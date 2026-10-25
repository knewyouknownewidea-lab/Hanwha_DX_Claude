'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { createEngine } from '../lib/engine-model/engine-scene.js';

type ViewerProps = {
  catalog: { parts: Array<{ id: string; group: string }> };
  selected: string | null;
  onSelect: (id: string | null) => void;
  hidden?: string[];
  isolate?: boolean;
  ghost?: boolean;
  cutaway?: boolean;
  explode?: number;
  resetTick?: number;
  focusTick?: number;
  onReady: (ids: string[]) => void;
  highlightIds?: string[];
  supplierFocused?: boolean;
  cylinders?: number;
  statusById?: Record<string, string>;
  pulse?: boolean;
  reducedMotion?: boolean;
};
type MeshEntry = {
  mesh: THREE.Mesh; id: string; material: THREE.MeshStandardMaterial;
  outline: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  pickable: boolean; highlighted: boolean;
};
const STATUS_COLORS: Record<string, string> = {
  secured: '#319c70', review: '#dbaa35', shortage: '#da5b57', unknown: '#87949d',
};

function Model({catalog, selected, onSelect, hidden = [], isolate = false, ghost = false,
  cutaway = false, explode = 0, resetTick = 0, focusTick = 0, onReady,
  highlightIds = [], supplierFocused = highlightIds.length > 0, cylinders = 6, statusById = {}, pulse = true, reducedMotion = false}: ViewerProps) {
  const { camera, size, gl } = useThree();
  const controls = useRef<any>(null);
  const desired = useRef<THREE.Vector3 | null>(null);
  const activeState = useRef({ pulse, reducedMotion });
  activeState.current = { pulse, reducedMotion };
  const viewState = useRef({ cutaway, explode, hidden, isolate, selected, supplierFocused });
  viewState.current = { cutaway, explode, hidden, isolate, selected, supplierFocused };
  const model = useMemo(() => createEngine(cylinders), [cylinders]);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), []);
  const parts = model.parts as Map<string, THREE.Group>;
  const entries = useMemo<MeshEntry[]>(() => {
    const result: MeshEntry[] = [];
    model.root.traverse((object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 36),
        new THREE.LineBasicMaterial({ color: '#173f53', transparent: true, opacity: .85, depthTest: false }));
      outline.name = `${object.userData.partId || 'context'}_selection_outline`;
      outline.visible = false;
      outline.renderOrder = 8;
      outline.raycast = () => {};
      object.add(outline);
      result.push({ mesh: object, material, outline, id: object.userData.partId || '',
        pickable: object.userData.pickable === true, highlighted: false });
    });
    return result;
  }, [model]);
  const total = useMemo(() => new THREE.Box3().setFromObject(model.root), [model]);
  const partInfo = useMemo(() => new Map(catalog.parts.map(p => [p.id, p])), [catalog]);
  const highlights = useMemo(() => new Set(highlightIds), [highlightIds]);
  function ownerIds(id: string) {
    const ids = [id];
    let current: THREE.Object3D | null | undefined = parts.get(id)?.parent;
    while (current) {
      if (current.userData.partId) ids.push(current.userData.partId);
      current = current.parent;
    }
    return ids;
  }
  useEffect(() => { onReady(Array.from(parts.keys())); }, [parts, onReady]);

  useLayoutEffect(() => {
    // Integrated support regions and shells stay on the bedplate even in an exploded view.
    model.root.traverse((object: THREE.Object3D) => {
      const { basePosition, explodeVector, integrated, category } = object.userData;
      if (!basePosition) return;
      object.position.fromArray(basePosition);
      if (explodeVector && !integrated && category !== 'shell')
        object.position.addScaledVector(new THREE.Vector3(...explodeVector), Math.max(0, Math.min(1, explode)));
    });
    for (const entry of entries) {
      const ancestors = ownerIds(entry.id);
      const chosen = !!selected && ancestors.includes(selected);
      const highlighted = ancestors.some(id => highlights.has(id));
      const info = partInfo.get(entry.id);
      const visible = !(info && hidden.includes(info.group)) && (!isolate || !selected || chosen);
      entry.mesh.visible = visible;
      entry.highlighted = highlighted;
      // A supplied assembly can colour its visible children during highlighting.
      // This is visual inheritance only; child inventory rows stay unregistered.
      const directState = statusById[entry.id] || 'unknown';
      const parentHighlighted = ancestors.slice(1).some(id => highlights.has(id));
      const parentState = parentHighlighted
        ? ancestors.slice(1).map(id => statusById[id]).find(state => state && state !== 'unknown') : undefined;
      const state = directState !== 'unknown' ? directState : parentState || 'unknown';
      // Supplier focus suppresses other suppliers' status colours, including a
      // selected part outside this supplier. Its outline stays available.
      const color = supplierFocused && !highlighted
        ? STATUS_COLORS.unknown : STATUS_COLORS[state] || STATUS_COLORS.unknown;
      const faded = !entry.pickable || (supplierFocused ? !highlighted : ghost && !!selected && !chosen);
      entry.material.color.set(color);
      entry.material.emissive.set(highlighted ? color : '#000000');
      entry.material.emissiveIntensity = highlighted ? .34 : 0;
      entry.material.transparent = faded;
      entry.material.opacity = faded ? (entry.pickable ? .16 : .12) : 1;
      entry.material.depthWrite = !faded;
      entry.material.side = THREE.DoubleSide;
      entry.material.clippingPlanes = cutaway ? [plane] : [];
      entry.material.clipShadows = true;
      entry.material.needsUpdate = true;
      entry.mesh.castShadow = !faded;
      entry.outline.visible = visible && chosen;
      entry.outline.material.clippingPlanes = cutaway ? [plane] : [];
      entry.outline.material.needsUpdate = true;
    }
    model.root.updateMatrixWorld(true);
  }, [model, entries, selected, hidden, isolate, ghost, cutaway, explode, highlights, supplierFocused, partInfo, statusById, plane]);

  useEffect(() => {
    const center = total.getCenter(new THREE.Vector3());
    const span = total.getSize(new THREE.Vector3()).add(new THREE.Vector3(0, 2.6, 1.8).multiplyScalar(explode));
    center.y += explode * .9;
    camera.position.copy(center.clone().add(new THREE.Vector3(14, 9, 14)));
    controls.current?.target.copy(center);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    if (camera instanceof THREE.OrthographicCamera) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const width = Math.abs(right.x) * span.x + Math.abs(right.y) * span.y + Math.abs(right.z) * span.z;
      const height = Math.abs(up.x) * span.x + Math.abs(up.y) * span.y + Math.abs(up.z) * span.z;
      camera.zoom = Math.min(size.height / (height * 1.17), size.width / (width * 1.17));
      camera.updateProjectionMatrix();
    }
    desired.current = null;
    controls.current?.update();
  }, [resetTick, model, total, camera, size.width, size.height, explode]);
  useEffect(() => {
    if (!selected || !focusTick) return;
    const part = parts.get(selected);
    if (part) desired.current = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
  }, [focusTick, parts, selected]);
  useFrame(({ clock }, dt) => {
    const motion = activeState.current;
    // 1.8-second brightness cycle: highlighted parts never disappear.
    const brightness = motion.pulse && !motion.reducedMotion
      ? .28 + .2 * (.5 + .5 * Math.sin(clock.elapsedTime * 2 * Math.PI / 1.8)) : .34;
    entries.forEach(entry => { if (entry.highlighted) entry.material.emissiveIntensity = brightness; });
    if (desired.current && controls.current) {
      const delta = desired.current.clone().sub(controls.current.target);
      const factor = motion.reducedMotion ? 1 : Math.min(1, dt * 5);
      controls.current.target.addScaledVector(delta, factor);
      camera.position.addScaledVector(delta, factor);
      controls.current.update();
      if (delta.length() < .005 || motion.reducedMotion) desired.current = null;
    }
  });

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const visibleInHierarchy = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current) { if (!current.visible) return false; current = current.parent; }
      return true;
    };
    const pick = (x: number, y: number) => {
      model.root.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hits = raycaster.intersectObjects(entries.filter(e => e.pickable).map(e => e.mesh), false)
        .filter(hit => visibleInHierarchy(hit.object) && (!cutaway || plane.distanceToPoint(hit.point) >= -1e-6));
      // Translucent covers never intercept a solid inner purchase part.
      const solid = hits.find(hit => ((hit.object as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity >= .7);
      return (solid || hits[0])?.object.userData.partId || null;
    };
    const element = gl.domElement;
    let down: { x: number; y: number; button: number } | null = null;
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY, button: event.button }; };
    const pointerUp = (event: PointerEvent) => {
      if (!down || down.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) { down = null; return; }
      down = null;
      const rect = element.getBoundingClientRect();
      onSelect(pick((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1));
    };
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointerup', pointerUp);
    const debug = {
      snapshot: () => ({
        ids: Array.from(parts.keys()), modelFamily: model.root.userData.engineFamily,
        ...viewState.current,
        highlightedMeshIds: [...new Set(entries.filter(e => e.highlighted).map(e => e.id))],
        visibleMeshIds: [...new Set(entries.filter(e => e.mesh.visible).map(e => e.id))],
        selectedOutlineIds: [...new Set(entries.filter(e => e.outline.visible).map(e => e.id))],
        clippingPartIds: [...new Set(entries.filter(e => e.pickable && e.material.clippingPlanes?.length).map(e => e.id))],
        byPartOpacity: Object.fromEntries(entries.map(e => [e.id, e.material.opacity])),
        colors: Object.fromEntries(entries.map(e => [e.id, `#${e.material.color.getHexString()}`])),
        emissive: Object.fromEntries(entries.map(e => [e.id, e.material.emissiveIntensity])),
        pulse: activeState.current.pulse, reducedMotion: activeState.current.reducedMotion,
        integratedSupportPositions: [...parts].filter(([id]) => id.startsWith('ENGINE_MBS_') || id.startsWith('ENGINE_SHELL_'))
          .map(([id, object]) => ({ id, position: object.position.toArray() })),
      }),
      projectPart: (id: string) => {
        const object = parts.get(id); if (!object) return null;
        const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera);
        const rect = element.getBoundingClientRect();
        return { x: point.x, y: point.y, clientX: rect.left + (point.x + 1) * rect.width / 2, clientY: rect.top + (1 - point.y) * rect.height / 2 };
      },
      pickAtNDC: pick,
    };
    (window as any).__integratedViewer = Object.freeze(debug);
    return () => {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointerup', pointerUp);
      if ((window as any).__integratedViewer === debug) delete (window as any).__integratedViewer;
    };
  }, [model, entries, parts, camera, gl, onSelect, cutaway, plane]);
  useEffect(() => () => {
    model.root.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
  }, [model]);
  return <>
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.1}
      onStart={() => { desired.current = null; }} minZoom={5} maxZoom={500} />
    <primitive object={model.root} />
  </>;
}

export default function EngineViewer(props: ViewerProps) {
  return <div className="engine-canvas" data-testid="engine-viewer">
    <Canvas orthographic shadows camera={{ position: [14, 10, 14], zoom: 45, near: .01, far: 300 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.setClearColor('#eaf0ed'); gl.localClippingEnabled = true; }}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[10, 15, 8]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-8, 5, -5]} intensity={1.6} />
      <Model {...props} />
      <Grid position={[0, -.015, 0]} args={[30, 20]} cellSize={1} cellThickness={.5}
        cellColor="#b9c9c1" sectionSize={5} sectionColor="#a2b7ac" sectionThickness={.7} fadeDistance={40} infiniteGrid />
    </Canvas>
    <div className="axis-tag"><span className="axis-dot" /> Y 수직 · X 크랭크축 <span>무차원 설명 비례</span></div>
    <div className="orbit-help">드래그 회전 · 휠 확대 · 우클릭 드래그 이동</div>
  </div>;
}
