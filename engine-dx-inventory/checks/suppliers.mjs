// 가상 협력사 데이터 검증: node checks/suppliers.mjs
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const parts=read('../public/models/parts.json').parts,d=read('../public/data/suppliers.json');
const typeIds=[...new Set(parts.map(p=>p.part_type_id))];
let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL '+m)}};
ok(d.meta?.sample===true&&!!d.meta.as_of&&!!d.meta.note,'meta.sample/as_of/note');
const ids=d.suppliers.map(s=>s.supplier_id);
ok(new Set(ids).size===ids.length&&ids.length===5,'협력사 id 중복 없음·5곳');
const cover=new Map();
for(const s of d.suppliers){
 const r=s.on_time_rate_pct,g=s.grade,t=d.supply[s.supplier_id]||[];
 ok(g==='A'?r>=90:g==='B'?r>=80&&r<90:g==='C'?r<80:false,`${s.supplier_id} 등급 ${g}·준수율 ${r} 일치`);
 ok(r===Math.round(r*10)/10,`${s.supplier_id} 준수율 소수 첫째 자리`);
 ok(t.length>=4&&t.length<=12&&new Set(t).size===t.length,`${s.supplier_id} 담당 유형 4~12종 (${t.length})`);
 for(const x of t){ok(typeIds.includes(x),`${s.supplier_id} ${x} parts.json에 존재`);cover.set(x,(cover.get(x)||0)+1)}
}
ok(Object.keys(d.supply).every(k=>ids.includes(k)),'supply 키가 협력사 id');
ok(typeIds.length===29&&typeIds.every(t=>cover.get(t)>=1),'29종 유형 모두 담당 협력사 있음');
ok(d.supply['SUP-DEMO-A']?.includes('CONROD')&&cover.get('CONROD')>=2,'협력사 A가 CONROD 담당·CONROD 2곳 이상');
ok(['PISTON','LINER'].every(t=>cover.get(t)>=2),'PISTON·LINER 2곳 이상');
console.log(`suppliers 검사: 통과 ${pass}, 실패 ${fail}`);
process.exit(fail?1:0);
