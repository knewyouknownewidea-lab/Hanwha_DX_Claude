// 업로드 데이터 표준 필드 정의 — 필드명·한글 헤더·별칭으로 자동 매핑한다
import type { DatasetKey } from "./types";

export type FieldType = "string" | "number" | "date" | "grade" | "list" | "boolean" | "history";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  aliases?: string[];
  min?: number;
  max?: number;
  defaultValue?: unknown;
  hint?: string;
}

export interface DatasetSchema {
  key: DatasetKey;
  label: string;
  primaryKey: string;
  fields: FieldDef[];
}

export const SCHEMAS: Record<DatasetKey, DatasetSchema> = {
  suppliers: {
    key: "suppliers",
    label: "협력업체",
    primaryKey: "supplierId",
    fields: [
      { key: "supplierId", label: "업체ID", type: "string", required: true, aliases: ["협력사id", "업체코드", "협력사코드", "vendorid", "vendor_id", "id"] },
      { key: "name", label: "협력사명", type: "string", required: true, aliases: ["업체명", "회사명", "vendor", "vendorname"] },
      { key: "process", label: "공정 구분", type: "string", aliases: ["공정", "업종"] },
      { key: "region", label: "지역", type: "string", aliases: ["소재지"] },
      { key: "items", label: "공급 가능 품목", type: "list", aliases: ["공급품목", "품목코드", "품목"], hint: "품목코드를 ; 로 구분" },
      { key: "auditGrade", label: "심사 등급", type: "grade", aliases: ["등급", "평가등급", "심사등급"] },
      { key: "qualityScore", label: "품질 평가 점수", type: "number", min: 0, max: 100, aliases: ["품질점수", "품질평가점수"] },
      { key: "defectRate", label: "불량률(%)", type: "number", min: 0, max: 100, aliases: ["불량률"] },
      { key: "techScore", label: "기술·대응력 점수", type: "number", min: 0, max: 100, aliases: ["기술점수", "기술대응력", "대응력점수"] },
      { key: "esgScore", label: "경영·ESG 점수", type: "number", min: 0, max: 100, aliases: ["esg", "경영점수", "esg점수", "경영esg"] },
      { key: "lastAuditDate", label: "최근 심사일", type: "date", aliases: ["심사일"] },
      { key: "lastTradeDate", label: "최근 거래일", type: "date", aliases: ["거래일"] },
      { key: "evalHistory", label: "평가 이력", type: "history", aliases: ["평가이력"], hint: "2024:A:88;2025:A:89 형식" },
    ],
  },
  items: {
    key: "items",
    label: "품목 마스터",
    primaryKey: "itemCode",
    fields: [
      { key: "itemCode", label: "품목코드", type: "string", required: true, aliases: ["품번", "자재코드", "itemno", "partno"] },
      { key: "name", label: "품목명", type: "string", required: true, aliases: ["자재명", "품명"] },
      { key: "spec", label: "규격", type: "string", aliases: ["사양"] },
      { key: "category", label: "분류", type: "string", aliases: ["품목분류"] },
      { key: "unit", label: "단위", type: "string" },
      { key: "criticality", label: "중요도", type: "string" },
      { key: "leadTimeDays", label: "표준 리드타임(일)", type: "number", min: 0, aliases: ["리드타임"] },
    ],
  },
  purchaseOrders: {
    key: "purchaseOrders",
    label: "구매조달(발주)",
    primaryKey: "poNo",
    fields: [
      { key: "poNo", label: "발주번호", type: "string", required: true, aliases: ["po", "po번호", "발주no"] },
      { key: "itemCode", label: "품목코드", type: "string", required: true, aliases: ["품번", "자재코드"] },
      { key: "supplierId", label: "업체ID", type: "string", required: true, aliases: ["협력사id", "발주업체", "업체코드"] },
      { key: "qty", label: "발주 수량", type: "number", required: true, min: 0, aliases: ["수량", "발주수량"] },
      { key: "unitPrice", label: "발주 단가", type: "number", min: 0, aliases: ["단가"] },
      { key: "currency", label: "통화", type: "string", defaultValue: "KRW", aliases: ["거래통화"] },
      { key: "orderDate", label: "발주 일자", type: "date", required: true, aliases: ["발주일", "발주일자"] },
      { key: "dueDate", label: "납기 예정일", type: "date", required: true, aliases: ["납기일", "납기", "납기예정일"] },
      { key: "receivedDate", label: "실제 입고일", type: "date", aliases: ["입고일", "실입고일"] },
      { key: "canceled", label: "취소 여부", type: "boolean", aliases: ["취소"] },
    ],
  },
  contracts: {
    key: "contracts",
    label: "원가-계약",
    primaryKey: "contractId",
    fields: [
      { key: "contractId", label: "계약번호", type: "string", required: true, aliases: ["계약id", "계약no"] },
      { key: "itemCode", label: "품목코드", type: "string", required: true, aliases: ["품번"] },
      { key: "supplierId", label: "업체ID", type: "string", required: true, aliases: ["협력사id", "거래협력사"] },
      { key: "spec", label: "규격", type: "string" },
      { key: "unitPrice", label: "최근 단가", type: "number", required: true, min: 0, aliases: ["단가", "계약단가"] },
      { key: "prevUnitPrice", label: "과거 단가", type: "number", min: 0, aliases: ["직전단가", "이전단가"] },
      { key: "currency", label: "거래 통화", type: "string", defaultValue: "KRW", aliases: ["통화"] },
      { key: "deliveryTerms", label: "인도 조건", type: "string", aliases: ["인도조건", "incoterms"] },
      { key: "paymentTerms", label: "결제 조건", type: "string", aliases: ["결제조건", "계약조건"] },
      { key: "startDate", label: "계약 시작일", type: "date", aliases: ["시작일"] },
      { key: "endDate", label: "계약 종료일", type: "date", aliases: ["종료일", "만료일"] },
    ],
  },
  inventory: {
    key: "inventory",
    label: "자재-공급관리(재고)",
    primaryKey: "itemCode",
    fields: [
      { key: "itemCode", label: "품목코드", type: "string", required: true, aliases: ["품번", "자재코드"] },
      { key: "stockQty", label: "현재 재고량", type: "number", required: true, min: 0, aliases: ["재고", "재고량", "현재고"] },
      { key: "safetyStock", label: "안전재고 기준", type: "number", required: true, min: 0, aliases: ["안전재고"] },
      { key: "mainSupplierId", label: "주 공급업체ID", type: "string", aliases: ["공급업체", "공급업체id"] },
      { key: "location", label: "보관 위치", type: "string", aliases: ["위치", "창고"] },
    ],
  },
};
