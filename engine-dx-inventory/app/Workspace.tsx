'use client';
import React,{useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import {Box,BarChart3,ChevronRight,Search,RotateCcw,Focus,Layers,Scissors,ShieldCheck,ExternalLink,FileText,Settings2,X,Package} from 'lucide-react';
import './workspace.css';
import './mobile-fixes.css';
import './desktop-fit.css';
const Viewer=dynamic(()=>import('./EngineViewer'),{ssr:false,loading:()=> <div className="viewer-loading">3D 엔진을 불러오고 있습니다…</div>});
async function getJson(path:string):Promise<any>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' 을(를) 불러오지 못했습니다 ('+r.status+').');return r.json();}
export default function Workspace(){
 const [catalog,setCatalog]=useState<any>(null),[inv,setInv]=useState<any>(null),[sup,setSup]=useState<any>(null),[supId,setSupId]=useState('');
 const [selected,setSelected]=useState<string|null>('CYL_01_CROSSHEAD_BRG'),[search,setSearch]=useState('');
 const [hidden,setHidden]=useState<string[]>([]),[isolate,setIsolate]=useState(false),[ghost,setGhost]=useState(false),[cutaway,setCutaway]=useState(true),[explode,setExplode]=useState(0),[resetTick,setReset]=useState(0),[focusTick,setFocus]=useState(0),[ready,setReady]=useState<string[]>([]);
 const [error,setError]=useState(''),[groupsOpen,setGroupsOpen]=useState(false),[provenance,setProvenance]=useState(false);
 const part=catalog?.parts.find((p:any)=>p.id===selected);
 const groups=useMemo(()=>Array.from(new Set<string>(catalog?.parts.map((p:any)=>p.group)||[])),[catalog]);
 useEffect(()=>{getJson('/models/parts.json').then(setCatalog).catch(e=>setError(e.message));getJson('/data/inventory.json').then(setInv).catch(e=>setError(e.message));getJson('/data/suppliers.json').then(setSup).catch(e=>setError(e.message))},[]);
 function pick(id:string|null){setSelected(id);if(id)setFocus(x=>x+1);}
 const partHits=search&&catalog?catalog.parts.filter((p:any)=>(p.id+' '+p.name_ko).toLowerCase().includes(search.toLowerCase())).slice(0,7):[];
 function reset(){setReset(x=>x+1);setHidden([]);setIsolate(false);setGhost(false);setExplode(0);}
 const typeCount=inv?Object.keys(inv.types).length:null;
 const lowCount=inv?Object.values<any>(inv.types).reduce((n,t)=>n+t.variants.filter((v:any)=>v.stock_qty<v.safety_stock).length,0):null;
 const asOf=inv?.meta?.as_of||'';
 const variants:any[]=part&&inv?[...(inv.types[part.part_type_id]?.variants||[])].sort((a:any,b:any)=>Number(b.used_by.includes(selected))-Number(a.used_by.includes(selected))):[];
 const supList:any[]=sup?.suppliers||[],activeSup=supList.find(x=>x.supplier_id===supId);
 const highlightIds:string[]=useMemo(()=>activeSup&&catalog?catalog.parts.filter((p:any)=>sup.supply[supId]?.includes(p.part_type_id)).map((p:any)=>p.id):[],[activeSup,catalog,sup,supId]);
 const partSups=part&&sup?supList.filter(x=>sup.supply[x.supplier_id]?.includes(part.part_type_id)):[];
 useEffect(()=>{(window as any).__engineDx=Object.freeze({highlighted:highlightIds,selected});},[highlightIds,selected]);// 테스트용 읽기 전용 상태
 const total=variants.reduce((n,v)=>n+v.stock_qty,0);
 return <div className="dx-app">
  <header className="dx-header"><a className="brand" href="/"><span className="brand-emblem">H</span><span><strong>HANWHA ENGINE</strong><small>PURCHASING DX WORKSPACE</small></span></a><div className="header-divider"/><span className="workspace-label">부품 재고</span><span className="demo-tag">DEMO</span><div className="header-right"><div className="avatar">구</div></div></header>
  <div className="app-body"><nav className="main-nav" aria-label="주요 기능"><a href="/main01/index.html" title="MAIN 01 구매 AI 분석"><BarChart3 size={21}/><span>MAIN 01</span></a><a href="/" className="nav-current" aria-current="page"><Box size={22}/><span>MAIN 02</span></a><button onClick={()=>setProvenance(true)} title="모델과 데이터 출처"><FileText size={21}/><span>모델 정보</span></button><div className="nav-bottom"><ShieldCheck size={20}/><span>가상 업무</span></div></nav>
   <main className="workspace"><div className="page-heading"><div><div className="eyebrow">MAIN 02 <ChevronRight size={12}/> ENGINE PARTS INVENTORY</div><h1>엔진 부품 재고<span>부품을 선택해 재고를 확인합니다</span></h1></div></div>
   <div className="summary-strip"><div><span>엔진 모델</span><strong>6G50ME-C9.6</strong><code>DEMO-CAD-2.0</code></div><div><span>선택 가능한 부품</span><strong>{catalog?.parts.length||'—'}<small>개</small></strong></div><div><span>재고 품목(부품 유형)</span><strong>{typeCount??'—'}<small>종</small></strong></div><div><span>안전재고 미달 세부 항목</span><strong>{lowCount??'—'}<small>건</small></strong></div><div className="summary-note"><i/>SAMPLE · 가상 재고 데이터 · 실제 자료 아님</div></div>
   {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="오류 닫기"><X size={15}/></button></div>}
   <div className="work-grid"><section className="viewer-panel" aria-label="3D 엔진 뷰어"><div className="viewer-head"><div className="viewer-title"><Box size={16}/><strong>6기통 엔진 조립체</strong><span className="pill-neutral">{ready.length?`${ready.length} 객체 연결`:'로딩 중'}</span></div><button className="text-button" onClick={()=>setProvenance(true)}>시연 모델 정보 <ExternalLink size={12}/></button></div>
    <div className="model-toolbar"><div className="view-toggle"><button className={!cutaway?'selected':''} onClick={()=>setCutaway(false)}><Box size={14}/>외형</button><button className={cutaway?'selected':''} onClick={()=>setCutaway(true)}><Scissors size={14}/>내부 단면</button></div><div className="toolbar-buttons"><button title="선택 부품 중심" aria-label="선택 부품 중심" disabled={!selected} onClick={()=>setFocus(x=>x+1)}><Focus size={17}/></button><button title="전체 보기 및 초기화" aria-label="전체 보기 및 초기화" onClick={reset}><RotateCcw size={17}/></button><button aria-label="부품군 표시 설정" className={groupsOpen?'on':''} onClick={()=>setGroupsOpen(!groupsOpen)}><Settings2 size={17}/></button></div></div>
    <div className="supplier-bar"><label htmlFor="supplier-select">협력사 강조</label><select id="supplier-select" aria-label="협력사 강조" value={supId} onChange={e=>setSupId(e.target.value)}><option value="">협력사 강조 끄기</option>{supList.map(x=><option key={x.supplier_id} value={x.supplier_id}>{x.name} · 담당 {sup.supply[x.supplier_id].length}종</option>)}</select>{supId&&<button className="supplier-clear" aria-label="협력사 강조 해제(도구줄)" onClick={()=>setSupId('')}><X size={13}/>해제</button>}<span className="supplier-state">{supId?'강조 중':'꺼짐'}</span></div>
    <div className="canvas-wrap" data-highlight-count={highlightIds.length}>{catalog&&<Viewer highlightIds={highlightIds} catalog={catalog} selected={selected} onSelect={pick} hidden={hidden} isolate={isolate} ghost={ghost} cutaway={cutaway} explode={explode} resetTick={resetTick} focusTick={focusTick} onReady={setReady}/>}
     {!catalog&&<div className="viewer-loading">엔진 데이터를 불러오는 중…</div>}
     {activeSup&&<div className="supplier-banner" role="status"><span>{activeSup.name} 담당 부품 {highlightIds.length}개 강조 중 · 나머지 반투명</span><button aria-label="협력사 강조 해제" onClick={()=>setSupId('')}>강조 해제</button></div>}
     <div className="model-caption"><b>6G50ME-C9.6</b><span>LOW-SPEED · TWO-STROKE · CROSSHEAD</span></div>
     {groupsOpen&&<div className="groups-popover"><strong>부품군 표시</strong>{groups.map(g=><label key={g}><input type="checkbox" checked={!hidden.includes(g)} onChange={()=>setHidden(hidden.includes(g)?hidden.filter(x=>x!==g):[...hidden,g])}/>{g}</label>)}</div>}
    </div><div className="viewer-footer"><div className="explode-control"><Layers size={16}/><label htmlFor="explode-range">분리</label><input id="explode-range" aria-label="분리 정도" type="range" min="0" max="100" step="1" value={Math.round(explode*100)} onChange={e=>setExplode(Number(e.target.value)/100)}/><output>{Math.round(explode*100)}%</output></div><label className="check-label"><input type="checkbox" checked={ghost} onChange={e=>setGhost(e.target.checked)}/>주변 반투명</label><label className="check-label"><input type="checkbox" checked={isolate} disabled={!selected} onChange={e=>setIsolate(e.target.checked)}/>선택 부품만</label></div>
    <div className="part-finder"><Search size={15}/><select aria-label="부품 선택" value={selected||''} onChange={e=>pick(e.target.value||null)}><option value="">전체 부품에서 선택</option>{catalog?.parts.map((p:any)=><option key={p.id} value={p.id}>{p.cylinder?`${p.cylinder}기통 · `:''}{p.name_ko} — {p.id}</option>)}</select><span>{part?.group||'전체 부품'}</span></div>
   </section>
   <aside className="collab-panel" aria-label="부품별 재고"><div className="part-summary"><div className="part-kicker">{part?.cylinder?`CYLINDER ${String(part.cylinder).padStart(2,'0')}`:'COMMON ASSEMBLY'}<span className="pill-neutral">{part?.group||'부품 미선택'}</span></div><h2>{part?.name_ko||'부품을 선택하세요'}</h2><code data-testid="selected-part-id">{selected||'—'}</code><div className="part-summary-bottom"><span>시연용 형상 · 치수 가정 포함</span></div></div>
    <div className="inv-search"><div className="search-input"><Search size={14}/><input aria-label="부품 이름 또는 ID 검색" placeholder="부품 이름 또는 ID 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    <div className="inv-body">{partHits.length>0&&<div className="part-search-results">{partHits.map((p:any)=><button key={p.id} onClick={()=>{pick(p.id);setSearch('')}}>{p.name_ko}<code>{p.id}</code></button>)}</div>}
     {!part&&<div className="empty"><Package size={30}/><p>3D 엔진에서 부품을 클릭하거나 위에서 검색하면<br/>같은 부품 유형의 재고를 보여 줍니다.</p></div>}
     {part&&!inv&&<div className="empty"><p>재고 데이터를 불러오는 중…</p></div>}
     {part&&inv&&<>
      <div className="inv-summary" data-testid="inv-summary"><div><span>유형 총 재고</span><strong data-testid="inv-total">{total}<small>EA</small></strong></div><div><span>세부 항목</span><strong>{variants.length}<small>개</small></strong></div><div><span>기준일</span><strong>{asOf}</strong></div></div>
      <p className="inv-scope">같은 부품 유형 전체 재고, 6개 기통 공통입니다. 선택한 위치만의 수량이 아닙니다.</p>
      <h3 className="inv-heading">생산 협력사</h3>
      <div className="sup-list" data-testid="sup-list">{partSups.map((x:any)=><div className="sup-row" key={x.supplier_id} data-testid="sup-row"><div className="sup-main"><strong>{x.name}</strong><span className="sup-badge">평가 {x.grade}</span><span className="sup-rate">납기 준수율 {x.on_time_rate_pct.toFixed(1)}%</span></div>{supId===x.supplier_id?<span className="sup-on">강조 중</span>:<button className="sup-btn" onClick={()=>setSupId(x.supplier_id)}>이 협력사 부품 3D에서 강조</button>}</div>)}{sup&&!partSups.length&&<p className="inv-scope">이 부품 유형의 담당 협력사 정보가 없습니다.</p>}</div>
      <div className="sample-note inv-note">SAMPLE · 가상 평가값 · 실제 평가 아님 · 기준일 {sup?.meta?.as_of||''}</div>
      <h3 className="inv-heading">세부 항목</h3>
      <div className="inv-variants">{variants.map((v:any,i:number)=>{const low=v.stock_qty<v.safety_stock,applied=v.used_by.includes(selected);return <details className="inv-variant" key={selected+v.variant_id} open={i===0} data-testid="inv-variant"><summary><span className="inv-v-title"><code>{v.drawing_no}</code><span>Rev {v.rev}</span></span><span className="inv-v-qty">{v.stock_qty} {v.unit}</span><span className="inv-v-badges">{applied&&<span className="inv-badge applied">이 위치 적용</span>}{low&&<span className="inv-badge low">안전재고 미달</span>}</span></summary><dl><div><dt>재질</dt><dd>{v.material}</dd></div><div><dt>재고 수량</dt><dd>{v.stock_qty} {v.unit}</dd></div><div><dt>안전재고</dt><dd>{v.safety_stock} {v.unit}</dd></div><div><dt>창고</dt><dd>{v.warehouse}</dd></div></dl></details>})}</div>
      <div className="sample-note inv-note">SAMPLE · 가상 재고 · 실제 자료 아님 · 기준일 {asOf}</div>
     </>}
    </div>
   </aside></div><footer className="workspace-footer"><span><ShieldCheck size={12}/>가상 재고 데이터 시연 · 실제 운영 자료 아님</span><span>공개 기술자료 + 가정 형상 · 재고는 가상 샘플 · ERP·MES·PLM 미연동</span><button onClick={()=>setProvenance(true)}>자료 출처 및 가정 확인 <ChevronRight size={12}/></button></footer>
   </main></div>
  {provenance&&<div className="modal-backdrop"><div className="modal source-modal" role="dialog" aria-modal="true"><div className="modal-head"><h2>모델·자료의 확인 범위</h2><button aria-label="모델 정보 닫기" onClick={()=>setProvenance(false)}><X size={20}/></button></div><p>한화엔진 원본 CAD가 아닌 <b>엔진 부품 재고 화면용 단순화 시연 모델</b>입니다. 공개 보어 500 mm·행정 2,500 mm를 참고했고, 나머지 부품 치수와 기통 간격·위상은 가정입니다.</p><h3>공개 기술자료</h3>{catalog?.sources.filter((s:any)=>['S1','S2','S3'].includes(s.id)).map((s:any)=><a key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.title}<ExternalLink size={13}/></a>)}<h3>베어링 손상 문헌 참고</h3><p>G45/G50ME-C9의 CL00005-2021 / CL17232-2021 문서 사본을 참고했습니다. 공식 원본 재확인이 필요하며, 한화엔진에서 실제 발생한 사건으로 표시하지 않습니다.</p><a href="https://www.scribd.com/document/906995029/MAN-Two-Strokes-CL00005-2021-Crosshead-Bearing-Schells" target="_blank" rel="noreferrer">문서 사본 출처 <ExternalLink size={13}/></a><h3>가상 재고 데이터</h3><p>재고 수량·도면번호·개정·재질·창고는 모두 가상(SAMPLE)이며 실제 자료가 아닙니다. 기준일은 {asOf||'—'}이고, 도면번호는 실제 번호 체계와 무관한 가상 형식입니다. ERP·MES·PLM과 연동되어 있지 않습니다.</p><h3>모델 가정</h3><ul>{catalog?.assumptions.map((a:string)=><li key={a}>{a}</li>)}</ul><a href="/models/parts.json" target="_blank">부품 ID 매핑 JSON 열기 <ExternalLink size={13}/></a></div></div>}
 </div>;
}
