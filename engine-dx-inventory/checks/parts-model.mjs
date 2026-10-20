import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createEngine } from '../lib/engine-model/engine-scene.js';

for (const count of [6, 7, 11]) {
  test(`${count} cylinders preserve independent placement IDs, geometry and material ownership`, () => {
    const engine = createEngine(count);
    assert.equal(engine.parts.size, 10 * count + 4);
    assert.equal(new Set(engine.metadata.map(row => row.partId)).size, engine.parts.size);
    assert.equal(engine.root.userData.cylinderCount, count);
    let meshCount = 0;
    const materials = new Set();
    engine.root.traverse(object => {
      if (!object.isMesh) return;
      meshCount++;
      materials.add(object.material);
      assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
      assert.ok(object.userData.partId);
    });
    assert.equal(materials.size, meshCount, 'no mesh material is shared');
    for (let i = 1; i <= count; i++) {
      const prefix = `CYL${String(i).padStart(2, '0')}`;
      for (const suffix of ['LINER', 'COVER', 'FRAME', 'EXHVALVE', 'EXHVALVE_HOUSING', 'EXHVALVE_SPINDLE', 'EXHVALVE_SEAT', 'HYDPIPE_01']) assert.ok(engine.parts.has(`${prefix}_${suffix}`));
    }
    assert.ok(!engine.parts.has(`CYL${String(count + 1).padStart(2, '0')}_LINER`));
    assert.ok(engine.context.every(object => object.userData.pickable === false));
    for (const row of engine.metadata) {
      assert.equal(row.accuracy, 'concept');
      assert.equal(row.dimensionsVerified, false);
      assert.equal(row.accuracyLabel, '구조 설명용 모델 / 실제 제작 치수 아님');
    }
  });
}

test('repetition changes the number and interval without stretching cylinder geometry', () => {
  const six = createEngine(6), eleven = createEngine(11);
  const measure = object => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray();
  assert.deepEqual(measure(six.parts.get('CYL01_LINER')), measure(eleven.parts.get('CYL01_LINER')));
  assert.equal(six.parts.get('CYL01_LINER').scale.x, 1);
  assert.equal(eleven.parts.get('CYL01_LINER').scale.x, 1);
  const positions = eleven.root.children.filter(object => object.name.startsWith('CYLINDER_')).map(object => object.position.x);
  for (let i = 1; i < positions.length; i++) assert.ok(Math.abs(positions[i] - positions[i - 1] - eleven.root.userData.cylinderPitch) < 1e-9);
});

test('MBS stays integrated while shell remains separately identified', () => {
  const engine = createEngine(6);
  const support = engine.parts.get('ENGINE_MBS_01');
  const shell = engine.parts.get('ENGINE_SHELL_01');
  assert.notEqual(support, shell);
  assert.equal(support.userData.category, 'mbs');
  assert.equal(shell.userData.category, 'shell');
  assert.equal(support.userData.integrated, true);
  assert.deepEqual(support.userData.explodeVector, [0, 0, 0]);
  assert.equal(shell.userData.relatedPartId, support.userData.partId);
  assert.ok(engine.connections.some(row => row.from === 'ENGINE_MBS_01' && row.to === 'ENGINE_BEDPLATE' && row.type === 'integrated-region'));
});

test('valve assembly retains parent/child identity and different child ownership', () => {
  const engine = createEngine(6);
  const assembly = engine.parts.get('CYL01_EXHVALVE');
  assert.equal(assembly.userData.bomRole, 'assembly');
  for (const suffix of ['HOUSING', 'SPINDLE', 'SEAT']) {
    const part = engine.parts.get(`CYL01_EXHVALVE_${suffix}`);
    assert.equal(part.parent, assembly);
    assert.equal(part.userData.parentPartId, 'CYL01_EXHVALVE');
    assert.equal(part.userData.bomRole, 'child');
    part.traverse(object => { if (object.isMesh) assert.equal(object.userData.partId, part.userData.partId); });
  }
});

function parseGlb(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const length = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8').trim());
}

test('exported GLB variants retain stable names, extras and hierarchy', async () => {
  for (const count of [6, 7, 11]) {
    const buffer = await readFile(new URL(`../public/models/g95-concept/engine-${count}.glb`, import.meta.url));
    const json = parseGlb(buffer);
    // Mesh extras also carry their owning part ID for picking. The named group
    // is the one placement node; a mesh must not overwrite it in this lookup.
    const nodes = new Map(json.nodes.filter(node => node.name && node.name === node.extras?.partId).map(node => [node.extras.partId, node]));
    const original = createEngine(count);
    for (const [partId] of original.parts) {
      assert.ok(nodes.has(partId), `exported ${partId}`);
      assert.equal(nodes.get(partId).name, partId);
      assert.equal(nodes.get(partId).extras.accuracy, 'concept');
    }
    const parent = nodes.get('CYL01_EXHVALVE');
    const childIds = parent.children.map(index => json.nodes[index].extras.partId);
    assert.deepEqual(childIds.sort(), ['CYL01_EXHVALVE_HOUSING', 'CYL01_EXHVALVE_SEAT', 'CYL01_EXHVALVE_SPINDLE']);
    assert.equal(nodes.get('ENGINE_MBS_01').extras.integrated, true);
    assert.equal(json.nodes.find(node => node.name === 'engine').extras.dimensionsVerified, false);
  }
});

test('all part export files match their explicitly named IDs and reference sheets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/g95-model-manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.partExports.length, 12);
  for (const part of manifest.partExports) {
    const json = parseGlb(await readFile(new URL(`../public/${part.file}`, import.meta.url)));
    assert.ok(json.nodes.some(node => node.name === part.partId && node.extras?.partId === part.partId));
    const sheet = await readFile(new URL(`../public/${part.reference}`, import.meta.url), 'utf8');
    assert.ok(sheet.includes('구조 설명용 모델 / 실제 제작 치수 아님'));
    assert.ok(sheet.includes('개념 절단'));
  }
});
