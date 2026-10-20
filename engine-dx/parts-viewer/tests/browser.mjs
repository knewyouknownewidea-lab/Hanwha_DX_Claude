/** Real browser QA. Run the app server, then `node tests/browser.mjs`. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const project = fileURLToPath(new URL('..', import.meta.url));
const verification = path.join(project, 'verification');
await mkdir(verification, { recursive: true });
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(path.resolve(modulePath)).href : 'playwright');
const baseUrl = process.env.BROWSER_TEST_URL ?? 'http://127.0.0.1:5178';
const launch = { headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] };
let browser;
let browserChannel;
const attempts = [];
for (const channel of process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL] : ['msedge', null]) {
  try {
    browser = await chromium.launch({ ...launch, ...(channel ? { channel } : {}) });
    browserChannel = channel ?? 'chromium';
    break;
  } catch (error) { attempts.push(error.message.split('\n')[0]); }
}
if (!browser) throw new Error(`실행 가능한 Playwright 브라우저가 없습니다: ${attempts.join(' / ')}`);

const context = await browser.newContext({ viewport: { width: 1365, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
const checks = [];
let guidedVideo = null;
async function check(name, action) {
  try { const evidence = await action(); checks.push({ name, passed: true, ...(evidence === undefined ? {} : { evidence }) }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function details(id) {
  const row = page.locator(`#parts-list [data-part="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  assert.equal(await page.evaluate(() => window.dock.state.selectedId), id);
  assert.ok((await page.locator('#detail-panel').textContent()).includes(id));
}
async function uploadJson(name, data) {
  await page.locator('#data-import').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)) });
}
function glbJson(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8').trim());
}

async function recordGuidedDemo() {
  let guideContext;
  let guide;
  let method = 'Playwright full-page viewport recording';
  try {
    guideContext = await browser.newContext({ viewport: { width: 1365, height: 1000 }, recordVideo: { dir: path.join(verification, 'video-tmp'), size: { width: 1365, height: 1000 } } });
    guide = await guideContext.newPage();
  } catch (error) {
    await guideContext?.close().catch(() => {});
    // MediaRecorder records the actual WebGL output when the optional external
    // Playwright ffmpeg executable is unavailable. Labels read live UI state.
    method = 'Live WebGL canvas MediaRecorder with labels read from actual UI state; not a full-page UI recording';
    guideContext = await browser.newContext({ viewport: { width: 1365, height: 1000 } });
    guide = await guideContext.newPage();
  }
  await guide.goto(baseUrl, { waitUntil: 'networkidle' });
  await guide.waitForFunction(() => !!window.dock?.engine?.parts?.size);
  const recordingStarted = Date.now();
  if (method.startsWith('Live')) await guide.evaluate(() => {
    const source = window.dock.viewer.renderer.domElement;
    const output = document.createElement('canvas'); output.width = 1280; output.height = 900;
    const ctx = output.getContext('2d');
    const chunks = [];
    const stream = output.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2200000 });
    let running = true;
    function draw() {
      ctx.fillStyle = '#eef1ed'; ctx.fillRect(0, 0, 1280, 900);
      ctx.fillStyle = '#19291f'; ctx.fillRect(0, 0, 1280, 136);
      ctx.fillStyle = '#ffffff'; ctx.font = '600 26px Segoe UI, sans-serif'; ctx.fillText('DOCK · ENGINE PROCUREMENT — LIVE 3D DEMO', 32, 40);
      ctx.font = '22px Segoe UI, sans-serif';
      const unit = document.querySelector('#unit-select').selectedOptions[0]?.textContent;
      const supplier = document.querySelector('#supplier-select').selectedOptions[0]?.textContent;
      ctx.fillText(`${unit}  /  ${supplier}`, 32, 78);
      ctx.font = '18px Segoe UI, sans-serif';
      ctx.fillText(document.querySelector('#data-label').textContent + ' · ' + document.querySelector('#view-notice').textContent.slice(0, 66), 32, 112);
      const availableHeight = 690;
      const scale = Math.min(1240 / source.width, availableHeight / source.height);
      const width = source.width * scale, height = source.height * scale;
      ctx.drawImage(source, (1280 - width) / 2, 142 + (availableHeight - height) / 2, width, height);
      ctx.fillStyle = '#19291f'; ctx.font = '600 22px Segoe UI, sans-serif';
      ctx.fillText(`${window.dock.state.selectedId} · ${window.dock.state.view} · ${window.dock.state.reduced ? '모션 감소' : '점멸 켜짐'}`, 32, 850);
      ctx.font = '19px Segoe UI, sans-serif'; ctx.fillText('구조 설명용 모델 / 실제 제작 치수 아님 · 모든 시연 업무 데이터는 가상', 32, 884);
      if (running) requestAnimationFrame(draw);
    }
    draw();
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    window.stopGuideRecording = () => new Promise(resolve => {
      recorder.onstop = async () => {
        running = false; stream.getTracks().forEach(track => track.stop());
        const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
        let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        resolve(btoa(binary));
      };
      recorder.stop();
    });
    recorder.start(300);
  });
  await guide.waitForTimeout(2000);
  await guide.locator('#demo-toggle').click();
  await guide.waitForTimeout(1500);
  await guide.locator('#supplier-select').selectOption('DEMO-SUP-A');
  await guide.waitForTimeout(1800);
  await guide.locator('#parts-list [data-part="CYL03_LINER"]').click();
  await guide.waitForTimeout(2000);
  await guide.locator('#unit-select').selectOption('DEMO-0702');
  await guide.locator('#supplier-select').selectOption('DEMO-SUP-A');
  await guide.waitForTimeout(2000);
  await guide.locator('[data-view="section"]').click();
  await guide.locator('#subparts-toggle').check();
  await guide.locator('#parts-list [data-part="ENGINE_MBS_01"]').click();
  await guide.waitForTimeout(2000);
  await guide.locator('#motion-toggle').check();
  await guide.waitForTimeout(2000);
  const destination = path.join(verification, 'demo.webm');
  if (method.startsWith('Live')) {
    const base64 = await guide.evaluate(() => window.stopGuideRecording());
    await writeFile(destination, Buffer.from(base64, 'base64'));
    await guideContext.close();
  } else {
    const video = guide.video(); await guideContext.close(); await video.saveAs(destination);
  }
  return { file: 'verification/demo.webm', method, durationEstimateSeconds: Math.round((Date.now() - recordingStarted) / 100) / 10, steps: ['initial unregistered', 'fictional demo', 'supplier A exact six liners', 'CYL03_LINER shortage', '7-cylinder unit supplier A frame only', 'concept section with integrated MBS', 'reduced motion stops pulse'] };
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.dock?.engine?.parts?.size, { timeout: 30000 });
  await check('initial unregistered data preserves null and grey status', async () => {
    const result = await page.evaluate(() => ({ kind: window.dock.state.dataset.dataKind, unit: window.dock.state.unitId, supplierCount: window.dock.state.dataset.suppliers.length, state: window.dock.viewer.state.statusFor('CYL01_LINER') }));
    assert.deepEqual(result, { kind: 'unregistered', unit: 'UNREGISTERED-001', supplierCount: 0, state: 'unknown' });
    assert.equal(await page.locator('#metric-secured').textContent(), '0');
    assert.ok((await page.locator('#detail-panel').textContent()).includes('미등록'));
    assert.equal(await page.locator('#detail-panel .status-pill.unknown').count(), 1);
    assert.ok((await page.locator('#viewport').textContent()).includes('구조 설명용 모델 / 실제 제작 치수 아님'));
    return result;
  });

  await check('every major purchase object can be selected through the part list', async () => {
    const ids = await page.evaluate(() => window.dock.engine.metadata.filter(part => part.role === 'purchase' && part.bomRole !== 'child').map(part => part.partId));
    for (const id of ids) await details(id);
    await details('CYL01_LINER');
    return { selectedCount: ids.length, ids };
  });

  await page.locator('#demo-toggle').click();
  await check('demo data is explicitly fictional and supplier A belongs to current unit only', async () => {
    assert.equal(await page.evaluate(() => window.dock.state.dataset.dataKind), 'demo');
    assert.ok((await page.locator('#data-notice').textContent()).includes('모든 업체·품목·재고·발주·일정은 가상'));
    await page.locator('#supplier-select').selectOption('DEMO-SUP-A');
    const evidence = await page.evaluate(() => {
      const { state, viewer } = window.dock;
      const expected = state.dataset.supply.filter(row => row.unitId === state.unitId && row.supplierId === state.supplierId).map(row => row.partId).sort();
      const selected = [...viewer.state.supplierIds].sort();
      const highlighted = [...new Set(viewer.meshes.filter(mesh => mesh.userData.highlighted).map(mesh => mesh.userData.partId))].sort();
      const otherOpacities = viewer.meshes.filter(mesh => !mesh.userData.highlighted).map(mesh => mesh.material.opacity);
      return { expected, selected, highlighted, maxOtherOpacity: Math.max(...otherOpacities) };
    });
    assert.deepEqual(evidence.selected, evidence.expected);
    assert.deepEqual(evidence.highlighted, evidence.expected);
    assert.equal(evidence.maxOtherOpacity, 0.14);
    assert.equal(evidence.expected.length, 6);
    assert.equal(await page.locator('#parts-list .supplier-linked').count(), 6);
    return evidence;
  });

  await check('secured review shortage use separate material colors in repeated cylinders', async () => {
    const materials = await page.evaluate(() => ['CYL01_LINER', 'CYL02_LINER', 'CYL03_LINER'].map(id => {
      const mesh = window.dock.viewer.meshes.find(mesh => mesh.userData.partId === id);
      return { id, uuid: mesh.material.uuid, color: mesh.material.color.getHex(), status: window.dock.viewer.state.statusFor(id), opacity: mesh.material.opacity };
    }));
    assert.deepEqual(materials.map(m => m.color), [0x49a779, 0xdcb552, 0xd97780]);
    assert.deepEqual(materials.map(m => m.status), ['secured', 'review', 'shortage']);
    assert.equal(new Set(materials.map(m => m.uuid)).size, 3);
    assert.ok(materials.every(m => m.opacity === 1));
    return materials.map(({ uuid, ...rest }) => rest);
  });

  await check('pulse has a smooth 1.8 second period and stop/reduced motion freeze actual materials', async () => {
    const waveform = await page.evaluate(async () => {
      const values = await Promise.all([0, 0.45, 0.9, 1.35, 1.8].map(time => window.dock.pulseForTest(time)));
      return values;
    });
    assert.ok(waveform.every(value => value >= 0.13 && value <= 0.26));
    assert.ok(Math.abs(waveform[0] - waveform[4]) < 1e-10);
    assert.ok(waveform[1] > waveform[0] && waveform[3] < waveform[0]);
    await page.locator('#pulse-toggle').uncheck();
    await page.waitForTimeout(100);
    const stoppedA = await page.evaluate(() => window.dock.viewer.meshes.find(mesh => mesh.userData.highlighted).material.emissiveIntensity);
    await page.waitForTimeout(220);
    const stoppedB = await page.evaluate(() => window.dock.viewer.meshes.find(mesh => mesh.userData.highlighted).material.emissiveIntensity);
    assert.equal(stoppedA, stoppedB);
    await page.locator('#pulse-toggle').check();
    await page.locator('#motion-toggle').check();
    assert.equal(await page.locator('#pulse-toggle').isDisabled(), true);
    await page.waitForTimeout(100);
    const reducedA = await page.evaluate(() => window.dock.viewer.meshes.find(mesh => mesh.userData.highlighted).material.emissiveIntensity);
    await page.waitForTimeout(220);
    const reducedB = await page.evaluate(() => window.dock.viewer.meshes.find(mesh => mesh.userData.highlighted).material.emissiveIntensity);
    assert.equal(reducedA, reducedB);
    await page.locator('#motion-toggle').uncheck();
    return { periodSeconds: 1.8, waveform, stoppedIntensity: stoppedB, reducedIntensity: reducedB };
  });

  await details('CYL02_LINER');
  await page.locator('#reset-camera').click();
  await page.screenshot({ path: path.join(verification, 'demo-supplier.png'), fullPage: true });
  await page.locator('#supplier-select').selectOption('');
  await details('CYL01_LINER');
  await page.locator('#reset-camera').click();
  await page.screenshot({ path: path.join(verification, 'demo-overview.png'), fullPage: true });

  await check('actual raycast can pick an interior behind a transparent structural exterior', async () => {
    const hit = await page.evaluate(() => {
      const viewer = window.dock.viewer;
      const interiors = new Set(['liner', 'mbs', 'spindle', 'shell']);
      const samples = [];
      for (const part of window.dock.engine.metadata.filter(meta => interiors.has(meta.category))) {
        const center = viewer.projectedCenter(part.partId);
        if (center && Math.abs(center.x) < 1 && Math.abs(center.y) < 1) samples.push([center.x, center.y]);
      }
      for (let y = -0.8; y <= 0.8; y += 0.04) for (let x = -0.85; x <= 0.85; x += 0.04) samples.push([x, y]);
      for (const [x, y] of samples) {
        const picked = viewer.pick(x, y);
        if (!picked || !interiors.has(window.dock.engine.parts.get(picked)?.userData.category)) continue;
        const hits = viewer.raycaster.intersectObjects(viewer.meshes, false).filter(item => item.object.userData.pickable !== false && window.dock.engine.parts.has(item.object.userData.partId));
        const selectedHit = hits.findIndex(item => item.object.userData.partId === picked);
        const exterior = hits.slice(0, selectedHit).find(item => ['frame', 'cylinderFrame'].includes(window.dock.engine.parts.get(item.object.userData.partId)?.userData.category) && item.object.userData.renderOpacity < 0.5);
        if (exterior) return { x, y, picked, transparentExterior: exterior.object.userData.partId, exteriorOpacity: exterior.object.material.opacity };
      }
      return null;
    });
    assert.ok(hit, 'No interior raycast through a transparent exterior was found');
    const rect = await page.locator('#viewport canvas').boundingBox();
    await page.mouse.click(rect.x + (hit.x + 1) / 2 * rect.width, rect.y + (1 - hit.y) / 2 * rect.height);
    assert.equal(await page.evaluate(() => window.dock.state.selectedId), hit.picked);
    return hit;
  });

  await check('MBS shell assembly housing spindle and seat remain separately selectable', async () => {
    await page.locator('#subparts-toggle').check();
    const ids = ['ENGINE_MBS_01', 'ENGINE_SHELL_01', 'CYL01_EXHVALVE', 'CYL01_EXHVALVE_HOUSING', 'CYL01_EXHVALVE_SPINDLE', 'CYL01_EXHVALVE_SEAT'];
    for (const id of ids) await details(id);
    return ids;
  });

  await check('section/exploded views keep integrated MBS attached and disclose conceptual cuts', async () => {
    await page.locator('[data-view="assembled"]').click();
    const before = await page.evaluate(() => window.dock.engine.parts.get('ENGINE_MBS_01').position.toArray());
    await page.locator('[data-view="section"]').click();
    assert.ok((await page.locator('#view-notice').textContent()).includes('실제 가공 단면'));
    assert.ok(await page.evaluate(() => window.dock.viewer.meshes.every(mesh => mesh.material.clippingPlanes.length === 1)));
    await details('ENGINE_MBS_01');
    await page.locator('#reset-camera').click();
    await page.screenshot({ path: path.join(verification, 'demo-section.png'), fullPage: true });
    await page.locator('[data-view="exploded"]').click();
    const after = await page.evaluate(() => window.dock.engine.parts.get('ENGINE_MBS_01').position.toArray());
    assert.deepEqual(after, before);
    assert.ok((await page.locator('#view-notice').textContent()).includes('MBS 통합 영역은 베드에서 분리하지 않습니다'));
    assert.ok(await page.evaluate(() => window.dock.viewer.meshes.every(mesh => mesh.material.clippingPlanes.length === 0)));
    await page.locator('[data-view="assembled"]').click();
    return { mbsBefore: before, mbsAfter: after };
  });

  await check('BOM download excludes assembly child rows without losing their IDs', async () => {
    await page.locator('[data-page="procurement"]').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bom-download').click()]);
    const json = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(json.items.length, 26);
    assert.equal(json.excludedChildren.length, 18);
    assert.ok(json.items.some(row => row.partId === 'CYL01_EXHVALVE'));
    assert.ok(!json.items.some(row => row.partId === 'CYL01_EXHVALVE_SPINDLE'));
    assert.ok(json.excludedChildren.some(row => row.partId === 'CYL01_EXHVALVE_SPINDLE'));
    assert.equal(json.dataKind, 'demo');
    await page.locator('[data-page="model"]').click();
    return { items: json.items.length, excludedChildren: json.excludedChildren.length };
  });

  await check('7-cylinder unit rebuild has stable collision-free IDs and exact different supplier scope', async () => {
    await page.locator('#unit-select').selectOption('DEMO-0702');
    await page.locator('#supplier-select').selectOption('DEMO-SUP-A');
    const evidence = await page.evaluate(() => ({ count: window.dock.state.count, ids: [...window.dock.engine.parts.keys()], supplierIds: window.dock.viewer.state.supplierIds }));
    assert.equal(evidence.count, 7);
    assert.equal(new Set(evidence.ids).size, evidence.ids.length);
    assert.ok(evidence.ids.includes('CYL07_LINER'));
    assert.ok(!evidence.ids.includes('CYL08_LINER'));
    assert.deepEqual(evidence.supplierIds, ['ENGINE_FRAMEBOX']);
    return { cylinders: 7, independentIds: evidence.ids.length, supplierIds: evidence.supplierIds };
  });

  await check('manual cylinder count change clears purchase data until matching production unit', async () => {
    await page.locator('#cylinder-select').selectOption('6');
    assert.equal(await page.evaluate(() => window.dock.state.layoutOnly), true);
    assert.equal(await page.locator('#metric-secured').textContent(), '0');
    assert.ok((await page.locator('#data-notice').textContent()).includes('배치 전용'));
    assert.equal(await page.locator('#supplier-select option').count(), 1);
    await page.locator('#cylinder-select').selectOption('7');
    assert.equal(await page.evaluate(() => window.dock.state.layoutOnly), false);
  });

  await check('browser GLB download preserves assembly hierarchy independent IDs and dimension disclaimer', async () => {
    const expectedIds = await page.evaluate(() => [...window.dock.engine.parts.keys()]);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#glb-download').click()]);
    const bytes = await readFile(await download.path());
    const gltf = glbJson(bytes);
    const names = new Set(gltf.nodes.map(node => node.name));
    for (const id of expectedIds) assert.ok(names.has(id), `Missing GLB part ${id}`);
    const engine = gltf.nodes.find(node => node.name === 'engine');
    assert.equal(engine.extras.cylinderCount, 7);
    assert.equal(engine.extras.dimensionsVerified, false);
    assert.equal(engine.extras.units, 'dimensionless conceptual demo units');
    const parent = gltf.nodes.find(node => node.name === 'CYL01_EXHVALVE');
    assert.ok(parent.children.some(index => gltf.nodes[index].name === 'CYL01_EXHVALVE_SPINDLE'));
    assert.ok(!gltf.materials.some(material => material.emissiveFactor?.some(value => value > 0)));
    return { bytes: bytes.length, stablePartIds: expectedIds.length, nodes: gltf.nodes.length, filename: download.suggestedFilename() };
  });

  await check('invalid JSON and unknown model part imports are rejected atomically', async () => {
    const previous = await page.evaluate(() => ({ unit: window.dock.state.unitId, kind: window.dock.state.dataset.dataKind }));
    await uploadJson('invalid.json', '{bad json');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('연결 실패'));
    assert.deepEqual(await page.evaluate(() => ({ unit: window.dock.state.unitId, kind: window.dock.state.dataset.dataKind })), previous);
    const data = await page.evaluate(() => window.dock.getDataset('demo'));
    data.supply[0].partId = 'ENGINE_NONEXISTENT';
    await uploadJson('invalid-model-part.json', data);
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('모델에 없는 partId'));
    assert.deepEqual(await page.evaluate(() => ({ unit: window.dock.state.unitId, kind: window.dock.state.dataset.dataKind })), previous);
    return previous;
  });

  await check('actual user import preserves missing inventory and unknown status without guessing', async () => {
    await uploadJson('user-provided.json', {
      schemaVersion: '1.0', dataKind: 'registered', sourceDescription: '브라우저 QA에서 명시적으로 제공한 입력 · 실사업 자료가 아닌 검증 fixture',
      units: [{ id: 'QA-USER-001', label: 'QA 입력 검증 호기', cylinders: 6, phase: '검증 fixture', dueDate: null }],
      suppliers: [], supply: [{ unitId: 'QA-USER-001', partId: 'CYL01_LINER', itemNumber: 'QA-ITEM-001', status: 'unknown', requiredQty: 1 }],
    });
    await page.waitForFunction(() => window.dock.state.unitId === 'QA-USER-001');
    await details('CYL01_LINER');
    const body = await page.locator('#detail-panel').textContent();
    assert.ok(body.includes('QA-ITEM-001'));
    assert.ok(body.includes('미등록'));
    assert.equal(await page.locator('#detail-panel .status-pill.unknown').count(), 1);
    assert.equal(await page.locator('#metric-secured').textContent(), '0');
    assert.equal(await page.evaluate(() => window.dock.state.dataset.supply[0].availableStock), null);
    assert.equal(await page.evaluate(() => window.dock.state.dataset.supply[0].shortageQty), null);
  });

  // End on an explicitly fictional, repeatable demonstration view.
  await page.locator('#demo-toggle').click();
  await page.locator('#subparts-toggle').uncheck();
  await page.locator('#supplier-select').selectOption('DEMO-SUP-A');
  await details('CYL02_LINER');
  await page.locator('#reset-camera').click();
  await check('mobile 390px keeps page within viewport with no horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    await page.screenshot({ path: path.join(verification, 'demo-mobile.png'), fullPage: true });
    assert.ok(sizes.document <= sizes.viewport + 1, JSON.stringify(sizes));
    assert.ok(sizes.body <= sizes.viewport + 1, JSON.stringify(sizes));
    return sizes;
  });
  await check('runtime has no browser console errors or failed asset requests', async () => {
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    return { consoleErrors: 0, failedRequests: 0 };
  });
  if (process.env.RECORD_DEMO === '1') {
    await context.close(); // Release the QA WebGL context before recording.
    try { guidedVideo = await recordGuidedDemo(); console.log('Recorded verification/demo.webm'); }
    catch (error) { guidedVideo = { available: false, reason: error.message }; console.log(`Optional video unavailable: ${error.message}`); }
  }
} catch (error) {
  checks.push({ name: 'browser setup/completion', passed: false, error: error.stack });
} finally {
  const result = { passed: checks.every(check => check.passed), browser: browserChannel, browserVersion: browser.version(), url: baseUrl, desktopViewport: { width: 1365, height: 1000 }, checks, consoleErrors, failedRequests, guidedVideo, limitation: 'Headless browser with WebGL software rendering; actual CAD dimensions and ERP facts are outside this verification.' };
  await writeFile(path.join(verification, 'browser-results.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ passed: result.passed, checks: checks.length, failed: checks.filter(check => !check.passed).map(check => check.name) }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
