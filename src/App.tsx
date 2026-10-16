// MainDashboard: 상단 바 + A(데이터)·B(챗봇)·C(결과) 3분할
import { useEffect, type ReactNode } from "react";
import { LuDatabase, LuFileUp, LuMessagesSquare, LuPanelRight, LuRotateCcw } from "react-icons/lu";
import { StoreProvider, useStore, type Panel } from "./store/store";
import { AgentProvider, useAgent } from "./store/agent";
import { SupplierEvaluationCard } from "./components/SupplierEvaluationCard";
import { DataManagementTabs } from "./components/DataManagementTabs";
import { ChatPanel } from "./components/ChatPanel";
import { ResultPanel } from "./components/ResultPanel";
import { ImportDialog } from "./components/ImportDialog";

function AiStatus() {
  const { state, dispatch } = useStore();
  const { provider, providerChecked } = useAgent();
  const llmOn = state.aiMode === "llm" && !!provider;
  return (
    <div className="ai-status">
      <span className={`dot ${llmOn ? "dot-on" : provider ? "dot-ready" : "dot-off"}`} aria-hidden />
      <span className="ai-status-text">{!providerChecked ? "AI 연결 확인 중" : llmOn ? `LLM 연결됨 · ${provider!.label}` : provider ? "LLM 사용 가능 · 꺼짐" : "LLM 미연결 · 규칙 기반 데모"}</span>
      <div className="mode" role="radiogroup" aria-label="질문 해석 방식">
        <button type="button" role="radio" aria-checked={state.aiMode === "rule"} className={state.aiMode === "rule" ? "is-on" : ""} onClick={() => dispatch({ type: "aiMode", mode: "rule" })}>
          규칙 기반
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={state.aiMode === "llm"}
          className={state.aiMode === "llm" ? "is-on" : ""}
          disabled={!provider}
          title={provider ? "질문 해석에 LLM을 사용합니다. 수치 계산은 계속 코드가 합니다." : "LLM이 연결되지 않았습니다. README의 AI API 연결 방법을 참고하세요."}
          onClick={() => dispatch({ type: "aiMode", mode: "llm" })}
        >
          LLM 해석
        </button>
      </div>
    </div>
  );
}

function Topbar() {
  const { state, derived, dispatch } = useStore();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M4 17h3V9H4v8Zm6.5 0h3V5h-3v12Zm6.5 0h3v-6h-3v6Z" fill="currentColor" />
          </svg>
        </span>
        <div className="brand-text">
          <h1>구매·협력사 AI 분석 플랫폼</h1>
          <p>데이터 관리 → AI 분석 요청 → 결과 형식 선택 → 시각화</p>
        </div>
      </div>
      <div className="data-status" title={Object.entries(state.meta.sources).map(([k, v]) => `${k}: ${v}`).join("\n")}>
        <LuDatabase aria-hidden />
        <span className="badge-demo">{state.meta.isSample ? "SAMPLE" : "업로드 포함"}</span>
        <span>
          협력사 {derived.supplierViews.length} · 발주 {derived.poViews.length} · 계약 {derived.contractViews.length} · 품목 {derived.itemsByCode.size}
        </span>
        <span className="muted">기준일 {state.meta.asOf}</span>
      </div>
      <AiStatus />
      <div className="topbar-actions">
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "openImport", dataset: state.tab })}>
          <LuFileUp aria-hidden /> 데이터 불러오기
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            dispatch({ type: "resetSample" });
            dispatch({ type: "toast", text: "샘플 데이터를 다시 불러왔습니다" });
          }}
          title="SAMPLE 데이터로 초기화"
        >
          <LuRotateCcw aria-hidden />
          <span className="hide-sm">샘플 초기화</span>
        </button>
      </div>
    </header>
  );
}

const PANEL_TABS: { id: Panel; label: string; icon: ReactNode }[] = [
  { id: "A", label: "A 데이터", icon: <LuDatabase aria-hidden /> },
  { id: "B", label: "B 챗봇", icon: <LuMessagesSquare aria-hidden /> },
  { id: "C", label: "C 결과", icon: <LuPanelRight aria-hidden /> },
];

function Toast() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "clearToast" }), 3200);
    return () => clearTimeout(t);
  }, [state.toast, dispatch]);
  if (!state.toast) return null;
  return (
    <div className={`toast toast-${state.toast.tone}`} role="status" key={state.toast.id}>
      {state.toast.text}
    </div>
  );
}

function Workspace() {
  const { state, dispatch } = useStore();
  const hasResult = !!state.view.resultId;
  return (
    <>
      <nav className="panel-tabs" aria-label="화면 전환">
        {PANEL_TABS.map((p) => (
          <button key={p.id} type="button" className={state.panel === p.id ? "is-active" : ""} aria-pressed={state.panel === p.id} onClick={() => dispatch({ type: "panel", panel: p.id })}>
            {p.icon}
            {p.label}
            {p.id === "C" && hasResult && state.panel !== "C" && <i className="tab-dot" aria-label="새 결과" />}
          </button>
        ))}
      </nav>
      <main className="workspace">
        <section className={`panel panel-a ${state.panel === "A" ? "is-active" : ""}`} aria-label="A 데이터 관리">
          <div className="panel-head panel-head-a">
            <h2 className="panel-title">
              <span className="panel-key">A</span>데이터 관리 · AI 평가 요약
            </h2>
          </div>
          <div className="panel-body panel-body-a">
            <SupplierEvaluationCard />
            <DataManagementTabs />
          </div>
        </section>
        <section className={`panel panel-b ${state.panel === "B" ? "is-active" : ""}`} aria-label="B AI 챗봇">
          <ChatPanel />
        </section>
        <section className={`panel panel-c ${state.panel === "C" ? "is-active" : ""}`} aria-label="C 분석 결과">
          <ResultPanel />
        </section>
      </main>
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <AgentProvider>
        <div className="app">
          <Topbar />
          <Workspace />
          <ImportDialog />
          <Toast />
        </div>
      </AgentProvider>
    </StoreProvider>
  );
}
