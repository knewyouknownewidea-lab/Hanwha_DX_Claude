'use client';
import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {Box,Database,Search,X} from 'lucide-react';
import './simulation-data.css';

type Props={data:any;unitId:string;onClose:()=>void;onSelectPart:(partId:string,unitId?:string)=>void};
type Column={key:string;label:string;render?:(row:any)=>React.ReactNode};
const tabs=[
 {id:'stock',label:'재고'},
 {id:'modelMappings',label:'3D 부품 매핑'},
 {id:'items',label:'품목'},
 {id:'suppliers',label:'협력사'},
 {id:'purchaseOrders',label:'발주 및 입고'},
 {id:'inspections',label:'입고검사'},
 {id:'productionBom',label:'생산계획 및 BOM'},
];
const display=(value:any)=>value==null||value===''?'미등록':String(value);
const orderStatus:Record<string,string>={open:'입고 예정',received:'입고 완료',delayed:'납기 지연'};

export default function SimulationData({data,unitId,onClose,onSelectPart}:Props){
 const [active,setActive]=useState('stock'),[query,setQuery]=useState(''),[unitOnly,setUnitOnly]=useState(true);
 const dialogRef=useRef<HTMLDivElement>(null),closeRef=useRef<HTMLButtonElement>(null);
 const prefix=useId();
 const unit=data?.units?.find((row:any)=>row.id===unitId);
 const title=tabs.find(tab=>tab.id===active)?.label??'재고';
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  closeRef.current?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key!=='Tab')return;
   const focusable=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]')??[]);
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
 },[onClose]);
 const tables=useMemo(()=>{
  const rel=data?.relations??{};
  const mappings=(rel.modelMappings??[]).filter((row:any)=>!unitOnly||row.unitId===unitId);
  const itemIds=new Set(mappings.map((row:any)=>row.itemNo));
  const supply=(data?.supply??[]).filter((row:any)=>!unitOnly||row.unitId===unitId);
  const supplierIds=new Set(supply.map((row:any)=>row.supplierId));
  const plans=rel.productionPlans??[];
  const planByUnit=new Map(plans.map((row:any)=>[row.unitId,row]));
  const poByNo=new Map((rel.purchaseOrders??[]).map((row:any)=>[row.poNo,row]));
  return {
   stock:(rel.stock??[]).filter((row:any)=>!unitOnly||row.unitId===unitId),
   modelMappings:mappings,
   items:(rel.items??[]).filter((row:any)=>!unitOnly||itemIds.has(row.itemNo)),
   suppliers:(data?.suppliers??[]).filter((row:any)=>!unitOnly||supplierIds.has(row.supplier_id)).map((row:any)=>({...row,
    suppliedItemNos:unitOnly?(row.suppliedItemNos??[]).filter((id:string)=>itemIds.has(id)):row.suppliedItemNos})),
   purchaseOrders:(rel.purchaseOrders??[]).filter((row:any)=>!unitOnly||row.unitId===unitId),
   inspections:(rel.inspections??[]).filter((row:any)=>!unitOnly||(poByNo.get(row.poNo) as any)?.unitId===unitId||itemIds.has(row.itemNo)),
   productionBom:(rel.bom??[]).filter((row:any)=>!unitOnly||row.unitId===unitId).map((row:any)=>({...row,...(planByUnit.get(row.unitId) as any),
    modelPartName:mappings.find((mapping:any)=>mapping.unitId===row.unitId&&mapping.partId===row.partId)?.modelPartName})),
  } as Record<string,any[]>;
 },[data,unitId,unitOnly]);
 const selectedRows=tables[active]??[];
 const rows=useMemo(()=>{
  const text=query.trim().toLocaleLowerCase();
  return text?selectedRows.filter(row=>Object.values(row).join(' ').toLocaleLowerCase().includes(text)):selectedRows;
 },[selectedRows,query]);
 const unitLabel=(id:string)=>data?.units?.find((row:any)=>row.id===id)?.label??display(id);
 const supplierLabel=(id:string)=>data?.suppliers?.find((row:any)=>row.supplier_id===id)?.name??display(id);
 const partButton=(row:any)=><button className="simulation-part-link" data-select-part={row.partId} onClick={()=>{onSelectPart(row.partId,row.unitId);onClose();}} aria-label={`${row.partId} 3D에서 보기`}><Box size={12}/>{row.partId}</button>;
 const columns:Record<string,Column[]>={
  stock:[{key:'itemNo',label:'품번'},{key:'warehouse',label:'창고'},{key:'currentStock',label:'현재고'},{key:'rejectedQty',label:'검사 보류량'},{key:'acceptedStock',label:'가용재고'},{key:'safetyStock',label:'안전재고'},{key:'asOf',label:'기준일'}],
  modelMappings:[{key:'unitId',label:'생산 호기',render:row=>unitLabel(row.unitId)},{key:'modelPartName',label:'모델 부품 이름'},{key:'partId',label:'3D 부품 ID',render:partButton},{key:'itemNo',label:'품번'},{key:'drawingNo',label:'도면번호'},{key:'rev',label:'REV'}],
  items:[{key:'itemNo',label:'품번'},{key:'name',label:'품명'},{key:'spec',label:'규격'},{key:'unit',label:'단위'},{key:'rev',label:'REV'}],
  suppliers:[{key:'supplier_id',label:'협력사 ID'},{key:'name',label:'가상 협력사명'},{key:'suppliedItemNos',label:'공급 품번',render:row=><div className="simulation-item-tags">{(row.suppliedItemNos??[]).map((id:string)=><code key={id}>{id}</code>)}</div>},{key:'leadTimeDays',label:'리드타임',render:row=>`${display(row.leadTimeDays)}일`},{key:'grade',label:'가상 등급'},{key:'on_time_rate_pct',label:'가상 납기 준수율',render:row=>`${display(row.on_time_rate_pct)}%`}],
  purchaseOrders:[{key:'poNo',label:'발주번호'},{key:'itemNo',label:'품번'},{key:'supplierId',label:'협력사',render:row=>supplierLabel(row.supplierId)},{key:'quantity',label:'수량'},{key:'requiredDate',label:'필요일'},{key:'promisedDate',label:'약정일'},{key:'expectedDate',label:'입고 예정일'},{key:'confirmed',label:'확정 여부',render:row=>row.confirmed?'확정':'미확정'},{key:'status',label:'입고 상태',render:row=><span className={`simulation-order-state ${row.status}`}>{orderStatus[row.status]??display(row.status)}</span>}],
  inspections:[{key:'lotNo',label:'검사 LOT'},{key:'itemNo',label:'품번'},{key:'poNo',label:'발주번호'},{key:'inspectedQty',label:'검사 수량'},{key:'rejectedQty',label:'부적합 수량',render:row=><span className={row.rejectedQty>0?'simulation-rejected':''}>{display(row.rejectedQty)}</span>},{key:'inspectionDate',label:'검사일'}],
  productionBom:[{key:'engineNumber',label:'엔진 번호'},{key:'assemblyDate',label:'조립일'},{key:'itemNo',label:'품번'},{key:'modelPartName',label:'부품명'},{key:'partId',label:'3D 부품 ID',render:partButton},{key:'requiredQty',label:'소요 수량'},{key:'bomIncluded',label:'BOM 집계',render:row=>row.bomIncluded?<span className="simulation-bom-included">구매 집계</span>:<span className="simulation-bom-excluded">제외 · {row.exclusionReason}</span>}],
 };
 const currentColumns=columns[active];
 return <div className="simulation-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div ref={dialogRef} className="simulation-dialog" role="dialog" aria-modal="true" aria-label="가상 데이터 테이블">
   <header className="simulation-head"><div><div className="simulation-eyebrow"><Database size={13}/> PROTOTYPE DATA <span>SAMPLE</span></div><h2>가상 데이터 테이블</h2><p>7개 테이블의 연결 관계와 시나리오에 따른 수량·일정을 확인합니다.</p></div><button ref={closeRef} className="simulation-close" aria-label="가상 데이터 닫기" onClick={onClose}><X size={21}/></button></header>
   <div className="simulation-disclaimer"><strong>모든 값은 가상 시연 데이터입니다.</strong><span>협력사·재고·품번·도면번호·일정·평가는 실제 거래나 제작 사양을 의미하지 않습니다.</span></div>
   <div className="simulation-context"><div><span>현재 시나리오</span><strong>{data?.meta?.scenarioLabel??'기본 생산계획'}</strong></div><div><span>선택 생산 호기</span><strong>{unit?.label??unitId}</strong></div><div><span>데이터 기준일</span><strong>{data?.meta?.as_of??'미등록'}</strong></div></div>
   <div className="simulation-tabs" role="tablist" aria-label="가상 데이터 종류">{tabs.map((tab,index)=><button role="tab" key={tab.id} id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel`} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} className={active===tab.id?'active':''} onClick={()=>{setActive(tab.id);setQuery('');}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;setActive(tabs[next].id);setQuery('');document.getElementById(`${prefix}-tab-${tabs[next].id}`)?.focus();}}>{tab.label}<small>{tables[tab.id]?.length??0}</small></button>)}</div>
   <section className="simulation-panel" id={`${prefix}-panel`} role="tabpanel" aria-labelledby={`${prefix}-tab-${active}`}>
    <div className="simulation-table-toolbar"><div><h3>{title}</h3><span>{rows.length} / {selectedRows.length}행{active==='productionBom'&&' · 조립체 하위품·통합 영역 집계 제외'}</span></div><div className="simulation-filters"><label className="simulation-unit-filter"><input type="checkbox" checked={unitOnly} onChange={event=>setUnitOnly(event.target.checked)}/>선택 호기만</label><label className="simulation-search"><Search size={14}/><input aria-label="가상 테이블 검색" placeholder="품번·부품·번호 검색" value={query} onChange={event=>setQuery(event.target.value)}/></label></div></div>
    <div className="simulation-table-scroll" tabIndex={0} aria-label={`${title} 가로 스크롤 표`}><table><thead><tr>{currentColumns.map(column=><th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.unitId??''}-${row.partId??row.poNo??row.lotNo??row.itemNo??row.supplier_id}-${index}`}>{currentColumns.map(column=><td key={column.key}>{column.render?column.render(row):display(row[column.key])}</td>)}</tr>)}{rows.length===0&&<tr><td colSpan={currentColumns.length} className="simulation-empty">{query?'검색 결과가 없습니다.':'이 범위에 연결된 가상 데이터가 없습니다.'}</td></tr>}</tbody></table></div>
   </section>
   <footer className="simulation-foot"><span>{active==='modelMappings'||active==='productionBom'?'3D 부품 ID를 누르면 해당 부품을 선택하고 뷰어로 돌아갑니다.':'수량은 간단한 가상 시나리오 계산 결과이며, 표는 읽기 전용입니다.'}</span><button onClick={onClose}>뷰어로 돌아가기</button></footer>
  </div>
 </div>;
}
