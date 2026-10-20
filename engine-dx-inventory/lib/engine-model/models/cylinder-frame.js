import { createPart, box, ring, METAL } from './model-utils.js';

export function createCylinderFrame(partId, pitch) {
  const group = createPart(partId, '실린더 프레임 · 연결 문맥', 'cylinderFrame', {
    sources: ['R1', 'R4'], role: 'context', bomRole: 'context',
    explodeVector: [0, 0, -1.2], promotableToPurchase: true,
    geometryEvidence: '라이너 장착부 및 프레임박스 상부 접합 관계를 개방형 슬리브·횡판으로 단순화. 냉각 재킷 내부는 미표현.',
  });
  ring(group, 0.70, 0.49, 1.06, 0, METAL.body);
  box(group, pitch - 0.035, 0.13, 1.61, [0, -0.55, 0], METAL.edge);
  // Two plate halves preserve a central opening for the liner.
  box(group, pitch - 0.035, 0.13, 0.20, [0, 0.55, -0.70], METAL.edge);
  box(group, pitch - 0.035, 0.13, 0.20, [0, 0.55, 0.70], METAL.edge);
  box(group, 0.15, 1.06, 0.24, [-pitch / 2 + 0.09, 0, 0], METAL.body);
  box(group, 0.15, 1.06, 0.24, [pitch / 2 - 0.09, 0, 0], METAL.body);
  return group;
}
