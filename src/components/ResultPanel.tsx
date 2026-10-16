// C: 선택한 템플릿으로 분석 결과를 표시 — 같은 결과를 템플릿만 바꿔 다시 그린다(재분석 없음)
import { useRef, useState, type ComponentType } from "react";
import { LuDatabase, LuFileDown, LuPrinter, LuRefreshCw, LuSheet, LuSparkles, LuTriangleAlert } from "react-icons/lu";
import type { AnalysisResult, TemplateId } from "../lib/analysisTypes";
import { TEMPLATES, templateLabel } from "../templates/registry";
import { useStore } from "../store/store";
import { useAgent } from "../store/agent";
import { toCSV } from "../lib/csv";
import { canPrint, printReport, reportDocument, saveFile } from "../platform/runtime";
import { ComparisonTable } from "./templates/ComparisonTable";
import { AnalyticsCharts } from "./templates/AnalyticsCharts";
import { SupplierScoreCard } from "./templates/SupplierScoreCard";
import { AnalysisReport } from "./templates/AnalysisReport";
import { SourceRecords } from "./templates/shared";
import { EmptyState } from "./ui";

const RENDERERS: Record<Exclude<TemplateId, "report">, ComponentType<{ result: AnalysisResult }>> = {
  table: ComparisonTable,
  chart: AnalyticsCharts,
  cards: SupplierScoreCard,
};

function csvOf(result: AnalysisResult) {
  const headers = [
    ...(result.rows.some((r) => r.rank) ? [{ key: "__rank", label: result.rankLabel ?? "순서" }] : []),
    { key: "__label", label: "대상" },
    { key: "__sub", label: "코드" },
    ...result.columns.map((c) => ({ key: c.key, label: c.label })),
    { key: "__currency", label: "통화" },
    { key: "__strengths", label: "강점" },
    { key: "__risks", label: "위험 요소" },
  ];
  const rows = result.rows.map((r) => ({
    __rank: r.rank ?? "",
    __label: r.label,
    __sub: r.sub ?? "",
    ...r.values,
    __currency: r.currency ?? "",
    __strengths: r.strengths.join(" / "),
    __risks: r.risks.join(" / "),
  }));
  return toCSV(headers, rows);
}

export function ResultPanel() {
  const { state, dispatch } = useStore();
  const { choose, rerun } = useAgent();
  const [showSrc, setShowSrc] = useState(false);
  const reportRef = useRef<HTMLElement>(null);
  const result = state.view.resultId ? state.results[state.view.resultId] : null;
  const tpl = state.view.template;
  const stale = result && result.dataVersion !== state.meta.version;
  const fileBase = result ? `${result.title.replace(/[\\/:*?"<>|\s]+/g, "_")}_${result.asOf}` : "";

  const exportCSV = async () => {
    if (!result) return;
    const r = await saveFile(`${fileBase}.csv`, csvOf(result), "text/csv;charset=utf-8");
    dispatch({ type: "toast", text: r === "saved" ? "표 데이터를 CSV로 저장했습니다" : r === "declined" ? "저장을 취소했습니다" : "이 화면에서는 파일 저장을 쓸 수 없습니다", tone: r === "saved" ? "ok" : "warn" });
  };
  const exportReport = async () => {
    if (!result) return;
    if (tpl !== "report") choose(null, result.id, "report");
    if (canPrint()) {
      setTimeout(printReport, 80);
      return;
    }
    setTimeout(async () => {
      const html = reportDocument(result.title, reportRef.current?.outerHTML ?? "");
      const r = await saveFile(`${fileBase}_보고서.html`, html, "text/html;charset=utf-8");
      dispatch({ type: "toast", text: r === "saved" ? "보고서를 HTML로 저장했습니다. 브라우저에서 열어 PDF로 인쇄할 수 있습니다" : r === "declined" ? "저장을 취소했습니다" : "이 화면에서는 파일 저장을 쓸 수 없습니다", tone: r === "saved" ? "ok" : "warn" });
    }, 80);
  };

  const Renderer = tpl && tpl !== "report" ? RENDERERS[tpl] : null;

  return (
    <>
      <div className="panel-head">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <span className="panel-key">C</span>분석 결과
          </h2>
          {result && (
            <div className="result-actions">
              <button type="button" className="icon-btn" onClick={() => rerun(result)} title="현재 데이터로 다시 분석" aria-label="다시 분석">
                <LuRefreshCw aria-hidden />
              </button>
              <button type="button" className="icon-btn" onClick={exportCSV} title="표 데이터 CSV 내보내기" aria-label="CSV 내보내기">
                <LuSheet aria-hidden />
              </button>
              <button type="button" className="icon-btn" onClick={exportReport} title={canPrint() ? "보고서 인쇄 또는 PDF 저장" : "보고서 HTML 저장"} aria-label={canPrint() ? "보고서 인쇄" : "보고서 저장"}>
                {canPrint() ? <LuPrinter aria-hidden /> : <LuFileDown aria-hidden />}
              </button>
              <button type="button" className={`icon-btn ${showSrc ? "is-on" : ""}`} onClick={() => setShowSrc(!showSrc)} title="관련 상세 데이터 보기" aria-label="근거 데이터 보기" aria-pressed={showSrc}>
                <LuDatabase aria-hidden />
              </button>
            </div>
          )}
        </div>
        {result && (
          <div className="seg" role="tablist" aria-label="결과 형식">
            {result.templates.map((id) => {
              const Icon = TEMPLATES[id].icon;
              return (
                <button key={id} type="button" role="tab" aria-selected={tpl === id} className={`seg-btn ${tpl === id ? "is-active" : ""}`} onClick={() => choose(null, result.id, id)} data-template={id} title={templateLabel(id, result.kind)}>
                  <Icon aria-hidden />
                  <span>{TEMPLATES[id].short}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="panel-body result-body">
        {!result || !tpl ? (
          <EmptyState title="분석 결과 대기 중" icon={<LuSparkles />}>
            <p>AI 챗봇에 질문하고 원하는 결과 형식을 선택하면 이곳에 분석 결과가 표시됩니다.</p>
            <ol className="how">
              <li>A에서 품목이나 협력사를 고르면 질문 문맥으로 쓰입니다</li>
              <li>B에 질문하면 AI가 데이터를 찾아 요약하고 결과 형식을 추천합니다</li>
              <li>형식을 고르면 C에 비교표·차트·카드·보고서가 만들어집니다</li>
            </ol>
          </EmptyState>
        ) : (
          <div className="result">
            {stale && (
              <div className="stale" role="status">
                <LuTriangleAlert aria-hidden />
                <span>분석 후 데이터가 바뀌었습니다. 지금 화면은 이전 데이터 기준입니다.</span>
                <button type="button" className="btn btn-small" onClick={() => rerun(result)}>
                  다시 분석
                </button>
              </div>
            )}
            {tpl !== "report" && (
              <header className="result-head">
                <p className="eyebrow">{result.kindLabel}</p>
                <h3>{result.title}</h3>
                <div className="scope">
                  {result.scope.map((s) => (
                    <span key={s.label} className="scope-item">
                      <b>{s.label}</b> {s.value}
                    </span>
                  ))}
                </div>
              </header>
            )}
            {showSrc && (
              <div className="src-panel">
                <p className="src-panel-title">관련 상세 데이터 · 이 결과를 계산한 원천 레코드</p>
                <SourceRecords result={result} />
              </div>
            )}
            {tpl === "report" ? <AnalysisReport result={result} ref={reportRef} /> : Renderer ? <Renderer result={result} /> : null}
            <p className="result-foot">최종 선정과 조치는 자동 확정되지 않습니다. 이 결과는 담당자 검토를 돕는 의사결정 지원 자료입니다.</p>
          </div>
        )}
      </div>
    </>
  );
}
