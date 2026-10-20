/**
 * Purchasing-data adapter for independently authored G95 concept geometry.
 * No part category, supplier scope, or legacy `used_by` field implies a fit.
 * A supply relationship exists only at the explicit (unitId, partId) key.
 */
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const idOf = part => typeof part === 'string' ? part : part?.id ?? part?.partId;
const CATEGORIES = Object.freeze({
  liner: ['G95_CONCEPT_LINER', '실린더'],
  cover: ['G95_CONCEPT_COVER', '실린더'],
  frame: ['G95_CONCEPT_FRAMEBOX', '구조물'],
  bedplate: ['G95_CONCEPT_BEDPLATE', '구조물'],
  mbs: ['G95_CONCEPT_MBS', '구조물'],
  shell: ['G95_CONCEPT_BEARING_SHELL', '연결 문맥'],
  cylinderFrame: ['G95_CONCEPT_CYLINDER_FRAME', '연결 문맥'],
  valve: ['G95_CONCEPT_EXHAUST_ASSEMBLY', '배기밸브'],
  housing: ['G95_CONCEPT_EXHAUST_HOUSING', '배기밸브'],
  spindle: ['G95_CONCEPT_EXHAUST_SPINDLE', '배기밸브'],
  seat: ['G95_CONCEPT_EXHAUST_SEAT', '배기밸브'],
  pipe: ['G95_CONCEPT_HYDRAULIC_PIPE', '유압 배관'],
});
export const STATUS = Object.freeze({
  secured: { label: '확보', color: '#45b981' },
  review: { label: '확인 필요', color: '#e7b74e' },
  shortage: { label: '미확보', color: '#e87472' },
  unknown: { label: '미등록', color: '#91a0af' },
});
export const MODEL_NOTICE = '구조 설명용 모델 / 실제 제작 치수 아님';

export function createCatalog(metadata, sources = []) {
  if (!Array.isArray(metadata)) throw new TypeError('metadata must be an array');
  const seen = new Set();
  return metadata.map(raw => {
    const id = raw.partId;
    if (!id || seen.has(id)) throw new Error(`Missing or duplicate geometry partId: ${id}`);
    seen.add(id);
    const [typeId, group] = CATEGORIES[raw.category] ?? ['G95_CONCEPT_CONTEXT', '연결 문맥'];
    const cylinderMatch = /^CYL(\d+)_/.exec(id);
    const sourceIds = Array.isArray(raw.sources) ? raw.sources : [];
    return {
      ...clone(raw), id, partId: id, part_instance_id: id,
      name_ko: raw.nameKo ?? id, part_type_id: typeId,
      group, cylinder: cylinderMatch ? Number(cylinderMatch[1]) : null,
      accuracy: raw.accuracy ?? 'concept', dimensionsVerified: raw.dimensionsVerified === true,
      geometry_status: raw.accuracyLabel ?? MODEL_NOTICE, sources: sourceIds,
      sourceRecords: sourceIds.map(sourceId => Array.isArray(sources)
        ? sources.find(source => (source.id ?? source.sourceId) === sourceId)
        : sources?.[sourceId]).filter(Boolean).map(clone),
      role: raw.role ?? 'context', bomRole: raw.bomRole ?? 'context',
      parentPartId: raw.parentPartId ?? null,
    };
  });
}

function unknownSupply(unitId, partId) {
  return {
    unitId, partId, supplierId: null, status: 'unknown', itemNo: null, rev: null,
    required: null, available: null, allocated: null, shortage: null,
    poNo: null, openOrder: null, requiredDate: null, expectedDate: null,
    reason: '미등록', updatedAt: null, variantId: null,
    supplyRole: null, registered: false, sample: false,
  };
}

export function getSupply(data, unitId, part) {
  const partId = idOf(part);
  const row = data?.supply?.find(row => row.unitId === unitId && row.partId === partId);
  if (!row) return unknownSupply(unitId, partId);
  const result = { ...unknownSupply(unitId, partId), ...clone(row), registered: true };
  result.sample = data?.meta?.dataKind === 'demo';
  // Quantities are supplied by the registered source. This visual adapter does
  // not calculate stock availability, allocation, or shortage from geometry.
  return result;
}

export function getSupplierPartIds(data, unitId, supplierId) {
  return [...new Set((data?.supply ?? [])
    .filter(row => row.unitId === unitId && row.supplierId === supplierId)
    .map(row => row.partId))];
}

export function getPartSuppliers(data, unitId, part) {
  const row = getSupply(data, unitId, part);
  if (!row.supplierId) return [];
  const supplier = data?.suppliers?.find(supplier => supplier.supplier_id === row.supplierId);
  return supplier ? [{ ...clone(supplier), status: row.status, supplyRole: row.supplyRole,
    sample: data?.meta?.dataKind === 'demo' }] : [];
}

export function getInventoryForPart(data, unitId, part) {
  const typeId = typeof part === 'object' ? part.part_type_id : null;
  const bucket = typeId ? data?.inventory?.types?.[typeId] : null;
  const supply = getSupply(data, unitId, part);
  const assignedVariantIds = supply.variantId ? [supply.variantId] : [];
  const variants = clone(bucket?.variants ?? []).map(row => ({
    ...row, assigned: assignedVariantIds.includes(row.variant_id),
    hypothetical_assignment: data?.meta?.dataKind === 'demo' && assignedVariantIds.includes(row.variant_id),
  }));
  const total = variants.length && variants.every(row => typeof row.stock_qty === 'number')
    ? variants.reduce((sum, row) => sum + row.stock_qty, 0) : null;
  return {
    variants, total, typeScope: '유형 공용 재고 · 선택 호기의 가용·배정 수량과 별도',
    partTypeId: typeId, assignedVariantIds,
    notice: bucket?.note ?? '승인된 품목 적용 관계와 실제 재고 데이터 미등록',
    provenance: clone(bucket?.provenance ?? null),
    sample: data?.meta?.dataKind === 'demo',
  };
}

/** BOM counts only explicit purchasing rows, never derived geometry counts. */
export function getBomRows(data, unitId, catalog) {
  const policies = data?.bomPolicies ?? {};
  const rows = (catalog ?? []).filter(part => {
    if (part.bomRole === 'context' || part.role === 'context') return false;
    if (policies.bedplateIncludesMbs !== false && part.category === 'mbs') return false;
    const mode = policies.exhaustValvePurchaseMode?.[unitId] ?? 'assembly';
    if (mode === 'assembly' && part.bomRole === 'child') return false;
    if (mode === 'children' && part.bomRole === 'assembly') return false;
    return true;
  }).map(part => ({ part, supply: getSupply(data, unitId, part) }));
  return rows;
}

export function summarizeSupply(data, unitId, catalog) {
  const rows = getBomRows(data, unitId, catalog);
  const counts = { secured: 0, review: 0, shortage: 0, unknown: 0 };
  rows.forEach(({ supply }) => { counts[supply.status]++; });
  const known = rows.filter(({ supply }) => typeof supply.required === 'number');
  return { counts, purchasePositions: rows.length, registeredPositions: known.length,
    requiredTotal: known.length ? known.reduce((sum, { supply }) => sum + supply.required, 0) : null,
    notice: '구매 위치 상태 집계. 미등록 위치의 필요량을 0으로 계산하지 않음.' };
}

const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const isNullableString = value => value === null || typeof value === 'string';
const isNullableNumber = value => value === null || (Number.isFinite(value) && value >= 0);
const dateIsValid = value => {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day && Number.isFinite(Date.parse(value));
};
const validPartId = value => typeof value === 'string' && (
  /^CYL\d{2}_(LINER|COVER|FRAME|EXHVALVE(?:_HOUSING|_SPINDLE|_SEAT)?|HYDPIPE_01)$/.test(value)
  || /^ENGINE_(BEDPLATE|FRAMEBOX|(?:MBS|SHELL)_\d{2})$/.test(value));
const hasDemoIdentity = value => {
  if (Array.isArray(value)) return value.some(hasDemoIdentity);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, item]) => {
    if ((key === 'sample' && item === true) || key === 'excludedLegacyField') return true;
    if (typeof item === 'string' && (/^(DEMO-|SMP-|SUP-DEMO-)/i.test(item)
      || /^(가상 협력사|시연:)/.test(item))) return true;
    if (['source', 'sourceDatasetModel', 'crosswalk'].includes(key) && typeof item === 'string'
      && /SAMPLE|시연|가상/.test(item)) return true;
    return hasDemoIdentity(item);
  });
};

/** Validate an optional imported dataset before replacing the current view. */
export function validateData(data, catalog) {
  const errors = [];
  const warnings = [];
  if (!isRecord(data)) return { valid: false, errors: ['데이터는 JSON 객체여야 합니다.'], warnings };
  const kind = data.meta?.dataKind;
  if (!['unregistered', 'demo', 'registered'].includes(kind)) errors.push('meta.dataKind가 필요합니다.');
  if (kind === 'demo' && data.meta?.sample !== true) errors.push('시연 데이터는 meta.sample=true여야 합니다.');
  if (kind === 'registered' && (!data.meta?.source || data.meta?.sample !== false))
    errors.push('등록 데이터는 meta.source와 sample=false가 필요합니다.');
  if (kind === 'registered' && hasDemoIdentity(data))
    errors.push('시연 식별자·SAMPLE 출처·가상 값을 실제 등록 데이터로 전환할 수 없습니다.');
  for (const key of ['units', 'suppliers', 'supply']) if (!Array.isArray(data[key])) errors.push(`${key} 배열이 필요합니다.`);
  if (!isRecord(data.inventory?.types)) errors.push('inventory.types 객체가 필요합니다.');
  if (errors.length) return { valid: false, errors, warnings };
  const units = new Map();
  data.units.forEach(unit => {
    if (!unit?.id || units.has(unit.id)) errors.push(`호기 ID 누락 또는 중복: ${unit?.id}`);
    else units.set(unit.id, unit);
    if (!Number.isInteger(unit?.cylinderCount) || unit.cylinderCount < 2 || unit.cylinderCount > 12)
      errors.push(`기통 수는 2~12 정수여야 합니다: ${unit?.id}`);
  });
  const suppliers = new Set();
  data.suppliers.forEach(supplier => {
    if (!supplier?.supplier_id || suppliers.has(supplier.supplier_id)) errors.push('협력사 ID 누락 또는 중복');
    suppliers.add(supplier?.supplier_id);
    if (!isNullableNumber(supplier?.on_time_rate_pct) || supplier.on_time_rate_pct > 100)
      errors.push(`납기 준수율은 null 또는 0~100: ${supplier?.supplier_id}`);
    if (supplier?.grade !== null && typeof supplier?.grade !== 'string') errors.push(`등급은 문자열 또는 null: ${supplier?.supplier_id}`);
  });
  const catalogMap = catalog ? new Map(catalog.map(part => [idOf(part), part])) : null;
  const variantIds = new Set();
  Object.entries(data.inventory.types).forEach(([typeId, type]) => {
    if (!Array.isArray(type?.variants)) { errors.push(`variants 배열 누락: ${typeId}`); return; }
    type.variants.forEach(variant => {
      if (!variant?.variant_id || variantIds.has(variant.variant_id)) errors.push(`variant_id 누락 또는 중복: ${variant?.variant_id}`);
      variantIds.add(variant?.variant_id);
      for (const field of ['stock_qty', 'safety_stock']) if (!isNullableNumber(variant?.[field])) errors.push(`${typeId}.${field} 수량 오류`);
      if (variant?.used_by?.length) errors.push(`${typeId}: legacy used_by 자동 적용은 허용하지 않습니다.`);
    });
  });
  const keys = new Set();
  data.supply.forEach((row, index) => {
    const at = `supply[${index}]`;
    if (!isRecord(row)) { errors.push(`${at}: 객체가 필요합니다.`); return; }
    const key = `${row.unitId}\u0000${row.partId}`;
    if (keys.has(key)) errors.push(`${at}: 호기/partId 중복`);
    keys.add(key);
    const unit = units.get(row.unitId);
    if (!unit) errors.push(`${at}: 알 수 없는 호기`);
    if (!validPartId(row.partId))
      errors.push(`${at}: partId 형식 오류`);
    const cyl = /^CYL(\d+)_/.exec(row.partId ?? '');
    const station = /^ENGINE_(?:MBS|SHELL)_(\d+)$/.exec(row.partId ?? '');
    if (unit && (cyl && (Number(cyl[1]) < 1 || Number(cyl[1]) > unit.cylinderCount)
      || station && (Number(station[1]) < 1 || Number(station[1]) > unit.cylinderCount + 1)))
      errors.push(`${at}: 호기의 기통/지지 위치 범위 초과`);
    // A catalog can represent the current unit only; other unit positions are
    // checked against the stable-ID grammar and their own cylinder counts.
    if (catalogMap && !catalogMap.has(row.partId) && !cyl && !station) errors.push(`${at}: catalog에 없는 partId`);
    if (row.supplierId !== null && !suppliers.has(row.supplierId)) errors.push(`${at}: 협력사 미등록`);
    if (!Object.hasOwn(STATUS, row.status)) errors.push(`${at}: 상태 오류`);
    for (const field of ['required', 'available', 'allocated', 'shortage', 'openOrder'])
      if (!isNullableNumber(row[field])) errors.push(`${at}.${field}: null 또는 0 이상 숫자 필요`);
    for (const field of ['itemNo', 'rev', 'poNo', 'reason', 'variantId'])
      if (row[field] !== undefined && !isNullableString(row[field])) errors.push(`${at}.${field}: 문자열 또는 null 필요`);
    for (const field of ['requiredDate', 'expectedDate', 'updatedAt'])
      if (!dateIsValid(row[field])) errors.push(`${at}.${field}: 날짜 또는 null 필요`);
    if (row.variantId && !variantIds.has(row.variantId)) errors.push(`${at}: variantId 미등록`);
    const part = catalogMap?.get(row.partId);
    if (row.variantId && part && !(data.inventory.types[part.part_type_id]?.variants ?? []).some(variant => variant.variant_id === row.variantId))
      errors.push(`${at}: variantId와 부품 유형이 일치하지 않습니다.`);
    if (row.status === 'secured' && !(typeof row.required === 'number' && row.required > 0
      && typeof row.available === 'number' && row.available >= row.required)) errors.push(`${at}: 확보 상태의 승인 가용량이 필요량보다 작거나 미등록`);
    if (row.status === 'shortage' && !(typeof row.required === 'number' && row.required > 0
      && typeof row.available === 'number' && row.available < row.required)) errors.push(`${at}: 미확보 상태 수량 근거가 필요합니다.`);
    if (row.status !== 'unknown' && !row.reason) errors.push(`${at}: 상태 사유가 필요합니다.`);
    if (typeof row.available === 'number' && typeof row.allocated === 'number' && row.allocated > row.available)
      errors.push(`${at}: 호기 배정량이 승인 가용량을 초과합니다.`);
  });
  if (kind === 'unregistered' && (data.supply.length || data.suppliers.length || Object.keys(data.inventory.types).length))
    errors.push('미등록 데이터셋에는 재고·공급·평가 값을 넣을 수 없습니다.');
  if (!data.bomPolicies) warnings.push('BOM 정책 미등록: 조립체 구매, MBS 베드 통합을 기본 적용합니다.');
  if (kind === 'demo') warnings.push('모든 공급·재고·등급·납기는 가상 시연 값입니다. 실제 G95 적용 근거가 아닙니다.');
  return { valid: errors.length === 0, errors, warnings };
}
