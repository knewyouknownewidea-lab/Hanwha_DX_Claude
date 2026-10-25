import * as THREE from 'three';

// Values in this module are drawing proportions in dimensionless demo units.
// They are deliberately not manufacturer dimensions or manufacturing details.
export const METAL = { body: 0x89959d, light: 0xbac4c9, dark: 0x44515b, edge: 0x697984, context: 0x344653, bore: 0x6d7c86 };

export function material(color = METAL.body, options = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.66, roughness: 0.34, ...options });
}

export function mesh(geometry, color, options = {}) {
  const normal = geometry.attributes.normal;
  if (normal) {
    // Lathed axis vertices can have a zero averaged normal. Keep the editable
    // geometry and GLB exporter finite and normalized at those degenerate tips.
    for (let i = 0; i < normal.count; i++) {
      const x = normal.getX(i), y = normal.getY(i), z = normal.getZ(i);
      if (x * x + y * y + z * z < 1e-12) normal.setXYZ(i, 0, 1, 0);
    }
    geometry.normalizeNormals();
  }
  const object = new THREE.Mesh(geometry, material(color, options));
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

export function createPart(partId, nameKo, category, options = {}) {
  const group = new THREE.Group();
  group.name = partId;
  group.userData = {
    partId, nameKo, category, role: 'purchase', accuracy: 'concept',
    accuracyLabel: '구조 설명용 모델 / 실제 제작 치수 아님',
    geometryEvidence: '공개 자료의 구조와 외형을 참조한 단순화·비례 가정',
    dimensionsVerified: false, sources: ['R1'], bomRole: 'item',
    pickable: true, explodeVector: [0, 0, 0], ...options,
  };
  return group;
}

export function box(parent, w, h, d, position, color = METAL.body, options = {}) {
  const object = mesh(new THREE.BoxGeometry(w, h, d), color, options);
  object.position.set(...position);
  parent.add(object);
  return object;
}

export function cylinder(parent, radius, height, position, color = METAL.body, options = {}) {
  const object = mesh(new THREE.CylinderGeometry(radius, radius, height, 48), color, options);
  object.position.set(...position);
  parent.add(object);
  return object;
}

export function ring(parent, outer, inner, height, y, color = METAL.body) {
  // Closed radial section makes a genuinely hollow, open-ended annulus.
  const section = [[outer, -height / 2], [outer, height / 2], [inner, height / 2], [inner, -height / 2], [outer, -height / 2]];
  const object = lathe(section, color);
  object.position.y = y;
  parent.add(object);
  return object;
}

export function lathe(section, color = METAL.body, options = {}) {
  return mesh(new THREE.LatheGeometry(section.map(([r, y]) => new THREE.Vector2(r, y)), 64), color, options);
}

export function beamBetween(parent, start, end, width, depth, color = METAL.body) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const object = mesh(new THREE.BoxGeometry(width, direction.length(), depth), color);
  object.position.copy(a).add(b).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(object);
  return object;
}

export function tubeBetween(parent, start, end, radius, color = METAL.context) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const object = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 32), color);
  object.position.copy(a).add(b).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(object);
  return object;
}

export function snapshotPart(group) {
  group.userData.basePosition = group.position.toArray();
  group.userData.baseRotation = group.rotation.toArray();
  group.traverse(child => {
    if (child.isMesh) {
      // Every mesh gets its own material. Changing one cylinder never changes its neighbours.
      child.userData.partId = group.userData.partId;
      child.userData.pickable = group.userData.pickable;
    }
  });
  return group;
}
