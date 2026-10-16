// 템플릿 ①: 정렬 가능한 비교표 + 요약·위험·근거
import { useMemo, useState } from "react";
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from "react-icons/lu";
import type { AnalysisResult, ResultColumn, ResultRow } from "../../lib/analysisTypes";
import { formatCell, isNumericKind } from "../ui";
import { Findings, Highlights } from "./shared";

function bestIds(result: AnalysisResult, col: ResultColumn) {
  if (col.higherIsBetter === undefined) return new Set<string>();
  const rows = result.rows.filter((r) => !r.excludedReason && r.values[col.key] !== null && r.values[col.key] !== undefined);
  if (rows.length < 2) return new Set<string>();
  const vals = rows.map((r) => Number(r.values[col.key]));
  const target = col.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
  return new Set(rows.filter((r) => Number(r.values[col.key]) === target).map((r) => r.id));
}

export function ComparisonTable({ result }: { result: AnalysisResult }) {
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const cols = all ? result.columns : result.columns.filter((c) => c.primary);
  const hasRank = result.rows.some((r) => r.rank);
  const best = useMemo(() => new Map(result.columns.map((c) => [c.key, bestIds(result, c)])), [result]);

  const rows = useMemo(() => {
    if (!sort) return result.rows;
    const get = (r: ResultRow) => (sort.key === "__rank" ? r.rank ?? 999 : sort.key === "__label" ? r.label : r.values[sort.key]);
    return [...result.rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [result.rows, sort]);

  const toggle = (key: string, numeric: boolean) => setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: numeric && key !== "__rank" ? "desc" : "asc" }));
  const SortIcon = ({ k }: { k: string }) => (sort?.key === k ? sort.dir === "asc" ? <LuArrowUp aria-hidden /> : <LuArrowDown aria-hidden /> : <LuArrowUpDown aria-hidden className="th-sort-idle" />);

  return (
    <div className="tpl tpl-table">
      <Highlights result={result} />
      <div className="tpl-table-bar">
        <span className="small muted">
          {result.rows.length}개 대상 · 열 제목을 눌러 정렬 · <span className="best-mark">최고</span> 표시는 비교 가능한 대상 중 가장 좋은 값
        </span>
        {result.columns.some((c) => !c.primary) && (
          <button type="button" className="link-btn" onClick={() => setAll(!all)}>
            {all ? "주요 열만 보기" : `모든 열 보기 (+${result.columns.filter((c) => !c.primary).length})`}
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table className="result-table">
          <thead>
            <tr>
              {hasRank && (
                <th className="num" aria-sort={sort?.key === "__rank" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="th-sort" onClick={() => toggle("__rank", true)}>
                    {result.rankLabel ?? "순서"}
                    <SortIcon k="__rank" />
                  </button>
                </th>
              )}
              <th className="sticky-col">
                <button type="button" className="th-sort" onClick={() => toggle("__label", false)}>
                  대상
                  <SortIcon k="__label" />
                </button>
              </th>
              {cols.map((c) => (
                <th key={c.key} className={isNumericKind(c) ? "num" : ""} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="th-sort" onClick={() => toggle(c.key, isNumericKind(c))}>
                    {c.label}
                    <SortIcon k={c.key} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.excludedReason ? "is-excluded" : undefined}>
                {hasRank && <td className="num rank-cell">{r.rank ?? "–"}</td>}
                <td className="sticky-col">
                  <span className="name-cell">
                    <span className="name">{r.label}</span>
                    {r.excludedReason ? <span className="cond-flag">조건 상이 · 순위 제외</span> : r.sub ? <span className="code">{r.sub}</span> : null}
                  </span>
                </td>
                {cols.map((c) => {
                  const isBest = best.get(c.key)?.has(r.id);
                  return (
                    <td key={c.key} className={`${isNumericKind(c) ? "num" : ""} ${isBest ? "is-best" : ""}`}>
                      {formatCell(c.kind, r.values[c.key], r.currency, c.digits)}
                      {isBest && <span className="best-mark">최고</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.some((r) => r.excludedReason) && (
        <p className="small muted">
          조건 상이: {result.rows.filter((r) => r.excludedReason).map((r) => `${r.label}(${r.excludedReason})`).join(", ")} — 단순 가격 순위에 넣지 않았습니다.
        </p>
      )}
      <Findings result={result} />
    </div>
  );
}
