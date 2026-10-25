import * as THREE from 'three';
import { createPart, cylinder, box, tubeBetween, METAL } from './model-utils.js';

export function createCylinderContext(partId, cylinderIndex) {
  const group = createPart(partId, '피스톤·크로스헤드 위치 참고', 'context', {
    sources: ['R1'], role: 'context', bomRole: 'context', pickable: false,
    geometryEvidence: '구매 대상의 연결 위치 설명에 한정한 보조 개념 형상. 운동학·행정·크랭크 위상은 설계값이 아님.',
  });
  cylinder(group, 0.345, 0.24, [0, 4.87, 0], METAL.context);
  cylinder(group, 0.065, 1.67, [0, 3.96, 0], METAL.context);
  box(group, 0.54, 0.23, 0.68, [0, 3.06, 0], METAL.context);
  for (const z of [-0.47, 0.47]) {
    box(group, 0.12, 1.46, 0.12, [0, 2.93, z], METAL.dark);
  }
  // Slightly alternating rods help distinguish repeated modules, with no motion claim.
  const offsetZ = cylinderIndex % 2 === 0 ? 0.31 : -0.31;
  tubeBetween(group, [0, 2.95, 0], [0, 1.20, offsetZ], 0.09, METAL.context);
  const crankpin = cylinder(group, 0.17, 0.42, [0, 1.20, offsetZ], METAL.context);
  crankpin.rotation.z = Math.PI / 2;
  for (const x of [-0.27, 0.27]) {
    tubeBetween(group, [x, 0.94, 0], [x, 1.20, offsetZ], 0.16, METAL.context);
  }
  return group;
}

export function createCrankContext(length) {
  const group = createPart('ENGINE_CRANK_CONTEXT', '크랭크축 · 위치 참고', 'context', {
    sources: ['R1'], role: 'context', bomRole: 'context', pickable: false,
    geometryEvidence: '수평 축선·베어링 위치를 나타내는 보조 개념 형상. 실제 크랭크축 형상이 아님.',
  });
  const shaft = cylinder(group, 0.235, length + 0.45, [0, 0.94, 0], METAL.context);
  shaft.rotation.z = Math.PI / 2;
  const end = cylinder(group, 0.46, 0.19, [length / 2 + 0.30, 0.94, 0], METAL.dark);
  end.rotation.z = Math.PI / 2;
  return group;
}

export function createHydraulicSupplyContext(length) {
  const group = createPart('ENGINE_HYDRAULIC_SUPPLY_CONTEXT', '유압 공급 연결 위치 · 개념', 'context', {
    sources: ['R1', 'R6'], role: 'context', bomRole: 'context', pickable: false,
    geometryEvidence: '개별 배관의 공급측 연결 문맥을 나타내는 개념 축선. 실제 공급 장치의 위치·배관 경로가 아님.',
  });
  const rail = cylinder(group, 0.055, length, [0, 6.28, -0.79], METAL.dark);
  rail.rotation.z = Math.PI / 2;
  return group;
}
