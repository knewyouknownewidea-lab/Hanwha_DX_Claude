import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEngine } from '../lib/engine-model/engine-scene.js';
import { createCatalog, getSupply, getSupplierPartIds, getPartSuppliers,
  getInventoryForPart, getBomRows, summarizeSupply, validateData } from '../lib/parts-inventory.mjs';

const read = async file => JSON.parse((await readFile(new URL(file, import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
const demo = await read('../public/data/parts-inventory-demo.json');
const empty = await read('../public/data/parts-inventory-empty.json');
const sources = await read('../public/data/model-sources.json');
const catalog6 = createCatalog(createEngine(6).metadata, sources);
const catalog7 = createCatalog(createEngine(7).metadata, sources);
const liner = catalog6.find(part => part.id === 'CYL01_LINER');
const mutate = (data, change) => { const result = structuredClone(data); change(result); return result; };

test('6/7 cylinder geometry creates stable independent catalog IDs', () => {
  assert.equal(catalog6.length, 64);
  assert.equal(catalog7.length, 74);
  assert.equal(new Set(catalog7.map(part => part.id)).size, 74);
  assert.equal(catalog7.filter(part => part.cylinder === 7).length, 8);
  assert.ok(catalog7.some(part => part.id === 'ENGINE_MBS_08'));
  assert.equal(catalog6.find(part => part.id === 'CYL01_LINER').part_type_id,
    catalog7.find(part => part.id === 'CYL01_LINER').part_type_id);
});

test('catalog preserves concept accuracy, source records, MBS/shell and assembly hierarchy', () => {
  assert.ok(catalog6.every(part => !part.dimensionsVerified && part.accuracy === 'concept'));
  assert.match(liner.geometry_status, /실제 제작 치수 아님/);
  assert.ok(liner.sourceRecords.some(source => source.id === 'R1'));
  assert.notEqual(catalog6.find(part => part.id === 'ENGINE_MBS_01').part_type_id,
    catalog6.find(part => part.id === 'ENGINE_SHELL_01').part_type_id);
  assert.equal(catalog6.find(part => part.id === 'CYL01_EXHVALVE_SPINDLE').parentPartId, 'CYL01_EXHVALVE');
  assert.throws(() => createCatalog([{ partId: 'X' }, { partId: 'X' }]), /duplicate/);
});

test('empty and demo datasets pass contract validation', () => {
  assert.deepEqual(validateData(empty, catalog6).errors, []);
  assert.deepEqual(validateData(demo, catalog6).errors, []);
  assert.deepEqual(validateData(demo, catalog7).errors, []);
});

test('unregistered mode retains unknown quantities and has no green state or invented supplier', () => {
  const row = getSupply(empty, 'UNREGISTERED-6', liner);
  assert.equal(row.status, 'unknown');
  for (const key of ['required', 'available', 'allocated', 'shortage', 'openOrder']) assert.equal(row[key], null);
  assert.deepEqual(getPartSuppliers(empty, 'UNREGISTERED-6', liner), []);
  assert.deepEqual(getSupplierPartIds(empty, 'UNREGISTERED-6', 'SUP-DEMO-A'), []);
  assert.equal(getInventoryForPart(empty, 'UNREGISTERED-6', liner).total, null);
  assert.equal(summarizeSupply(empty, 'UNREGISTERED-6', catalog6).requiredTotal, null);
});

test('supplier emphasis is an explicit unit/partId relation, never the whole liner type', () => {
  const ids = getSupplierPartIds(demo, 'DEMO-6A', 'SUP-DEMO-A');
  assert.deepEqual(ids, ['CYL01_LINER', 'CYL02_LINER', 'CYL04_LINER', 'CYL06_LINER']);
  assert.ok(!ids.includes('CYL03_LINER'));
  assert.deepEqual(getSupplierPartIds(demo, 'DEMO-7B', 'SUP-DEMO-A'), ['CYL02_LINER']);
  assert.deepEqual(getSupplierPartIds(demo, 'NONEXISTENT', 'SUP-DEMO-A'), []);
});

test('identical spatial IDs can have different units, revisions, item numbers and suppliers', () => {
  const six = getSupply(demo, 'DEMO-6A', liner);
  const seven = getSupply(demo, 'DEMO-7B', liner);
  assert.equal(six.status, 'secured');
  assert.equal(seven.status, 'shortage');
  assert.notEqual(six.itemNo, seven.itemNo);
  assert.notEqual(six.rev, seven.rev);
  assert.notEqual(six.supplierId, seven.supplierId);
});

test('legacy SAMPLE variants are type scoped, retain explicit provenance, and drop used_by', () => {
  const inventory = getInventoryForPart(demo, 'DEMO-6A', liner);
  assert.equal(inventory.total, 13);
  assert.equal(getSupply(demo, 'DEMO-6A', liner).available, 1);
  assert.match(inventory.typeScope, /유형 공용/);
  assert.equal(inventory.provenance.originalTypeId, 'LINER');
  assert.ok(inventory.variants.every(variant => !variant.used_by && variant.sample));
  assert.equal(inventory.variants.filter(variant => variant.assigned).length, 1);
  assert.ok(inventory.variants[0].hypothetical_assignment);
  assert.ok(!Object.hasOwn(demo.inventory.types, 'G95_CONCEPT_MBS'));
  assert.ok(!Object.hasOwn(demo.inventory.types, 'G95_CONCEPT_BEARING_SHELL'));
});

test('source shortage stays null when absent; adapter does not calculate stock or shortage', () => {
  const modified = mutate(demo, data => { delete data.supply[0].shortage; });
  assert.equal(getSupply(modified, 'DEMO-6A', liner).shortage, null);
  assert.equal(getSupply(demo, 'DEMO-6A', 'CYL04_LINER').shortage, 1);
});

test('supplier grade and on-time values remain explicitly sample and exact-row linked', () => {
  const suppliers = getPartSuppliers(demo, 'DEMO-6A', liner);
  assert.equal(suppliers.length, 1);
  assert.equal(suppliers[0].supplier_id, 'SUP-DEMO-A');
  assert.equal(suppliers[0].grade, 'A');
  assert.equal(suppliers[0].on_time_rate_pct, 96.4);
  assert.equal(suppliers[0].sample, true);
  assert.deepEqual(getPartSuppliers(demo, 'DEMO-6A', 'CYL01_EXHVALVE_SPINDLE'), []);
});

test('return values cannot mutate the source datasets', () => {
  const supply = getSupply(demo, 'DEMO-6A', liner); supply.required = 999;
  const inventory = getInventoryForPart(demo, 'DEMO-6A', liner); inventory.variants[0].stock_qty = 999;
  const suppliers = getPartSuppliers(demo, 'DEMO-6A', liner); suppliers[0].grade = 'X';
  assert.equal(getSupply(demo, 'DEMO-6A', liner).required, 1);
  assert.equal(getInventoryForPart(demo, 'DEMO-6A', liner).total, 13);
  assert.equal(getPartSuppliers(demo, 'DEMO-6A', liner)[0].grade, 'A');
});

test('BOM assembly mode excludes its children, shell/context, and bed-integrated MBS', () => {
  const ids = getBomRows(demo, 'DEMO-6A', catalog6).map(row => row.part.id);
  assert.equal(ids.length, 26);
  assert.ok(ids.includes('CYL01_EXHVALVE'));
  assert.ok(!ids.includes('CYL01_EXHVALVE_SPINDLE'));
  assert.ok(!ids.some(id => /ENGINE_(MBS|SHELL)/.test(id)));
  assert.ok(!ids.includes('CYL01_FRAME'));
  const summary = summarizeSupply(demo, 'DEMO-6A', catalog6);
  assert.equal(summary.registeredPositions, 13);
  assert.equal(summary.requiredTotal, 13);
  assert.deepEqual(summary.counts, { secured: 5, review: 6, shortage: 2, unknown: 13 });
});

test('BOM child purchasing mode excludes assembly while preserving child IDs', () => {
  const data = mutate(demo, row => { row.bomPolicies.exhaustValvePurchaseMode['DEMO-6A'] = 'children'; });
  const ids = getBomRows(data, 'DEMO-6A', catalog6).map(row => row.part.id);
  assert.ok(!ids.includes('CYL01_EXHVALVE'));
  assert.ok(ids.includes('CYL01_EXHVALVE_SPINDLE'));
});

test('validation rejects duplicate relations, unknown IDs, out-of-range cylinders and support stations', () => {
  const cases = [
    data => data.supply.push(structuredClone(data.supply[0])),
    data => { data.supply[0].partId = 'CYL01_BOGUS'; },
    data => { data.supply[0].partId = 'CYL07_LINER'; },
    data => { data.supply[0].partId = 'CYL00_LINER'; },
    data => { data.supply[0].partId = 'ENGINE_MBS_08'; },
    data => { data.supply[0].unitId = 'UNRECOGNIZED'; },
    data => { data.supply[0].supplierId = 'UNRECOGNIZED'; },
  ];
  for (const change of cases) assert.equal(validateData(mutate(demo, change), catalog6).valid, false);
});

test('validation rejects invalid state/quantity, variant/type and legacy inference', () => {
  const cases = [
    data => { data.supply[0].available = null; },
    data => { data.supply[0].required = -1; },
    data => { data.supply[0].allocated = 100; },
    data => { data.supply[0].status = 'green'; },
    data => { data.supply[0].variantId = 'DEMO-COVER-V1'; },
    data => { data.inventory.types.G95_CONCEPT_LINER.variants[0].used_by = ['CYL01_LINER']; },
  ];
  for (const change of cases) assert.equal(validateData(mutate(demo, change), catalog6).valid, false);
});

test('validation rejects impossible calendar dates and invalid supplier evaluations', () => {
  for (const value of ['2026-02-30', '2026-13-01', '2026-02-29', 'yesterday']) {
    assert.equal(validateData(mutate(demo, data => { data.supply[0].requiredDate = value; })).valid, false);
  }
  assert.equal(validateData(mutate(demo, data => { data.supply[0].requiredDate = '2028-02-29'; })).valid, true);
  assert.equal(validateData(mutate(demo, data => { data.suppliers[0].on_time_rate_pct = 101; })).valid, false);
});

test('changing only meta does not launder SAMPLE/DEMO values into registered data', () => {
  const data = mutate(demo, row => { row.meta.dataKind = 'registered'; row.meta.sample = false; row.meta.source = 'ERP import'; });
  assert.equal(validateData(data).valid, false);
  assert.match(validateData(data).errors.join(' '), /시연 식별자/);
  const fixture = mutate(empty, row => {
    row.meta.dataKind = 'registered'; row.meta.sample = false; row.meta.source = 'ERP 승인 파일';
    row.units = [{ id: 'UNIT-001', label: '입력 호기', cylinderCount: 6 }];
  });
  assert.equal(validateData(fixture).valid, true);
});

test('unregistered mode cannot contain stock, suppliers or supply data', () => {
  assert.equal(validateData(mutate(demo, data => { data.meta.dataKind = 'unregistered'; })).valid, false);
  assert.equal(validateData(null).valid, false);
  assert.equal(validateData({}).valid, false);
});
