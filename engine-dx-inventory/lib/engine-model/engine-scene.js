import * as THREE from 'three';
import { createCylinderLiner } from './models/cylinder-liner.js';
import { createCylinderCover } from './models/cylinder-cover.js';
import { createExhaustValveAssembly } from './models/exhaust-valve-assembly.js';
import { createFrameBox } from './models/frame-box.js';
import { createBedplate } from './models/bedplate.js';
import { createHydraulicPipe } from './models/hydraulic-pipe.js';
import { createMainBearingSupport, createBearingShell } from './models/main-bearing-support.js';
import { createCylinderFrame } from './models/cylinder-frame.js';
import { createCylinderContext, createCrankContext, createHydraulicSupplyContext } from './models/context-parts.js';
import { snapshotPart } from './models/model-utils.js';

/**
 * Independent, repeatable MAN B&W G95ME-C structure explanation model.
 * R1 is an 11G95ME-C poster; other cylinder counts here are conceptual layouts,
 * not assertions of available products. No numerical value below is a design dimension.
 */
export function createEngine(cylinderCount = 6) {
  const count = Math.max(2, Math.min(12, Math.round(Number(cylinderCount) || 6)));
  const pitch = 1.70; // Dimensionless drawing interval, never a metre value.
  const length = count * pitch + 0.35;
  const root = new THREE.Group();
  root.name = 'engine';
  root.userData = {
    engineFamily: 'MAN B&W G95ME-C', referenceEngine: '11G95ME-C (R1)',
    cylinderCount: count, units: 'dimensionless conceptual demo units',
    unitMeaning: 'Normalized drawing proportions; no manufacturing scale',
    coordinateSystem: 'Right-handed; X crankshaft axis; Y up; Z transverse',
    origin: 'Engine centre at bedplate foundation bottom',
    cylinderPitch: pitch, accuracy: 'concept', dimensionsVerified: false,
    modelNotice: '구조 설명용 모델 / 실제 제작 치수 아님',
    cylinderCountNotice: '기통 수 변경은 시각화 반복 배치이며 실제 제품 구성·공통 구조물의 설계를 확정하지 않음.',
    sources: ['R1'],
  };
  const parts = new Map();
  const metadata = [];
  const context = [];
  const connections = [];
  const shared = new THREE.Group();
  shared.name = 'shared_structure';
  root.add(shared);
  const contextStructure = new THREE.Group();
  contextStructure.name = 'context_structure';
  root.add(contextStructure);

  const addPart = (parent, object, position = [0, 0, 0]) => {
    object.position.set(...position);
    parent.add(object);
    // Traverse assemblies in hierarchy order; each child keeps its own stable ID.
    object.traverse(node => {
      if (node.isGroup && node.userData.partId) {
        snapshotPart(node);
        if (node.userData.pickable) {
          parts.set(node.userData.partId, node);
          metadata.push({ ...node.userData, objectName: node.name });
        } else {
          context.push(node);
        }
      }
    });
    return object;
  };
  const connect = (from, to, type, note, sources = ['R1']) => {
    connections.push({ from, to, type, accuracy: 'concept', sources, note });
  };

  addPart(shared, createBedplate(length, pitch, count));
  addPart(shared, createFrameBox(length, pitch, count));
  connect('ENGINE_FRAMEBOX', 'ENGINE_BEDPLATE', 'structural-joint', '하부 프레임과 베드플레이트 접합 위치. 접합 상세 미확인.');
  addPart(contextStructure, createCrankContext(length));
  addPart(contextStructure, createHydraulicSupplyContext(length));

  for (let station = 0; station <= count; station++) {
    const suffix = String(station + 1).padStart(2, '0');
    const x = (station - count / 2) * pitch;
    const supportId = `ENGINE_MBS_${suffix}`;
    const shellId = `ENGINE_SHELL_${suffix}`;
    addPart(shared, createMainBearingSupport(supportId), [x, 0.70, 0]);
    addPart(shared, createBearingShell(shellId, supportId), [x, 0.70, 0]);
    connect(supportId, 'ENGINE_BEDPLATE', 'integrated-region', '개념 모델의 베드플레이트 통합 지지 영역. 분해도에서도 분리하지 않음.', ['R1', 'R7']);
    connect(shellId, supportId, 'bearing-location', '서포트 내부의 별도 베어링 쉘 위치 참고. 실제 치수·분할 상세 미확인.', ['R1', 'R7']);
  }

  for (let i = 0; i < count; i++) {
    const number = String(i + 1).padStart(2, '0');
    const prefix = `CYL${number}`;
    const x = (i - (count - 1) / 2) * pitch;
    const module = new THREE.Group();
    module.name = `CYLINDER_${number}`;
    module.position.x = x;
    module.userData = { cylinderIndex: i + 1, basePosition: [x, 0, 0], explodeVector: [0, 0, 0] };
    root.add(module);
    addPart(module, createCylinderFrame(`${prefix}_FRAME`, pitch), [0, 4.30, 0]);
    addPart(module, createCylinderLiner(`${prefix}_LINER`), [0, 5.10, 0]);
    addPart(module, createCylinderCover(`${prefix}_COVER`), [0, 6.14, 0]);
    addPart(module, createExhaustValveAssembly(`${prefix}_EXHVALVE`), [0, 6.32, 0]);
    addPart(module, createHydraulicPipe(`${prefix}_HYDPIPE_01`), [0, 6.32, 0]);
    addPart(module, createCylinderContext(`${prefix}_CONTEXT`, i));
    connect(`${prefix}_LINER`, `${prefix}_FRAME`, 'liner-mount', '라이너 본체와 실린더 프레임의 장착 관계. 재킷·밀봉 상세 생략.');
    connect(`${prefix}_LINER`, `${prefix}_COVER`, 'cover-joint', '라이너 상단과 커버 접합 위치.');
    connect(`${prefix}_FRAME`, 'ENGINE_FRAMEBOX', 'structural-joint', '실린더 프레임 하부와 프레임박스 상부 접합 문맥.');
    connect(`${prefix}_EXHVALVE`, `${prefix}_COVER`, 'valve-mount', '커버 중앙 배기밸브 장착 관계.');
    connect(`${prefix}_EXHVALVE_HOUSING`, `${prefix}_EXHVALVE`, 'assembly-child', '하우징은 조립체 하위품. 구매 단위에 따라 중복 집계 방지.', ['R3', 'R5']);
    connect(`${prefix}_EXHVALVE_SPINDLE`, `${prefix}_EXHVALVE`, 'assembly-child', '스핀들은 조립체 하위품.', ['R3', 'R5']);
    connect(`${prefix}_EXHVALVE_SEAT`, `${prefix}_EXHVALVE`, 'assembly-child', '시트는 조립체 하위품.');
    connect(`${prefix}_HYDPIPE_01`, `${prefix}_EXHVALVE_HOUSING`, 'hydraulic-concept', '유압 작동부 연결 위치를 가리키는 개념 배관. 실제 경로·관경·연결 규격 미확인.', ['R1', 'R3', 'R6']);
    connect(`${prefix}_HYDPIPE_01`, 'ENGINE_HYDRAULIC_SUPPLY_CONTEXT', 'hydraulic-concept', '공급측 끝단은 개념 공급 축선과 연결. 실제 장치 위치를 확정하지 않음.', ['R1', 'R6']);
  }

  // Re-apply mesh ownership after assembly traversal so nested child IDs stay intact.
  parts.forEach((object, partId) => {
    object.traverse(node => {
      if (!node.isMesh) return;
      let owner = node.parent;
      while (owner && !owner.userData.partId) owner = owner.parent;
      if (owner) {
        node.userData.partId = owner.userData.partId;
        node.userData.pickable = owner.userData.pickable;
      }
    });
  });
  root.updateMatrixWorld(true);
  return { root, parts, metadata, context, connections };
}
