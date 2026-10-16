// 템플릿 목록 — 새 템플릿은 여기에 등록하고 ResultPanel의 RENDERERS에 렌더러를 추가하면 된다
import type { IconType } from "react-icons";
import { LuChartColumn, LuFileText, LuLayoutGrid, LuTable2 } from "react-icons/lu";
import type { IntentKind, TemplateId } from "../lib/analysisTypes";

export interface TemplateDef {
  id: TemplateId;
  label: string;
  short: string;
  description: string;
  icon: IconType;
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  table: { id: "table", label: "비교표", short: "표", description: "정렬 가능한 표로 항목을 나란히 비교", icon: LuTable2 },
  chart: { id: "chart", label: "데이터 시각화", short: "차트", description: "막대·선 그래프로 차이와 추이 확인", icon: LuChartColumn },
  cards: { id: "cards", label: "종합 평가 카드", short: "카드", description: "대상별 점수·강점·위험 요소", icon: LuLayoutGrid },
  report: { id: "report", label: "분석 보고서", short: "보고서", description: "목적·범위·결과·검토 의견·근거", icon: LuFileText },
};

const LABELS: Partial<Record<IntentKind, Partial<Record<TemplateId, string>>>> = {
  item_candidates: { table: "업체별 비교표", chart: "비교 그래프", cards: "후보 업체 카드", report: "종합 분석 보고서" },
  supplier_profile: { table: "항목별 점수표", cards: "평가 근거 카드", report: "근거 리포트" },
  stock_risk: { table: "위험 품목표", cards: "품목별 카드" },
  price_increase: { table: "단가 변동표", cards: "계약별 카드" },
};

export const templateLabel = (id: TemplateId, kind?: IntentKind) => (kind && LABELS[kind]?.[id]) || TEMPLATES[id].label;
