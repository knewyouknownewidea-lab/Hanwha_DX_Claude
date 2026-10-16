// SAMPLE 데이터 생성기 — 시연용 가상 데이터를 만든다.
// 실행: node scripts/generate-sample.mjs  →  src/data/sample/*.json
// 업체명·품목·수치는 모두 가상이며 실제 회사 데이터가 아니다.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "sample");
mkdirSync(OUT, { recursive: true });

const AS_OF = "2026-10-15";

// 시드 고정 난수 (같은 결과를 재현)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261015);
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const DAY = 86400000;
const toDate = (s) => new Date(s + "T00:00:00Z");
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => fmt(new Date(toDate(s).getTime() + n * DAY));

const items = [
  { itemCode: "ITM-1001", name: "실린더 라이너", spec: "Ø500 × 2,100mm, 특수주철", category: "주조품", unit: "EA", criticality: "상", lead: 75, qty: [4, 12] },
  { itemCode: "ITM-1002", name: "피스톤 링 세트", spec: "Ø500, 4본 1조", category: "정밀가공품", unit: "SET", criticality: "상", lead: 60, qty: [10, 30] },
  { itemCode: "ITM-1003", name: "배기밸브 스핀들", spec: "L=1,450mm, 내열합금 페이스", category: "단조·가공품", unit: "EA", criticality: "상", lead: 90, qty: [4, 10] },
  { itemCode: "ITM-1004", name: "연료분사밸브 노즐", spec: "9홀, Ø0.85", category: "정밀가공품", unit: "EA", criticality: "상", lead: 45, qty: [20, 60] },
  { itemCode: "ITM-1005", name: "메인 베어링 쉘", spec: "Ø560, 상하 1조", category: "정밀가공품", unit: "SET", criticality: "중", lead: 60, qty: [4, 12] },
  { itemCode: "ITM-1006", name: "커넥팅로드 볼트", spec: "M64 × 520mm", category: "체결부품", unit: "EA", criticality: "중", lead: 30, qty: [40, 120] },
  { itemCode: "ITM-1007", name: "실린더 커버 가스켓", spec: "Ø720, 연철", category: "소모성 부품", unit: "EA", criticality: "하", lead: 20, qty: [50, 200] },
  { itemCode: "ITM-1008", name: "냉각수 펌프 임펠러", spec: "Ø310, 청동 주물", category: "주조품", unit: "EA", criticality: "중", lead: 45, qty: [6, 16] },
  { itemCode: "ITM-1009", name: "고압 연료관", spec: "이중관, 2.4m", category: "배관 부품", unit: "EA", criticality: "중", lead: 40, qty: [10, 30] },
  { itemCode: "ITM-1010", name: "터보차저 노즐링", spec: "축류형, 33베인", category: "정밀가공품", unit: "EA", criticality: "상", lead: 90, qty: [2, 6] },
];

const suppliers = [
  { supplierId: "SUP-001", name: "업체 A", process: "주조", region: "경남 창원", auditGrade: "A", qualityScore: 92, defectRate: 0.6, techScore: 85, esgScore: 80, lastAuditDate: "2024-05-21", evalHistory: [{ year: 2024, grade: "A", score: 88 }, { year: 2025, grade: "A", score: 89 }] },
  { supplierId: "SUP-002", name: "업체 B", process: "주조", region: "경남 김해", auditGrade: "B", qualityScore: 80, defectRate: 1.5, techScore: 70, esgScore: 65, lastAuditDate: "2025-04-10", evalHistory: [{ year: 2024, grade: "B", score: 82 }, { year: 2025, grade: "B", score: 83 }] },
  { supplierId: "SUP-003", name: "업체 C", process: "주조·가공", region: "부산", auditGrade: "A", qualityScore: 90, defectRate: 0.7, techScore: 88, esgScore: 84, lastAuditDate: "2024-09-03", evalHistory: [{ year: 2024, grade: "A", score: 89 }, { year: 2025, grade: "A", score: 90 }] },
  { supplierId: "SUP-004", name: "업체 D", process: "주조(해외)", region: "해외", auditGrade: "C", qualityScore: 80, defectRate: 1.6, techScore: 62, esgScore: null, lastAuditDate: "2026-02-17", evalHistory: [{ year: 2025, grade: "C", score: 71 }] },
  { supplierId: "SUP-005", name: "업체 E", process: "정밀가공", region: "경남 창원", auditGrade: "A", qualityScore: 91, defectRate: 0.5, techScore: 86, esgScore: 82, lastAuditDate: "2023-11-14", evalHistory: [{ year: 2024, grade: "A", score: 91 }, { year: 2025, grade: "A", score: 92 }] },
  { supplierId: "SUP-006", name: "업체 F", process: "정밀가공", region: "경북 구미", auditGrade: "B", qualityScore: 82, defectRate: 1.4, techScore: 80, esgScore: 70, lastAuditDate: "2025-06-02", evalHistory: [{ year: 2024, grade: "A", score: 86 }, { year: 2025, grade: "B", score: 84 }] },
  { supplierId: "SUP-007", name: "업체 G", process: "단조·가공", region: "경남 창원", auditGrade: "A", qualityScore: 89, defectRate: 0.8, techScore: 84, esgScore: 78, lastAuditDate: "2024-03-28", evalHistory: [{ year: 2024, grade: "A", score: 88 }, { year: 2025, grade: "A", score: 89 }] },
  { supplierId: "SUP-008", name: "업체 H", process: "정밀가공", region: "울산", auditGrade: "B", qualityScore: 81, defectRate: 1.4, techScore: 72, esgScore: 66, lastAuditDate: "2025-08-19", evalHistory: [{ year: 2024, grade: "B", score: 84 }, { year: 2025, grade: "B", score: 83 }] },
  { supplierId: "SUP-009", name: "업체 I", process: "소모품", region: "부산", auditGrade: "B", qualityScore: 80, defectRate: 1.0, techScore: 70, esgScore: 68, lastAuditDate: "2025-10-07", evalHistory: [{ year: 2024, grade: "B", score: 82 }, { year: 2025, grade: "B", score: 83 }] },
  { supplierId: "SUP-010", name: "업체 J", process: "배관", region: "울산", auditGrade: "C", qualityScore: 70, defectRate: 2.8, techScore: 62, esgScore: 55, lastAuditDate: "2026-03-11", evalHistory: [{ year: 2024, grade: "B", score: 77 }, { year: 2025, grade: "C", score: 73 }] },
  { supplierId: "SUP-011", name: "업체 K", process: "정밀가공", region: "경남 함안", auditGrade: "A", qualityScore: 88, defectRate: 0.7, techScore: 87, esgScore: 81, lastAuditDate: "2024-07-30", evalHistory: [{ year: 2024, grade: "A", score: 90 }, { year: 2025, grade: "A", score: 92 }] },
  { supplierId: "SUP-012", name: "업체 L", process: "단조", region: "경남 창원", auditGrade: "B", qualityScore: 85, defectRate: 0.9, techScore: 79, esgScore: 76, lastAuditDate: "2025-01-22", evalHistory: [{ year: 2024, grade: "B", score: 84 }, { year: 2025, grade: "A", score: 86 }] },
];

// 업체·품목 거래 쌍: n=발주 건수, late=기한 초과 건수, overdueOpen=납기 경과 미입고 1건 여부,
// p=[2024 단가, 2025 단가, 2026 단가], cur=통화, terms=인도조건
const DOM = "창원 공장 도착도";
const pairs = [
  { s: "SUP-001", i: "ITM-1001", n: 30, late: 1, p: [1180000, 1210000, 1250000] },
  { s: "SUP-002", i: "ITM-1001", n: 26, late: 2, p: [1100000, 1120000, 1190000] },
  { s: "SUP-003", i: "ITM-1001", n: 20, late: 1, p: [1270000, 1290000, 1310000] },
  { s: "SUP-004", i: "ITM-1001", n: 8, late: 2, p: [870, 880, 905], cur: "USD", terms: "FOB 해외 선적항" },
  { s: "SUP-001", i: "ITM-1008", n: 10, late: 0, p: [420000, 428000, 438000] },
  { s: "SUP-002", i: "ITM-1008", n: 12, late: 1, p: [398000, 405000, 415000] },
  { s: "SUP-003", i: "ITM-1005", n: 12, late: 0, p: [2150000, 2180000, 2210000] },
  { s: "SUP-008", i: "ITM-1005", n: 14, late: 2, p: [2140000, 2190000, 2240000] },
  { s: "SUP-005", i: "ITM-1002", n: 18, late: 1, p: [3450000, 3480000, 3520000] },
  { s: "SUP-008", i: "ITM-1002", n: 16, late: 2, p: [3250000, 3300000, 3560000], overdueOpen: true },
  { s: "SUP-005", i: "ITM-1006", n: 10, late: 0, p: [185000, 188000, 192000] },
  { s: "SUP-007", i: "ITM-1006", n: 12, late: 1, p: [179000, 183000, 188000] },
  { s: "SUP-006", i: "ITM-1004", n: 24, late: 4, p: [620000, 640000, 720000], overdueOpen: true },
  { s: "SUP-008", i: "ITM-1004", n: 10, late: 1, p: [655000, 675000, 705000] },
  { s: "SUP-011", i: "ITM-1004", n: 14, late: 0, p: [670000, 684000, 698000] },
  { s: "SUP-006", i: "ITM-1010", n: 10, late: 2, p: [8900000, 9050000, 9300000] },
  { s: "SUP-011", i: "ITM-1010", n: 12, late: 0, p: [9100000, 9220000, 9350000] },
  { s: "SUP-007", i: "ITM-1003", n: 16, late: 1, p: [5200000, 5290000, 5380000] },
  { s: "SUP-012", i: "ITM-1003", n: 14, late: 1, p: [5050000, 5180000, 5290000] },
  { s: "SUP-009", i: "ITM-1007", n: 20, late: 2, p: [48000, 49000, 50000] },
  { s: "SUP-010", i: "ITM-1007", n: 10, late: 2, p: [46000, 47000, 49000] },
  { s: "SUP-010", i: "ITM-1009", n: 18, late: 5, p: [1320000, 1350000, 1520000], overdueOpen: true },
  { s: "SUP-012", i: "ITM-1009", n: 10, late: 1, p: [1420000, 1440000, 1455000] },
];

const START = "2024-01-08";
const END_ORDER = "2026-09-28";
const span = (toDate(END_ORDER) - toDate(START)) / DAY;

const rawPOs = [];
for (const pr of pairs) {
  const item = items.find((x) => x.itemCode === pr.i);
  const orders = [];
  for (let k = 0; k < pr.n; k++) {
    const base = Math.round((span * (k + 0.5)) / pr.n);
    const jitter = randInt(-9, 9);
    const orderDate = addDays(START, Math.max(0, Math.min(span, base + jitter)));
    const dueDate = addDays(orderDate, item.lead + randInt(-5, 5));
    orders.push({ orderDate, dueDate });
  }
  orders.sort((a, b) => a.orderDate.localeCompare(b.orderDate));
  const closed = orders.map((o, idx) => ({ ...o, idx })).filter((o) => o.dueDate <= AS_OF);
  // 기한 초과 대상 선택: overdueOpen이면 가장 최근 마감분 1건을 미입고 지연으로 둔다
  const lateSet = new Set();
  if (pr.overdueOpen && closed.length) lateSet.add(closed[closed.length - 1].idx);
  while (lateSet.size < Math.min(pr.late, closed.length)) {
    lateSet.add(closed[randInt(0, closed.length - 1)].idx);
  }
  orders.forEach((o, idx) => {
    const year = Number(o.orderDate.slice(0, 4));
    const price = pr.p[Math.min(2, Math.max(0, year - 2024))];
    let receivedDate = null;
    if (o.dueDate <= AS_OF) {
      if (lateSet.has(idx)) {
        const isOverdueOpen = pr.overdueOpen && idx === closed[closed.length - 1].idx;
        receivedDate = isOverdueOpen ? null : addDays(o.dueDate, randInt(4, 21));
        if (receivedDate && receivedDate > AS_OF) receivedDate = null;
      } else {
        receivedDate = addDays(o.dueDate, -randInt(0, 6));
      }
    }
    rawPOs.push({
      itemCode: pr.i,
      supplierId: pr.s,
      qty: randInt(item.qty[0], item.qty[1]),
      unitPrice: price,
      currency: pr.cur || "KRW",
      orderDate: o.orderDate,
      dueDate: o.dueDate,
      receivedDate,
    });
  });
}
rawPOs.sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.supplierId.localeCompare(b.supplierId));
const yearSeq = {};
const purchaseOrders = rawPOs.map((po) => {
  const y = po.orderDate.slice(0, 4);
  yearSeq[y] = (yearSeq[y] || 0) + 1;
  return { poNo: `PO-${y}-${String(yearSeq[y]).padStart(4, "0")}`, ...po };
});

const contracts = pairs.map((pr, k) => {
  const item = items.find((x) => x.itemCode === pr.i);
  return {
    contractId: `CT-2026-${String(k + 1).padStart(3, "0")}`,
    itemCode: pr.i,
    supplierId: pr.s,
    spec: item.spec,
    unitPrice: pr.p[2],
    prevUnitPrice: pr.p[1],
    currency: pr.cur || "KRW",
    deliveryTerms: pr.terms || DOM,
    paymentTerms: pr.cur === "USD" ? "T/T 선적 후 30일" : "월말 마감 60일",
    startDate: "2026-01-01",
    endDate: pr.s === "SUP-010" || pr.s === "SUP-006" ? "2026-11-30" : "2026-12-31",
  };
});

const inventory = [
  { itemCode: "ITM-1001", stockQty: 18, safetyStock: 12, mainSupplierId: "SUP-001", location: "자재창고 A동" },
  { itemCode: "ITM-1002", stockQty: 64, safetyStock: 40, mainSupplierId: "SUP-005", location: "자재창고 B동" },
  { itemCode: "ITM-1003", stockQty: 9, safetyStock: 10, mainSupplierId: "SUP-007", location: "자재창고 A동" },
  { itemCode: "ITM-1004", stockQty: 85, safetyStock: 120, mainSupplierId: "SUP-006", location: "정밀부품 보관실" },
  { itemCode: "ITM-1005", stockQty: 22, safetyStock: 16, mainSupplierId: "SUP-003", location: "자재창고 B동" },
  { itemCode: "ITM-1006", stockQty: 340, safetyStock: 200, mainSupplierId: "SUP-005", location: "자재창고 C동" },
  { itemCode: "ITM-1007", stockQty: 520, safetyStock: 400, mainSupplierId: "SUP-009", location: "자재창고 C동" },
  { itemCode: "ITM-1008", stockQty: 14, safetyStock: 10, mainSupplierId: "SUP-001", location: "자재창고 A동" },
  { itemCode: "ITM-1009", stockQty: 21, safetyStock: 30, mainSupplierId: "SUP-010", location: "배관자재 야적장" },
  { itemCode: "ITM-1010", stockQty: 7, safetyStock: 6, mainSupplierId: "SUP-011", location: "정밀부품 보관실" },
];

// 공급 가능 품목은 거래 쌍에서 채운다
const supplierRows = suppliers.map((s) => ({
  ...s,
  items: pairs.filter((p) => p.s === s.supplierId).map((p) => p.i),
}));

const itemRows = items.map(({ lead, qty, ...rest }) => ({ ...rest, leadTimeDays: lead }));

const meta = {
  label: "SAMPLE · 시연용 가상 데이터",
  asOf: AS_OF,
  note: "업체명·품목·수치는 모두 가상이며 실제 회사 데이터가 아닙니다.",
  generatedBy: "scripts/generate-sample.mjs",
};

const write = (name, data) => writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
write("meta.json", meta);
write("items.json", itemRows);
write("suppliers.json", supplierRows);
write("purchaseOrders.json", purchaseOrders);
write("contracts.json", contracts);
write("inventory.json", inventory);
console.log(`items ${itemRows.length}, suppliers ${supplierRows.length}, POs ${purchaseOrders.length}, contracts ${contracts.length}, inventory ${inventory.length}`);
