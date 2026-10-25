import { createPart, box, beamBetween, METAL } from './model-utils.js';

export function createFrameBox(length, pitch, cylinderCount) {
  const group = createPart('ENGINE_FRAMEBOX', '프레임박스', 'frame', {
    sources: ['R1', 'R4'], explodeVector: [0, 0, -1.55],
    geometryEvidence: 'R1의 높은 프레임박스·가이드 지지 실루엣을 개방형 구조로 단순화. 세부 격벽과 보강재는 개념 표현.',
  });
  for (const z of [-0.94, 0.94]) {
    box(group, length, 0.23, 0.25, [0, 0.87, z], METAL.edge);
    box(group, length, 0.23, 0.24, [0, 3.68, z * 0.73], METAL.body);
    for (let i = 0; i <= cylinderCount; i++) {
      const x = (i - cylinderCount / 2) * pitch;
      beamBetween(group, [x, 0.96, z], [x, 3.58, z * 0.73], 0.24, 0.23, METAL.body);
      // This open frame exposes guide and crank positions without invented access covers.
      if (i < cylinderCount) {
        const nextX = x + pitch;
        beamBetween(group, [x + 0.12, 1.08, z], [nextX - 0.12, 3.52, z * 0.73], 0.115, 0.14, METAL.edge);
      }
    }
  }
  for (let i = 0; i <= cylinderCount; i++) {
    const x = (i - cylinderCount / 2) * pitch;
    box(group, 0.23, 0.22, 1.52, [x, 3.68, 0], METAL.body);
  }
  return group;
}
