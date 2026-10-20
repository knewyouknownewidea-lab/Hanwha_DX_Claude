import { createPart, lathe, ring, METAL } from './model-utils.js';

export function createExhaustValveAssembly(partId) {
  const group = createPart(partId, '배기밸브 조립체', 'valve', {
    sources: ['R1', 'R3', 'R5'], bomRole: 'assembly', explodeVector: [0, 2.2, 0],
    geometryEvidence: '중앙 배기밸브의 하우징·스핀들·시트 기능 구분을 단순화. 특정 제품의 정밀 단면이 아님.',
    bomPolicy: '조립체 구매 시 하위 부품은 중복 집계하지 않음. 하위품 구매로 전환 시 조립체 수량 제외.',
  });
  const childOptions = { sources: ['R1', 'R3', 'R5'], role: 'subpart', bomRole: 'child', parentPartId: partId };
  const housing = createPart(`${partId}_HOUSING`, '배기밸브 하우징', 'housing', {
    ...childOptions, explodeVector: [0, 0.25, 0],
    geometryEvidence: 'R3 배기밸브의 수직 본체·측면 배출구 외형 참조. 배출구 위치·비례는 개념이며 유압 작동부는 외곽 위치만 표현.',
  });
  housing.add(lathe([
    [0.24, 0.04], [0.30, 0.10], [0.30, 0.20], [0.23, 0.24],
    [0.22, 0.68], [0.29, 0.74], [0.29, 0.88], [0.20, 0.92],
    [0.20, 1.14], [0.13, 1.14], [0.13, 0.04], [0.24, 0.04],
  ], METAL.body));
  ring(housing, 0.245, 0.13, 0.08, 1.12, METAL.dark);
  const outlet = ring(housing, 0.19, 0.13, 0.30, 0, METAL.body);
  outlet.rotation.x = Math.PI / 2;
  outlet.position.set(0, 0.43, 0.29);
  const outletLip = ring(housing, 0.22, 0.13, 0.06, 0, METAL.edge);
  outletLip.rotation.x = Math.PI / 2;
  outletLip.position.set(0, 0.43, 0.45);
  group.add(housing);

  const spindle = createPart(`${partId}_SPINDLE`, '배기밸브 스핀들', 'spindle', {
    ...childOptions, explodeVector: [0.40, 0, 0.65],
    geometryEvidence: 'R3·R5의 스핀들/컴플리트 구분을 반영한 버섯형 개념 형상. 재질·치수 미확인.',
  });
  spindle.add(lathe([
    [0.0, -0.21], [0.18, -0.21], [0.215, -0.15], [0.19, -0.08],
    [0.055, 0.01], [0.055, 0.95], [0.0, 0.95], [0.0, -0.21],
  ], METAL.light));
  group.add(spindle);

  const seat = createPart(`${partId}_SEAT`, '배기밸브 시트', 'seat', {
    ...childOptions, explodeVector: [-0.40, -0.16, 0.65],
    geometryEvidence: '스핀들 하부와 커버 장착부 사이의 시트 위치를 보여주는 개념 환형체.',
  });
  ring(seat, 0.245, 0.175, 0.10, -0.12, METAL.edge);
  group.add(seat);
  return group;
}
