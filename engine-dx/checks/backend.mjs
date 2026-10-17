import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createApi} from '../lib/api.mjs';
import {ACTIONS} from '../lib/domain.mjs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
const d1={prepare(sql){let args=[];const q={bind(...v){args=v;return q},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}};return q;}};
const blobs=new Map();const BUCKET={async put(k,b){blobs.set(k,b)},async get(k){return blobs.has(k)?{body:blobs.get(k)}:null}};
const catalog=JSON.parse(readFileSync('public/models/parts.json','utf8'));
const handle=createApi({DB:d1,BUCKET},catalog),cookies={},checks=[];
async function call(user,path,method='GET',body,expected=200){
 const headers={origin:'http://localhost:5173'};if(cookies[user])headers.cookie=cookies[user];
 if(body&&!(body instanceof FormData))headers['content-type']='application/json';
 const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers,body:body?body instanceof FormData?body:JSON.stringify(body):undefined}));
 const cookie=r.headers.get('set-cookie');if(cookie)cookies[user]=cookie.split(';')[0];
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
 assert.equal(r.status,expected,`${method} ${path}: ${text}`);return data;
}
function pass(name){checks.push({name,passed:true})}
await call('none','bootstrap');
for(const user of ['buyer','design','quality','production','supplier-a','supplier-b'])await call(user,'session','POST',{user_id:user});
assert.equal((await call('buyer','issues')).issues.length,10);pass('10 fictional scenarios seeded');
assert.equal((await call('buyer','catalog')).catalog.parts.length,94);pass('94 unique CAD IDs available');
const draft={part_id:'CYL_01_LINER',supplier_id:'SUP-DEMO-A',title:'API test assembly association',type:'설계 사양 확인',content:'가상 검증 문의',assigned_depts:['설계팀','품질팀'],due_date:'2026-10-25',po_number:'INTERNAL-CONTRACT-TEST',external_visible:true};
const {id}=await call('buyer','issues','POST',draft,201);
const other=await call('buyer','issues','POST',{...draft,part_id:'CYL_02_LINER',supplier_id:'SUP-DEMO-B'},201);
assert.equal((await call('buyer','issues/'+id)).issue.part_id,'CYL_01_LINER');
assert.equal((await call('buyer','issues/'+other.id)).issue.part_id,'CYL_02_LINER');pass('Same component type in different cylinders remains distinct');
await call('none','issues','GET',null,401);pass('No session is denied');
await call('supplier-a','issues/'+other.id,'GET',null,404);pass('Other supplier issue blocked at server');
await call('supplier-a','issues','POST',{...draft,supplier_id:'SUP-DEMO-B'},403);pass('Supplier identity spoof blocked');
await call('supplier-a','issues/'+id,'PATCH',{status:'검토 완료',reason:'spoof'},403);pass('Supplier cannot change status or assignment');
await call('production','issues/'+id+'/reviews','POST',{opinion:'unassigned',status:'검토 완료'},403);pass('Unassigned department review blocked');
await call('buyer','issues/'+id,'PATCH',{status:'담당 부서 지정',reason:'설계 및 품질 검토 배정'});
await call('buyer','issues/'+id,'PATCH',{status:'검토 중',reason:'검토 착수'});
await call('design','issues/'+id+'/reviews','POST',{opinion:'설계 검토(가상)',status:'검토 완료'},201);
await call('buyer','issues/'+id,'PATCH',{status:'검토 완료',reason:'조기 완료 테스트'},409);pass('Multi-department gate prevents premature review completion');
await call('quality','issues/'+id+'/reviews','POST',{opinion:'품질 검토(가상)',status:'검토 완료'},201);
await call('buyer','issues/'+id,'PATCH',{status:'검토 완료',reason:'두 부서 검토 완료'});
await call('buyer','issues/'+id+'/messages','POST',{content:'INTERNAL-ONLY-REVIEW',visibility:'internal'},201);
await call('buyer','issues/'+id+'/messages','POST',{content:'가상 외부 최종 회신',visibility:'external',kind:'final_reply'},201);
await call('buyer','issues/'+id,'PATCH',{status:'협력업체 회신 대기',reason:'구매팀 회신 기록'});
const ext=await call('supplier-a','issues/'+id);
assert.equal(ext.reviews.length,0);assert.equal(ext.audit.length,0);assert.equal(ext.actions.length,0);assert(!('po_number' in ext.issue));assert(!JSON.stringify(ext).includes('INTERNAL-ONLY'));pass('Supplier receives no internal reviews, contract, actions or audit');
await call('supplier-a','issues/'+id+'/ack','POST',{message_id:ext.messages.find(m=>m.kind==='final_reply').id});
await call('buyer','issues/'+id,'PATCH',{status:'구매 후속 조치 중',reason:'수신 확인 후 구매 검토'});
await call('buyer','issues/'+id,'PATCH',{status:'최종 완료',reason:'미조치 종결 테스트'},409);pass('Review completion is distinct from purchase completion');
for(const type of ACTIONS)await call('buyer','issues/'+id+'/actions','POST',{action_type:type,decision:'완료',note:'가상 업무 후속 판단 기록'},201);
await call('buyer','issues/'+id,'PATCH',{status:'최종 완료',reason:'구매 조치 및 회신 확인 완료'});pass('End-to-end review → reply → acknowledgment → purchase actions → closure');
for(const visibility of ['internal','external']){
 const form=new FormData();form.set('file',new File(['sample attachment'],'sample.txt',{type:'text/plain'}));form.set('visibility',visibility);
 const a=await call('buyer','issues/'+id+'/attachments','POST',form,201);
 await call('supplier-a','attachments/'+a.id,'GET',null,visibility==='internal'?404:200);
}
pass('Attachment file stored; internal file denied and external file allowed');
const final=await call('buyer','issues/'+id);assert(final.audit.length>=12);assert(final.audit.some(a=>a.event==='구매 후속 조치'));pass('Status and business actions retain append-only audit trail');
await call('supplier-a','issues','POST',{...draft,supplier_id:'SUP-DEMO-A',title:'협력사 가상 문의'},201);pass('Supplier-origin inquiry accepted under own supplier ID');
const source=readFileSync('public/main01/index.html');assert.equal(createHash('sha256').update(source).digest('hex'),'7470ae35b8989711b2138823e88fa08d0f22f8507a7d5e9f9c9837bf91f6ebf9');pass('MAIN01 HTML byte-for-byte preserved');
const metadata=JSON.parse(readFileSync('public/models/parts.json'));for(const stem of ['engine_full','engine_cutaway']){
 const d=readFileSync('public/models/'+stem+'.glb');const n=d.readUInt32LE(12);const g=JSON.parse(d.subarray(20,20+n).toString());assert.equal(g.nodes.length,94);assert.equal(new Set(g.nodes.map(x=>x.name)).size,94);assert.deepEqual(g.nodes.map(x=>x.name).sort(),metadata.parts.map(x=>x.id).sort());
}
pass('Both GLBs preserve 94 independent part IDs and correct mapping');
mkdirSync('verification',{recursive:true});writeFileSync('verification/backend-tests.json',JSON.stringify({passed:true,tests:checks,main01_sha256:createHash('sha256').update(source).digest('hex'),database:'SQLite in-memory using real schema migrations, isolated from demo runtime'},null,2));
console.log(JSON.stringify({passed:true,count:checks.length,tests:checks.map(c=>c.name)},null,2));db.close();
