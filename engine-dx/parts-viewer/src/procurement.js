/**
 * Purchase-data boundary. No network requests, PDF extraction, inventory
 * inference or supplier-contract inference happen in this module.
 */
export const STATUS = Object.freeze({
  secured: Object.freeze({ label: '확보', color: '#33c98b' }),
  review: Object.freeze({ label: '확인 필요', color: '#f4bd45' }),
  shortage: Object.freeze({ label: '미확보', color: '#ed6c79' }),
  unknown: Object.freeze({ label: '데이터 미확인', color: '#929cab' }),
});

export const UNITS = Object.freeze([
  Object.freeze({ id: 'UNREGISTERED-001', label: '미등록 생산 호기', cylinders: 6, phase: '미등록', dueDate: null }),
]);

const EMPTY = {
  schemaVersion: '1.0',
  dataKind: 'unregistered',
  notice: '실제 생산 호기·품목·협력사·재고·발주 데이터는 미등록입니다.',
  units: UNITS,
  suppliers: [],
  supply: [],
  purchasingPolicy: [],
};

const DEMO_UNITS = [
  { id: 'DEMO-0601', label: '시연 호기 0601 · 가상 6기통', cylinders: 6, phase: '시연 · 제작 중', dueDate: '2026-11-30' },
  { id: 'DEMO-0702', label: '시연 호기 0702 · 가상 7기통', cylinders: 7, phase: '시연 · 제작 예정', dueDate: '2026-12-15' },
];

const DEMO = {
  schemaVersion: '1.0',
  dataKind: 'demo',
  notice: '모든 생산 호기·협력사·품목·수량·발주·일정은 가상 시연 데이터이며 실제 계약·재고와 관계없습니다.',
  units: DEMO_UNITS,
  suppliers: [
    { id: 'DEMO-SUP-A', name: '시연 협력사 A', fictional: true },
    { id: 'DEMO-SUP-B', name: '시연 협력사 B', fictional: true },
    { id: 'DEMO-SUP-C', name: '시연 협력사 C', fictional: true },
  ],
  supply: [],
  purchasingPolicy: [],
};

function demoRow(unitId, partId, supplierId, status, options = {}) {
  const qty = options.requiredQty ?? 1;
  return {
    unitId, partId,
    itemNumber: `DEMO-${partId}`, revision: '시연-A', supplierId,
    requiredQty: qty,
    availableStock: status === 'secured' ? qty : 0,
    shortageQty: status === 'shortage' ? qty : 0,
    allocatedQty: status === 'secured' ? qty : 0,
    openOrderQty: status === 'review' ? qty : 0,
    purchaseOrder: status === 'review' ? `DEMO-PO-${unitId.slice(-4)}` : null,
    requiredDate: '2026-11-25',
    expectedDate: status === 'review' ? '2026-11-28' : null,
    status,
    reason: status === 'secured' ? '시연: 요구 사양·수량에 맞는 가용재고 확보' : status === 'review' ? '시연: 입고 예정 · 필요일 대비 납기 지연 확인 필요' : '시연: 필요일까지 확보 대책 없는 부족 상태',
    updatedAt: '2026-10-20',
    procurementMode: 'individual',
    parentPartId: null,
    bomIncluded: true,
    ...options,
  };
}

for (const unit of DEMO_UNITS) {
  const alternate = unit.id === 'DEMO-0702';
  DEMO.supply.push(
    demoRow(unit.id, 'ENGINE_BEDPLATE', 'DEMO-SUP-B', 'secured'),
    demoRow(unit.id, 'ENGINE_FRAMEBOX', alternate ? 'DEMO-SUP-A' : 'DEMO-SUP-B', 'review'),
  );
  for (let cylinder = 1; cylinder <= unit.cylinders; cylinder++) {
    const prefix = `CYL${String(cylinder).padStart(2, '0')}`;
    const assemblyPartId = `${prefix}_EXHVALVE`;
    const linerStatus = cylinder % 3 === 0 ? 'shortage' : cylinder % 2 === 0 ? 'review' : 'secured';
    DEMO.supply.push(
      demoRow(unit.id, `${prefix}_LINER`, alternate ? 'DEMO-SUP-B' : 'DEMO-SUP-A', linerStatus),
      demoRow(unit.id, `${prefix}_COVER`, 'DEMO-SUP-B', 'secured'),
      demoRow(unit.id, assemblyPartId, 'DEMO-SUP-C', 'review', { procurementMode: 'assembly' }),
      demoRow(unit.id, `${prefix}_HYDPIPE_01`, 'DEMO-SUP-C', cylinder === 2 ? 'shortage' : 'review'),
    );
    DEMO.purchasingPolicy.push({ unitId: unit.id, assemblyPartId, mode: 'assembly' });
    // Child geometry keeps independent IDs. These rows are display-only and
    // deliberately carry no duplicated purchasing quantities or supplier claim.
    for (const child of ['HOUSING', 'SPINDLE', 'SEAT']) {
      DEMO.supply.push({
        ...nullSupply(unit.id, `${assemblyPartId}_${child}`),
        parentPartId: assemblyPartId, bomIncluded: false,
        reason: '시연: 컴플리트 구매에 포함된 구성품 · 별도 BOM 집계 제외',
      });
    }
  }
}

const QUANTITIES = ['requiredQty', 'availableStock', 'shortageQty', 'allocatedQty', 'openOrderQty'];
const OPTIONAL_TEXT = ['itemNumber', 'revision', 'purchaseOrder', 'reason'];
const ID = /^[A-Z0-9][A-Z0-9_-]{1,79}$/;
const PART_ID = /^[A-Z][A-Z0-9_]{1,79}$/;
const MAX_ROWS = 100000;
const clone = value => JSON.parse(JSON.stringify(value));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function nullSupply(unitId, partId) {
  return {
    unitId, partId, itemNumber: null, revision: null, supplierId: null,
    requiredQty: null, availableStock: null, shortageQty: null,
    allocatedQty: null, openOrderQty: null, purchaseOrder: null,
    requiredDate: null, expectedDate: null, status: 'unknown',
    reason: '데이터 미확인', updatedAt: null, procurementMode: null,
    parentPartId: null, bomIncluded: true,
  };
}

/** Returns a fresh data object. Initial mode always contains zero inventory facts. */
export function getDataset(mode = 'empty') {
  if (mode !== 'empty' && mode !== 'demo') throw new TypeError('데이터 모드는 empty 또는 demo입니다.');
  return clone(mode === 'demo' ? DEMO : EMPTY);
}

/** Exact placement lookup; model IDs never become real purchase item numbers. */
export function getSupply(dataset, unitId, partId) {
  const row = dataset?.supply?.find(row => row.unitId === unitId && row.partId === partId);
  return row ? { ...nullSupply(unitId, partId), ...clone(row) } : nullSupply(unitId, partId);
}

/** Highlight only explicit supplier assignments on the current production unit. */
export function getSupplierPartIds(dataset, unitId, supplierId) {
  if (!supplierId) return [];
  return [...new Set((dataset?.supply ?? [])
    .filter(row => row.unitId === unitId && row.supplierId === supplierId)
    .map(row => row.partId))];
}

export function getEffectiveStatus(dataset, unitId, partId) {
  return getSupply(dataset, unitId, partId).status;
}

export function getUnitSummary(dataset, unitId, partIds) {
  const ids = [...new Set(partIds ?? (dataset?.supply ?? [])
    .filter(row => row.unitId === unitId).map(row => row.partId))];
  const counts = { secured: 0, review: 0, shortage: 0, unknown: 0 };
  let registered = 0;
  for (const id of ids) {
    const row = getSupply(dataset, unitId, id);
    counts[Object.hasOwn(counts, row.status) ? row.status : 'unknown']++;
    if (row.itemNumber !== null) registered++;
  }
  return { total: ids.length, registered, unregistered: ids.length - registered, counts, ...counts };
}

function validDate(value, timestamp = false) {
  if (value == null) return true;
  if (typeof value !== 'string') return false;
  const datePattern = timestamp ? /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const datePart = value.slice(0, 10);
  return new Date(`${datePart}T00:00:00Z`).toISOString().slice(0, 10) === datePart;
}

/**
 * JSON import boundary. Returns errors instead of partially accepting bad data.
 * Registered data must explicitly declare its origin; demo identities cannot
 * silently become actual supplier or production records.
 */
export function validateDataset(input) {
  const errors = [];
  let data;
  try {
    if (typeof input === 'string' && input.length > 20 * 1024 * 1024) throw new Error('JSON 파일이 20 MiB 한도를 초과합니다.');
    data = typeof input === 'string' ? JSON.parse(input) : input;
  } catch (error) {
    return { valid: false, errors: [`JSON 해석 실패: ${error.message}`], dataset: null };
  }
  if (!isObject(data)) return { valid: false, errors: ['데이터 최상위는 JSON 객체여야 합니다.'], dataset: null };
  if (data.schemaVersion !== '1.0') errors.push('schemaVersion은 1.0이어야 합니다.');
  if (!['unregistered', 'demo', 'registered'].includes(data.dataKind)) errors.push('dataKind가 유효하지 않습니다.');
  for (const key of ['units', 'suppliers', 'supply']) {
    if (!Array.isArray(data[key])) errors.push(`${key}는 배열이어야 합니다.`);
    else if (data[key].length > MAX_ROWS) errors.push(`${key}가 ${MAX_ROWS}행 한도를 초과합니다.`);
  }
  if (errors.length) return { valid: false, errors, dataset: null };
  if (!data.units.length) errors.push('생산 호기가 최소 한 개 필요합니다.');
  const units = new Map();
  const suppliers = new Map();
  const rows = new Map();
  for (const [index, unit] of data.units.entries()) {
    const label = `units[${index}]`;
    if (!isObject(unit)) { errors.push(`${label}는 객체여야 합니다.`); continue; }
    if (typeof unit.id !== 'string' || !ID.test(unit.id)) errors.push(`${label}.id가 유효하지 않습니다.`);
    if (units.has(unit.id)) errors.push(`생산 호기 ID 중복: ${unit.id}`);
    units.set(unit.id, unit);
    if (typeof unit.label !== 'string' || !unit.label.trim()) errors.push(`${label}.label이 필요합니다.`);
    if (!Number.isInteger(unit.cylinders) || unit.cylinders < 1 || unit.cylinders > 24) errors.push(`${label}.cylinders는 1~24 정수여야 합니다.`);
    if (!validDate(unit.dueDate)) errors.push(`${label}.dueDate가 유효한 ISO 날짜가 아닙니다.`);
    if (data.dataKind === 'registered' && /^DEMO-/i.test(unit.id)) errors.push('시연 생산 호기를 실제 데이터로 등록할 수 없습니다.');
    if (data.dataKind === 'demo' && !/^DEMO-/.test(unit.id)) errors.push('시연 생산 호기 ID는 DEMO- 접두사가 필요합니다.');
  }
  for (const [index, supplier] of data.suppliers.entries()) {
    const label = `suppliers[${index}]`;
    if (!isObject(supplier)) { errors.push(`${label}는 객체여야 합니다.`); continue; }
    if (typeof supplier.id !== 'string' || !ID.test(supplier.id)) errors.push(`${label}.id가 유효하지 않습니다.`);
    if (suppliers.has(supplier.id)) errors.push(`협력사 ID 중복: ${supplier.id}`);
    suppliers.set(supplier.id, supplier);
    if (typeof supplier.name !== 'string' || !supplier.name.trim()) errors.push(`${label}.name이 필요합니다.`);
    if (typeof supplier.fictional !== 'boolean') errors.push(`${label}.fictional을 명시해야 합니다.`);
    if (data.dataKind === 'demo' && (supplier.fictional !== true || !/^DEMO-/.test(supplier.id))) errors.push('시연 협력사는 fictional:true 및 DEMO- ID여야 합니다.');
    if (data.dataKind === 'registered' && (supplier.fictional !== false || /^DEMO-/i.test(supplier.id))) errors.push('가상 협력사를 실제 데이터로 등록할 수 없습니다.');
  }
  for (const [index, row] of data.supply.entries()) {
    const label = `supply[${index}]`;
    if (!isObject(row)) { errors.push(`${label}는 객체여야 합니다.`); continue; }
    if (!units.has(row.unitId)) errors.push(`${label}.unitId에 등록된 생산 호기가 없습니다.`);
    if (typeof row.partId !== 'string' || !PART_ID.test(row.partId)) errors.push(`${label}.partId가 유효하지 않습니다.`);
    const key = `${row.unitId}:${row.partId}`;
    if (rows.has(key)) errors.push(`호기·부품 중복: ${key}`);
    rows.set(key, row);
    if (!Object.hasOwn(STATUS, row.status)) errors.push(`${label}.status가 유효하지 않습니다.`);
    if (row.supplierId != null && !suppliers.has(row.supplierId)) errors.push(`${label}.supplierId에 등록된 협력사가 없습니다.`);
    for (const field of QUANTITIES) {
      if (row[field] != null && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0)) errors.push(`${label}.${field}는 0 이상의 유한한 수 또는 null이어야 합니다.`);
    }
    for (const field of OPTIONAL_TEXT) {
      if (row[field] != null && (typeof row[field] !== 'string' || row[field].length > 2000)) errors.push(`${label}.${field}는 2000자 이내의 문자열 또는 null이어야 합니다.`);
    }
    for (const field of ['requiredDate', 'expectedDate']) {
      if (!validDate(row[field])) errors.push(`${label}.${field}가 유효한 ISO 날짜가 아닙니다.`);
    }
    if (!validDate(row.updatedAt, true)) errors.push(`${label}.updatedAt이 유효한 ISO 날짜/시간이 아닙니다.`);
    if (row.procurementMode != null && !['assembly', 'individual'].includes(row.procurementMode)) errors.push(`${label}.procurementMode가 유효하지 않습니다.`);
    if (row.bomIncluded != null && typeof row.bomIncluded !== 'boolean') errors.push(`${label}.bomIncluded는 boolean이어야 합니다.`);
    if (row.parentPartId != null && (typeof row.parentPartId !== 'string' || !PART_ID.test(row.parentPartId) || row.parentPartId === row.partId)) errors.push(`${label}.parentPartId가 유효하지 않습니다.`);
    const cylinder = /^CYL(\d{2})_/.exec(row.partId ?? '');
    if (cylinder && (Number(cylinder[1]) < 1 || Number(cylinder[1]) > (units.get(row.unitId)?.cylinders ?? 0))) errors.push(`${label}.partId가 해당 호기의 기통 수 범위를 벗어납니다.`);
    if (data.dataKind === 'registered' && [row.itemNumber, row.purchaseOrder].some(value => typeof value === 'string' && /^DEMO-/i.test(value))) errors.push(`${label}: 시연 품목·발주번호를 실제 데이터로 등록할 수 없습니다.`);
  }
  const policy = data.purchasingPolicy ?? [];
  if (!Array.isArray(policy)) errors.push('purchasingPolicy는 배열이어야 합니다.');
  const policies = new Map();
  if (Array.isArray(policy)) for (const [index, rule] of policy.entries()) {
    if (!isObject(rule) || !units.has(rule.unitId) || typeof rule.assemblyPartId !== 'string' || !PART_ID.test(rule.assemblyPartId) || !['assembly', 'individual'].includes(rule.mode)) {
      errors.push(`purchasingPolicy[${index}]가 유효하지 않습니다.`); continue;
    }
    const key = `${rule.unitId}:${rule.assemblyPartId}`;
    if (policies.has(key)) errors.push(`구매 정책 중복: ${key}`);
    policies.set(key, rule.mode);
    const parent = rows.get(key);
    if (rule.mode === 'assembly' && (!parent || parent.procurementMode !== 'assembly')) errors.push(`${key}: 조립체 구매 행이 필요합니다.`);
    if (rule.mode === 'individual' && parent && parent.bomIncluded !== false) errors.push(`${key}: 개별 구매 정책에서 조립체를 함께 BOM 집계할 수 없습니다.`);
  }
  for (const [key, row] of rows) {
    if (row.procurementMode === 'assembly' && row.bomIncluded !== false && policies.get(key) === 'individual') errors.push(`${key}: 구매 정책과 조립체 구매가 충돌합니다.`);
    if (row.parentPartId) {
      const parent = rows.get(`${row.unitId}:${row.parentPartId}`);
      if (!parent) errors.push(`${key}: parentPartId에 해당하는 동일 호기 상위 행이 없습니다.`);
      const ownCylinder = /^CYL\d{2}_/.exec(row.partId)?.[0];
      const parentCylinder = /^CYL\d{2}_/.exec(row.parentPartId)?.[0];
      if (ownCylinder !== parentCylinder) errors.push(`${key}: 다른 기통의 조립체를 부모로 지정할 수 없습니다.`);
      if (parent?.procurementMode === 'assembly' && parent.bomIncluded !== false && row.bomIncluded !== false) errors.push(`${key}: 조립체와 하위 부품의 BOM 중복입니다. 정보용 하위 행은 bomIncluded:false로 지정하세요.`);
    }
    // Exhaust-valve children need an explicit parent even when imports omit it.
    const impliedParentId = /^(CYL\d{2}_EXHVALVE)_(HOUSING|SPINDLE|SEAT)$/.exec(row.partId ?? '')?.[1];
    if (impliedParentId) {
      if (row.parentPartId !== impliedParentId) errors.push(`${key}: 배기밸브 하위 부품은 parentPartId를 명시해야 합니다.`);
      const parent = rows.get(`${row.unitId}:${impliedParentId}`);
      if (parent?.procurementMode === 'assembly' && parent.bomIncluded !== false && row.bomIncluded !== false) errors.push(`${key}: 배기밸브 컴플리트와 하위 부품을 중복 집계할 수 없습니다.`);
    }
    const visited = new Set([row.partId]);
    let parentId = row.parentPartId;
    while (parentId) {
      if (visited.has(parentId)) { errors.push(`${key}: 부모 부품 관계에 순환이 있습니다.`); break; }
      visited.add(parentId);
      parentId = rows.get(`${row.unitId}:${parentId}`)?.parentPartId;
    }
  }
  if (data.dataKind === 'unregistered' && (data.supply.length || data.suppliers.length)) errors.push('미등록 데이터에는 공급·재고·발주·협력사 사실을 포함할 수 없습니다. 사용자 제공 실데이터는 dataKind:registered로 명시하세요.');
  if (data.dataKind === 'registered' && (typeof data.sourceDescription !== 'string' || !data.sourceDescription.trim())) errors.push('실제 등록 데이터에는 sourceDescription으로 사용자가 제공한 원천을 명시해야 합니다.');
  if (errors.length) return { valid: false, errors: [...new Set(errors)], dataset: null };
  try {
    const normalized = clone(data);
    normalized.purchasingPolicy ??= [];
    normalized.supply = normalized.supply.map(row => ({ ...nullSupply(row.unitId, row.partId), ...row }));
    return { valid: true, errors: [], dataset: normalized };
  } catch {
    return { valid: false, errors: ['순환 객체 또는 JSON으로 직렬화할 수 없는 값이 있습니다.'], dataset: null };
  }
}

/** No stock/shortage inference: preserves quantities explicitly supplied by users. */
export function buildBom(dataset, unitId) {
  const unitRows = (dataset?.supply ?? []).filter(row => row.unitId === unitId);
  const byId = new Map(unitRows.map(row => [row.partId, row]));
  const items = [];
  const excludedChildren = [];
  for (const row of unitRows) {
    const parent = row.parentPartId ? byId.get(row.parentPartId) : null;
    if (row.bomIncluded === false || (parent?.procurementMode === 'assembly' && parent.bomIncluded !== false)) {
      excludedChildren.push({ ...clone(row), exclusionReason: parent?.procurementMode === 'assembly' ? '상위 조립체 구매에 포함' : '정보용 또는 개별 구매 정책의 상위 노드' });
    } else items.push(clone(row));
  }
  return {
    unitId, items, excludedChildren,
    totalRows: items.length,
    totalRequiredQty: items.length && items.every(row => typeof row.requiredQty === 'number') ? items.reduce((sum, row) => sum + row.requiredQty, 0) : null,
    notice: '명시적으로 연결된 구매 행만 집계합니다. 재고·부족량·호기 배정량은 자동 추정하지 않습니다.',
  };
}

export function exportDataset(dataset) {
  const result = validateDataset(dataset);
  if (!result.valid) throw new TypeError(result.errors.join('\n'));
  return JSON.stringify(result.dataset, null, 2);
}
