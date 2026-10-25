import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createEngine } from './engine-scene.js';

export const STATE_COLORS = {secured:0x49a779,review:0xdcb552,shortage:0xd97780,unknown:0x9ba8ac};
export function pulseLevel(timeSeconds, enabled=true, reduced=false) {
  return enabled && !reduced ? .13 + .13 * (.5 + .5 * Math.sin(timeSeconds * Math.PI * 2 / 1.8)) : .13;
}

export class EngineViewer {
  constructor(container, onSelect) {
    this.container=container; this.onSelect=onSelect;
    this.state={selectedId:null,supplierIds:[],statusFor:()=> 'unknown',view:'assembled',ghost:true,pulse:true,reduced:false};
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.setClearColor('#eef1ed');this.renderer.localClippingEnabled=true;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.65;
    this.renderer.domElement.setAttribute('aria-label','회전·확대 및 부품 선택 가능한 3D 엔진');
    this.renderer.domElement.setAttribute('tabindex','0');
    container.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff,0xa1b2a5,3.2));
    const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(4,12,10);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xdde7f4,2);fill.position.set(-10,5,-5);this.scene.add(fill);
    this.camera=new THREE.PerspectiveCamera(36,1,.05,200);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.minDistance=2;this.controls.maxDistance=70;this.controls.maxPolarAngle=Math.PI*.90;
    this.grid=new THREE.GridHelper(70,70,0xcbd6c8,0xdce4d8);this.grid.position.y=-.025;this.grid.material.transparent=true;this.grid.material.opacity=.55;this.scene.add(this.grid);
    this.selectionBox=new THREE.BoxHelper(new THREE.Object3D(),0x7b9850);this.selectionBox.material.transparent=true;this.selectionBox.material.opacity=.65;this.selectionBox.visible=false;this.scene.add(this.selectionBox);
    this.raycaster=new THREE.Raycaster();this.clipPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),0);this.meshes=[];
    this._resize=new ResizeObserver(()=>this.resize());this._resize.observe(container);
    let down=null;
    this.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(e.button!==0||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
      const rect=this.renderer.domElement.getBoundingClientRect();
      const result=this.pick((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      if(result)this.onSelect(result);
    });
    this.resize();
    this.renderer.setAnimationLoop(time=>{
      this.controls.update();
      const level=pulseLevel(time/1000,this.state.pulse,this.state.reduced);
      for(const mesh of this.meshes)if(mesh.userData.highlighted)mesh.material.emissiveIntensity=level;
      this.renderer.render(this.scene,this.camera);
    });
  }
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  rebuild(count){
    if(this.engine){this.scene.remove(this.engine.root);this.engine.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}
    this.engine=createEngine(count);this.scene.add(this.engine.root);this.meshes=[];
    this.engine.root.traverse(o=>{if(o.isMesh){o.userData.originalColor=o.material.color.clone();this.meshes.push(o);}});
    this.apply(this.state);this.reset();return this.engine;
  }
  hasAncestor(object,ids){let node=object;while(node){if(ids.has(node.userData.partId))return node.userData.partId;node=node.parent;}return null;}
  apply(next){
    Object.assign(this.state,next);if(!this.engine)return;
    const {selectedId,supplierIds,view,ghost,statusFor}=this.state;
    const linked=new Set(supplierIds),selected=new Set(selectedId?[selectedId]:[]);
    this.engine.parts.forEach(object=>{
      const data=object.userData;
      if(data.basePosition){object.position.fromArray(data.basePosition);if(view==='exploded'&&!data.integrated)object.position.addScaledVector(new THREE.Vector3(...(data.explodeVector??[0,0,0])),1);}
    });
    this.engine.root.updateMatrixWorld(true);
    for(const mesh of this.meshes){
      const id=mesh.userData.partId;const group=this.engine.parts.get(id);
      const parentLinked=this.hasAncestor(mesh,linked),isSelected=!!this.hasAncestor(mesh,selected);
      const exactStatus=statusFor(id);
      const status=exactStatus==='unknown'&&parentLinked?statusFor(parentLinked):exactStatus;
      const isContext=!group||['context','cylinderFrame','shell'].includes(group.userData.category);
      const exterior=group&&['frame','cylinderFrame'].includes(group.userData.category);
      const dim=supplierIds.length?!parentLinked:ghost&&exterior&&!isSelected;
      const opacity=dim?.14:isContext&&!isSelected?.3:1;
      mesh.userData.highlighted=!!parentLinked;
      mesh.userData.renderOpacity=opacity;
      mesh.material.color.copy(status==='unknown'?mesh.userData.originalColor:new THREE.Color(STATE_COLORS[status]));
      mesh.material.transparent=opacity<1;mesh.material.opacity=opacity;mesh.material.depthWrite=opacity>=.99;
      mesh.material.side=THREE.DoubleSide;
      mesh.material.emissive.setHex(parentLinked?STATE_COLORS[status]??STATE_COLORS.unknown:isSelected?0x40684a:0);
      mesh.material.emissiveIntensity=parentLinked?.13:isSelected?.12:0;
      mesh.material.clippingPlanes=view==='section'?[this.clipPlane]:[];mesh.material.needsUpdate=true;
    }
    const chosen=this.engine.parts.get(selectedId);
    this.selectionBox.visible=!!chosen;
    if(chosen)this.selectionBox.setFromObject(chosen);
  }
  reset(){
    if(!this.engine)return;const box=new THREE.Box3().setFromObject(this.engine.root);const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());center.y-=.2;
    const angle=this.camera.fov*Math.PI/360;
    let distance=Math.max(size.y/2/Math.tan(angle),size.x/2/(Math.tan(angle)*this.camera.aspect))*1.26;
    const direction=new THREE.Vector3(.95,.52,1.7).normalize();
    this.controls.target.copy(center);
    for(let attempt=0;attempt<12;attempt++){
      this.camera.position.copy(center).addScaledVector(direction,distance);this.controls.update();this.camera.updateMatrixWorld();
      let extent=0;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(this.camera);extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));}
      if(extent<=.84)break;distance*=1.1;
    }
  }
  focus(id){const obj=this.engine.parts.get(id);if(!obj)return;const box=new THREE.Box3().setFromObject(obj);const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3()).length();const direction=this.camera.position.clone().sub(this.controls.target).normalize();this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,Math.max(size*1.8,3.2));this.controls.update();}
  pick(x,y){
    this.camera.updateMatrixWorld();this.engine.root.updateMatrixWorld(true);this.raycaster.setFromCamera(new THREE.Vector2(x,y),this.camera);
    const hits=this.raycaster.intersectObjects(this.meshes,false).filter(h=>h.object.userData.pickable!==false&&this.engine.parts.has(h.object.userData.partId)&&(this.state.view!=='section'||this.clipPlane.distanceToPoint(h.point)>=-1e-6));
    // Transparent structural envelopes never occlude a solid interior selection.
    const solid=hits.filter(h=>h.object.userData.renderOpacity>=.5);
    const hit=solid[0]??hits[0];return hit?.object.userData.partId??null;
  }
  projectedCenter(id){const o=this.engine.parts.get(id);if(!o)return null;this.engine.root.updateMatrixWorld(true);this.camera.updateMatrixWorld();return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(this.camera);}
  snapshot(){this.renderer.render(this.scene,this.camera);return this.renderer.domElement.toDataURL('image/png');}
  async exportGLB(){const clean=createEngine(this.engine.root.userData.cylinderCount);const data=await new GLTFExporter().parseAsync(clean.root,{binary:true,onlyVisible:true});clean.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});return data;}
}
