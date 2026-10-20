import * as THREE from 'three';
import { createPart, mesh, cylinder, METAL } from './model-utils.js';

export function createHydraulicPipe(partId) {
  const group = createPart(partId, '배기밸브 작동 유압 배관', 'pipe', {
    sources: ['R1', 'R3', 'R6'], explodeVector: [0, 0.15, -0.55],
    geometryEvidence: '유압 작동부 연결 기능을 보여주는 개념 경로. 경로·관경·연결 규격 미확인.',
    applicabilityNote: 'R6의 외형·기능 참조. 특정 기준 엔진에 설치되는 실제 배관 경로는 미확인.',
  });
  const points = [[0.27, 0.96, 0], [0.47, 0.96, -0.15], [0.59, 0.88, -0.44], [0.59, 0.12, -0.69], [0.40, -0.04, -0.79]];
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  group.add(mesh(new THREE.TubeGeometry(curve, 40, 0.035, 12, false), METAL.light));
  // Plain endpoint sleeves denote connections without asserting a thread or fitting standard.
  const upper = cylinder(group, 0.065, 0.10, [0.275, 0.96, 0], METAL.edge);
  upper.rotation.z = Math.PI / 2;
  const lower = cylinder(group, 0.065, 0.10, [0.40, -0.04, -0.79], METAL.edge);
  lower.rotation.x = Math.PI / 2;
  return group;
}
