'use client';
import React,{Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,Grid,useGLTF} from '@react-three/drei';
import * as THREE from 'three';

function Model({catalog,selected,onSelect,hidden,isolate,ghost,cutaway,explode,resetTick,focusTick,onReady,highlightIds}:any){
 const asset=useGLTF(cutaway?'/models/engine_cutaway.glb':'/models/engine_full.glb');
 const {camera,size}=useThree();const controls=useRef<any>(null);const desired=useRef<any>(null);
 const meshes=useMemo(()=>{const out:any[]=[];asset.scene.traverse((o:any)=>{if(o.isMesh){
  const info=catalog.parts.find((p:any)=>p.id===o.name);if(!info)throw new Error('부품 매핑 누락: '+o.name);
  const b=new THREE.Box3().setFromObject(o);const center=b.getCenter(new THREE.Vector3());
  out.push({id:o.name,geometry:o.geometry,material:o.material,center,info});}});return out;},[asset,catalog]);
 const total=useMemo(()=>{const b=new THREE.Box3();meshes.forEach((m:any)=>b.union(m.geometry.boundingBox||new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position)));return b;},[meshes]);
 useEffect(()=>{onReady(meshes.map((m:any)=>m.id));},[meshes]);
 useEffect(()=>{const c=total.getCenter(new THREE.Vector3());const span=total.getSize(new THREE.Vector3());
  camera.position.copy(c.clone().add(new THREE.Vector3(14,9,14)));controls.current?.target.copy(c);
  camera.lookAt(c);camera.updateMatrixWorld();
  if(camera instanceof THREE.OrthographicCamera){
   const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
   const projectedW=Math.abs(right.x)*span.x+Math.abs(right.y)*span.y+Math.abs(right.z)*span.z;
   const projectedH=Math.abs(up.x)*span.x+Math.abs(up.y)*span.y+Math.abs(up.z)*span.z;
   camera.zoom=Math.min(size.height/(projectedH*1.3),size.width/(projectedW*1.3));camera.updateProjectionMatrix();}
  desired.current=null;controls.current?.update();
 },[resetTick,asset,size.width,size.height]);
 useEffect(()=>{if(!selected||!focusTick)return;const m=meshes.find((m:any)=>m.id===selected);if(m)desired.current=m.center.clone();},[focusTick]);
 useFrame((_,dt)=>{if(desired.current&&controls.current){const delta=desired.current.clone().sub(controls.current.target);controls.current.target.addScaledVector(delta,Math.min(1,dt*5));camera.position.addScaledVector(delta,Math.min(1,dt*5));controls.current.update();if(delta.length()<.005)desired.current=null;}});
 const hl=useMemo(()=>new Set<string>(highlightIds||[]),[highlightIds]);const hlOn=hl.size>0;
 const reduced=useMemo(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,[]);
 const mats=useRef(new Map<string,any>());// 재질 참조를 재사용해 속성만 갱신
 useFrame(({clock})=>{if(!hlOn)return;const v=reduced?.7:.625+.375*Math.sin(clock.elapsedTime*2*Math.PI/1.4);// 주기 1.4초, 0.25~1.0
  hl.forEach(id=>{if(id===selected)return;const m=mats.current.get(id);if(m)m.emissiveIntensity=v;});});
 const clipping=useMemo(()=>[],[]);
 return <><OrbitControls ref={controls} target={total.getCenter(new THREE.Vector3())} makeDefault enableDamping dampingFactor={.1} onStart={()=>{desired.current=null;}} minZoom={.5} maxZoom={500}/>
  {meshes.map((m:any)=>{const visible=!hidden.includes(m.info.group)&&(!isolate||selected===m.id);
   if(!visible)return null;const chosen=m.id===selected;
   const faded=(id:string,c:boolean)=>!c&&(hlOn?!hl.has(id):!!selected&&ghost);
   const off=m.center.clone().sub(total.getCenter(new THREE.Vector3())).normalize().multiplyScalar(explode*2.5);
   // Additional stable local separation makes nested motion components readable.
   const k=catalog.parts.findIndex((p:any)=>p.id===m.id);off.x+=(k%3-1)*explode*.65;
   return <mesh key={m.id} name={m.id} geometry={m.geometry} position={off.toArray()} castShadow receiveShadow
    onClick={(e:any)=>{e.stopPropagation();onSelect(m.id)}} onPointerOver={()=>{document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor='auto'}}>
    <meshStandardMaterial ref={(r:any)=>{if(r)mats.current.set(m.id,r);else mats.current.delete(m.id);}} color={chosen?'#f47936':m.material.color} emissive={chosen?'#6c240a':hlOn&&hl.has(m.id)?'#19c37d':'#000000'} emissiveIntensity={chosen ? .3 : hlOn&&hl.has(m.id)?.7:0}
      roughness={.55} metalness={.22} transparent={faded(m.id,chosen)} opacity={faded(m.id,chosen) ? .18 : 1} depthWrite={!faded(m.id,chosen)} side={THREE.DoubleSide}/>
   </mesh>;})}
 </>;
}
export default function EngineViewer(props:any){
 const [failed,setFailed]=useState('');
 return <div className="engine-canvas" data-testid="engine-viewer">
  <Canvas orthographic shadows camera={{position:[14,10,14],zoom:45,near:.01,far:300}} gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl}:any)=>{gl.setClearColor('#eaf0ed');gl.localClippingEnabled=true;}} onPointerMissed={()=>props.onSelect(null)}>
   <ambientLight intensity={1.8}/><directionalLight position={[10,15,8]} intensity={3} castShadow shadow-mapSize={[2048,2048]}/><directionalLight position={[-8,5,-5]} intensity={1.6}/>
   <Suspense fallback={null}><Model {...props}/></Suspense>
   <Grid position={[0,-2.13,0]} args={[24,24]} cellSize={1} cellThickness={.5} cellColor="#b9c9c1" sectionSize={5} sectionColor="#a2b7ac" sectionThickness={.7} fadeDistance={40} infiniteGrid/>
  </Canvas>
  <div className="axis-tag"><span className="axis-dot"/> Z 수직 · Y 크랭크축 <span>단위 m</span></div>
  <div className="orbit-help">드래그 회전 · 휠 확대 · 우클릭 드래그 이동</div>
 </div>;
}
