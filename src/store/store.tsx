// 화면 상태 — 선택 대상, 대화, 분석 결과, 표시 템플릿, 데이터 버전
import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import type { DataMeta, DataSet, DatasetKey, TabKey } from "../data/types";
import { SCHEMAS } from "../data/schema";
import { loadSample } from "../data/sampleData";
import type { AnalysisResult, TemplateId } from "../lib/analysisTypes";
import { derive, type Derived } from "../lib/metrics";
import type { ClarifyOption, Engine, PendingClarify } from "../ai/agent";

export type ChatMessage =
  | { id: string; role: "user"; text: string; at: string }
  | {
      id: string;
      role: "assistant";
      at: string;
      engine: Engine | "system";
      engineNote?: string;
      text: string[];
      resultId?: string;
      followup?: boolean;
      keep?: TemplateId | null;
      chosen?: TemplateId | null;
      options?: ClarifyOption[];
      need?: PendingClarify["need"];
      answered?: string | null;
      suggestions?: string[];
    };

export type Panel = "A" | "B" | "C";

export interface State {
  data: DataSet;
  meta: DataMeta;
  tab: TabKey;
  selection: { supplierId: string | null; itemCode: string | null; rowKey: string | null; rowTab: TabKey | null };
  messages: ChatMessage[];
  results: Record<string, AnalysisResult>;
  view: { resultId: string | null; template: TemplateId | null };
  lastResultId: string | null;
  pending: PendingClarify | null;
  busy: boolean;
  progress: number;
  aiMode: "rule" | "llm";
  panel: Panel;
  importFor: DatasetKey | null;
  toast: { id: number; text: string; tone: "ok" | "warn" } | null;
}

export type Action =
  | { type: "tab"; tab: TabKey }
  | { type: "selectRow"; tab: TabKey; rowKey: string; supplierId?: string | null; itemCode?: string | null }
  | { type: "selectSupplier"; supplierId: string }
  | { type: "clearSelection"; what: "item" | "supplier" | "row" }
  | { type: "addMessage"; message: ChatMessage }
  | { type: "patchMessage"; id: string; patch: Partial<Extract<ChatMessage, { role: "assistant" }>> }
  | { type: "addResult"; result: AnalysisResult; asLast?: boolean }
  | { type: "show"; resultId: string; template: TemplateId }
  | { type: "pending"; pending: PendingClarify | null }
  | { type: "busy"; busy: boolean; progress?: number }
  | { type: "aiMode"; mode: "rule" | "llm" }
  | { type: "panel"; panel: Panel }
  | { type: "openImport"; dataset: DatasetKey | null }
  | { type: "replaceData"; dataset: DatasetKey; rows: unknown[]; source: string; mode: "replace" | "merge" }
  | { type: "resetSample" }
  | { type: "toast"; text: string; tone?: "ok" | "warn" }
  | { type: "clearToast" }
  | { type: "clearChat" };

const now = () => new Date().toISOString();

export const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  at: now(),
  engine: "system",
  text: ["안녕하세요. 구매·협력사 데이터 분석 도우미입니다. 협력사 평가, 과거 거래 이력, 단가 비교, 납기 실적 등을 질문해 주세요."],
  suggestions: [
    "해당 품목의 과거 거래 협력사를 비교해 줘.",
    "납기 준수율이 낮은 협력사를 찾아줘.",
    "최근 단가가 상승한 품목을 보여줘.",
    "A등급 협력사의 품질 실적을 정리해 줘.",
  ],
};

function initial(): State {
  const { data, meta } = loadSample();
  return {
    data,
    meta,
    tab: "suppliers",
    selection: { supplierId: data.suppliers[0]?.supplierId ?? null, itemCode: null, rowKey: data.suppliers[0]?.supplierId ?? null, rowTab: "suppliers" },
    messages: [WELCOME],
    results: {},
    view: { resultId: null, template: null },
    lastResultId: null,
    pending: null,
    busy: false,
    progress: 0,
    aiMode: "rule",
    panel: "B",
    importFor: null,
    toast: null,
  };
}

let toastSeq = 0;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "tab":
      return { ...s, tab: a.tab };
    case "selectRow":
      return {
        ...s,
        selection: {
          rowKey: a.rowKey,
          rowTab: a.tab,
          supplierId: a.supplierId === undefined ? s.selection.supplierId : a.supplierId,
          itemCode: a.itemCode === undefined ? s.selection.itemCode : a.itemCode,
        },
      };
    case "selectSupplier":
      return { ...s, selection: { ...s.selection, supplierId: a.supplierId } };
    case "clearSelection":
      if (a.what === "item") return { ...s, selection: { ...s.selection, itemCode: null } };
      if (a.what === "supplier") return { ...s, selection: { ...s.selection, supplierId: null } };
      return { ...s, selection: { ...s.selection, rowKey: null, rowTab: null } };
    case "addMessage":
      return { ...s, messages: [...s.messages, a.message] };
    case "patchMessage":
      return { ...s, messages: s.messages.map((m) => (m.id === a.id && m.role === "assistant" ? { ...m, ...a.patch } : m)) };
    case "addResult":
      return { ...s, results: { ...s.results, [a.result.id]: a.result }, lastResultId: a.asLast === false ? s.lastResultId : a.result.id };
    case "show":
      return { ...s, view: { resultId: a.resultId, template: a.template } };
    case "pending":
      return { ...s, pending: a.pending };
    case "busy":
      return { ...s, busy: a.busy, progress: a.progress ?? (a.busy ? s.progress : 0) };
    case "aiMode":
      return { ...s, aiMode: a.mode };
    case "panel":
      return { ...s, panel: a.panel };
    case "openImport":
      return { ...s, importFor: a.dataset };
    case "replaceData": {
      const pk = SCHEMAS[a.dataset].primaryKey;
      const incoming = a.rows as Record<string, unknown>[];
      let next: unknown[];
      if (a.mode === "replace") next = incoming;
      else {
        const map = new Map((s.data[a.dataset] as unknown as Record<string, unknown>[]).map((r) => [String(r[pk]), r]));
        for (const r of incoming) map.set(String(r[pk]), { ...(map.get(String(r[pk])) || {}), ...r });
        next = [...map.values()];
      }
      const data = { ...s.data, [a.dataset]: next } as DataSet;
      const meta: DataMeta = {
        ...s.meta,
        isSample: false,
        label: "SAMPLE + 업로드 데이터",
        sources: { ...s.meta.sources, [a.dataset]: a.source },
        version: s.meta.version + 1,
      };
      const supplierId = data.suppliers.some((x) => x.supplierId === s.selection.supplierId) ? s.selection.supplierId : data.suppliers[0]?.supplierId ?? null;
      const itemCode = data.items.some((x) => x.itemCode === s.selection.itemCode) ? s.selection.itemCode : null;
      return { ...s, data, meta, selection: { supplierId, itemCode, rowKey: null, rowTab: null } };
    }
    case "resetSample": {
      const { data, meta } = loadSample();
      return {
        ...s,
        data,
        meta: { ...meta, version: s.meta.version + 1 },
        selection: { supplierId: data.suppliers[0]?.supplierId ?? null, itemCode: null, rowKey: data.suppliers[0]?.supplierId ?? null, rowTab: "suppliers" },
      };
    }
    case "toast":
      return { ...s, toast: { id: ++toastSeq, text: a.text, tone: a.tone ?? "ok" } };
    case "clearToast":
      return { ...s, toast: null };
    case "clearChat":
      return { ...s, messages: [{ ...WELCOME, at: now() }], pending: null, lastResultId: null };
  }
}

interface Store {
  state: State;
  dispatch: Dispatch<Action>;
  derived: Derived;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const derived = useMemo(() => derive(state.data, state.meta.asOf), [state.data, state.meta.asOf]);
  const value = useMemo(() => ({ state, dispatch, derived }), [state, derived]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider가 없습니다");
  return v;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
