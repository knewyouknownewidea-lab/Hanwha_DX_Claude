import { createPart, lathe, METAL } from './model-utils.js';

export function createCylinderLiner(partId) {
  const group = createPart(partId, '실린더 라이너', 'liner', {
    sources: ['R1', 'R2'], explodeVector: [0, 1.1, 0],
    geometryEvidence: 'R1의 위치 및 R2의 관형 본체·상부 칼라 외형 참조. 포트·냉각유로·밀봉홈은 생략.',
    applicabilityNote: 'R2의 제품군 외형 참조이며 이 모델의 특정 호기 공급·치수를 확인한 자료는 아님.',
  });
  group.add(lathe([
    [0.47, -0.95], [0.47, 0.59], [0.50, 0.70], [0.58, 0.70],
    [0.58, 0.88], [0.36, 0.88], [0.36, -0.95], [0.47, -0.95],
  ], METAL.light));
  return group;
}
