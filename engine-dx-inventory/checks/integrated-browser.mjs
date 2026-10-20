/** Real rendered-page QA: start scripts/serve-local.mjs, then run this file. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const project = fileURLToPath(new URL('..', import.meta.url));
const verification = path.join(project, 'verification');
await mkdir(verification, { recursive: true });
const { chromium } = await (process.env.PLAYWRIGHT_MODULE_PATH
  ? import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : import('playwright'));
const baseUrl = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:5179';
let browser, browserChannel;
const launchFailures = [];
const channels = process.env.BROWSER_CHANNEL ? [process.env.BROWSER_CHANNEL]
  : process.platform === 'win32' ? ['msedge', null] : [null];
for (const channel of channels) {
  try {
    browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    browserChannel = channel || 'chromium';
    break;
  } catch (error) { launchFailures.push(error.message.split('\n')[0]); }
}
if (!browser) throw new Error('실행 가능한 Playwright 브라우저가 없습니다: ' + launchFailures.join(' / '));
const context = await browser.newContext({ viewport: { width: 1365, height: 1000 },
  deviceScaleFactor: 1, reducedMotion: 'no-preference', acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const consoleErrors = [], failedRequests = [], checks = [];
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
async function check(name, action) {
  try { const evidence = await action(); checks.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + ': ' + error.message); }
}
const state = () => page.evaluate(() => window.__engineDx);
const snap = () => page.evaluate(() => window.__integratedViewer.snapshot());
const pause = ms => page.waitForTimeout(ms);
function assertSupplierColorScope(viewer) {
  const highlighted = new Set(viewer.highlightedMeshIds);
  const neutral = Object.keys(viewer.colors).filter(id => !highlighted.has(id));
  assert.ok(neutral.length, 'The supplier view retains neutral surrounding parts');
  for (const id of neutral) {
    assert.equal(viewer.colors[id], '#87949d', `${id}: another supplier must not retain its status color`);
    assert.ok(viewer.byPartOpacity[id] < .3, `${id}: surrounding geometry must be translucent`);
    assert.equal(viewer.emissive[id], 0, `${id}: another supplier must not glow`);
  }
  for (const id of highlighted) assert.equal(viewer.byPartOpacity[id], 1, `${id}: supplied part stays opaque`);
  return { highlighted: [...highlighted], neutralMeshPartCount: neutral.length };
}
async function selectPart(id) {
  await page.getByLabel('부품 선택', { exact: true }).selectOption(id);
  await page.waitForFunction(id => window.__engineDx.selected === id, id);
  assert.equal(await page.getByTestId('selected-part-id').textContent(), id);
  await pause(250);
}
async function demoMode() {
  await page.getByLabel('데이터 모드').selectOption('demo');
  await page.waitForFunction(() => window.__engineDx.dataKind === 'demo');
  await page.getByLabel('시뮬레이션 시나리오').selectOption('baseline');
  await page.waitForFunction(() => window.__engineDx.scenario === 'baseline');
}
async function setScenario(id) {
  await page.getByLabel('시뮬레이션 시나리오').selectOption(id);
  await page.waitForFunction(id => window.__engineDx.scenario === id, id);
}
async function downloadScenario() {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '현재 가상 데이터 JSON 다운로드', exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}
async function supplier(id) {
  await page.getByLabel('협력사 강조', { exact: true }).selectOption(id);
  await page.waitForFunction(id => {
    const current = window.__engineDx, viewer = window.__integratedViewer.snapshot();
    return id ? current.highlighted.length > 0 && viewer.highlightedMeshIds.length > 0
      : current.highlighted.length === 0 && viewer.highlightedMeshIds.length === 0;
  }, id);
}
async function upload(name, value) {
  await page.getByLabel('호기별 구매 JSON 연결').setInputFiles({ name, mimeType: 'application/json',
    buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
}
async function purchaseDetails(open = true) {
  const details = page.locator('.unit-purchase-details');
  if ((await details.getAttribute('open') !== null) !== open) await details.locator(':scope > summary').click();
  if (open) assert.ok(await details.locator('.supply-summary').isVisible());
}
async function picture(name) {
  if (name === 'integrated-demo.png' || name === 'integrated-supplier.png') {
    await page.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await pause(250);
  }
  await page.locator('.toast').waitFor({ state: 'hidden' });
  await page.screenshot({ path: path.join(verification, name), fullPage: true });
  return name;
}
const hash = value => createHash('sha256').update(value).digest('hex');
function glbJSON(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  const length = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8'));
}
let registeredFixture;
let guidedVideo = null;
async function recordViewportDemo() {
  // Encode real viewport screenshots in the browser. This works without the
  // optional external ffmpeg executable and includes the actual inventory UI.
  const recordingContext = await browser.newContext({ viewport: { width: 1365, height: 1000 }, reducedMotion: 'no-preference' });
  const guide = await recordingContext.newPage();
  await guide.goto(baseUrl, { waitUntil: 'networkidle' });
  await guide.waitForFunction(() => window.__integratedViewer?.snapshot().ids.length === 64);
  const first = await guide.screenshot({ type: 'jpeg', quality: 88 });
  await guide.evaluate(async encoded => {
    const output = document.createElement('canvas'); output.width = 1365; output.height = 1000;
    const ctx = output.getContext('2d');
    async function paint(frame) {
      const bytes = Uint8Array.from(atob(frame), char => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      ctx.drawImage(bitmap, 0, 0, output.width, output.height); bitmap.close();
    }
    await paint(encoded);
    const stream = output.captureStream(8), chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2200000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    window.__qaVideo = { paint, stop: () => new Promise(resolve => {
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
        let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        resolve(btoa(binary));
      }; recorder.stop();
    }) };
    recorder.start(400);
  }, first.toString('base64'));
  const started = Date.now(); let running = true, capturedFrames = 1;
  const recording = (async () => {
    while (running) {
      const frame = await guide.screenshot({ type: 'jpeg', quality: 88 });
      await guide.evaluate(encoded => window.__qaVideo.paint(encoded), frame.toString('base64'));
      capturedFrames++; await new Promise(resolve => setTimeout(resolve, 110));
    }
  })();
  try {
    await guide.waitForTimeout(1000);
    await guide.getByRole('button', { name: '협력사 선택: 가상 한빛정밀', exact: true }).click();
    await guide.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await guide.waitForTimeout(1600);
    await guide.getByRole('button', { name: '가상 데이터 보기', exact: true }).click();
    await guide.waitForTimeout(1200);
    await guide.getByRole('dialog', { name: '가상 데이터 테이블', exact: true }).getByRole('tab', { name: /^발주 및 입고/ }).click();
    await guide.waitForTimeout(1200);
    await guide.getByRole('button', { name: '가상 데이터 닫기', exact: true }).click();
    await guide.getByLabel('부품 선택', { exact: true }).selectOption('CYL05_LINER');
    await guide.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await guide.getByLabel('시뮬레이션 시나리오').selectOption('receipts');
    await guide.waitForTimeout(1600);
    await guide.getByLabel('시뮬레이션 시나리오').selectOption('delayed');
    await guide.waitForTimeout(1600);
    await guide.getByLabel('부품 선택', { exact: true }).selectOption('CYL05_COVER');
    await guide.getByLabel('시뮬레이션 시나리오').selectOption('rejected');
    await guide.getByRole('button', { name: '협력사 선택: 가상 바다메탈', exact: true }).click();
    await guide.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await guide.waitForTimeout(1600);
    await guide.getByLabel('시뮬레이션 시나리오').selectOption('baseline');
    await guide.getByRole('button', { name: '협력사 선택: 가상 새론부품', exact: true }).click();
    await guide.getByRole('button', { name: '내부 단면', exact: true }).click();
    await guide.getByLabel('분리 정도', { exact: true }).fill('50');
    await guide.waitForTimeout(1500);
    await guide.getByLabel('부품 선택', { exact: true }).selectOption('CYL01_EXHVALVE_SPINDLE');
    await guide.waitForTimeout(1200);
    await guide.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await guide.getByLabel('생산 호기', { exact: true }).selectOption('DEMO-7B');
    await guide.getByLabel('협력사 강조', { exact: true }).selectOption('SUP-DEMO-A');
    await guide.waitForTimeout(1500);
    await guide.getByRole('button', { name: '점멸 정지', exact: true }).click();
    await guide.waitForTimeout(1300);
  } finally {
    running = false; await recording;
  }
  const encoded = await guide.evaluate(() => window.__qaVideo.stop());
  const durationMs = Date.now() - started;
  await writeFile(path.join(verification, 'integrated-demo.webm'), Buffer.from(encoded, 'base64'));
  await recordingContext.close();
  return { available: true, file: 'integrated-demo.webm', durationMs, capturedFrames,
    averageCapturedFps: Number((capturedFrames * 1000 / durationMs).toFixed(2)),
    method: 'Actual application viewport screenshot frames encoded with browser MediaRecorder; capture cadence is reported separately, no external ffmpeg.' };
}
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => window.__integratedViewer?.snapshot().ids.length === 64
    && window.__engineDx?.unitId === 'DEMO-6A' && window.__engineDx?.dataKind === 'demo', null, { timeout: 90000 });
  await pause(1200);

  await check('inventory UI preserves orange Hanwha branding, MAIN navigation and two panels', async () => {
    assert.equal(await page.locator('.brand strong').textContent(), 'HANWHA ENGINE');
    const orange = await page.locator('.brand-emblem').evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(orange, 'rgb(237, 106, 36)');
    assert.equal(await page.getByRole('link', { name: 'MAIN 01', exact: true }).getAttribute('href'), '/main01/index.html');
    const left = await page.getByRole('region', { name: '3D 엔진 뷰어' }).boundingBox();
    const right = await page.getByLabel('부품별 재고', { exact: true }).boundingBox();
    assert.ok(left && right && right.x >= left.x + left.width - 2);
    assert.equal(await page.evaluate(() => typeof window.dock), 'undefined');
    assert.ok(!(await page.locator('body').innerText()).includes('DOCK'));
    return { orange, leftPanel: left, rightPanel: right, screenshot: await picture('integrated-initial.png') };
  });

  await check('initial prototype opens immediately with labelled demo data and selectable fictional suppliers', async () => {
    const current = await state(), viewer = await snap();
    assert.equal(current.dataKind, 'demo');
    assert.equal(current.unitId, 'DEMO-6A');
    assert.equal(current.partIds.length, 64);
    assert.equal(viewer.modelFamily, 'MAN B&W G95ME-C');
    assert.equal(await page.getByLabel('시뮬레이션 시나리오').inputValue(), 'baseline');
    assert.notEqual(await page.getByTestId('inv-total').textContent(), '미등록');
    assert.ok(await page.getByRole('button', { name: '협력사 선택: 가상 한빛정밀', exact: true }).isVisible());
    assert.ok(await page.getByRole('button', { name: '협력사 선택: 가상 바다메탈', exact: true }).isVisible());
    assert.ok((await page.locator('.summary-note').innerText()).includes('SAMPLE'));
    assert.ok((await page.locator('.accuracy-watermark').textContent()).includes('실제 제작 치수 아님'));
    return { dataKind: current.dataKind, unitId: current.unitId, count: current.partIds.length,
      scenario: await page.getByLabel('시뮬레이션 시나리오').inputValue() };
  });

  await check('seven fictional data tables show linked stock mappings items suppliers orders inspections and BOM', async () => {
    await page.getByRole('button', { name: '가상 데이터 보기', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '가상 데이터 테이블', exact: true });
    assert.ok(await modal.isVisible());
    assert.equal(await modal.getByRole('tab').count(), 7);
    assert.ok((await modal.locator('.simulation-disclaimer').innerText()).includes('모든 값은 가상 시연 데이터'));
    const tables = [
      { name: '재고', rows: 12, headers: ['품번', '현재고', '검사 보류량', '가용재고', '안전재고'] },
      { name: '3D 부품 매핑', rows: 64, headers: ['모델 부품 이름', '3D 부품 ID', '도면번호', 'REV'] },
      { name: '품목', rows: 12, headers: ['품번', '품명', '규격', '단위', 'REV'] },
      { name: '협력사', rows: 5, headers: ['가상 협력사명', '공급 품번', '리드타임', '가상 등급', '가상 납기 준수율'] },
      { name: '발주 및 입고', rows: 9, headers: ['발주번호', '수량', '필요일', '약정일', '입고 예정일', '확정 여부'] },
      { name: '입고검사', rows: 6, headers: ['검사 LOT', '검사 수량', '부적합 수량', '검사일'] },
      { name: '생산계획 및 BOM', rows: 64, headers: ['엔진 번호', '조립일', '부품명', '소요 수량', 'BOM 집계'] },
    ];
    for (const expected of tables) {
      await modal.getByRole('tab', { name: new RegExp('^' + expected.name) }).click();
      await modal.getByRole('heading', { name: expected.name, exact: true }).waitFor();
      const table = modal.getByRole('table');
      assert.equal(await table.locator('tbody tr').count(), expected.rows);
      const headers = await table.getByRole('columnheader').allTextContents();
      for (const header of expected.headers) assert.ok(headers.includes(header), `${expected.name}: ${header}`);
      if (expected.name === '협력사') assert.ok((await table.innerText()).includes('97.2%'));
      if (expected.name === '생산계획 및 BOM') {
        assert.ok((await table.innerText()).includes('하위품 중복 집계 제외'));
        assert.ok((await table.innerText()).includes('통합'));
      }
    }
    await modal.getByRole('tab', { name: /^재고/ }).click();
    await page.getByRole('button', { name: '가상 데이터 닫기', exact: true }).click();
    return { tableCount: tables.length, unitScopedRows: Object.fromEntries(tables.map(table => [table.name, table.rows])) };
  });

  await check('data modal supports all-unit filtering, tab keyboard navigation, searching and direct 3D links', async () => {
    await page.getByRole('button', { name: '가상 데이터 보기', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '가상 데이터 테이블', exact: true });
    await modal.getByLabel('선택 호기만', { exact: true }).uncheck();
    assert.equal(await modal.getByRole('table').locator('tbody tr').count(), 24);
    await modal.getByLabel('선택 호기만', { exact: true }).check();
    const stockTab = modal.getByRole('tab', { name: /^재고/ });
    await stockTab.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await modal.getByRole('tab', { name: /^3D 부품 매핑/ }).getAttribute('aria-selected'), 'true');
    await modal.getByLabel('가상 테이블 검색').fill('CYL05_LINER');
    assert.equal(await modal.getByRole('table').locator('tbody tr').count(), 1);
    assert.ok((await modal.getByRole('table').innerText()).includes('DEMO-A-LNR-001'));
    const screenshot = await picture('integrated-data-tables.png');
    await modal.getByRole('button', { name: 'CYL05_LINER 3D에서 보기', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    assert.equal((await state()).selected, 'CYL05_LINER');
    assert.equal(await page.getByTestId('selected-part-id').textContent(), 'CYL05_LINER');
    await page.getByRole('button', { name: '가상 데이터 보기', exact: true }).click();
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: '가상 데이터 보기', exact: true }).evaluate(el => document.activeElement === el), true);
    await page.getByRole('button', { name: '가상 데이터 보기', exact: true }).click();
    await modal.getByLabel('선택 호기만', { exact: true }).uncheck();
    await modal.getByRole('tab', { name: /^3D 부품 매핑/ }).click();
    await modal.getByLabel('가상 테이블 검색').fill('CYL07_LINER');
    assert.equal(await modal.getByRole('table').locator('tbody tr').count(), 1);
    await modal.getByRole('button', { name: 'CYL07_LINER 3D에서 보기', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.__integratedViewer.snapshot().ids.length === 74
      && window.__engineDx.unitId === 'DEMO-7B' && window.__engineDx.selected === 'CYL07_LINER');
    return { allUnitStockRows: 24, searchedMappingRows: 1, linkedPartId: 'CYL05_LINER',
      crossUnitLink: { unitId: 'DEMO-7B', partId: 'CYL07_LINER', objectCount: 74 }, keyboardAndEscape: true, screenshot };
  });

  await check('explicit unregistered mode retains 64 concept objects with unknown stock and suppliers', async () => {
    await page.getByLabel('데이터 모드').selectOption('unregistered');
    await page.waitForFunction(() => window.__engineDx.dataKind === 'unregistered');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().ids.length === 64);
    const current = await state(), viewer = await snap();
    assert.equal(current.partIds.length, 64);
    assert.equal(viewer.modelFamily, 'MAN B&W G95ME-C');
    assert.deepEqual(new Set(viewer.ids), new Set(current.partIds));
    assert.ok(!current.partIds.some(id => /^CYL_\d/.test(id) || id.includes('PISTON')));
    assert.ok(Object.values(current.statusById).every(status => status === 'unknown'));
    assert.equal(await page.getByTestId('inv-total').textContent(), '미등록');
    assert.equal(await page.getByTestId('sup-row').count(), 0);
    assert.ok((await page.locator('.supply-summary').textContent()).includes('미등록'));
    assert.ok((await page.locator('.accuracy-watermark').textContent()).includes('실제 제작 치수 아님'));
    return { dataKind: current.dataKind, count: current.partIds.length, statuses: [...new Set(Object.values(current.statusById))] };
  });

  await check('fictional supplier cards select exact current-unit positions immediately', async () => {
    await demoMode();
    const hanbit = page.getByRole('button', { name: '협력사 선택: 가상 한빛정밀', exact: true });
    const bada = page.getByRole('button', { name: '협력사 선택: 가상 바다메탈', exact: true });
    await hanbit.click();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().highlightedMeshIds.length === 6);
    const liners = Array.from({ length: 6 }, (_, i) => `CYL${String(i + 1).padStart(2, '0')}_LINER`);
    assert.deepEqual((await state()).highlighted, liners);
    assert.equal(await hanbit.getAttribute('aria-pressed'), 'true');
    assert.ok((await hanbit.innerText()).includes('리드타임 21일'));
    await bada.click();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().highlightedMeshIds.includes('CYL01_COVER'));
    const covers = Array.from({ length: 6 }, (_, i) => `CYL${String(i + 1).padStart(2, '0')}_COVER`);
    assert.deepEqual((await state()).highlighted, covers);
    assert.equal(await bada.getAttribute('aria-pressed'), 'true');
    assert.equal(await hanbit.getAttribute('aria-pressed'), 'false');
    await supplier('');
    return { supplierA: liners, supplierB: covers, fictionalNamesExplicit: true };
  });

  await check('part selector and ID search route into matching purchase details', async () => {
    await selectPart('CYL03_EXHVALVE_SPINDLE');
    assert.ok((await page.locator('.part-summary h2').textContent()).includes('스핀들'));
    await page.getByLabel('부품 이름 또는 ID 검색').fill('CYL02_COVER');
    await page.locator('.part-search-results button').filter({ hasText: 'CYL02_COVER' }).click();
    assert.equal((await state()).selected, 'CYL02_COVER');
    assert.equal(await page.getByLabel('부품 이름 또는 ID 검색').inputValue(), '');
    await demoMode();
    await selectPart('CYL01_LINER');
    return { selected: (await state()).selected, unit: (await state()).unitId };
  });

  await check('every principal component, valve child and support context is independently selectable', async () => {
    const representatives = ['CYL01_LINER', 'CYL01_COVER', 'CYL01_EXHVALVE',
      'CYL01_EXHVALVE_HOUSING', 'CYL01_EXHVALVE_SPINDLE', 'CYL01_EXHVALVE_SEAT',
      'CYL01_HYDPIPE_01', 'CYL01_FRAME', 'ENGINE_FRAMEBOX', 'ENGINE_BEDPLATE', 'ENGINE_MBS_01', 'ENGINE_SHELL_01'];
    for (const id of representatives) {
      await selectPart(id);
      assert.ok((await page.locator('.part-summary h2').innerText()).length > 2);
    }
    await selectPart('CYL01_LINER');
    return { selectedIndependently: representatives };
  });

  await check('demo inventory keeps variant details, SAMPLE evaluation and unit allocation separate', async () => {
    assert.equal((await state()).unitId, 'DEMO-6A');
    assert.equal(await page.getByTestId('inv-total').textContent(), '9EA');
    assert.equal(await page.locator('.unit-purchase-details').getAttribute('open'), '');
    await purchaseDetails(true);
    const facts = await page.locator('.supply-summary').innerText();
    assert.ok(facts.includes('호기 가용재고\n1') && facts.includes('호기 배정량\n1'));
    const row = page.getByTestId('sup-row');
    assert.ok((await row.innerText()).includes('97.2%'));
    assert.ok((await page.locator('.sup-list + .sample-note').innerText()).includes('실제 계약·평가 아님'));
    const first = page.getByTestId('inv-variant').nth(0), second = page.getByTestId('inv-variant').nth(1);
    assert.equal(await first.getAttribute('open'), '');
    assert.ok((await first.innerText()).includes('가상 내마모 주철'));
    assert.ok((await first.innerText()).includes('가상 조립동 자재창고'));
    assert.ok((await first.innerText()).includes('Rev A'));
    await second.locator('summary').click();
    assert.equal(await second.getAttribute('open'), '');
    assert.ok((await second.innerText()).includes('가상 제2 자재창고'));
    await second.locator('summary').click();
    assert.equal(await second.getAttribute('open'), null);
    await purchaseDetails(false);
    await page.locator('.inv-body').evaluate(el => { el.scrollTop = 0; });
    return { typeTotal: 9, unitAvailable: 1, unitAllocated: 1, sampleOnTimePct: 97.2,
      screenshot: await picture('integrated-demo.png') };
  });

  await check('supplier row highlights only exact current-unit part IDs and preserves their statuses', async () => {
    await page.getByRole('button', { name: '이 협력사 부품 3D에서 강조' }).click();
    const expected = ['CYL01_LINER', 'CYL02_LINER', 'CYL03_LINER', 'CYL04_LINER', 'CYL05_LINER', 'CYL06_LINER'];
    await page.waitForFunction(() => window.__integratedViewer.snapshot().highlightedMeshIds.length === 6);
    assert.deepEqual((await state()).highlighted, expected);
    const viewer = await snap();
    assert.deepEqual(new Set(viewer.highlightedMeshIds), new Set(expected));
    assert.equal(viewer.colors.CYL01_LINER, '#319c70');
    assert.equal(viewer.colors.CYL05_LINER, '#dbaa35');
    assert.equal(viewer.colors.CYL06_LINER, '#da5b57');
    assert.equal(viewer.byPartOpacity.CYL01_LINER, 1);
    assert.ok(viewer.byPartOpacity.CYL01_HYDPIPE_01 < .3);
    assert.equal(viewer.byPartOpacity.CYL01_COVER, .16);
    assert.deepEqual(viewer.selectedOutlineIds, ['CYL01_LINER']);
    return { highlighted: expected, otherTypeUnselected: 'CYL01_HYDPIPE_01', screenshot: await picture('integrated-supplier.png') };
  });

  await check('supplier selection removes other-supplier status colors, switching replaces them and clearing restores all statuses', async () => {
    await supplier('');
    const baseline = await snap();
    assert.equal(baseline.colors.CYL01_COVER, '#319c70');
    assert.equal(baseline.colors.CYL01_LINER, '#319c70');
    await supplier('SUP-DEMO-A');
    const supplierA = await snap(), scopeA = assertSupplierColorScope(supplierA);
    assert.equal(supplierA.colors.CYL01_LINER, '#319c70');
    assert.equal(supplierA.colors.CYL05_LINER, '#dbaa35');
    assert.equal(supplierA.colors.CYL06_LINER, '#da5b57');
    assert.equal(supplierA.colors.CYL01_COVER, '#87949d');
    await supplier('SUP-DEMO-B');
    const supplierB = await snap(), scopeB = assertSupplierColorScope(supplierB);
    assert.equal(supplierB.colors.CYL01_COVER, baseline.colors.CYL01_COVER);
    for (const id of scopeA.highlighted) {
      assert.equal(supplierB.colors[id], '#87949d', `${id}: previous supplier color must be removed`);
      assert.equal(supplierB.emissive[id], 0);
    }
    await supplier('');
    const restored = await snap();
    assert.deepEqual(restored.colors, baseline.colors);
    assert.ok(Object.values(restored.emissive).every(value => value === 0));
    await supplier('SUP-DEMO-A');
    return { supplierA: scopeA, supplierB: scopeB, clearedRestoresEveryStatusColor: true };
  });

  await check('slow continuous pulse changes brightness without disappearance and stop freezes it', async () => {
    await page.waitForFunction(() => window.__integratedViewer.snapshot().emissive.CYL01_LINER >= .28);
    const samples = [];
    for (let i = 0; i < 7; i++) { samples.push((await snap()).emissive.CYL01_LINER); await pause(180); }
    assert.ok(Math.max(...samples) - Math.min(...samples) > .08);
    assert.ok(samples.every(value => value >= .279 && value <= .481));
    assert.ok(samples.every((value, i) => i === 0 || Math.abs(value - samples[i - 1]) < .16));
    await page.getByRole('button', { name: '점멸 정지', exact: true }).click();
    await page.waitForFunction(() => !window.__integratedViewer.snapshot().pulse
      && window.__integratedViewer.snapshot().emissive.CYL01_LINER === .34);
    const frozenA = (await snap()).emissive.CYL01_LINER;
    await pause(420); const frozenB = (await snap()).emissive.CYL01_LINER;
    assert.equal(frozenA, frozenB); assert.equal(frozenA, .34);
    await page.getByRole('button', { name: '점멸 시작', exact: true }).click();
    return { samples, frozen: frozenA, opacity: (await snap()).byPartOpacity.CYL01_LINER };
  });

  await check('green yellow red states remain distinct while valve child buying quantities stay excluded', async () => {
    await supplier('SUP-DEMO-A');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().highlightedMeshIds.includes('CYL05_LINER'));
    const viewer = await snap();
    assert.equal(viewer.colors.CYL05_LINER, '#dbaa35');
    assert.equal(viewer.colors.CYL01_LINER, '#319c70');
    assert.equal(viewer.colors.CYL06_LINER, '#da5b57');
    assert.equal((await state()).statusById.CYL01_EXHVALVE_SPINDLE, 'unknown');
    await selectPart('CYL05_LINER');
    await purchaseDetails(true);
    assert.ok((await page.locator('.supply-reason').innerText()).includes('입고 예정'));
    assert.ok((await page.locator('.purchase-facts').nth(1).innerText()).includes('2026-11-05'));
    await selectPart('CYL01_EXHVALVE_SPINDLE');
    assert.ok((await page.locator('.supply-reason').innerText()).includes('하위품 중복 집계 제외'));
    assert.ok((await page.locator('.supply-summary').innerText()).includes('필요량\n0'));
    await supplier('SUP-DEMO-A');
    await selectPart('CYL01_LINER');
    await purchaseDetails(false);
    return { green: viewer.colors.CYL01_LINER, yellow: viewer.colors.CYL05_LINER,
      red: viewer.colors.CYL06_LINER, childPurchaseQuantity: 0, childDataStatus: 'unknown' };
  });

  await check('reduced-motion control freezes pulse and respects browser motion preference', async () => {
    await page.getByLabel('모션 감소', { exact: true }).check();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().reducedMotion === true
      && window.__integratedViewer.snapshot().emissive.CYL01_LINER === .34);
    assert.equal((await snap()).reducedMotion, true);
    assert.equal((await snap()).emissive.CYL01_LINER, .34);
    assert.equal(await page.getByRole('button', { name: '점멸 정지', exact: true }).isDisabled(), true);
    await page.getByLabel('모션 감소', { exact: true }).uncheck();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pause(150); assert.equal((await state()).reducedMotion, true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await pause(150); assert.equal((await state()).reducedMotion, false);
    return { manual: true, mediaQuery: true };
  });

  await check('actual canvas ray click selects a liner behind faded surroundings and updates details', async () => {
    await supplier('SUP-DEMO-A');
    await page.getByLabel('주변 반투명', { exact: true }).check();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().byPartOpacity.CYL01_COVER === .16);
    await selectPart('CYL01_COVER');
    await pause(900);
    const point = await page.evaluate(() => {
      const d = window.__integratedViewer, p = d.projectPart('CYL01_LINER');
      for (const dx of [0, -.01, .01, -.025, .025, -.05, .05]) for (const dy of [0, -.01, .01, -.025, .025]) {
        if (d.pickAtNDC(p.x + dx, p.y + dy) !== 'CYL01_LINER') continue;
        const rect = document.querySelector('canvas').getBoundingClientRect();
        return { x: p.x + dx, y: p.y + dy, clientX: rect.left + (p.x + dx + 1) * rect.width / 2,
          clientY: rect.top + (1 - p.y - dy) * rect.height / 2, pick: 'CYL01_LINER' };
      }
      return null;
    });
    assert.ok(point, 'A ray through the visible liner must reach CYL01_LINER');
    await page.mouse.click(point.clientX, point.clientY);
    await page.waitForFunction(() => window.__engineDx.selected === 'CYL01_LINER');
    assert.equal(await page.getByTestId('selected-part-id').textContent(), 'CYL01_LINER');
    return point;
  });

  await check('hide group, isolate, surrounding translucency and reset control actual mesh visibility', async () => {
    await supplier(''); await selectPart('CYL01_LINER');
    await page.getByLabel('주변 반투명', { exact: true }).check();
    assert.equal((await snap()).byPartOpacity.CYL01_COVER, .16);
    await page.getByLabel('선택 부품만', { exact: true }).check();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().visibleMeshIds.length === 1);
    assert.deepEqual((await snap()).visibleMeshIds.filter(id => id && !id.endsWith('CONTEXT')), ['CYL01_LINER']);
    await page.getByLabel('선택 부품만', { exact: true }).uncheck();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().visibleMeshIds.length > 1);
    await page.getByRole('button', { name: '부품군 표시 설정', exact: true }).click();
    await page.locator('.groups-popover').getByLabel('실린더', { exact: true }).uncheck();
    await page.waitForFunction(() => !window.__integratedViewer.snapshot().visibleMeshIds.some(id => /_(LINER|COVER)$/.test(id)));
    assert.ok(!(await snap()).visibleMeshIds.some(id => /_(LINER|COVER)$/.test(id)));
    await page.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().visibleMeshIds.includes('CYL01_COVER'));
    const viewer = await snap(); assert.ok(viewer.visibleMeshIds.includes('CYL01_LINER'));
    assert.ok(viewer.visibleMeshIds.includes('CYL01_COVER'));
    await page.getByRole('button', { name: '부품군 표시 설정', exact: true }).click();
    return { resetRestores: ['CYL01_LINER', 'CYL01_COVER'] };
  });

  await check('section and exploded views keep MBS and shell locations and distinct valve hierarchy', async () => {
    const before = (await snap()).integratedSupportPositions;
    await page.getByRole('button', { name: '내부 단면', exact: true }).click();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().cutaway === true
      && window.__integratedViewer.snapshot().clippingPartIds.length > 0);
    assert.ok((await page.locator('.model-context-note').textContent()).includes('실제 가공 단면'));
    await page.getByLabel('분리 정도', { exact: true }).fill('100');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().explode === 1);
    assert.deepEqual((await snap()).integratedSupportPositions, before);
    const ids = (await snap()).ids;
    for (const id of ['ENGINE_MBS_01', 'ENGINE_SHELL_01', 'CYL01_EXHVALVE', 'CYL01_EXHVALVE_HOUSING', 'CYL01_EXHVALVE_SPINDLE', 'CYL01_EXHVALVE_SEAT']) assert.ok(ids.includes(id));
    await selectPart('ENGINE_MBS_01');
    assert.ok((await page.locator('.inv-body').innerText()).includes('탈착 가능한 부품으로 해석하지 않습니다'));
    await selectPart('CYL01_EXHVALVE_SPINDLE');
    assert.ok((await page.locator('.inv-body').innerText()).includes('상위 컴플리트 구매 시 BOM에서 제외'));
    const evidence = { integratedSupportCount: before.length, clippingMeshPartCount: (await snap()).clippingPartIds.length,
      screenshot: await picture('integrated-section.png') };
    await page.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
    await page.waitForFunction(() => window.__integratedViewer.snapshot().cutaway === false
      && window.__integratedViewer.snapshot().clippingPartIds.length === 0);
    return evidence;
  });

  await check('7-cylinder unit rebuild has 74 unique G95 IDs and does not leak other-unit supply', async () => {
    await supplier('SUP-DEMO-A');
    await page.getByLabel('생산 호기', { exact: true }).selectOption('DEMO-7B');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().ids.length === 74);
    assert.equal((await state()).highlighted.length, 0);
    await supplier('SUP-DEMO-A');
    const expectedCoverIds = Array.from({ length: 7 }, (_, i) => `CYL${String(i + 1).padStart(2, '0')}_COVER`);
    assert.deepEqual((await state()).highlighted, expectedCoverIds);
    assert.equal(new Set((await snap()).ids).size, 74);
    await selectPart('CYL01_LINER');
    await purchaseDetails(true);
    assert.ok((await page.locator('.purchase-facts').first().innerText()).includes('DEMO-B-LNR-001 · B'));
    assert.equal((await state()).statusById.CYL01_LINER, 'secured');
    assert.ok((await page.getByTestId('sup-row').innerText()).includes('가상 바다메탈'));
    assert.ok((await state()).partIds.includes('CYL07_LINER'));
    await purchaseDetails(false);
    return { count: 74, supplierA: (await state()).highlighted, currentUnit: (await state()).unitId };
  });

  await check('BOM download exports explicit purchasing rows without assembly-child or MBS duplication', async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '호기 BOM JSON', exact: true }).click();
    const download = await pending;
    const buffer = await readFile(await download.path());
    const bom = JSON.parse(buffer.toString('utf8'));
    assert.equal(bom.unitId, 'DEMO-7B');
    assert.equal(bom.rows.length, 30);
    assert.ok(!bom.rows.some(row => row.part.bomRole === 'child' || row.part.category === 'mbs' || row.part.category === 'shell'));
    return { filename: download.suggestedFilename(), purchasePositions: bom.rows.length };
  });

  await check('GLB download preserves part IDs and excludes replaced G50 legacy objects', async () => {
    const pending = page.waitForEvent('download');
    await page.locator('.motion-toolbar a[download]').click();
    const download = await pending;
    const json = glbJSON(await readFile(await download.path()));
    const ids = [...new Set(json.nodes.filter(node => node.extras?.pickable && node.extras?.partId).map(node => node.extras.partId))];
    assert.equal(ids.length, 74);
    assert.ok(ids.includes('CYL07_LINER') && ids.includes('ENGINE_MBS_08'));
    assert.ok(!ids.some(id => /^CYL_\d/.test(id) || id.includes('PISTON')));
    return { filename: download.suggestedFilename(), preservedIds: ids.length };
  });

  await check('MAIN 01 route is HTTP 200 with original source bytes preserved', async () => {
    const response = await context.request.get(baseUrl + '/main01/index.html');
    assert.equal(response.status(), 200);
    const remote = await response.body();
    const saved = await readFile(path.join(project, 'public/main01/index.html'));
    const verifiedOriginalSha256 = '7470ae35b8989711b2138823e88fa08d0f22f8507a7d5e9f9c9837bf91f6ebf9';
    assert.equal(hash(remote), hash(saved)); assert.equal(hash(saved), verifiedOriginalSha256);
    return { status: response.status(), sha256: hash(saved), bytes: saved.length };
  });

  await check('invalid and disguised demo JSON imports reject atomically', async () => {
    const before = await state();
    const rawDemo = JSON.parse(await readFile(path.join(project, 'public/data/parts-inventory-demo.json'), 'utf8'));
    rawDemo.meta.dataKind = 'registered'; rawDemo.meta.sample = false; rawDemo.meta.source = 'ERP import';
    await upload('disguised-demo.json', rawDemo);
    await page.getByRole('alert').waitFor();
    assert.equal((await state()).unitId, before.unitId);
    assert.equal((await state()).dataKind, before.dataKind);
    const empty = JSON.parse(await readFile(path.join(project, 'public/data/parts-inventory-empty.json'), 'utf8'));
    registeredFixture = { ...empty, meta: { dataKind: 'registered', sample: false, source: '브라우저 QA 입력 검증 fixture — 실사업 자료 아님', as_of: null },
      units: [{ id: 'QA-UNIT-001', label: 'QA 입력 검증 호기', cylinderCount: 6 }], suppliers: [],
      supply: [{ unitId: 'QA-UNIT-001', partId: 'CYL01_LINER', supplierId: null, status: 'unknown', itemNo: 'QA-ITEM-001', rev: null,
        required: null, available: null, allocated: null, shortage: null, poNo: null, openOrder: null,
        requiredDate: null, expectedDate: null, reason: '입력 검증 fixture', updatedAt: null, variantId: null }] };
    const bad = structuredClone(registeredFixture); bad.supply[0].partId = 'CYL01_BOGUS';
    await upload('invalid-id.json', bad);
    await page.waitForFunction(() => document.querySelector('[role=alert]').textContent.includes('partId'));
    assert.equal((await state()).unitId, before.unitId);
    assert.deepEqual((await state()).highlighted, before.highlighted);
    return { previousModeRetained: before.dataKind, previousUnitRetained: before.unitId };
  });

  await check('provided JSON connects explicit fixture item while preserving unknown stock and evaluations', async () => {
    assert.ok(registeredFixture);
    await upload('qa-input-fixture.json', registeredFixture);
    await page.waitForFunction(() => window.__engineDx.unitId === 'QA-UNIT-001');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().ids.length === 64);
    assert.equal((await state()).dataKind, 'registered');
    await purchaseDetails(true);
    assert.ok((await page.locator('.purchase-facts').first().innerText()).includes('QA-ITEM-001'));
    assert.equal(await page.getByTestId('inv-total').textContent(), '미등록');
    assert.equal(await page.getByTestId('sup-row').count(), 0);
    assert.equal((await state()).statusById.CYL01_LINER, 'unknown');
    assert.ok((await page.locator('.supply-summary').innerText()).includes('미등록'));
    await purchaseDetails(false);
    return { item: 'QA-ITEM-001', stock: '미등록', fixtureOnly: true };
  });

  await check('supplier without current-unit supplied parts neutralizes every mesh instead of restoring unrelated status colors', async () => {
    const fixture = structuredClone(registeredFixture);
    fixture.suppliers = [
      { supplier_id: 'QA-SUPPLIER-A', name: 'QA 공급 연결 확인', grade: null, on_time_rate_pct: null },
      { supplier_id: 'QA-NO-SUPPLY', name: 'QA 공급 관계 없음', grade: null, on_time_rate_pct: null },
    ];
    Object.assign(fixture.supply[0], { supplierId: 'QA-SUPPLIER-A', status: 'secured',
      required: 1, available: 1, allocated: 1, shortage: 0, openOrder: 0 });
    await upload('qa-empty-supplier-fixture.json', fixture);
    await page.waitForFunction(() => window.__integratedViewer.snapshot().colors.CYL01_LINER === '#319c70');
    await page.getByLabel('협력사 강조', { exact: true }).selectOption('QA-NO-SUPPLY');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().supplierFocused === true
      && window.__integratedViewer.snapshot().colors.CYL01_LINER === '#87949d');
    const viewer = await snap();
    assert.deepEqual(viewer.highlightedMeshIds, []);
    const scoped = assertSupplierColorScope(viewer);
    await supplier('');
    await page.waitForFunction(() => window.__integratedViewer.snapshot().colors.CYL01_LINER === '#319c70');
    assert.equal((await snap()).supplierFocused, false);
    return { ...scoped, emptySupplierDoesNotRevealOtherSupplierColors: true, clearingRestoresGreen: true };
  });

  await check('source information explains concept geometry, sample data and actual purchase limitations', async () => {
    await page.getByRole('button', { name: '자료 출처 및 가정 확인' }).click();
    const modal = page.getByRole('dialog', { name: '모델과 데이터 출처' });
    const text = await modal.innerText();
    assert.ok(text.includes('실제 제작 치수 아님') && text.includes('G50 메시와 새 G95 구조를 혼합하지 않았습니다'));
    assert.equal(await modal.locator('a[href^="https:"]').count(), 7);
    await page.getByRole('button', { name: '모델 정보 닫기' }).click();
    return { sourceLinks: 7 };
  });

  await check('receipt scenario turns an incoming liner into allocated stock while an uncovered shortage remains red', async () => {
    await demoMode(); await supplier('SUP-DEMO-A'); await selectPart('CYL05_LINER'); await purchaseDetails(true);
    assert.equal((await state()).statusById.CYL05_LINER, 'review');
    assert.equal(await page.getByTestId('inv-total').textContent(), '9EA');
    await setScenario('receipts');
    await page.waitForFunction(() => window.__engineDx.statusById.CYL05_LINER === 'secured'
      && window.__integratedViewer.snapshot().colors.CYL05_LINER === '#319c70');
    assert.equal((await state()).statusById.CYL06_LINER, 'shortage');
    assert.equal(await page.getByTestId('inv-total').textContent(), '11EA');
    assert.ok((await page.locator('.supply-summary').innerText()).includes('호기 배정량\n1'));
    assert.ok((await page.locator('.supply-reason').innerText()).includes('입고·검사 합격'));
    const data = await downloadScenario();
    const stock = data.relations.stock.find(row => row.itemNo === 'DEMO-A-LNR-001');
    assert.equal(stock.currentStock, 5); assert.equal(stock.acceptedStock, 5);
    assert.ok(data.relations.inspections.some(row => row.itemNo === stock.itemNo && row.simulationEvent === 'receipts' && row.rejectedQty === 0));
    return { changedPart: 'CYL05_LINER', status: 'secured', allocated: 1, unchangedShortagePart: 'CYL06_LINER',
      screenshot: await picture('integrated-simulation-receipts.png') };
  });

  await check('delayed scenario restores seed quantities and shows the shifted promised arrival in UI and order data', async () => {
    await setScenario('delayed');
    await page.waitForFunction(() => window.__engineDx.statusById.CYL05_LINER === 'review');
    assert.equal(await page.getByTestId('inv-total').textContent(), '9EA');
    assert.ok((await page.locator('.purchase-facts').nth(1).innerText()).includes('2026-11-19'));
    assert.ok((await page.locator('.supply-reason').innerText()).includes('납기 지연'));
    const data = await downloadScenario();
    const order = data.relations.purchaseOrders.find(row => row.itemNo === 'DEMO-A-LNR-001' && row.status === 'delayed');
    assert.equal(order.expectedDate, '2026-11-19'); assert.equal(order.confirmed, false);
    const stock = data.relations.stock.find(row => row.itemNo === 'DEMO-A-LNR-001');
    assert.equal(stock.currentStock, 4);
    return { partId: 'CYL05_LINER', expectedDate: order.expectedDate, confirmed: order.confirmed,
      screenshot: await picture('integrated-simulation-delayed.png') };
  });

  await check('inspection rejection removes two cover units from availability and returning to baseline resets every scenario effect', async () => {
    await setScenario('rejected'); await selectPart('CYL05_COVER'); await purchaseDetails(true);
    await page.waitForFunction(() => window.__engineDx.statusById.CYL05_COVER === 'shortage');
    assert.equal(await page.getByTestId('inv-total').textContent(), '9EA');
    assert.ok((await page.locator('.supply-summary').innerText()).includes('호기 배정량\n0'));
    assert.ok((await page.locator('.supply-reason').innerText()).includes('검사 부적합'));
    const data = await downloadScenario();
    const stock = data.relations.stock.find(row => row.itemNo === 'DEMO-A-COV-001');
    assert.equal(stock.currentStock, 6); assert.equal(stock.rejectedQty, 2); assert.equal(stock.acceptedStock, 4);
    assert.ok(data.relations.inspections.some(row => row.itemNo === stock.itemNo && row.simulationEvent === 'rejected' && row.rejectedQty === 2));
    const screenshot = await picture('integrated-simulation-rejected.png');
    await setScenario('baseline');
    await page.waitForFunction(() => window.__engineDx.statusById.CYL05_COVER === 'secured');
    assert.equal(await page.getByTestId('inv-total').textContent(), '13EA');
    await selectPart('CYL05_LINER');
    assert.equal((await state()).statusById.CYL05_LINER, 'review');
    assert.equal(await page.getByTestId('inv-total').textContent(), '9EA');
    assert.ok((await page.locator('.purchase-facts').nth(1).innerText()).includes('2026-11-05'));
    const reset = await downloadScenario();
    assert.ok(!reset.relations.inspections.some(row => row.simulationEvent));
    assert.equal(reset.relations.stock.find(row => row.itemNo === 'DEMO-A-COV-001').acceptedStock, 6);
    await purchaseDetails(false);
    return { changedPart: 'CYL05_COVER', rejected: 2, accepted: 4, baselineAccepted: 6,
      resetsSeed: true, scenario: reset.meta.scenario, screenshot };
  });

  await demoMode(); await supplier('SUP-DEMO-A'); await selectPart('CYL01_LINER');
  await page.getByRole('button', { name: '전체 보기 및 초기화', exact: true }).click();
  await page.locator('.inv-body').evaluate(el => { el.scrollTop = 0; });
  await check('390px mobile retains controls and prevents horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await pause(500);
    const width = await page.evaluate(() => ({ viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(width.html <= width.viewport + 1 && width.body <= width.viewport + 1, JSON.stringify(width));
    assert.ok(await page.getByLabel('데이터 모드').isVisible());
    assert.ok(await page.getByLabel('생산 호기', { exact: true }).isVisible());
    return { ...width, screenshot: await picture('integrated-mobile.png') };
  });

  await check('runtime completes without JavaScript errors or failed asset requests', async () => {
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    return { consoleErrors: 0, failedRequests: 0 };
  });
  if (process.env.RECORD_DEMO === '1') {
    await context.close();
    try { guidedVideo = await recordViewportDemo(); console.log('Recorded verification/integrated-demo.webm'); }
    catch (error) { guidedVideo = { available: false, reason: error.message }; console.error('Video unavailable: ' + error.message); }
  }
} catch (error) {
  checks.push({ name: 'browser setup/completion', passed: false, error: error.stack });
} finally {
  const result = { passed: checks.every(check => check.passed), browser: 'headless ' + browserChannel, version: browser.version(),
    url: baseUrl, desktopViewport: { width: 1365, height: 1000 }, checks, consoleErrors, failedRequests, guidedVideo,
    limitation: 'Headless WebGL software rendering. Import fixture is QA-only input, not actual commercial/ERP data. Manufacturing dimensions and external purchase facts are not validated.' };
  await writeFile(path.join(verification, 'integrated-browser.json'), JSON.stringify(result, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ passed: result.passed, checks: checks.length, failed: checks.filter(check => !check.passed).map(check => check.name) }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
