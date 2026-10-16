// A 상단: 선택한 협력사의 평가 요약 카드 (다크 테마)
import { useState } from "react";
import { LuChevronDown, LuChevronRight, LuCircleAlert, LuCircleCheck, LuCircleDashed, LuMessageSquareText } from "react-icons/lu";
import { useStore } from "../store/store";
import { useAgent } from "../store/agent";
import { EVAL_CONFIG } from "../lib/evaluation";
import { fmtNum } from "../lib/format";

function Donut({ value, grade }: { value: number | null; grade: string | null }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg className="donut" viewBox="0 0 108 108" role="img" aria-label={grade ? `${grade}등급, 종합 ${fmtNum(value)}점` : "평가 불가"}>
      <circle cx="54" cy="54" r={r} className="donut-track" />
      <circle cx="54" cy="54" r={r} className="donut-arc" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 54 54)" />
      <text x="54" y="52" className="donut-grade" textAnchor="middle">
        {grade ?? "–"}
      </text>
      <text x="54" y="72" className="donut-sub" textAnchor="middle">
        {value === null ? "산정 불가" : `종합 ${fmtNum(value)}점`}
      </text>
    </svg>
  );
}

const STEP_ICON = {
  done: <LuCircleCheck aria-hidden />,
  warn: <LuCircleAlert aria-hidden />,
  todo: <LuCircleDashed aria-hidden />,
};

export function SupplierEvaluationCard() {
  const { state, derived, dispatch } = useStore();
  const { ask } = useAgent();
  const [open, setOpen] = useState(false);
  const sid = state.selection.supplierId;
  const sup = sid ? derived.suppliersById.get(sid) : undefined;
  const ev = sid ? derived.evaluations.get(sid) : undefined;

  return (
    <section className="eval-card" aria-labelledby="eval-title">
      <div className="eval-head">
        <div>
          <p className="eval-eyebrow">AI Scoring Agent</p>
          <h2 id="eval-title">AI 에이전트 자동 채점·평가</h2>
          <p className="eval-sub">ISO 9001 관련 품질관리 원칙을 참고한 협력사 평가 항목 및 근거 분석</p>
        </div>
        <span className="eval-tag">{state.meta.isSample ? "SAMPLE" : "업로드 데이터"}</span>
      </div>

      <div className="eval-picker">
        <label htmlFor="eval-supplier">평가 대상</label>
        <select id="eval-supplier" value={sid ?? ""} onChange={(e) => dispatch({ type: "selectSupplier", supplierId: e.target.value })}>
          {derived.supplierViews.map((s) => (
            <option key={s.supplierId} value={s.supplierId}>
              {s.name} ({s.supplierId})
            </option>
          ))}
        </select>
      </div>

      {!sup || !ev ? (
        <p className="eval-empty">협력업체 데이터가 없습니다. 상단의 데이터 불러오기로 협력업체 파일을 올려 주세요.</p>
      ) : (
        <>
          <div className="eval-body">
            <Donut value={ev.total} grade={ev.grade} />
            <ul className="eval-bars">
              {ev.criteria.map((c) => (
                <li key={c.key}>
                  <span className="eval-bar-label">{c.label}</span>
                  <span className="eval-bar-track" aria-hidden>
                    <span className={`eval-bar-fill ${c.score === null ? "is-missing" : ""}`} style={{ width: `${c.score ?? 0}%` }} />
                  </span>
                  <span className="eval-bar-val">{c.score === null ? "누락" : fmtNum(c.score, 0)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="eval-basis">
            <button type="button" className="eval-basis-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? <LuChevronDown aria-hidden /> : <LuChevronRight aria-hidden />}
              <span className="eval-basis-key">AI 평가 근거</span>
              <span className="eval-basis-sum">
                정량 지표 {ev.criteria.filter((c) => c.score !== null).length}개 반영
                {ev.missing.length ? ` · 추가 확인 ${ev.missing.length}건` : ""} → 담당자 검토 후 확정
              </span>
            </button>
            {open && (
              <div className="eval-basis-body">
                <ul>
                  {ev.criteria.map((c) => (
                    <li key={c.key}>
                      <b>
                        {c.label} ({c.weight})
                      </b>{" "}
                      {c.basis}
                      <span className="eval-src">출처: {c.source}</span>
                    </li>
                  ))}
                </ul>
                {(ev.missing.length > 0 || ev.notes.length > 0) && (
                  <div className="eval-missing">
                    <b>추가 확인 필요</b>
                    <ul>
                      {[...ev.missing, ...ev.notes].map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="eval-note">
                  {EVAL_CONFIG.name} · 등급 기준 A ≥ 85, B ≥ 75, C ≥ 65. ISO 9001은 외부 공급자 평가를 요구하지만 등급·가중치를 정하지 않으므로 이 점수는 공식 인증 점수가 아닙니다.
                </p>
                <button type="button" className="eval-ask" onClick={() => ask(`${sup.name}의 평가 근거를 정리해 줘`)} disabled={state.busy}>
                  <LuMessageSquareText aria-hidden /> 챗봇에서 근거 리포트 만들기
                </button>
              </div>
            )}
          </div>

          <ol className="eval-steps" aria-label="평가 처리 단계">
            {ev.steps.map((st) => (
              <li key={st.label} className={`step step-${st.status}`} title={st.detail}>
                {STEP_ICON[st.status]}
                <span>{st.label}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
