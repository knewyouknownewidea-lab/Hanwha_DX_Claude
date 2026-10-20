/** Deliberately simple, deterministic purchasing simulation. All values are fictional. */
const copy = value => JSON.parse(JSON.stringify(value));
export const getScenarioOptions = Object.freeze([
  { id: 'baseline', label: '기본 생산계획', description: '확보·입고 예정·미확보가 함께 있는 기본 가상 상황' },
  { id: 'receipts', label: '예정 물량 입고', description: '열린 발주를 입고·검사 합격 처리하고 위치별 재고를 재배정' },
  { id: 'delayed', label: '협력사 납기 지연', description: '미입고 발주의 입고 예정일을 14일 늦추고 확인 필요 표시' },
  { id: 'rejected', label: '입고검사 부적합', description: '커버 2개를 검사 부적합으로 보류하고 가용재고를 재계산' },
]);
const addDays = (value, days) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function buildScenario(input, scenario = 'baseline') {
  const data = copy(input);
  if (data.meta?.dataKind !== 'demo' || !data.relations) return data;
  if (!getScenarioOptions.some(option => option.id === scenario)) scenario = 'baseline';
  const relations = data.relations;
  // Always start from the immutable seed, even when a simulated result is passed again.
  const seed = data.simulationSeed;
  if (seed) {
    relations.stock = copy(seed.stock);
    relations.purchaseOrders = copy(seed.purchaseOrders);
    relations.inspections = copy(seed.inspections);
  }
  data.meta.scenario = scenario;
  data.meta.scenarioLabel = getScenarioOptions.find(option => option.id === scenario).label;
  data.meta.simulationPolicy = '가상 품목별 현재고에서 검사 부적합을 제외한 수량을 호기 위치 순서로 배정. 안전재고는 경보 기준이며 자동 차감하지 않음. 실제 ERP 계산·계약 정보 아님.';

  if (scenario === 'delayed') {
    for (const order of relations.purchaseOrders.filter(order => order.status === 'open')) {
      order.expectedDate = addDays(order.expectedDate, 14);
      order.confirmed = false;
      order.status = 'delayed';
    }
  }
  if (scenario === 'receipts') {
    for (const order of relations.purchaseOrders.filter(order => order.status === 'open')) {
      const stock = relations.stock.find(row => row.itemNo === order.itemNo);
      if (stock) stock.currentStock += order.quantity;
      order.status = 'received';
      order.confirmed = true;
      order.receivedDate = addDays(data.meta.as_of, 1);
      relations.inspections.push({ lotNo: `DEMO-LOT-SIM-${order.poNo}`, itemNo: order.itemNo,
        poNo: order.poNo, inspectedQty: order.quantity, rejectedQty: 0,
        inspectionDate: order.receivedDate, sample: true, simulationEvent: 'receipts' });
    }
  }
  if (scenario === 'rejected') {
    for (const stock of relations.stock.filter(row => row.category === 'cover')) {
      const po = relations.purchaseOrders.find(order => order.itemNo === stock.itemNo && order.status === 'received');
      relations.inspections.push({ lotNo: `DEMO-LOT-REJECT-${stock.itemNo}`, itemNo: stock.itemNo,
        poNo: po?.poNo ?? null, inspectedQty: 2, rejectedQty: 2,
        inspectionDate: data.meta.as_of, sample: true, simulationEvent: 'rejected' });
    }
  }

  const available = new Map();
  const incoming = new Map();
  for (const stock of relations.stock) {
    stock.rejectedQty = relations.inspections.filter(row => row.itemNo === stock.itemNo)
      .reduce((sum, row) => sum + row.rejectedQty, 0);
    stock.acceptedStock = Math.max(0, stock.currentStock - stock.rejectedQty);
    stock.asOf = scenario === 'receipts' ? addDays(data.meta.as_of, 1) : data.meta.as_of;
    available.set(stock.itemNo, stock.acceptedStock);
  }
  for (const order of relations.purchaseOrders) {
    if (order.status !== 'received') incoming.set(order.itemNo, (incoming.get(order.itemNo) ?? 0) + order.quantity);
  }
  for (const type of Object.values(data.inventory.types)) {
    for (const variant of type.variants) {
      const stock = relations.stock.find(row => row.itemNo === variant.itemNo);
      if (!stock) continue;
      Object.assign(variant, { stock_qty: stock.acceptedStock, current_stock: stock.currentStock,
        rejected_qty: stock.rejectedQty, safety_stock: stock.safetyStock, as_of: stock.asOf });
    }
  }
  for (const row of data.supply) {
    const bom = relations.bom.find(record => record.unitId === row.unitId && record.partId === row.partId);
    const order = relations.purchaseOrders.find(record => record.itemNo === row.itemNo && record.status !== 'received');
    row.required = bom?.bomIncluded ? bom.requiredQty : 0;
    row.updatedAt = scenario === 'receipts' ? addDays(data.meta.as_of, 1) : data.meta.as_of;
    if (!bom?.bomIncluded) {
      Object.assign(row, { status: 'unknown', required: 0, available: 0, allocated: 0,
        shortage: 0, openOrder: 0, poNo: null, expectedDate: null,
        reason: bom?.exclusionReason ?? '연결 문맥 · 구매 BOM 집계 제외' });
      continue;
    }
    const allocated = Math.min(row.required, available.get(row.itemNo) ?? 0);
    available.set(row.itemNo, Math.max(0, (available.get(row.itemNo) ?? 0) - allocated));
    const shortage = Math.max(0, row.required - allocated);
    const planned = Math.min(shortage, incoming.get(row.itemNo) ?? 0);
    incoming.set(row.itemNo, Math.max(0, (incoming.get(row.itemNo) ?? 0) - planned));
    const shortageAfterIncoming = Math.max(0, shortage - planned);
    const status = allocated >= row.required ? 'secured' : shortageAfterIncoming > 0 ? 'shortage' : 'review';
    const stock = relations.stock.find(record => record.itemNo === row.itemNo);
    const delayed = order && order.expectedDate > row.requiredDate;
    const reason = status === 'secured' ? (scenario === 'receipts' ? '가상 입고·검사 합격 후 재고 확보' : '검사 합격 가용재고 배정')
      : status === 'shortage' ? (stock?.rejectedQty > 0 && scenario === 'rejected' ? '검사 부적합 보류 · 대체 확보 계획 없음' : '미확보 · 필요일까지 추가 확보 대책 없음')
        : delayed ? '납기 지연 · 필요일 이후 입고, 일정 확인 필요' : '입고 예정 · 발주 물량 확인 필요';
    Object.assign(row, { available: allocated, allocated, shortage, openOrder: planned,
      status, reason, poNo: order?.poNo ?? relations.purchaseOrders.find(record => record.itemNo === row.itemNo)?.poNo ?? null,
      expectedDate: order?.expectedDate ?? null, promisedDate: order?.promisedDate ?? null,
      warehouse: stock?.warehouse ?? null, safetyStock: stock?.safetyStock ?? null,
      currentStock: stock?.currentStock ?? null, rejectedQty: stock?.rejectedQty ?? 0,
      shortageAfterIncoming });
  }
  return data;
}
