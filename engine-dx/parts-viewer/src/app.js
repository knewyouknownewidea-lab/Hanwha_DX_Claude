import { EngineViewer } from './viewer.js';
import { STATUS,getDataset,getSupply,getSupplierPartIds,getUnitSummary,validateDataset,buildBom } from './procurement.js';
import { createEngine } from './engine-scene.js';

const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={dataset:getDataset('empty'),unitId:'UNREGISTERED-001',supplierId:'',selectedId:'CYL01_LINER',count:6,layoutOnly:false,view:'assembled',ghost:true,pulse:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,subparts:false,search:'',sources:[],page:'model'};
let viewer,engine,toastTimer;
const effectiveDataset=()=>state.layoutOnly?getDataset('empty'):state.dataset;
const supply=id=>getSupply(effectiveDataset(),state.unitId,id);
const selectedUnit=()=>state.dataset.units.find(u=>u.id===state.unitId);
const currentSupplierIds=()=>getSupplierPartIds(effectiveDataset(),state.unitId,state.supplierId).filter(id=>engine.parts.has(id));
const purchaseParts=()=>engine.metadata.filter(m=>m.role==='purchase'&&m.bomRole!=='child');
const categoryLabel={liner:'실린더 라이너',cover:'실린더 커버',frame:'프레임박스',bedplate:'베드플레이트',valve:'배기밸브 조립체',pipe:'유압 배관',mbs:'메인베어링 서포트',housing:'하우징',spindle:'스핀들',seat:'시트',shell:'베어링 쉘',cylinderFrame:'실린더 프레임'};
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function download(name,content,type='application/json'){const blob=content instanceof Blob?content:new Blob([typeof content==='object'&&!(content instanceof ArrayBuffer)?JSON.stringify(content,null,2):content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
function statusPill(status){return `<span class="status-pill ${status}"><i class="dot ${status}"></i>${escape(STATUS[status]?.label??'데이터 미확인')}</span>`;}
function fact(label,value){return `<dt>${escape(label)}</dt><dd class="${value==null?'missing':''}">${value==null?'미등록':escape(value)}</dd>`;}
function rebuild(){engine=viewer.rebuild(state.count);if(!engine.parts.has(state.selectedId))state.selectedId='CYL01_LINER';$('canvas-loading').hidden=true;render();}
function renderControls(){
  $('unit-select').innerHTML=state.dataset.units.map(u=>`<option value="${escape(u.id)}">${escape(u.label)}</option>`).join('');$('unit-select').value=state.unitId;
  const ds=effectiveDataset();$('supplier-select').innerHTML='<option value="">전체 부품</option>'+ds.suppliers.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');$('supplier-select').value=state.supplierId;
  if(!$('cylinder-select').querySelector(`option[value="${state.count}"]`))$('cylinder-select').insertAdjacentHTML('beforeend',`<option value="${state.count}">${state.count}기통</option>`);
  $('cylinder-select').value=String(state.count);
  const demo=state.dataset.dataKind==='demo';const registered=state.dataset.dataKind==='registered';
  $('data-label').textContent=demo?'가상 데이터 · 시연 중':registered?'사용자 제공 데이터':'실제 데이터 미연결';
  $('demo-toggle').textContent=demo?'시연 종료 · 미등록으로':'시연 데이터 켜기 ↗';
  $('data-notice').classList.toggle('demo',demo);
  $('data-notice').innerHTML=`<span class="notice-dot"></span><strong>${state.layoutOnly?'배치 전용 · 호기 연결 해제':demo?'가상 시연 데이터':registered?'사용자 제공 데이터':'실제 데이터 미등록'}</strong><span>${escape(state.layoutOnly?'선택 호기와 기통 수가 달라 구매 데이터 표시를 중지했습니다.':demo?'모든 업체·품목·재고·발주·일정은 가상입니다.':registered?state.dataset.sourceDescription:'생산 호기·품목번호·협력사·재고·발주 정보를 연결해주세요.')}</span><button id="template-download">빈 연결 양식 ↓</button>`;
  $('template-download').onclick=()=>download('procurement-empty.json',getDataset('empty'));
  $('unit-phase').textContent=state.layoutOnly?'구조 배치 검토':selectedUnit()?.phase??'미등록';
  $('model-subtitle').textContent=`${state.count}기통 반복 배치 · 개념 모델`;
  const summary=getUnitSummary(ds,state.unitId,purchaseParts().map(p=>p.partId));
  for(const k of ['total','secured','review','shortage','unknown'])$(`metric-${k}`).textContent=summary[k];
  $('metric-registered').textContent=`품목 연결 ${summary.registered} / ${summary.total}`;
  const ids=currentSupplierIds();$('supplier-note').textContent=state.supplierId?`${selectedUnit()?.label??''} · 명시적 공급 객체 ${ids.length}개 강조`:'협력사를 선택하면 해당 호기의 공급 부품이 강조됩니다.';
  $('motion-toggle').checked=state.reduced;$('pulse-toggle').checked=state.pulse;$('pulse-toggle').disabled=state.reduced;
  $('ghost-toggle').checked=state.ghost;
}
function renderParts(){
  const ids=new Set(currentSupplierIds());
  const filtered=engine.metadata.filter(m=>(state.subparts||m.role==='purchase'&&m.bomRole!=='child')&&(`${m.nameKo} ${categoryLabel[m.category]??''} ${m.partId}`).toLowerCase().includes(state.search.toLowerCase()));
  const groups=new Map();for(const m of filtered){const cylinder=/^CYL(\d{2})_/.exec(m.partId)?.[1];const key=cylinder?`CYLINDER ${cylinder}`:'SHARED STRUCTURE';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
  $('part-count').textContent=filtered.length;
  $('parts-list').innerHTML=filtered.length?[...groups].map(([g,items])=>`<div class="part-group">${g}</div>${items.map(m=>`<button class="part-row ${m.partId===state.selectedId?'active':''} ${ids.has(m.partId)?'supplier-linked':''}" data-part="${m.partId}" title="${escape(m.nameKo)} · ${m.partId}"><i class="dot ${supply(m.partId).status}"></i><span class="part-text"><strong>${escape(m.nameKo)}</strong><code>${m.partId}</code></span><span class="arrow">›</span></button>`).join('')}`).join(''):'<div class="empty-list">검색 결과가 없습니다.</div>';
}
function renderDetail(){
  const m=engine.parts.get(state.selectedId)?.userData;if(!m)return;
  const row=supply(m.partId),supplier=effectiveDataset().suppliers.find(s=>s.id===row.supplierId);
  const links=(m.sources??[]).map(id=>{const src=state.sources.find(s=>s.id===id);return src?`<a href="${escape(src.url)}" target="_blank" rel="noopener">${id} ↗</a>`:`<span>${id}</span>`;}).join('');
  const related=engine.connections.filter(c=>c.from===m.partId||c.to===m.partId).slice(0,4);
  const role=m.bomRole==='assembly'?'조립체 · 구매 단위 별도 지정':m.bomRole==='child'?'조립체 하위품 · 중복 집계 제외 가능':m.integrated?'베드플레이트 통합 영역 · 탈착부품 아님':m.role==='context'?'연결 위치 설명용 보조 객체':'독립 구매 위치';
  const qty=(label,value)=>`<div><span>${label}</span><strong class="${value==null?'missing':''}">${value==null?'미등록':escape(value)}</strong></div>`;
  $('detail-panel').innerHTML=`<div class="detail-top"><div class="detail-kicker">PART DETAIL <span> / ${/^CYL/.test(m.partId)?m.partId.slice(0,5):'ENGINE'}</span></div><h2>${escape(m.nameKo)}</h2><code>${m.partId}</code>${statusPill(row.status)}</div><div class="detail-body"><div><h3 class="detail-section-title">구매 정보 <small>${state.dataset.dataKind==='demo'?'가상 시연 정보':'호기별 연결 정보'}</small></h3><dl class="facts">${fact('생산 호기',state.layoutOnly?null:selectedUnit()?.label)}${fact('품목번호',row.itemNumber)}${fact('REV',row.revision)}${fact('공급업체',supplier?.name??null)}</dl><div class="quantity-grid">${qty('필요량',row.requiredQty)}${qty('가용재고',row.availableStock)}${qty('부족량',row.shortageQty)}</div><dl class="facts">${fact('호기 배정량',row.allocatedQty)}${fact('미입고 발주량',row.openOrderQty)}${fact('발주번호',row.purchaseOrder)}${fact('필요 입고일',row.requiredDate)}${fact('납품 예정일',row.expectedDate)}${fact('데이터 갱신일',row.updatedAt)}</dl><div class="reason-card"><strong>상태 사유</strong><br>${escape(row.reason??'데이터 미확인')}</div></div><div><hr class="detail-divider"><h3 class="detail-section-title">연결 관계 <small>구조 참조</small></h3><p class="reason-card">${escape(role)}</p><ul class="connection-list">${related.map(c=>{const id=c.from===m.partId?c.to:c.from;return `<li>${escape(engine.parts.get(id)?.userData.nameKo??'유압 공급 위치 (개념)')}<br><small>${escape(c.type)}</small></li>`;}).join('')}</ul><div class="accuracy-tag"><strong>구조 설명용 모델 / 실제 제작 치수 아님</strong>모델 정확도: 개념 형상<br>확인된 부품 제작 치수: 없음<br>외형·배치는 공식 자료 참고, 비례·두께·연결 상세는 단순화 가정<div class="source-links">${links}</div></div>${m.bomRole==='child'?'<div class="reason-card">조립체 상태는 개별 하위품의 재고 확보를 보증하지 않습니다. 개별 데이터가 없으면 미등록입니다.</div>':''}</div></div>`;
  $('selection-label').hidden=false;$('selection-label').innerHTML=`${escape(m.nameKo)}<code>${m.partId}</code>`;
}
function renderTable(){
  const bom=buildBom(effectiveDataset(),state.unitId);const excluded=new Set(bom.excludedChildren.map(x=>typeof x==='string'?x:x.partId));
  $('purchase-table').innerHTML=`<table><thead><tr><th>부품 · partId</th><th>품목번호 · REV</th><th>공급업체</th><th>상태</th><th>필요량</th><th>재고</th><th>배정</th><th>발주번호</th><th>BOM</th></tr></thead><tbody>${engine.metadata.filter(m=>m.role!=='context').map(m=>{const r=supply(m.partId),s=effectiveDataset().suppliers.find(s=>s.id===r.supplierId);return `<tr><td><button data-part="${m.partId}">${escape(m.nameKo)}</button><br><code>${m.partId}</code></td><td>${escape(r.itemNumber??'미등록')}<br><small>${escape(r.revision??'미등록')}</small></td><td>${escape(s?.name??'미등록')}</td><td>${statusPill(r.status)}</td><td>${r.requiredQty??'미등록'}</td><td>${r.availableStock??'미등록'}</td><td>${r.allocatedQty??'미등록'}</td><td>${escape(r.purchaseOrder??'미등록')}</td><td>${excluded.has(m.partId)||r.bomIncluded===false?'하위 정보 · 제외':r.itemNumber?'집계 대상':'미등록'}</td></tr>`;}).join('')}</tbody></table><div class="reason-card">${escape(bom.notice??'조립체와 하위품을 중복 집계하지 않습니다.')} · 집계 행 ${bom.items.length} / 제외 하위 행 ${bom.excludedChildren.length}</div>`;
}
function syncViewer(){viewer.apply({selectedId:state.selectedId,supplierIds:currentSupplierIds(),statusFor:id=>supply(id).status,view:state.view,ghost:state.ghost,pulse:state.pulse,reduced:state.reduced});}
function render(){renderControls();renderParts();renderDetail();renderTable();syncViewer();}
function selectPart(id,focus=false){if(!engine.parts.has(id))return;state.selectedId=id;renderParts();renderDetail();syncViewer();if(focus)viewer.focus(id);if(window.parent!==window)window.parent.postMessage({type:'DOCK_PART_SELECTED',unitId:state.layoutOnly?null:state.unitId,partId:id,dataKind:state.dataset.dataKind},location.origin);}
function setPage(page){state.page=page;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`${page}-page`));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));viewer.resize();}
function setView(view){state.view=view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('view-notice').textContent=view==='section'?'개념 절단: 열린 절단면은 가시성 표현입니다. 실제 가공 단면·냉각 유로·밀봉 구조를 나타내지 않습니다.':view==='exploded'?'연결 위치 설명용 분리입니다. 실제 정비 순서·탈착 가능성을 의미하지 않습니다. MBS 통합 영역은 베드에서 분리하지 않습니다.':'기통 수와 간격은 배치 시연입니다. 실제 엔진의 제작 사양을 의미하지 않습니다.';syncViewer();if(view==='exploded')viewer.reset();}
function acceptDataset(input){
  const result=validateDataset(input);if(!result.valid)throw new Error(result.errors.slice(0,3).join(' / '));
  if(result.dataset.units.some(u=>u.cylinders<2||u.cylinders>12))throw new Error('현재 모델은 2~12기통 개념 배치를 지원합니다.');
  // Every input placement must actually exist in the selected unit's generated model.
  for(const unit of result.dataset.units){const reference=createEngine(unit.cylinders);const invalid=result.dataset.supply.filter(r=>r.unitId===unit.id&&!reference.parts.has(r.partId));reference.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});if(invalid.length)throw new Error(`모델에 없는 partId: ${invalid[0].partId}`);}
  state.dataset=result.dataset;state.unitId=result.dataset.units[0].id;state.count=result.dataset.units[0].cylinders;state.supplierId='';state.layoutOnly=false;rebuild();
}
function loadSources(){fetch('./public/data/sources.json').then(r=>r.ok?r.json():Promise.reject(new Error('출처 파일 누락'))).then(data=>{state.sources=Array.isArray(data)?data:data.sources??[];$('sources-list').innerHTML=state.sources.map(s=>`<article class="source-card"><div class="source-id">${escape(s.id)} · ${s.verified?'확인':'제한 또는 미확인'}</div><h3>${escape(s.title)}</h3><p>${escape(typeof s.evidence==='string'?s.evidence:JSON.stringify(s.evidence))}</p><p>${escape(typeof s.limitations==='string'?s.limitations:JSON.stringify(s.limitations??''))}</p><a href="${escape(s.url)}" target="_blank" rel="noopener">원본 자료 ↗</a></article>`).join('');renderDetail();}).catch(()=>{$('sources-list').textContent='출처 기록은 docs/sources-and-accuracy.md에서 확인할 수 있습니다.';});}
try{
  viewer=new EngineViewer($('viewport'),id=>selectPart(id));rebuild();loadSources();
  $('unit-select').onchange=e=>{state.unitId=e.target.value;state.count=selectedUnit().cylinders;state.layoutOnly=false;state.supplierId='';rebuild();};
  $('supplier-select').onchange=e=>{state.supplierId=e.target.value;render();const ids=currentSupplierIds();if(ids.length)selectPart(ids[0]);};
  $('cylinder-select').onchange=e=>{state.count=Number(e.target.value);state.layoutOnly=state.count!==selectedUnit().cylinders;state.supplierId='';rebuild();};
  $('demo-toggle').onclick=()=>{acceptDataset(getDataset(state.dataset.dataKind==='demo'?'empty':'demo'));toast(state.dataset.dataKind==='demo'?'가상 시연 데이터입니다. 실제 공급·재고 정보와 관계없습니다.':'실제 데이터 미등록 상태로 돌아왔습니다.');};
  $('part-search').oninput=e=>{state.search=e.target.value;renderParts();};$('subparts-toggle').onchange=e=>{state.subparts=e.target.checked;renderParts();};
  document.addEventListener('click',e=>{const part=e.target.closest('[data-part]');if(part){selectPart(part.dataset.part);if(state.page!=='model')setPage('model');}const page=e.target.closest('[data-page]');if(page)setPage(page.dataset.page);const view=e.target.closest('[data-view]');if(view)setView(view.dataset.view);});
  $('ghost-toggle').onchange=e=>{state.ghost=e.target.checked;syncViewer();};$('pulse-toggle').onchange=e=>{state.pulse=e.target.checked;syncViewer();};$('motion-toggle').onchange=e=>{state.reduced=e.target.checked;renderControls();syncViewer();};
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{state.reduced=e.matches;renderControls();syncViewer();});
  $('reset-camera').onclick=()=>viewer.reset();$('focus-button').onclick=()=>viewer.focus(state.selectedId);
  $('snapshot-button').onclick=()=>{const a=document.createElement('a');a.href=viewer.snapshot();a.download=`G95-concept-${state.count}cyl-${state.view}.png`;a.click();toast('구조 설명용 3D 화면을 저장했습니다.');};
  $('glb-download').onclick=async()=>{try{download(`engine-${state.count}-concept.glb`,await viewer.exportGLB(),'model/gltf-binary');toast('재질 강조를 제외한 원본 조립 상태로 GLB를 저장했습니다.');}catch(e){toast(e.message);}};
  $('mapping-download').onclick=()=>download(`engine-${state.count}-parts.json`,{model:engine.root.userData,parts:engine.metadata,connections:engine.connections});
  $('bom-download').onclick=()=>download(`${state.unitId}-bom.json`,{dataKind:state.dataset.dataKind,...buildBom(effectiveDataset(),state.unitId)});
  $('data-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw new Error('JSON 파일은 최대 20MiB입니다.');acceptDataset(await file.text());toast('검증한 호기별 구매 데이터를 연결했습니다. 파일은 서버로 전송하지 않습니다.');}catch(err){toast(`연결 실패: ${err.message}`);}finally{e.target.value='';}};
  $('help-button').onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='DOCK_LOAD_PROCUREMENT')return;try{acceptDataset(event.data.dataset);window.parent.postMessage({type:'DOCK_DATA_ACCEPTED',unitId:state.unitId},event.origin);}catch(e){window.parent.postMessage({type:'DOCK_DATA_REJECTED',error:e.message},event.origin);}});
  if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embed');
  // Exposes the same production actions for deterministic browser checks and a guided demo.
  window.dock={get state(){return state;},get viewer(){return viewer;},get engine(){return engine;},selectPart,setView,setPage,acceptDataset,render,getDataset,pulseForTest:(t)=>import('./viewer.js').then(m=>m.pulseLevel(t,state.pulse,state.reduced))};
}catch(error){$('canvas-loading').textContent=`3D 초기화 실패: ${error.message}. WebGL 사용 가능한 브라우저에서 열어주세요.`;console.error(error);}
