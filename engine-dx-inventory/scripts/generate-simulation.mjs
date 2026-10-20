import { mkdir, writeFile } from 'node:fs/promises';
import { createEngine } from '../lib/engine-model/engine-scene.js';
import { createCatalog, getBomRows, validateData } from '../lib/parts-inventory.mjs';
import { buildScenario } from '../lib/simulation.mjs';

const units = [
  { id: 'DEMO-6A', label: '가상 생산호기 A · 6기통', cylinderCount: 6, sample: true },
  { id: 'DEMO-7B', label: '가상 생산호기 B · 7기통', cylinderCount: 7, sample: true },
];
const supplierDefinitions = [
  ['A', '가상 한빛정밀', 'A', 97.2, 21], ['B', '가상 바다메탈', 'B', 88.5, 28],
  ['C', '가상 동해구조', 'A', 94.1, 45], ['D', '가상 누리유압', 'B', 83.4, 14],
  ['E', '가상 새론부품', 'C', 76.8, 18],
];
const categories = {
  liner: ['LNR', '실린더 라이너', '가상 내마모 주철', 2],
  cover: ['COV', '실린더 커버', '가상 단조강', 2],
  frame: ['FRB', '프레임박스', '가상 용접강 구조', 1],
  bedplate: ['BED', '베드플레이트', '가상 용접강 구조', 1],
  mbs: ['MBS', '메인베어링 서포트 통합 영역', '가상 베드 통합 영역', 0],
  shell: ['SHL', '베어링 쉘 위치 참고', '가상 베어링 합금', 0],
  cylinderFrame: ['CYF', '실린더 프레임 위치 참고', '가상 주철', 0],
  valve: ['EXV', '배기밸브 조립체', '가상 내열 합금 조립체', 2],
  housing: ['EVH', '배기밸브 하우징', '가상 주강 · 조립체 하위품', 0],
  spindle: ['EVS', '배기밸브 스핀들', '가상 내열강 · 조립체 하위품', 0],
  seat: ['EVT', '배기밸브 시트', '가상 내열강 · 조립체 하위품', 0],
  pipe: ['HYP', '유압 배관', '가상 강관', 2],
};
const data = {
  schemaVersion: '1.1',
  meta: { dataKind: 'demo', sample: true, as_of: '2026-10-20',
    source: '사용자 요청에 따라 독립 생성한 프로토타입 가상 데이터',
    note: '모든 호기·품목·도면번호·재질·재고·발주·검사·협력사·평가는 가상 시연 데이터. 실제 계약·제작 사양·엔진 적용 근거가 아님.',
    geometryModel: 'MAN B&W G95ME-C 구조 설명용 개념 모델',
    mappingPolicy: '현재 호기와 partId를 명시하여 연결. 동일 분류나 협력사 취급 품목만으로 자동 강조하지 않음.' },
  units,
  suppliers: supplierDefinitions.map(([id, name, grade, onTime, lead]) => ({
    supplier_id: `SUP-DEMO-${id}`, name, grade, on_time_rate_pct: onTime,
    leadTimeDays: lead, lead_time_days: lead, suppliedItemNos: [], scope: '가상 호기별 명시 공급 관계', sample: true,
  })),
  inventory: { types: {} }, supply: [],
  bomPolicies: { bedplateIncludesMbs: true, exhaustValvePurchaseMode: { 'DEMO-6A': 'assembly', 'DEMO-7B': 'assembly' } },
  relations: { items: [], stock: [], modelMappings: [], purchaseOrders: [], inspections: [], productionPlans: [], bom: [] },
};

for (const [unitIndex, unit] of units.entries()) {
  const model = createEngine(unit.cylinderCount);
  const catalog = createCatalog(model.metadata);
  const included = new Set(getBomRows(data, unit.id, catalog).map(row => row.part.id));
  const requiredDate = unitIndex === 0 ? '2026-11-10' : '2026-11-20';
  data.relations.productionPlans.push({ unitId: unit.id, engineNumber: `DEMO-ENGINE-${unitIndex + 1}`,
    assemblyDate: unitIndex === 0 ? '2026-11-15' : '2026-11-25', cylinderCount: unit.cylinderCount,
    requiredDate, sample: true });
  for (const [category, [code, name, material, safety]] of Object.entries(categories)) {
    const group = catalog.filter(part => part.category === category);
    const partTypeId = group[0].part_type_id;
    const itemNo = `DEMO-${unitIndex ? 'B' : 'A'}-${code}-001`;
    const drawingNo = `DEMO-DWG-${unitIndex ? 'B' : 'A'}-${code}-R${unitIndex + 1}`;
    const variantId = `DEMO-VAR-${unitIndex ? 'B' : 'A'}-${code}`;
    const required = group.filter(part => included.has(part.id)).length;
    const initialAccepted = category === 'liner' ? Math.max(0, required - 2)
      : category === 'valve' ? Math.max(0, required - 1)
        : category === 'pipe' ? Math.max(0, required - 2) : required;
    const rejected = category === 'valve' ? 1 : 0;
    const warehouse = unitIndex ? '가상 제2 자재창고' : '가상 조립동 자재창고';
    const supplierFor = part => {
      if (category === 'liner') return unitIndex ? 'B' : 'A';
      if (category === 'cover') return unitIndex ? 'A' : 'B';
      if (['frame', 'bedplate', 'mbs'].includes(category)) return 'C';
      if (category === 'pipe') return 'D';
      if (category === 'valve' || ['housing', 'spindle', 'seat'].includes(category)) return 'E';
      return 'E';
    };
    data.relations.items.push({ itemNo, name, spec: '가상 품목 사양 · 실제 제작 규격 미검증',
      unit: 'EA', rev: unitIndex ? 'B' : 'A', category, sample: true });
    data.relations.stock.push({ itemNo, unitId: unit.id, category, warehouse,
      currentStock: initialAccepted + rejected, safetyStock: safety, asOf: '2026-10-20', sample: true });
    const bucket = data.inventory.types[partTypeId] ??= { variants: [],
      note: '가상 현재고에서 검사 부적합 보류량을 제외한 수량. 호기별 위치 배정과 유형 총 재고는 별도 표시.',
      provenance: { source: '사용자 요청에 따라 생성한 가상 시연 데이터', sample: true } };
    bucket.variants.push({ variant_id: variantId, itemNo, drawing_no: drawingNo,
      rev: unitIndex ? 'B' : 'A', material, stock_qty: initialAccepted,
      safety_stock: safety, unit: 'EA', warehouse, sample: true,
      applicability: '가상 구매 연결 · 실제 MAN G95 적용 미검증' });
    const receivedPo = `DEMO-PO-${unitIndex + 1}-${code}-R`;
    if (required) {
      data.relations.purchaseOrders.push({ poNo: receivedPo, unitId: unit.id, itemNo,
        supplierId: `SUP-DEMO-${supplierFor(group[0])}`, quantity: initialAccepted + rejected,
        requiredDate, promisedDate: '2026-10-15', expectedDate: '2026-10-15',
        receivedDate: '2026-10-15', confirmed: true, status: 'received', sample: true });
      data.relations.inspections.push({ lotNo: `DEMO-LOT-${unitIndex + 1}-${code}-R`, itemNo,
        poNo: receivedPo, inspectedQty: initialAccepted + rejected, rejectedQty: rejected,
        inspectionDate: '2026-10-16', sample: true });
    }
    const incoming = category === 'liner' ? 1 : ['valve', 'pipe'].includes(category) ? required - initialAccepted : 0;
    if (incoming) data.relations.purchaseOrders.push({ poNo: `DEMO-PO-${unitIndex + 1}-${code}-OPEN`,
      unitId: unit.id, itemNo, supplierId: `SUP-DEMO-${supplierFor(group.at(-1))}`,
      quantity: incoming, requiredDate, promisedDate: unitIndex ? '2026-11-15' : '2026-11-05',
      expectedDate: unitIndex ? '2026-11-15' : '2026-11-05', confirmed: category !== 'pipe',
      status: 'open', sample: true });
    for (const part of group) {
      const supplierId = `SUP-DEMO-${supplierFor(part)}`;
      const supplier = data.suppliers.find(row => row.supplier_id === supplierId);
      if (!supplier.suppliedItemNos.includes(itemNo)) supplier.suppliedItemNos.push(itemNo);
      const bomIncluded = included.has(part.id);
      const exclusionReason = part.bomRole === 'child' ? '배기밸브 조립체에 포함 · 하위품 중복 집계 제외'
        : category === 'mbs' ? '베드플레이트 통합 영역 · 별도 구매 집계 제외' : '연결 위치 참고용 · 구매 BOM 집계 제외';
      data.relations.modelMappings.push({ unitId: unit.id, partId: part.id, modelPartName: part.name_ko,
        itemNo, drawingNo, variantId, rev: unitIndex ? 'B' : 'A', sample: true });
      data.relations.bom.push({ unitId: unit.id, itemNo, partId: part.id,
        requiredQty: bomIncluded ? 1 : 0, bomIncluded, parentPartId: part.parentPartId,
        exclusionReason: bomIncluded ? null : exclusionReason, sample: true });
      data.supply.push({ unitId: unit.id, partId: part.id, supplierId, itemNo, variantId,
        rev: unitIndex ? 'B' : 'A', drawingNo, requiredDate, required: bomIncluded ? 1 : 0,
        available: 0, allocated: 0, shortage: 0, openOrder: 0, poNo: null,
        expectedDate: null, updatedAt: '2026-10-20', status: 'review', reason: '가상 데이터 계산 대기',
        supplyRole: bomIncluded ? '가상 구매 위치 공급' : exclusionReason, sample: true });
    }
  }
  model.root.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
}
data.simulationSeed = structuredClone({ stock: data.relations.stock,
  purchaseOrders: data.relations.purchaseOrders, inspections: data.relations.inspections });
const result = buildScenario(data);
const validation = validateData(result);
if (!validation.valid) throw new Error(validation.errors.join('\n'));
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/data/prototype-simulation.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`가상 프로토타입: ${result.units.length}호기, ${result.suppliers.length}협력사, ${result.relations.items.length}품목, ${result.relations.modelMappings.length}객체 연결`);
