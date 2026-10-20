import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEngine } from '../lib/engine-model/engine-scene.js';
import { createCatalog, getSupply, getSupplierPartIds, getBomRows, validateData } from '../lib/parts-inventory.mjs';
import { buildScenario, getScenarioOptions } from '../lib/simulation.mjs';

const input = JSON.parse(await readFile(new URL('../public/data/prototype-simulation.json', import.meta.url), 'utf8'));
const catalogs = new Map(input.units.map(unit => [unit.id, createCatalog(createEngine(unit.cylinderCount).metadata)]));

test('full prototype contract validates in every scenario and cylinder catalog', () => {
  for (const option of getScenarioOptions) {
    const data = buildScenario(input, option.id);
    for (const catalog of catalogs.values()) assert.deepEqual(validateData(data, catalog).errors, []);
  }
});

test('all selectable 6/7 cylinder objects have exactly one inventory and drawing mapping', () => {
  assert.deepEqual(input.units.map(unit => unit.cylinderCount), [6, 7]);
  assert.equal(input.relations.items.length, 24);
  assert.equal(Object.keys(input.inventory.types).length, 12);
  assert.equal(input.relations.modelMappings.length, 138);
  assert.equal(input.supply.length, 138);
  for (const [unitId, catalog] of catalogs) {
    const mappings = input.relations.modelMappings.filter(row => row.unitId === unitId);
    assert.equal(mappings.length, catalog.length);
    assert.equal(new Set(mappings.map(row => row.partId)).size, catalog.length);
    for (const part of catalog) {
      const mapping = mappings.find(row => row.partId === part.id);
      assert.ok(mapping?.drawingNo.startsWith('DEMO-'));
      const supply = getSupply(input, unitId, part);
      assert.equal(mapping.itemNo, supply.itemNo);
      assert.ok(input.relations.items.some(item => item.itemNo === mapping.itemNo));
      assert.ok(input.inventory.types[part.part_type_id].variants.some(variant => variant.variant_id === supply.variantId));
    }
  }
});

test('all stock, supplier, purchase order, inspection and BOM references resolve', () => {
  const items = new Set(input.relations.items.map(row => row.itemNo));
  const suppliers = new Set(input.suppliers.map(row => row.supplier_id));
  const units = new Set(input.units.map(row => row.id));
  const pos = new Set(input.relations.purchaseOrders.map(row => row.poNo));
  assert.equal(pos.size, input.relations.purchaseOrders.length);
  for (const key of ['stock', 'modelMappings', 'purchaseOrders', 'inspections', 'bom']) {
    for (const row of input.relations[key]) {
      assert.ok(items.has(row.itemNo), `${key}: ${row.itemNo}`);
      if (row.unitId) assert.ok(units.has(row.unitId));
      if (row.supplierId) assert.ok(suppliers.has(row.supplierId));
      if (row.poNo && key === 'inspections') assert.ok(pos.has(row.poNo));
      if (key === 'inspections') assert.ok(row.rejectedQty <= row.inspectedQty);
      assert.equal(row.sample, true);
    }
  }
  for (const row of input.supply) {
    const supplier = input.suppliers.find(record => record.supplier_id === row.supplierId);
    assert.ok(supplier.suppliedItemNos.includes(row.itemNo));
    if (row.poNo) {
      const po = input.relations.purchaseOrders.find(order => order.poNo === row.poNo);
      assert.equal(po.itemNo, row.itemNo);
      assert.equal(po.supplierId, row.supplierId);
    }
  }
});

test('current-unit supplier allocations are exact, with different supplier at the same part position', () => {
  assert.equal(input.suppliers.length, 5);
  assert.equal(getSupply(input, 'DEMO-6A', 'CYL01_LINER').supplierId, 'SUP-DEMO-A');
  assert.equal(getSupply(input, 'DEMO-7B', 'CYL01_LINER').supplierId, 'SUP-DEMO-B');
  assert.equal(getSupplierPartIds(input, 'DEMO-6A', 'SUP-DEMO-A').length, 6);
  assert.ok(getSupplierPartIds(input, 'DEMO-6A', 'SUP-DEMO-A').every(id => id.endsWith('_LINER')));
  assert.ok(getSupplierPartIds(input, 'DEMO-7B', 'SUP-DEMO-A').every(id => id.endsWith('_COVER')));
  assert.deepEqual(getSupplierPartIds(input, 'DEMO-6A', 'nonexistent'), []);
});

test('prototype allocation never uses the same accepted stock twice or subtracts safety stock', () => {
  for (const scenario of getScenarioOptions) {
    const data = buildScenario(input, scenario.id);
    for (const stock of data.relations.stock) {
      const allocated = data.supply.filter(row => row.itemNo === stock.itemNo).reduce((sum, row) => sum + row.allocated, 0);
      assert.ok(allocated <= stock.acceptedStock);
      const rejected = data.relations.inspections.filter(row => row.itemNo === stock.itemNo).reduce((sum, row) => sum + row.rejectedQty, 0);
      assert.equal(stock.acceptedStock, Math.max(0, stock.currentStock - rejected));
    }
  }
  assert.equal(getSupply(input, 'DEMO-6A', 'CYL01_LINER').allocated, 1);
  assert.equal(input.relations.stock.find(row => row.itemNo === 'DEMO-A-LNR-001').acceptedStock, 4);
});

test('baseline contains green, yellow and red purchasing positions in each unit', () => {
  for (const [unitId, catalog] of catalogs) {
    const statuses = new Set(getBomRows(input, unitId, catalog).map(row => row.supply.status));
    assert.deepEqual(statuses, new Set(['secured', 'review', 'shortage']));
  }
  assert.equal(getSupply(input, 'DEMO-6A', 'CYL05_LINER').status, 'review');
  assert.equal(getSupply(input, 'DEMO-6A', 'CYL06_LINER').status, 'shortage');
});

test('receipts change pending positions to secured without inventing an unplanned receipt', () => {
  const data = buildScenario(input, 'receipts');
  assert.equal(getSupply(data, 'DEMO-6A', 'CYL05_LINER').status, 'secured');
  assert.equal(getSupply(data, 'DEMO-6A', 'CYL06_LINER').status, 'shortage');
  assert.equal(getSupply(data, 'DEMO-6A', 'CYL06_HYDPIPE_01').status, 'secured');
  assert.ok(data.relations.purchaseOrders.every(row => row.status === 'received'));
  assert.ok(data.relations.inspections.some(row => row.simulationEvent === 'receipts'));
});

test('delayed orders show changed expected date, unconfirmed status and reason', () => {
  const data = buildScenario(input, 'delayed');
  const row = getSupply(data, 'DEMO-6A', 'CYL05_LINER');
  assert.equal(row.status, 'review');
  assert.equal(row.expectedDate, '2026-11-19');
  assert.match(row.reason, /납기 지연/);
  assert.equal(data.relations.purchaseOrders.find(order => order.poNo === row.poNo).confirmed, false);
});

test('inspection rejection changes available stock and two formerly secured cover positions', () => {
  const data = buildScenario(input, 'rejected');
  assert.equal(getSupply(input, 'DEMO-6A', 'CYL05_COVER').status, 'secured');
  assert.equal(getSupply(data, 'DEMO-6A', 'CYL05_COVER').status, 'shortage');
  assert.equal(getSupply(data, 'DEMO-6A', 'CYL06_COVER').allocated, 0);
  const stock = data.relations.stock.find(row => row.itemNo === 'DEMO-A-COV-001');
  assert.equal(stock.currentStock, 6);
  assert.equal(stock.rejectedQty, 2);
  assert.equal(stock.acceptedStock, 4);
});

test('BOM excludes MBS, shell, frame context and valve children without losing their IDs', () => {
  for (const [unitId, catalog] of catalogs) {
    const rows = getBomRows(input, unitId, catalog);
    assert.equal(rows.length, input.units.find(unit => unit.id === unitId).cylinderCount * 4 + 2);
    assert.ok(rows.every(row => !['mbs', 'shell', 'cylinderFrame', 'housing', 'spindle', 'seat'].includes(row.part.category)));
    const included = input.relations.bom.filter(row => row.unitId === unitId && row.bomIncluded);
    assert.equal(included.length, rows.length);
    assert.ok(input.relations.bom.find(row => row.unitId === unitId && row.partId === 'CYL01_EXHVALVE_SPINDLE').parentPartId === 'CYL01_EXHVALVE');
    assert.ok(input.relations.bom.some(row => row.unitId === unitId && row.partId === 'ENGINE_MBS_01' && !row.bomIncluded));
    assert.equal(getSupply(input, unitId, 'ENGINE_MBS_01').status, 'unknown');
    assert.equal(getSupply(input, unitId, 'CYL01_EXHVALVE_SPINDLE').status, 'unknown');
  }
});

test('scenarios are deterministic, nonmutating and restart from baseline when switched', () => {
  const snapshot = JSON.stringify(input);
  const received = buildScenario(input, 'receipts');
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(buildScenario(received, 'baseline'), buildScenario(input, 'baseline'));
  assert.deepEqual(buildScenario(received, 'receipts'), received);
  assert.deepEqual(buildScenario(input, 'unknown-option'), buildScenario(input));
});
