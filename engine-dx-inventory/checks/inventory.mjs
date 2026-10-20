// 재고 샘플 데이터 검증: node checks/inventory.mjs
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const parts=read('../public/models/parts.json').parts,inv=read('../public/data/inventory.json');
const byId=new Map(parts.map(p=>[p.id,p])),typeIds=[...new Set(parts.map(p=>p.part_type_id))];
let pass=0,fail=0;
const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL '+m)}};
ok(typeIds.length===29&&typeIds.every(t=>inv.types[t]?.variants?.length>=1&&inv.types[t].variants.length<=4)&&Object.keys(inv.types).length===typeIds.length,'29종 유형 전부 1~4개 세부 항목');
ok(inv.meta?.sample===true&&!!inv.meta.as_of,'meta.sample/as_of');
const seen=new Map(),drawings=new Set();let low=0,zero=0;
for(const t of typeIds){
 const vs=inv.types[t]?.variants||[];
 for(const v of vs){
  ok(Number.isInteger(v.stock_qty)&&v.stock_qty>=0&&Number.isInteger(v.safety_stock)&&v.safety_stock>=0,`${v.variant_id} 수량 정수·0 이상`);
  ok(/^SMP-[A-Z0-9]+-\d{3}$/.test(v.drawing_no)&&!drawings.has(v.drawing_no),`${v.variant_id} 도면번호 형식·중복 없음`);drawings.add(v.drawing_no);
  if(v.stock_qty<v.safety_stock)low++;if(v.stock_qty===0)zero++;
  for(const id of v.used_by){
   ok(byId.get(id)?.part_type_id===t,`${v.variant_id} used_by ${id} 존재·유형 일치`);
   ok(!seen.has(id),`${id} 중복 배정`);seen.set(id,v.variant_id);
  }
 }
 const cyl=parts.filter(p=>p.part_type_id===t&&p.cylinder);
 for(const p of cyl)ok(seen.has(p.id),`${p.id} 기통 부품 배정`);
}
ok(low>=4&&low<=6,`안전재고 미달 4~6건 (현재 ${low})`);
ok(zero===1,`재고 0 항목 1건 (현재 ${zero})`);
console.log(`inventory 검사: 통과 ${pass}, 실패 ${fail} (미달 ${low}건, 재고 0 ${zero}건)`);
process.exit(fail?1:0);
