// 템플릿 ③: 종합 평가 카드 — 대상별 점수, 강점, 위험 요소, 근거
import { LuCircleAlert, LuCircleCheck } from "react-icons/lu";
import type { AnalysisResult } from "../../lib/analysisTypes";
import { formatCell, GradeBadge } from "../ui";
import { fmtNum } from "../../lib/format";
import { Highlights } from "./shared";

export function SupplierScoreCard({ result }: { result: AnalysisResult }) {
  const colOf = (k: string) => result.columns.find((c) => c.key === k);
  return (
    <div className="tpl tpl-cards">
      <Highlights result={result} />
      <div className="score-cards">
        {result.rows.map((r) => {
          const grade = r.values.grade as string | null | undefined;
          const score = r.values.score ?? r.values.total;
          return (
            <article key={r.id} className={`score-card ${r.rank === 1 ? "is-top" : ""} ${r.excludedReason ? "is-excluded" : ""}`}>
              <header>
                <div>
                  <h4>{r.label}</h4>
                  {r.sub && <span className="code">{r.sub}</span>}
                </div>
                <div className="score-card-badges">
                  {r.rank ? <span className="rank-badge">{result.rankLabel ?? "순서"} {r.rank}</span> : r.excludedReason ? <span className="cond-flag">순위 제외</span> : null}
                  {grade !== undefined && <GradeBadge grade={grade} size="md" />}
                </div>
              </header>
              {score !== undefined && score !== null && (
                <p className="score-line">
                  <span className="score-num">{fmtNum(Number(score))}</span>
                  <span className="muted">{r.values.score !== undefined ? "검토 점수" : "종합 점수"}</span>
                </p>
              )}
              <dl className="card-metrics">
                {result.cardMetrics.map((k) => {
                  const c = colOf(k);
                  if (!c) return null;
                  return (
                    <div key={k}>
                      <dt>{c.label}</dt>
                      <dd>{formatCell(c.kind, r.values[k], r.currency, c.digits)}</dd>
                    </div>
                  );
                })}
              </dl>
              {r.strengths.length > 0 && (
                <ul className="pros">
                  {r.strengths.map((s) => (
                    <li key={s}>
                      <LuCircleCheck aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              )}
              {r.risks.length > 0 && (
                <ul className="cons">
                  {r.risks.map((s) => (
                    <li key={s}>
                      <LuCircleAlert aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              )}
              {r.evidence.length > 0 && (
                <details className="evidence">
                  <summary>관련 평가 근거</summary>
                  <ul>
                    {r.evidence.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </div>
      <p className="small muted">카드 순서와 점수는 검토용 참고값입니다. 최종 선정과 판단은 담당자가 검토 후 확정합니다.</p>
    </div>
  );
}
