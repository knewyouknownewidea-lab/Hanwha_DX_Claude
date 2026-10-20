import { createPart, box, METAL } from './model-utils.js';

export function createBedplate(length, pitch, cylinderCount) {
  const group = createPart('ENGINE_BEDPLATE', '베드플레이트', 'bedplate', {
    sources: ['R1', 'R4', 'R7'], explodeVector: [0, 0, 0],
    geometryEvidence: 'R1의 하부 기초 및 축 지지 배치 참조. 축 방향 길이와 단면은 시연용 비례.',
  });
  box(group, length + 0.35, 0.20, 2.42, [0, 0.14, 0], METAL.dark);
  box(group, length, 0.52, 0.28, [0, 0.48, 1.04]);
  box(group, length, 0.52, 0.28, [0, 0.48, -1.04]);
  box(group, 0.20, 0.48, 2.12, [-length / 2 + 0.10, 0.48, 0]);
  box(group, 0.20, 0.48, 2.12, [length / 2 - 0.10, 0.48, 0]);
  // Broad transverse foundations show the integrated support relationship.
  for (let i = 0; i <= cylinderCount; i++) {
    const x = (i - cylinderCount / 2) * pitch;
    box(group, 0.29, 0.20, 1.85, [x, 0.34, 0], METAL.edge);
  }
  return group;
}
