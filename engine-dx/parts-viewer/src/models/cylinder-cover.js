import { createPart, lathe, ring, METAL } from './model-utils.js';

export function createCylinderCover(partId) {
  const group = createPart(partId, '실린더 커버', 'cover', {
    sources: ['R1', 'R4'], explodeVector: [0, 1.65, 0],
    geometryEvidence: 'R1 상부 배치·중앙 배기밸브 장착 관계를 개념화. 확인되지 않은 체결 개수·연료기기 구멍은 생략.',
  });
  group.add(lathe([
    [0.57, -0.17], [0.62, -0.12], [0.62, 0.02], [0.54, 0.12],
    [0.33, 0.22], [0.21, 0.22], [0.21, -0.17], [0.57, -0.17],
  ], METAL.body));
  ring(group, 0.29, 0.21, 0.075, 0.23, METAL.edge);
  return group;
}
