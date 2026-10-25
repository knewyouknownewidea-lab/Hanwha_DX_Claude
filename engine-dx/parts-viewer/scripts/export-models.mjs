import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createEngine } from '../src/engine-scene.js';

const project = fileURLToPath(new URL('../', import.meta.url));
const modelDir = path.join(project, 'public/models');
const dataDir = path.join(project, 'public/data');
const referenceDir = path.join(project, 'public/reference');

// Three's browser exporter uses FileReader for its Blob conversion. No canvas,
// textures or browser globals are otherwise needed by these original meshes.
if (!globalThis.FileReader) {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.({ target: this }); }, error => this.onerror?.(error));
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then(value => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`;
        this.onloadend?.({ target: this });
      }, error => this.onerror?.(error));
    }
  };
}

const partFiles = [
  ['cylinder-liner', 'CYL01_LINER'],
  ['cylinder-cover', 'CYL01_COVER'],
  ['exhaust-valve-assembly', 'CYL01_EXHVALVE'],
  ['exhaust-valve-housing', 'CYL01_EXHVALVE_HOUSING'],
  ['exhaust-valve-spindle', 'CYL01_EXHVALVE_SPINDLE'],
  ['exhaust-valve-seat', 'CYL01_EXHVALVE_SEAT'],
  ['frame-box', 'ENGINE_FRAMEBOX'],
  ['bedplate', 'ENGINE_BEDPLATE'],
  ['hydraulic-pipe', 'CYL01_HYDPIPE_01'],
  ['main-bearing-support', 'ENGINE_MBS_01'],
  ['bearing-shell', 'ENGINE_SHELL_01'],
  ['cylinder-frame', 'CYL01_FRAME'],
];

async function exportGlb(root, filename) {
  const bytes = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false });
  await writeFile(path.join(modelDir, filename), Buffer.from(bytes));
  return bytes.byteLength;
}

function hierarchy(object) {
  return {
    name: object.name || object.type,
    ...(object.userData.partId ? { partId: object.userData.partId } : {}),
    ...(object.children.length ? { children: object.children.filter(child => child.isGroup).map(hierarchy) } : {}),
  };
}

function standalone(source, engineData) {
  const root = new THREE.Group();
  root.name = `part_model_${source.userData.partId}`;
  root.userData = {
    engineFamily: engineData.engineFamily, sourceEngine: engineData.referenceEngine,
    accuracy: 'concept', units: engineData.units, coordinateSystem: engineData.coordinateSystem,
    modelNotice: engineData.modelNotice, dimensionsVerified: false,
    standaloneNotice: '부품 식별용 독립 보기. 원래 엔진의 장착 위치·정밀 치수를 나타내지 않음.',
  };
  const object = source.clone(true);
  object.position.set(0, 0, 0);
  object.userData = { ...object.userData, sourceAssemblyPosition: source.position.toArray(), basePosition: [0, 0, 0] };
  root.add(object);
  root.updateMatrixWorld(true);
  return root;
}

// Orthographic reference sheets are generated from the same editable meshes.
// The third view discards the front half at Z=0; it does not invent a closed
// manufacturing cut surface, cooling passage, port or concealed interface.
function clipAtZZero(polygon) {
  const clipped = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const inA = a.z <= 0, inB = b.z <= 0;
    if (inA) clipped.push(a);
    if (inA !== inB) {
      const t = -a.z / (b.z - a.z);
      clipped.push(a.clone().lerp(b, t));
    }
  }
  return clipped;
}

function projection(view) {
  const direction = view === 'side' ? new THREE.Vector3(1, 0, 0)
    : view === 'cut' ? new THREE.Vector3(0.5, 0.22, 1).normalize()
      : new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  return { direction, horizontal: point => point.dot(right), vertical: point => point.dot(up) };
}

function trianglesFor(root, view, cut) {
  const output = [];
  const { direction: towardCamera } = projection(view);
  root.traverse(object => {
    if (!object.isMesh) return;
    const position = object.geometry.attributes.position;
    const index = object.geometry.index;
    const total = index ? index.count : position.count;
    for (let i = 0; i < total; i += 3) {
      const points = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(object.matrixWorld));
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      if (normal.dot(towardCamera) < 0.001) continue;
      const polygon = cut ? clipAtZZero(points) : points;
      if (polygon.length < 3) continue;
      const depth = polygon.reduce((sum, p) => sum + p.dot(towardCamera), 0) / polygon.length;
      const shade = Math.round(140 + 48 * normal.dot(new THREE.Vector3(0.3, 0.8, 0.5).normalize()));
      output.push({ polygon, depth, shade });
    }
  });
  return output.sort((a, b) => a.depth - b.depth);
}

function xml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'); }

function viewSvg(root, x, view, cut) {
  const bounds = new THREE.Box3().setFromObject(root);
  const { horizontal, vertical } = projection(view);
  const corners = [];
  for (const xx of [bounds.min.x, bounds.max.x]) for (const yy of [bounds.min.y, bounds.max.y]) for (const zz of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(xx, yy, zz));
  const horizontalMin = Math.min(...corners.map(horizontal));
  const horizontalMax = Math.max(...corners.map(horizontal));
  const verticalMin = Math.min(...corners.map(vertical));
  const verticalMax = Math.max(...corners.map(vertical));
  const horizontalSize = Math.max(0.15, horizontalMax - horizontalMin);
  const verticalSize = Math.max(0.15, verticalMax - verticalMin);
  const scale = Math.min(292 / horizontalSize, 294 / verticalSize);
  const centreX = (horizontalMin + horizontalMax) / 2;
  const centreY = (verticalMin + verticalMax) / 2;
  const paths = trianglesFor(root, view, cut).map(({ polygon, shade }) => {
    const positions = polygon.map(p => `${(x + 170 + (horizontal(p) - centreX) * scale).toFixed(2)},${(277 - (vertical(p) - centreY) * scale).toFixed(2)}`);
    const color = `rgb(${shade},${shade + 8},${shade + 14})`;
    return `<path d="M${positions.join('L')}Z" fill="${color}" stroke="${color}" stroke-width="0.3" stroke-linejoin="round"/>`;
  }).join('');
  return `<rect x="${x + 8}" y="74" width="324" height="392" rx="12" fill="#f0f4f7" stroke="#d9e2e9"/>
<text x="${x + 24}" y="103" font-size="16" font-weight="700">${cut ? '개념 절단 · Z=0 · 사시' : view === 'side' ? '측면 · +X 방향에서' : '정면 · +Z 방향에서'}</text>
${paths}
<text x="${x + 24}" y="448" font-size="12" fill="#536878">${cut ? '앞쪽 절반 제외 · 절단면 폐합 없음' : '메시 정사영 · 축척/제작 치수 없음'}</text>`;
}

function referenceSvg(root, title, partId, metadata) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1056" height="600" viewBox="0 0 1056 600">
<rect width="1056" height="600" fill="#fff"/>
<g font-family="Malgun Gothic,Arial,sans-serif" fill="#183040">
<text x="24" y="30" font-size="21" font-weight="700">${xml(title)} · ${partId}</text>
<text x="24" y="53" font-size="14" fill="#9a5e18">구조 설명용 모델 / 실제 제작 치수 아님 · 확인된 부품 제작 치수 없음</text>
${viewSvg(root, 12, 'front', false)}${viewSvg(root, 358, 'side', false)}${viewSvg(root, 704, 'cut', true)}
<text x="24" y="497" font-size="14" font-weight="700">MAN B&amp;W G95ME-C 구조 참조 · 형상 정확도: 개념 형상</text>
<text x="24" y="522" font-size="13">참조 ${xml(metadata.sources.join(', '))} · 볼트 수·관경·밀봉홈·냉각유로 등 미확인 상세는 미표현</text>
<text x="24" y="547" font-size="13">절단 보기의 열린 표면은 메시 클리핑 결과이며 실제 가공면·벽 두께·숨은 구조의 증거가 아님</text>
<text x="24" y="572" font-size="13">${metadata.integrated ? 'MBS는 베드플레이트 통합 지지영역으로 취급. 독립 파일은 식별용이며 탈착 가능함을 뜻하지 않음.' : '독립 부품 보기는 식별용. 장착 상세·실제 연결 규격은 설계 자료로 확인 필요.'}</text>
</g></svg>`;
}

await Promise.all([mkdir(modelDir, { recursive: true }), mkdir(dataDir, { recursive: true }), mkdir(referenceDir, { recursive: true })]);
const variants = [];
for (const count of [6, 7, 11]) {
  const engine = createEngine(count);
  const filename = `engine-${count}.glb`;
  const bytes = await exportGlb(engine.root, filename);
  variants.push({
    cylinders: count, file: `models/${filename}`, byteLength: bytes,
    engine: engine.root.userData, parts: engine.metadata,
    context: engine.context.map(object => ({ ...object.userData })),
    hierarchy: hierarchy(engine.root), connections: engine.connections,
  });
}

const base = createEngine(6);
const exports = [];
for (const [name, partId] of partFiles) {
  const source = base.parts.get(partId);
  const partRoot = standalone(source, base.root.userData);
  const filename = `${name}.glb`;
  const byteLength = await exportGlb(partRoot, filename);
  const reference = `reference/${name}.svg`;
  await writeFile(path.join(referenceDir, `${name}.svg`), referenceSvg(partRoot, source.userData.nameKo, partId, source.userData), 'utf8');
  exports.push({ name, partId, nameKo: source.userData.nameKo, file: `models/${filename}`, reference, byteLength, metadata: { ...source.userData } });
}

const manifest = {
  schemaVersion: '1.0', generator: 'scripts/export-models.mjs',
  license: 'Original concept geometry created for this project. References are not redistributed.',
  modelNotice: '구조 설명용 모델 / 실제 제작 치수 아님',
  dimensionalPolicy: 'All numeric geometry values are dimensionless demo proportions. glTF metre convention does not represent physical manufacturer dimensions.',
  mappingPolicy: 'partId identifies a placement/classification, not a purchase item number. Bind itemNumber/REV/supplier by production unit.',
  engineFamily: 'MAN B&W G95ME-C', referenceEngine: 'R1 11G95ME-C Mark 10.5',
  defaultVariant: 6, parts: base.metadata, connections: base.connections,
  context: base.context.map(object => ({ ...object.userData })), variants, partExports: exports,
};
await writeFile(path.join(dataDir, 'parts-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
const links = exports.map(part => `<li><a href="${part.name}.svg">${xml(part.nameKo)} · ${part.partId}</a></li>`).join('\n');
await writeFile(path.join(referenceDir, 'index.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><title>부품 구조 참고도</title><style>body{font:16px/1.8 system-ui;max-width:900px;margin:40px auto;padding:0 20px;color:#183040}a{color:#075eaa}</style><h1>부품 구조 참고도</h1><p>구조 설명용 모델 / 실제 제작 치수 아님. 메시 기반 정면·측면·개념 절단 보기이며 제조도면이 아닙니다.</p><ul>${links}</ul></html>`, 'utf8');
console.log(`Exported ${variants.length} engine GLBs, ${exports.length} part GLBs, ${exports.length} reference sheets and parts-manifest.json.`);
