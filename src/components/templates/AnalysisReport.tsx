// 템플릿 ④: 분석 보고서 — 인쇄(로컬) 또는 HTML 저장(아티팩트)용 문서
import { forwardRef } from "react";
import type { AnalysisResult } from "../../lib/analysisTypes";
import { formatCell, isNumericKind } from "../ui";

export const AnalysisReport = forwardRef<HTMLElement, { result: AnalysisResult }>(function AnalysisReport({ result }, ref) {
  const cols = result.columns.filter((c) => c.primary);
  const hasRank = result.rows.some((r) => r.rank);
  const created = new Date(result.createdAt);
  return (
    <article className="tpl report-doc" ref={ref}>
      <header className="report-head">
        <p className="report-kicker">분석 보고서 · {result.kindLabel}</p>
        <h1>{result.title}</h1>
        <p className="muted small">
          작성: AI 분석 도우미 초안 · {created.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })} · 데이터 기준일 {result.asOf} · {result.dataLabel}
        </p>
      </header>

      <section>
        <h2>1. 분석 목적</h2>
        <p>{result.purpose}</p>
        <p className="muted small">요청 질문: “{result.question}”</p>
      </section>

      <section>
        <h2>2. 분석 조건 · 대상 및 데이터 범위</h2>
        <table>
          <tbody>
            {result.scope.map((s) => (
              <tr key={s.label}>
                <th scope="row">{s.label}</th>
                <td>{s.value}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">사용 데이터</th>
              <td>
                {result.sources
                  .filter((s) => s.ids.length)
                  .map((s) => `${s.label} ${s.ids.length}건`)
                  .join(" · ")}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. 주요 분석 결과</h2>
        <ul>
          {result.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>4. 비교 결과</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {hasRank && <th className="num">{result.rankLabel ?? "순서"}</th>}
                <th>대상</th>
                {cols.map((c) => (
                  <th key={c.key} className={isNumericKind(c) ? "num" : ""}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id}>
                  {hasRank && <td className="num">{r.rank ?? "제외"}</td>}
                  <td>
                    {r.label}
                    {r.excludedReason ? ` (조건 상이: ${r.excludedReason})` : ""}
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={isNumericKind(c) ? "num" : ""}>
                      {c.kind === "grade" ? String(r.values[c.key] ?? "–") : formatCell(c.kind, r.values[c.key], r.currency, c.digits)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {result.risks.length > 0 && (
        <section>
          <h2>5. 위험 요소</h2>
          <ul>
            {result.risks.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>{result.risks.length ? 6 : 5}. 검토 의견 (초안)</h2>
        <ul>
          {result.reviewPoints.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>이 보고서는 기록된 데이터로 계산한 비교 결과입니다. 최종 선정과 조치는 담당자가 검토 후 확정합니다.</li>
        </ul>
      </section>

      <section>
        <h2>{result.risks.length ? 7 : 6}. 사용된 평가 근거 · 참조 데이터</h2>
        <ul>
          {result.basis.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {result.notes.length > 0 && <p className="muted small">참고: {result.notes.join(" · ")}</p>}
        <p className="muted small">
          참조 레코드:{" "}
          {result.sources
            .filter((s) => s.ids.length)
            .map((s) => `${s.label} ${s.ids.slice(0, 6).join(", ")}${s.ids.length > 6 ? ` 외 ${s.ids.length - 6}건` : ""}`)
            .join(" / ")}
        </p>
      </section>
    </article>
  );
});
