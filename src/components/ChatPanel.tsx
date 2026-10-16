// B: AI 챗봇 — 질문 → 요약 + 데이터 출처 → 결과 형식 추천 → 선택하면 C에 표시
import { useEffect, useRef, useState } from "react";
import { LuArrowUp, LuBot, LuCheck, LuCircleDashed, LuDatabase, LuEraser, LuLoaderCircle } from "react-icons/lu";
import { STEPS } from "../ai/agent";
import { useStore, type ChatMessage } from "../store/store";
import { useAgent } from "../store/agent";
import { KeywordSearch } from "./KeywordSearch";
import { TemplateSelector } from "./TemplateSelector";
import { Chip } from "./ui";
import { templateLabel } from "../templates/registry";

function EngineBadge({ engine }: { engine: string }) {
  if (engine === "rule") return <span className="engine engine-rule">규칙 기반 데모 응답</span>;
  if (engine === "llm") return <span className="engine engine-llm">LLM 해석 · 계산은 코드</span>;
  return null;
}

function Assistant({ m }: { m: Extract<ChatMessage, { role: "assistant" }> }) {
  const { state } = useStore();
  const { ask, choose } = useAgent();
  const result = m.resultId ? state.results[m.resultId] : undefined;
  // 후속 질문이면 직전에 보던 형식을 "유지" 선택지로 맨 앞에 둔다
  const keep = m.followup ? m.keep ?? null : null;
  return (
    <div className="msg msg-ai">
      <div className="msg-avatar" aria-hidden>
        <LuBot />
      </div>
      <div className="msg-body">
        <EngineBadge engine={m.engine} />
        {m.text.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        {result && (
          <>
            <p className="msg-sources">
              <LuDatabase aria-hidden />
              사용 데이터:{" "}
              {result.sources
                .filter((s) => s.ids.length)
                .map((s) => `${s.label} ${s.ids.length}건`)
                .join(" · ")}{" "}
              · 기준일 {result.asOf} · {result.dataLabel}
            </p>
            <TemplateSelector result={result} chosen={m.chosen} keep={keep} onChoose={(t) => choose(m.id, result.id, t)} />
            {m.chosen && (
              <p className="msg-chosen">
                <LuCheck aria-hidden /> {templateLabel(m.chosen, result.kind)} 형식으로 C 영역에 표시했습니다. 다른 형식을 누르면 바로 바뀝니다.
              </p>
            )}
          </>
        )}
        {m.options && (
          <div className="opt-chips" role="group" aria-label="선택지">
            {m.options.map((o) => (
              <button type="button" key={o.id} className={`opt-chip ${m.answered === o.label ? "is-chosen" : ""}`} onClick={() => ask(o.label, { answeringId: m.id })} disabled={state.busy || !!m.answered}>
                <span>{o.label}</span>
                {o.sub && <small>{o.sub}</small>}
              </button>
            ))}
          </div>
        )}
        {m.suggestions && (
          <div className="suggest" role="group" aria-label="질문 예시">
            {m.suggestions.map((s) => (
              <button type="button" key={s} className="suggest-chip" onClick={() => ask(s)} disabled={state.busy}>
                {s}
              </button>
            ))}
          </div>
        )}
        {m.engineNote && <p className="msg-note">{m.engineNote}</p>}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { state, derived, dispatch } = useStore();
  const { ask } = useAgent();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages.length, state.busy]);

  const send = () => {
    if (!text.trim() || state.busy) return;
    const q = text;
    setText("");
    ask(q);
  };

  const item = state.selection.itemCode ? derived.itemsByCode.get(state.selection.itemCode) : null;
  const sup = state.selection.supplierId ? derived.suppliersById.get(state.selection.supplierId) : null;

  return (
    <>
      <div className="panel-head">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <span className="panel-key">B</span>AI 챗봇 · 분석 요청
          </h2>
          <button type="button" className="icon-btn" onClick={() => dispatch({ type: "clearChat" })} title="대화 지우기" aria-label="대화 지우기">
            <LuEraser aria-hidden />
          </button>
        </div>
        <KeywordSearch />
      </div>
      <div className="panel-body chat-list" ref={listRef} aria-live="polite">
        {state.messages.map((m) =>
          m.role === "user" ? (
            <div className="msg msg-user" key={m.id}>
              <p>{m.text}</p>
            </div>
          ) : (
            <Assistant key={m.id} m={m} />
          ),
        )}
        {state.busy && (
          <div className="msg msg-ai">
            <div className="msg-avatar" aria-hidden>
              <LuBot />
            </div>
            <ol className="progress" aria-label="분석 진행 상태">
              {STEPS.map((s, i) => (
                <li key={s} className={i < state.progress ? "done" : i === state.progress ? "now" : ""}>
                  {i < state.progress ? <LuCheck aria-hidden /> : i === state.progress ? <LuLoaderCircle aria-hidden className="spin" /> : <LuCircleDashed aria-hidden />}
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <div className="composer">
        <div className="ctx-chips" aria-label="질문 문맥">
          <span className="ctx-label">문맥</span>
          {item ? (
            <Chip tone="accent" onRemove={() => dispatch({ type: "clearSelection", what: "item" })}>
              품목 · {item.name}
            </Chip>
          ) : (
            <span className="ctx-empty">선택한 품목 없음</span>
          )}
          {sup && (
            <Chip onRemove={() => dispatch({ type: "clearSelection", what: "supplier" })}>
              협력사 · {sup.name}
            </Chip>
          )}
        </div>
        <form
          className="composer-form"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            분석 질문
          </label>
          <textarea
            id="chat-input"
            rows={2}
            placeholder="분석할 내용을 질문하세요 · 예: 해당 품목의 과거 거래 업체를 비교해 줘"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" className="send-btn" disabled={state.busy || !text.trim()} aria-label="질문 보내기">
            <LuArrowUp aria-hidden />
          </button>
        </form>
      </div>
    </>
  );
}
