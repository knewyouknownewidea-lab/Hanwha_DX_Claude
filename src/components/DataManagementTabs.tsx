// A 하단: 4개 데이터 탭 — 표, 검색·필터·정렬, 행 상세, 업로드
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LuMessageSquareText, LuRotateCcw, LuSearch, LuUpload, LuX } from "react-icons/lu";
import { TAB_LABEL, type TabKey } from "../data/types";
import { useStore } from "../store/store";
import { useAgent } from "../store/agent";
import { DataTable, type Col } from "./DataTable";
import { GradeBadge, StatusPill } from "./ui";
import { fmtDate, fmtInt, fmtMoney, fmtNum, fmtPct, fmtSignedPct } from "../lib/format";
import type { ContractView, InventoryView, POView, SupplierView } from "../lib/metrics";
import { EVAL_CONFIG } from "../lib/evaluation";

const TABS: TabKey[] = ["suppliers", "purchaseOrders", "contracts", "inventory"];

const FILTERS: Record<TabKey, { id: string; label: string }[]> = {
  suppliers: [
    { id: "all", label: "전체 등급" },
    { id: "A", label: "A등급" },
    { id: "B", label: "B등급" },
    { id: "C", label: "C등급" },
    { id: "D", label: "D등급" },
  ],
  purchaseOrders: [
    { id: "all", label: "전체 상태" },
    { id: "진행 중", label: "진행 중" },
    { id: "납기 지연", label: "납기 지연" },
    { id: "지연입고", label: "지연입고" },
    { id: "입고완료", label: "입고완료" },
  ],
  contracts: [
    { id: "all", label: "전체 계약" },
    { id: "up", label: `${EVAL_CONFIG.priceIncreaseThreshold}% 이상 상승` },
    { id: "expiring", label: "60일 안에 종료" },
  ],
  inventory: [
    { id: "all", label: "전체 품목" },
    { id: "risk", label: "미달·지연만" },
  ],
};

const Code = ({ children }: { children: ReactNode }) => <span className="code">{children}</span>;
const NameCell = ({ name, code }: { name: string; code: string }) => (
  <span className="name-cell">
    <span className="name">{name}</span>
    <Code>{code}</Code>
  </span>
);

const matches = (q: string, ...fields: (string | number | null | undefined)[]) => {
  if (!q) return true;
  const t = fields.join(" ").toLowerCase().replace(/\s+/g, "");
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => t.includes(tok));
};

function Detail({ title, fields, actions, onClose }: { title: string; fields: [string, ReactNode][]; actions?: ReactNode; onClose: () => void }) {
  return (
    <section className="row-detail" aria-label={`${title} 상세`}>
      <div className="row-detail-head">
        <h3>{title}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="상세 닫기">
          <LuX aria-hidden />
        </button>
      </div>
      <dl className="kv">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v ?? "–"}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="row-detail-actions">{actions}</div>}
    </section>
  );
}

export function DataManagementTabs() {
  const { state, derived, dispatch } = useStore();
  const { ask } = useAgent();
  const [query, setQuery] = useState<Record<TabKey, string>>({ suppliers: "", purchaseOrders: "", contracts: "", inventory: "" });
  const [filter, setFilter] = useState<Record<TabKey, string>>({ suppliers: "all", purchaseOrders: "all", contracts: "all", inventory: "all" });
  const tab = state.tab;
  const q = query[tab];
  const f = filter[tab];
  const sel = state.selection;
  const selectedKey = sel.rowTab === tab ? sel.rowKey : null;
  const itemName = (code: string) => derived.itemsByCode.get(code)?.name ?? code;

  // 검색 등으로 선택이 바뀌면 선택 행이 보이도록 스크롤
  useEffect(() => {
    if (!selectedKey) return;
    const t = setTimeout(() => document.querySelector(".data-table tr.is-selected")?.scrollIntoView({ block: "nearest" }), 30);
    return () => clearTimeout(t);
  }, [selectedKey, tab]);

  const counts: Record<TabKey, number> = {
    suppliers: derived.supplierViews.length,
    purchaseOrders: derived.poViews.length,
    contracts: derived.contractViews.length,
    inventory: derived.inventoryViews.length,
  };

  const askItem = (code: string) => ask(`${itemName(code)}의 과거 거래 업체를 등급, 납기 실적, 최근 단가와 함께 비교해 줘`);
  const askSupplier = (name: string) => ask(`${name}의 평가 근거를 정리해 줘`);
  const close = () => dispatch({ type: "clearSelection", what: "row" });

  const view = useMemo(() => {
    if (tab === "suppliers") {
      const rows = derived.supplierViews.filter(
        (s) => (f === "all" || s.evalGrade === f) && matches(q, s.name, s.supplierId, s.process, s.region, s.items.map(itemName).join(" "), s.items.join(" ")),
      );
      const cols: Col<SupplierView>[] = [
        { key: "name", label: "협력사", render: (s) => <NameCell name={s.name} code={s.supplierId} />, sort: (s) => s.name, sticky: true },
        { key: "grade", label: "평가등급", render: (s) => <GradeBadge grade={s.evalGrade} />, sort: (s) => s.evalGrade ?? "Z" },
        { key: "quality", label: "품질 점수", render: (s) => fmtNum(s.qualityScore ?? null, 0), sort: (s) => s.qualityScore ?? null, num: true },
        { key: "ontime", label: "납기 준수율", render: (s) => fmtPct(s.onTimeRate), sort: (s) => s.onTimeRate, num: true },
        { key: "defect", label: "불량률", render: (s) => fmtPct(s.defectRate ?? null), sort: (s) => s.defectRate ?? null, num: true },
        { key: "items", label: "공급 가능 품목", render: (s) => <span className="clip">{s.items.map(itemName).join(", ") || "–"}</span>, sort: (s) => s.items.length },
        { key: "trade", label: "최근 거래일", render: (s) => fmtDate(s.tradeDate), sort: (s) => s.tradeDate },
        { key: "hist", label: "평가 이력", render: (s) => (s.evalHistory.length ? s.evalHistory.map((h) => `${String(h.year).slice(2)}·${h.grade}`).join("  ") : "–") },
      ];
      return { rows, cols, key: (s: SupplierView) => s.supplierId } as const;
    }
    if (tab === "purchaseOrders") {
      const rows = derived.poViews.filter((p) => (f === "all" || p.status === f) && matches(q, p.poNo, p.itemName, p.itemCode, p.supplierName, p.supplierId, p.status));
      const cols: Col<POView>[] = [
        { key: "po", label: "발주번호", render: (p) => <Code>{p.poNo}</Code>, sort: (p) => p.poNo, sticky: true },
        { key: "item", label: "품목", render: (p) => <NameCell name={p.itemName} code={p.itemCode} />, sort: (p) => p.itemName },
        { key: "sup", label: "발주 업체", render: (p) => p.supplierName, sort: (p) => p.supplierName },
        { key: "qty", label: "수량", render: (p) => fmtInt(p.qty), sort: (p) => p.qty, num: true },
        { key: "order", label: "발주 일자", render: (p) => p.orderDate, sort: (p) => p.orderDate },
        { key: "due", label: "납기 예정일", render: (p) => p.dueDate, sort: (p) => p.dueDate },
        { key: "recv", label: "실제 입고일", render: (p) => fmtDate(p.receivedDate), sort: (p) => p.receivedDate },
        { key: "status", label: "상태", render: (p) => <StatusPill value={p.status} />, sort: (p) => p.status },
      ];
      return { rows, cols, key: (p: POView) => p.poNo, initialSort: { key: "order", dir: "desc" as const } } as const;
    }
    if (tab === "contracts") {
      const rows = derived.contractViews.filter(
        (c) =>
          (f === "all" || (f === "up" && (c.changeRate ?? 0) >= EVAL_CONFIG.priceIncreaseThreshold) || (f === "expiring" && c.expiresInDays !== null && c.expiresInDays <= 60)) &&
          matches(q, c.contractId, c.itemName, c.itemCode, c.supplierName, c.supplierId, c.deliveryTerms, c.paymentTerms, c.currency),
      );
      const cols: Col<ContractView>[] = [
        { key: "item", label: "품목", render: (c) => <NameCell name={c.itemName} code={c.itemCode} />, sort: (c) => c.itemName, sticky: true },
        { key: "sup", label: "거래 협력사", render: (c) => c.supplierName, sort: (c) => c.supplierName },
        { key: "price", label: "최근 단가", render: (c) => fmtMoney(c.unitPrice, c.currency), sort: (c) => c.unitPrice, num: true },
        { key: "prev", label: "과거 단가", render: (c) => fmtMoney(c.prevUnitPrice ?? null, c.currency), sort: (c) => c.prevUnitPrice ?? null, num: true },
        {
          key: "chg",
          label: "변동률",
          render: (c) => <span className={(c.changeRate ?? 0) >= EVAL_CONFIG.priceIncreaseThreshold ? "delta-up" : ""}>{fmtSignedPct(c.changeRate)}</span>,
          sort: (c) => c.changeRate,
          num: true,
        },
        { key: "term", label: "계약 기간", render: (c) => `${c.startDate ?? "–"} ~ ${c.endDate ?? "–"}`, sort: (c) => c.endDate },
        { key: "cond", label: "계약 조건", render: (c) => <span className="clip">{[c.deliveryTerms, c.paymentTerms].filter(Boolean).join(" · ")}</span> },
        { key: "cur", label: "통화", render: (c) => c.currency, sort: (c) => c.currency },
      ];
      return { rows, cols, key: (c: ContractView) => c.contractId } as const;
    }
    const rows = derived.inventoryViews.filter((v) => (f === "all" || v.status !== "정상") && matches(q, v.itemCode, v.itemName, v.supplierName, v.location, v.status));
    const cols: Col<InventoryView>[] = [
      { key: "code", label: "품목코드", render: (v) => <Code>{v.itemCode}</Code>, sort: (v) => v.itemCode, sticky: true },
      { key: "name", label: "자재명", render: (v) => v.itemName, sort: (v) => v.itemName },
      { key: "sup", label: "공급 업체", render: (v) => v.supplierName, sort: (v) => v.supplierName },
      { key: "stock", label: "현재 재고", render: (v) => fmtInt(v.stockQty), sort: (v) => v.stockQty, num: true },
      { key: "safe", label: "안전재고", render: (v) => fmtInt(v.safetyStock), sort: (v) => v.safetyStock, num: true },
      { key: "open", label: "발주 잔량", render: (v) => fmtInt(v.openOrderQty), sort: (v) => v.openOrderQty, num: true },
      { key: "exp", label: "예상 입고일", render: (v) => fmtDate(v.expectedDate), sort: (v) => v.expectedDate },
      { key: "status", label: "공급 지연 여부", render: (v) => <StatusPill value={v.status} />, sort: (v) => v.status },
    ];
    return { rows, cols, key: (v: InventoryView) => v.itemCode } as const;
  }, [tab, derived, q, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelect = (r: unknown) => {
    if (tab === "suppliers") {
      const s = r as SupplierView;
      dispatch({ type: "selectRow", tab, rowKey: s.supplierId, supplierId: s.supplierId });
    } else if (tab === "purchaseOrders") {
      const p = r as POView;
      dispatch({ type: "selectRow", tab, rowKey: p.poNo, supplierId: p.supplierId, itemCode: p.itemCode });
    } else if (tab === "contracts") {
      const c = r as ContractView;
      dispatch({ type: "selectRow", tab, rowKey: c.contractId, supplierId: c.supplierId, itemCode: c.itemCode });
    } else {
      const v = r as InventoryView;
      dispatch({ type: "selectRow", tab, rowKey: v.itemCode, itemCode: v.itemCode, supplierId: v.mainSupplierId ?? undefined });
    }
  };

  let detail: ReactNode = null;
  if (selectedKey) {
    if (tab === "suppliers") {
      const s = derived.supplierViews.find((x) => x.supplierId === selectedKey);
      const ev = s && derived.evaluations.get(s.supplierId);
      const del = s && derived.supplierDelivery.get(s.supplierId);
      if (s && ev)
        detail = (
          <Detail
            title={`${s.name} · ${s.supplierId}`}
            onClose={close}
            fields={[
              ["평가등급(산정)", <><GradeBadge grade={ev.grade} /> {fmtNum(ev.total)}점</>],
              ["심사 등급(입력)", s.auditGrade ? `${s.auditGrade} · ${s.lastAuditDate ?? ""}` : "–"],
              ["공정 · 지역", `${s.process ?? "–"} · ${s.region ?? "–"}`],
              ["납기", del ? `마감 ${del.evaluated}건 중 기한 내 ${del.onTime}건 (${fmtPct(del.rate)})` : "–"],
              ["진행 중 발주", del ? `${del.open}건 · 납기 경과 ${del.overdueOpen}건` : "–"],
              ["공급 가능 품목", s.items.map(itemName).join(", ") || "–"],
              ["평가 이력", s.evalHistory.map((h) => `${h.year} ${h.grade}(${h.score})`).join(" → ") || "–"],
            ]}
            actions={
              <button type="button" className="btn btn-quiet" onClick={() => askSupplier(s.name)} disabled={state.busy}>
                <LuMessageSquareText aria-hidden /> 평가 근거 분석 요청
              </button>
            }
          />
        );
    } else if (tab === "purchaseOrders") {
      const p = derived.poViews.find((x) => x.poNo === selectedKey);
      if (p)
        detail = (
          <Detail
            title={`${p.poNo} · ${p.itemName}`}
            onClose={close}
            fields={[
              ["발주 업체", `${p.supplierName} (${p.supplierId})`],
              ["수량 · 단가", `${fmtInt(p.qty)} × ${fmtMoney(p.unitPrice ?? null, p.currency)}`],
              ["발주 → 납기", `${p.orderDate} → ${p.dueDate}`],
              ["입고", p.receivedDate ? `${p.receivedDate}${p.delayDays ? ` (${p.delayDays}일 지연)` : " (기한 내)"}` : p.status === "납기 지연" ? `미입고 · 납기 후 ${p.delayDays}일 경과` : "미입고 (진행 중)"],
              ["상태", <StatusPill value={p.status} />],
            ]}
            actions={
              <button type="button" className="btn btn-quiet" onClick={() => askItem(p.itemCode)} disabled={state.busy}>
                <LuMessageSquareText aria-hidden /> 이 품목 후보 업체 비교
              </button>
            }
          />
        );
    } else if (tab === "contracts") {
      const c = derived.contractViews.find((x) => x.contractId === selectedKey);
      if (c)
        detail = (
          <Detail
            title={`${c.contractId} · ${c.itemName}`}
            onClose={close}
            fields={[
              ["거래 협력사", `${c.supplierName} (${c.supplierId})`],
              ["규격", c.spec ?? "–"],
              ["단가", `${fmtMoney(c.prevUnitPrice ?? null, c.currency)} → ${fmtMoney(c.unitPrice, c.currency)} (${fmtSignedPct(c.changeRate)})`],
              ["계약 기간", `${c.startDate ?? "–"} ~ ${c.endDate ?? "–"}${c.expiresInDays !== null ? ` · 종료까지 ${c.expiresInDays}일` : ""}`],
              ["인도 · 결제 조건", `${c.deliveryTerms ?? "–"} · ${c.paymentTerms ?? "–"}`],
            ]}
            actions={
              <button type="button" className="btn btn-quiet" onClick={() => askItem(c.itemCode)} disabled={state.busy}>
                <LuMessageSquareText aria-hidden /> 이 품목 후보 업체 비교
              </button>
            }
          />
        );
    } else {
      const v = derived.inventoryViews.find((x) => x.itemCode === selectedKey);
      if (v)
        detail = (
          <Detail
            title={`${v.itemName} · ${v.itemCode}`}
            onClose={close}
            fields={[
              ["재고 / 안전재고", `${fmtInt(v.stockQty)} / ${fmtInt(v.safetyStock)} ${v.unit}${v.shortage ? ` (부족 ${v.shortage})` : ""}`],
              ["발주 잔량", `${fmtInt(v.openOrderQty)} ${v.unit}${v.overdueOpen ? ` · 납기 경과 ${v.overdueOpen}건` : ""}`],
              ["예상 입고일", fmtDate(v.expectedDate)],
              ["주 공급업체", v.supplierName],
              ["보관 위치", v.location ?? "–"],
            ]}
            actions={
              <button type="button" className="btn btn-quiet" onClick={() => askItem(v.itemCode)} disabled={state.busy}>
                <LuMessageSquareText aria-hidden /> 이 품목 후보 업체 비교
              </button>
            }
          />
        );
    }
  }

  return (
    <section className="data-tabs" aria-label="데이터 관리">
      <div className="tabs" role="tablist" aria-label="데이터 종류">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls="tab-panel" className={`tab ${tab === t ? "is-active" : ""}`} onClick={() => dispatch({ type: "tab", tab: t })}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="data-toolbar">
        <label className="search-field">
          <LuSearch aria-hidden />
          <input id={`filter-${tab}`} type="search" placeholder={`${TAB_LABEL[tab]}에서 찾기`} value={q} onChange={(e) => setQuery({ ...query, [tab]: e.target.value })} />
        </label>
        <select id={`select-${tab}`} aria-label="필터" value={f} onChange={(e) => setFilter({ ...filter, [tab]: e.target.value })}>
          {FILTERS[tab].map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "openImport", dataset: tab })}>
          <LuUpload aria-hidden /> 업로드
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            dispatch({ type: "resetSample" });
            dispatch({ type: "toast", text: "샘플 데이터를 다시 불러왔습니다" });
          }}
          title="샘플 데이터 불러오기"
          aria-label="샘플 데이터 불러오기"
        >
          <LuRotateCcw aria-hidden />
        </button>
      </div>
      <div className="data-meta">
        <span className="badge-demo">{state.meta.isSample ? "SAMPLE" : "업로드 포함"}</span>
        <span>
          {view.rows.length.toLocaleString()} / {counts[tab].toLocaleString()}행 · 출처 {state.meta.sources[tab] ?? "–"} · 기준일 {state.meta.asOf}
        </span>
      </div>
      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <DataTable
          key={tab}
          label={`${TAB_LABEL[tab]} 표`}
          rows={view.rows as unknown[]}
          cols={view.cols as Col<unknown>[]}
          rowKey={view.key as (r: unknown) => string}
          selectedKey={selectedKey}
          onSelect={onSelect}
          initialSort={"initialSort" in view ? view.initialSort : undefined}
          empty={q || f !== "all" ? "조건에 맞는 행이 없습니다. 검색어나 필터를 바꿔 보세요." : "데이터가 없습니다. 업로드로 파일을 추가하세요."}
        />
      </div>
      {detail}
    </section>
  );
}
