import * as THREE from 'three';
import { createPart, mesh, lathe, METAL } from './model-utils.js';

export function createMainBearingSupport(partId) {
  const group = createPart(partId, '메인베어링 서포트', 'mbs', {
    sources: ['R1', 'R7'], integrated: true, explodeVector: [0, 0, 0],
    detachability: '이 개념 모델에서는 베드플레이트 통합 지지 영역. 별도 식별은 구매 매핑용이며 탈착 가능함을 뜻하지 않음.',
    geometryEvidence: 'R7 역할 자료를 바탕으로 베드플레이트 내 축 지지 영역을 표시. 특정 특허 실시예의 형상은 복제하지 않음.',
  });
  // A saddle-shaped foundation; the bearing shell remains a different object.
  const shape = new THREE.Shape();
  shape.moveTo(-0.98, -0.36);
  shape.lineTo(0.98, -0.36);
  shape.lineTo(0.80, 0.08);
  shape.lineTo(0.30, 0.24);
  shape.absarc(0, 0.24, 0.30, 0, -Math.PI, true);
  shape.lineTo(-0.80, 0.08);
  shape.closePath();
  const foundation = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.29, bevelEnabled: false, curveSegments: 24 }), METAL.edge);
  // The 2D shape runs across Z; extrusion runs along the crank X axis.
  foundation.rotation.y = Math.PI / 2;
  foundation.position.x = -0.145;
  group.add(foundation);
  return group;
}

export function createBearingShell(partId, supportId) {
  const group = createPart(partId, '메인베어링 쉘 · 위치 확인', 'shell', {
    sources: ['R1', 'R7'], role: 'context', bomRole: 'context',
    relatedPartId: supportId, explodeVector: [0, 0, 0],
    geometryEvidence: '서포트와 구분된 축 둘레의 위치 확인용 환형체. 실제 쉘의 분할선·급유홈·두께 미확인.',
  });
  const shell = lathe([[0.30, -0.17], [0.30, 0.17], [0.245, 0.17], [0.245, -0.17], [0.30, -0.17]], METAL.light);
  shell.rotation.z = Math.PI / 2;
  shell.position.y = 0.24;
  group.add(shell);
  return group;
}
