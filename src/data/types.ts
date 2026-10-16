// 데이터 계층: 플랫폼이 다루는 5종 데이터와 공통 식별자
// 연결 키 — supplierId(협력사), itemCode(품목), poNo(발주), contractId(계약)

export type Grade = "A" | "B" | "C" | "D";

export interface EvalHistoryEntry {
  year: number;
  grade: Grade;
  score: number;
}

export interface Supplier {
  supplierId: string;
  name: string;
  process?: string;
  region?: string;
  items: string[]; // 공급 가능 품목 코드
  auditGrade?: Grade | null; // 최근 심사 등급(입력값)
  qualityScore?: number | null; // 품질 평가 점수(입고검사 기반, 100점)
  defectRate?: number | null; // 불량률(%)
  techScore?: number | null; // 기술·대응력(심사 입력값)
  esgScore?: number | null; // 경영·ESG(심사 입력값)
  lastAuditDate?: string | null;
  lastTradeDate?: string | null; // 입력값이 있으면 사용, 없으면 발주 이력에서 계산
  evalHistory: EvalHistoryEntry[];
}

export interface Item {
  itemCode: string;
  name: string;
  spec?: string;
  category?: string;
  unit?: string;
  criticality?: string;
  leadTimeDays?: number | null;
}

export interface PurchaseOrder {
  poNo: string;
  itemCode: string;
  supplierId: string;
  qty: number;
  unitPrice?: number | null;
  currency: string;
  orderDate: string;
  dueDate: string;
  receivedDate?: string | null;
  canceled?: boolean;
}

export interface Contract {
  contractId: string;
  itemCode: string;
  supplierId: string;
  spec?: string;
  unitPrice: number;
  prevUnitPrice?: number | null;
  currency: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface InventoryRecord {
  itemCode: string;
  stockQty: number;
  safetyStock: number;
  mainSupplierId?: string | null;
  location?: string;
}

export type DatasetKey = "suppliers" | "items" | "purchaseOrders" | "contracts" | "inventory";

export interface DataSet {
  suppliers: Supplier[];
  items: Item[];
  purchaseOrders: PurchaseOrder[];
  contracts: Contract[];
  inventory: InventoryRecord[];
}

export interface DataMeta {
  label: string; // 예: "SAMPLE · 시연용 가상 데이터"
  asOf: string; // 데이터 기준일
  isSample: boolean;
  sources: Partial<Record<DatasetKey, string>>; // 데이터별 출처(파일명 등)
  version: number; // 데이터가 바뀔 때마다 증가 → 재분석 필요 여부 판단
}

export const DATASET_LABEL: Record<DatasetKey, string> = {
  suppliers: "협력업체",
  items: "품목 마스터",
  purchaseOrders: "구매조달(발주)",
  contracts: "원가-계약",
  inventory: "자재-공급관리(재고)",
};

export type TabKey = "suppliers" | "purchaseOrders" | "contracts" | "inventory";

export const TAB_LABEL: Record<TabKey, string> = {
  suppliers: "협력업체",
  purchaseOrders: "구매조달",
  contracts: "원가-계약",
  inventory: "자재-공급관리",
};
