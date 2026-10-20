import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Works independently of a host project's package.json module mode.
const source = await readFile(new URL('../src/procurement.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { getDataset, getSupply, getSupplierPartIds, getEffectiveStatus, getUnitSummary, validateDataset, buildBom, exportDataset } = api;

test('initial actual mode has no invented stock, orders, supplier or purchase item', () => {
  const data = getDataset();
  assert.equal(data.dataKind, 'unregistered');
  assert.equal(data.units[0].id, 'UNREGISTERED-001');
  assert.deepEqual(data.supply, []);
  assert.deepEqual(data.suppliers, []);
  const row = getSupply(data, data.units[0].id, 'CYL01_LINER');
  for (const field of ['itemNumber', 'revision', 'supplierId', 'requiredQty', 'availableStock', 'shortageQty', 'allocatedQty', 'openOrderQty', 'purchaseOrder', 'requiredDate', 'expectedDate', 'updatedAt']) assert.equal(row[field], null, field);
  assert.equal(row.status, 'unknown');
  assert.equal(row.reason, '데이터 미확인');
  assert.equal(validateDataset(data).valid, true);
});

test('dataset callers cannot mutate future initial data', () => {
  const data = getDataset();
  data.units[0].cylinders = 17;
  data.suppliers.push({ id: 'X' });
  assert.equal(getDataset().units[0].cylinders, 6);
  assert.equal(getDataset().suppliers.length, 0);
  assert.throws(() => getDataset('actual'), TypeError);
});

test('supplier selection only returns exact current unit assignments', () => {
  const data = getDataset('demo');
  assert.equal(validateDataset(data).valid, true);
  const first = getSupplierPartIds(data, 'DEMO-0601', 'DEMO-SUP-A');
  const second = getSupplierPartIds(data, 'DEMO-0702', 'DEMO-SUP-A');
  assert.ok(first.includes('CYL01_LINER'));
  assert.ok(!first.includes('ENGINE_FRAMEBOX'));
  assert.deepEqual(second, ['ENGINE_FRAMEBOX']);
  assert.deepEqual(getSupplierPartIds(data, 'MISSING-UNIT', 'DEMO-SUP-A'), []);
  assert.deepEqual(getSupplierPartIds(data, 'DEMO-0601', null), []);
  assert.ok(!getSupplierPartIds(data, 'DEMO-0601', 'DEMO-SUP-C').includes('CYL01_EXHVALVE_SPINDLE'));
});

test('summary and statuses preserve unknown and never derive stock availability', () => {
  const data = getDataset('demo');
  assert.equal(getEffectiveStatus(data, 'DEMO-0601', 'CYL01_LINER'), 'secured');
  assert.equal(getEffectiveStatus(data, 'DEMO-0601', 'CYL02_LINER'), 'review');
  assert.equal(getEffectiveStatus(data, 'DEMO-0601', 'CYL03_LINER'), 'shortage');
  assert.equal(getEffectiveStatus(data, 'DEMO-0601', 'ENGINE_MBS_01'), 'unknown');
  const summary = getUnitSummary(data, 'DEMO-0601', ['CYL01_LINER', 'CYL01_LINER', 'CYL02_LINER', 'CYL03_LINER', 'ENGINE_MBS_01']);
  assert.deepEqual(summary.counts, { secured: 1, review: 1, shortage: 1, unknown: 1 });
  assert.equal(summary.total, 4);
  assert.equal(summary.registered, 3);
});

test('BOM preserves assembly hierarchy and excludes informational children', () => {
  const data = getDataset('demo');
  const bom = buildBom(data, 'DEMO-0601');
  assert.equal(bom.items.length, 26);
  assert.equal(bom.excludedChildren.length, 18);
  assert.ok(bom.items.some(row => row.partId === 'CYL01_EXHVALVE'));
  assert.ok(!bom.items.some(row => row.partId === 'CYL01_EXHVALVE_SPINDLE'));
  assert.ok(bom.excludedChildren.some(row => row.partId === 'CYL01_EXHVALVE_SPINDLE' && row.parentPartId === 'CYL01_EXHVALVE'));
  assert.equal(buildBom(getDataset(), 'UNREGISTERED-001').totalRequiredQty, null);
});

test('rejects duplicate placements, inherited property status, invalid numbers and dates', () => {
  for (const mutate of [
    data => data.supply.push({ ...data.supply[0] }),
    data => { data.supply[0].status = 'toString'; },
    data => { data.supply[0].requiredQty = -1; },
    data => { data.supply[0].availableStock = Infinity; },
    data => { data.supply[0].openOrderQty = '1'; },
    data => { data.supply[0].expectedDate = '2026-02-30'; },
    data => { data.supply[0].supplierId = 'NOT-REGISTERED'; },
    data => { data.supply[0].partId = 'CYL07_LINER'; },
  ]) {
    const data = getDataset('demo');
    mutate(data);
    const result = validateDataset(data);
    assert.equal(result.valid, false);
    assert.equal(result.dataset, null);
    assert.ok(result.errors.length);
  }
});

test('rejects child double purchase even when parent metadata was omitted', () => {
  const data = getDataset('demo');
  const child = data.supply.find(row => row.unitId === 'DEMO-0601' && row.partId === 'CYL01_EXHVALVE_SPINDLE');
  child.bomIncluded = true;
  child.procurementMode = 'individual';
  child.requiredQty = 1;
  delete child.parentPartId;
  const result = validateDataset(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(message => message.includes('중복')));
});

test('rejects parent cycles, cross-cylinder parents, policy conflicts', () => {
  for (const mutate of [
    data => { data.supply[0].parentPartId = 'ENGINE_FRAMEBOX'; data.supply[1].parentPartId = 'ENGINE_BEDPLATE'; },
    data => { data.supply.find(row => row.partId === 'CYL01_EXHVALVE_SPINDLE').parentPartId = 'CYL02_EXHVALVE'; },
    data => { data.purchasingPolicy[0].mode = 'individual'; },
  ]) {
    const data = getDataset('demo');
    mutate(data);
    assert.equal(validateDataset(data).valid, false);
  }
});

test('allows explicit individual component purchasing without counting assembly', () => {
  const data = getDataset('demo');
  const parent = data.supply.find(row => row.unitId === 'DEMO-0601' && row.partId === 'CYL01_EXHVALVE');
  parent.bomIncluded = false;
  parent.procurementMode = null;
  data.purchasingPolicy[0].mode = 'individual';
  for (const row of data.supply.filter(row => row.unitId === 'DEMO-0601' && row.parentPartId === 'CYL01_EXHVALVE')) {
    row.bomIncluded = true;
    row.procurementMode = 'individual';
    row.requiredQty = 1;
  }
  assert.equal(validateDataset(data).valid, true);
  const bom = buildBom(data, 'DEMO-0601');
  assert.ok(!bom.items.some(row => row.partId === 'CYL01_EXHVALVE'));
  assert.ok(bom.items.some(row => row.partId === 'CYL01_EXHVALVE_SPINDLE'));
});

test('demo cannot silently pass as actual production or unregistered data', () => {
  const data = getDataset('demo');
  data.dataKind = 'registered';
  data.sourceDescription = '사용자 제공 CSV';
  assert.equal(validateDataset(data).valid, false);
  data.dataKind = 'unregistered';
  assert.equal(validateDataset(data).valid, false);
});

test('supports user supplied actual data with explicit source and no inferred quantities', () => {
  const actual = {
    schemaVersion: '1.0', dataKind: 'registered', sourceDescription: '구매팀이 직접 제공한 ERP 내보내기',
    units: [{ id: 'USER-001', label: '사용자 입력 호기', cylinders: 6, dueDate: null }],
    suppliers: [{ id: 'USER-SUP-1', name: '사용자 입력 업체', fictional: false }],
    supply: [{ unitId: 'USER-001', partId: 'CYL01_LINER', itemNumber: 'USER-ITEM-1', supplierId: 'USER-SUP-1', requiredQty: 1, availableStock: null, status: 'unknown' }],
  };
  const result = validateDataset(actual);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.dataset.supply[0].shortageQty, null);
  assert.equal(result.dataset.supply[0].status, 'unknown');
  assert.equal(result.dataset.supply[0].revision, null);
});

test('JSON import/export roundtrip preserves stable placement IDs and purchase policy', () => {
  const data = getDataset('demo');
  const result = validateDataset(exportDataset(data));
  assert.equal(result.valid, true);
  assert.deepEqual(result.dataset.supply.map(row => [row.unitId, row.partId, row.parentPartId]), data.supply.map(row => [row.unitId, row.partId, row.parentPartId]));
  assert.deepEqual(result.dataset.purchasingPolicy, data.purchasingPolicy);
  assert.equal(validateDataset('{invalid').valid, false);
  assert.equal(validateDataset([]).valid, false);
});

test('published JSON templates match the executable datasets', async () => {
  for (const mode of ['empty', 'demo']) {
    const json = JSON.parse(await readFile(new URL(`../public/data/procurement-${mode}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(json, getDataset(mode));
  }
});
