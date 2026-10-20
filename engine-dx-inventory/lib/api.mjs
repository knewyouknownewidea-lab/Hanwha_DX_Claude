import {ENGINE,VERSION,DEPTS,STATUSES,TYPES,ACTIONS,DEMO_USERS,SUPPLIERS} from './domain.mjs';
const now=()=>new Date().toISOString();
const uid=(prefix)=>prefix+'-'+crypto.randomUUID();
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(s,m)=>{throw new ApiError(s,m)};
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const clean=(v,n=5000)=>typeof v==='string'?v.trim().slice(0,n):'';
const req=(v,name,n=5000)=>{let s=clean(v,n);if(!s)fail(400,name+'을 입력하세요.');return s;};
const arr=(s)=>{try{return JSON.parse(s||'[]')}catch{return []}};
const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const rows=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const buyer=u=>u.role==='구매팀';
const supplier=u=>u.role==='협력업체';
async function audit(db,u,issue,event,reason,detail={}){
 return run(db,'INSERT INTO audit_logs (id,issue_id,user_id,created_at,event,reason,detail) VALUES (?,?,?,?,?,?,?)',uid('AUD'),issue,u.id,now(),event,reason,JSON.stringify(detail));
}
async function seed(db,catalog){
 if(await one(db,"SELECT id FROM issues WHERE id='TC-DEMO-010'")&&(await one(db,'SELECT COUNT(*) AS n FROM parts')).n===catalog.parts.length)return;
 await run(db,'INSERT OR IGNORE INTO engines (id,model,version,note) VALUES (?,?,?,?)',ENGINE,'6G50ME-C9.6',VERSION,'시연용 단순화 CAD · 치수 가정 포함');
 for(const s of SUPPLIERS)await run(db,'INSERT OR IGNORE INTO suppliers (id,name,evidence,families,part_types) VALUES (?,?,?,?,?)',s.id,s.name,s.evidence,s.families,s.part_types);
 for(const u of DEMO_USERS)await run(db,'INSERT OR IGNORE INTO users (id,name,role,department,supplier_id) VALUES (?,?,?,?,?)',u.id,u.name,u.role,u.department,u.supplier_id||null);
 for(const p of catalog.parts)await run(db,'INSERT OR IGNORE INTO parts (id,engine_id,type_id,name,part_group,cylinder,node_name) VALUES (?,?,?,?,?,?,?)',p.id,ENGINE,p.part_type_id,p.name_ko,p.group,p.cylinder||null,p.id);
 const examples=[
 ['크로스헤드 베어링 사양 변경 검토','CYL_01_CROSSHEAD_BRG','설계변경 검토',['설계팀','품질팀'],'검토 중'],
 ['크로스헤드 핀 가공 가능 여부','CYL_02_CROSSHEAD_PIN','제작 가능 여부',['가공팀'],'담당 부서 지정'],
 ['피스톤 로드 제작 조건 확인','CYL_03_PISTON_ROD','가공 조건 검토',['가공팀','생산팀'],'추가 확인 필요'],
 ['실린더 라이너 검사기준 문의','CYL_04_LINER','검사기준 확인',['품질팀'],'접수'],
 ['크랭크축 치수 검사 관련 협의','ENGINE_CRANKSHAFT','검사기준 확인',['품질팀','설계팀'],'검토 완료'],
 ['실린더 커버 설계변경 확인','CYL_05_COVER','설계변경 검토',['설계팀'],'협력업체 회신 대기'],
 ['커넥팅로드 재질 사양 검토','CYL_06_CONROD','설계 사양 확인',['설계팀'],'구매 후속 조치 중'],
 ['프레임 제작 관련 문의','ENGINE_FRAME','제작 가능 여부',['생산팀'],'보류'],
 ['공급 부품의 품질검사 결과 확인','CYL_02_LINER','입고 품질 문제',['품질팀'],'검토 중'],
 ['기술 회신 후 구매 조치 확인','CYL_01_PISTON','납품 부품의 기술적 문의',['설계팀'],'최종 완료']];
 for(let i=0;i<examples.length;i++){
  const [title,part,type,depts,status]=examples[i],id='TC-DEMO-'+String(i+1).padStart(3,'0');
  const done=['검토 완료','협력업체 회신 대기','구매 후속 조치 중','최종 완료'].includes(status);
  const content='[가상 업무 시나리오] '+title+'. 실제 발주·사고·공급관계가 아닌 협업 흐름 확인용 문의입니다. '+(i===0?'G45/G50ME-C9 베어링 피로손상 문헌(CL00005-2021/CL17232-2021) 사본을 참고 주제로 삼았으며, 한화엔진의 실제 구매 사건을 뜻하지 않습니다.':'공개 가이드의 부품 구성만 참고했으며 세부 제작조건은 확정하지 않았습니다.');
  await run(db,'INSERT OR IGNORE INTO issues (id,engine_id,design_version,part_id,supplier_id,title,type,content,requester_id,request_dept,assigned_depts,created_at,due_date,po_number,status,external_visible,fictional) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,ENGINE,VERSION,part,i%2?'SUP-DEMO-B':'SUP-DEMO-A',title,type,content,'buyer','구매팀',JSON.stringify(depts),'2026-10-15T00:00:00Z','2026-10-'+(20+i),'DEMO-PO-'+(1000+i),status,1,1);
  for(const dep of depts){const u=DEMO_USERS.find(u=>u.department===dep);if(done)await run(db,'INSERT OR IGNORE INTO issue_reviews (id,issue_id,user_id,department,created_at,opinion,status) VALUES (?,?,?,?,?,?,?)','REV-SEED-'+i+'-'+u.id,id,u.id,dep,'2026-10-16T02:00:00Z','[가상 검토] 공개자료 확인 범위와 가정 치수를 구분해 협의하세요. 실제 제작 승인 의견은 아닙니다.','검토 완료');}
  await run(db,'INSERT OR IGNORE INTO audit_logs (id,issue_id,user_id,created_at,event,reason,detail) VALUES (?,?,?,?,?,?,?)','AUD-SEED-'+i,id,'buyer','2026-10-15T00:00:00Z','가상 사례 생성','시연 데이터 초기 구성',JSON.stringify({status}));
  if(['협력업체 회신 대기','구매 후속 조치 중','최종 완료'].includes(status)){
   await run(db,'INSERT OR IGNORE INTO issue_messages (id,issue_id,user_id,created_at,content,visibility,kind,acknowledged_at) VALUES (?,?,?,?,?,?,?,?)','MSG-SEED-'+i,id,'buyer','2026-10-16T03:00:00Z','[가상 구매 회신] 요청하신 검토를 마쳤습니다. 확정 도면은 별도로 확인해 주세요.','external','final_reply',status==='협력업체 회신 대기'?null:'2026-10-16T04:00:00Z');
  }
  if(status==='최종 완료')for(const action of ACTIONS)await run(db,'INSERT OR IGNORE INTO purchase_actions (id,issue_id,user_id,action_type,decision,note,created_at) VALUES (?,?,?,?,?,?,?)','ACT-SEED-'+i+'-'+ACTIONS.indexOf(action),id,'buyer',action,'해당 없음','가상 사례: 실제 발주 변경 없이 확인 완료','2026-10-16T05:00:00Z');
 }
}
export function createApi(env,catalog){
 const db=env.DB;
 async function user(request){
  const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)dx_demo=([^;]+)/)?.[1];
  if(!token)fail(401,'시연 계정을 선택하세요.');
  const u=await one(db,'SELECT users.* FROM demo_sessions JOIN users ON users.id=demo_sessions.user_id WHERE token=? AND expires_at>?',token,now());
  if(!u)fail(401,'시연 세션이 만료되었습니다.');return u;
 }
 async function issueAccess(u,id){
  const item=await one(db,'SELECT issues.*,parts.name AS part_name,suppliers.name AS supplier_name FROM issues JOIN parts ON parts.id=issues.part_id JOIN suppliers ON suppliers.id=issues.supplier_id WHERE issues.id=?',id);
  if(!item||supplier(u)&&(item.supplier_id!==u.supplier_id||!item.external_visible))fail(404,'조회 가능한 협의가 없습니다.');return item;
 }
 function externalIssue(i){const {po_number,assigned_depts,requester_id,request_dept,...rest}=i;return rest;}
 return async function handle(request){
  try{
   if(!db)fail(503,'데이터베이스가 연결되지 않았습니다.');
   const url=new URL(request.url),p=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=request.method;
   if(!['GET','HEAD'].includes(method)){
    const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'다른 출처의 요청은 허용되지 않습니다.');
   }
   if(p[0]==='health')return json({ok:true,database:'SQLite / D1',demo:true});
   if(p[0]==='bootstrap'){
    await seed(db,catalog);
    return json({users:DEMO_USERS,statuses:STATUSES,types:TYPES,depts:DEPTS,actions:ACTIONS,engine:{id:ENGINE,model:'6G50ME-C9.6',version:VERSION},demo:true});
   }
   if(p[0]==='session'&&method==='POST'){
    await seed(db,catalog);const data=await request.json();const u=DEMO_USERS.find(u=>u.id===data.user_id);if(!u)fail(400,'유효한 가상 계정을 선택하세요.');
    const token=crypto.randomUUID()+crypto.randomUUID();
    await run(db,'INSERT INTO demo_sessions (token,user_id,expires_at) VALUES (?,?,?)',token,u.id,new Date(Date.now()+86400000).toISOString());
    return json({user:u,demo:true},200,{'Set-Cookie':`dx_demo=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`});
   }
   const u=await user(request);
   if(p[0]==='me')return json({user:u,demo:true});
   if(p[0]==='catalog')return json({catalog,suppliers:supplier(u)?SUPPLIERS.filter(s=>s.id===u.supplier_id):SUPPLIERS});
   if(p[0]==='issues'&&p.length===1&&method==='GET'){
    const items=await rows(db,'SELECT issues.*,parts.name AS part_name,suppliers.name AS supplier_name FROM issues JOIN parts ON parts.id=issues.part_id JOIN suppliers ON suppliers.id=issues.supplier_id ORDER BY issues.created_at DESC');
    return json({issues:items.filter(i=>!supplier(u)||i.supplier_id===u.supplier_id&&i.external_visible).map(i=>supplier(u)?externalIssue(i):i)});
   }
   if(p[0]==='issues'&&p.length===1&&method==='POST'){
    if(!buyer(u)&&!supplier(u))fail(403,'구매팀 또는 협력업체만 문의를 등록할 수 있습니다.');
    const d=await request.json();const pid=req(d.part_id,'부품');if(!catalog.parts.some(p=>p.id===pid))fail(400,'존재하지 않는 부품 ID입니다.');
    const sid=supplier(u)?u.supplier_id:req(d.supplier_id,'협력업체');if(supplier(u)&&d.supplier_id&&d.supplier_id!==sid)fail(403,'다른 협력업체로 등록할 수 없습니다.');
    if(!SUPPLIERS.some(s=>s.id===sid))fail(400,'협력업체를 확인하세요.');
    const depts=supplier(u)?[]:(d.assigned_depts||[]);if(!Array.isArray(depts)||depts.some(x=>!DEPTS.includes(x)))fail(400,'검토 부서를 확인하세요.');
    const type=req(d.type,'문의 유형');if(!TYPES.includes(type))fail(400,'문의 유형을 확인하세요.');
    const due=req(d.due_date,'목표 회신일');if(!/^\d{4}-\d{2}-\d{2}$/.test(due))fail(400,'날짜 형식을 확인하세요.');
    const id=uid('TC');await run(db,'INSERT INTO issues (id,engine_id,design_version,part_id,supplier_id,title,type,content,requester_id,request_dept,assigned_depts,created_at,due_date,po_number,status,external_visible,fictional) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,ENGINE,VERSION,pid,sid,req(d.title,'제목',160),type,req(d.content,'문의 내용'),u.id,u.department,JSON.stringify(depts),now(),due,buyer(u)?clean(d.po_number,100):null,'접수',supplier(u)?1:(d.external_visible?1:0),1);
    await audit(db,u,id,'문의 등록','가상 기술협의 등록',{part_id:pid});return json({id},201);
   }
   if(p[0]==='attachments'&&p[1]&&method==='GET'){
    const a=await one(db,'SELECT * FROM attachments WHERE id=?',p[1]);if(!a)fail(404,'첨부파일이 없습니다.');await issueAccess(u,a.issue_id);
    if(supplier(u)&&a.visibility!=='external')fail(404,'첨부파일이 없습니다.');
    const blob=await env.BUCKET.get(a.storage_key);if(!blob)fail(404,'저장된 첨부파일이 없습니다.');
    return new Response(blob.body,{headers:{'Content-Type':a.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'no-store'}});
   }
   if(p[0]!=='issues'||!p[1])fail(404,'지원하지 않는 요청입니다.');
   const id=p[1],issue=await issueAccess(u,id),sub=p[2];
   if(!sub&&method==='GET'){
    const reviews=supplier(u)?[]:await rows(db,'SELECT issue_reviews.*,users.name AS user_name FROM issue_reviews JOIN users ON users.id=issue_reviews.user_id WHERE issue_id=? ORDER BY created_at',id);
    const messages=await rows(db,'SELECT issue_messages.*,users.name AS user_name,users.department AS department FROM issue_messages JOIN users ON users.id=issue_messages.user_id WHERE issue_id=? ORDER BY created_at',id);
    const actions=supplier(u)?[]:await rows(db,'SELECT purchase_actions.*,users.name AS user_name FROM purchase_actions JOIN users ON users.id=purchase_actions.user_id WHERE issue_id=? ORDER BY created_at',id);
    const files=await rows(db,'SELECT id,issue_id,name,mime,bytes,visibility,created_at FROM attachments WHERE issue_id=? ORDER BY created_at',id);
    const logs=supplier(u)?[]:await rows(db,'SELECT audit_logs.*,users.name AS user_name FROM audit_logs JOIN users ON users.id=audit_logs.user_id WHERE issue_id=? ORDER BY created_at',id);
    return json({issue:supplier(u)?externalIssue(issue):issue,reviews,messages:messages.filter(m=>!supplier(u)||m.visibility==='external'),actions,attachments:files.filter(a=>!supplier(u)||a.visibility==='external'),audit:logs});
   }
   if(!sub&&method==='PATCH'){
    const d=await request.json();if(!buyer(u))fail(403,'구매팀만 협의를 수정하거나 상태를 변경할 수 있습니다.');
    const reason=req(d.reason,'변경 사유');
    if(d.assigned_depts){if(!Array.isArray(d.assigned_depts)||d.assigned_depts.some(x=>!DEPTS.includes(x)))fail(400,'검토 부서를 확인하세요.');}
    const target=d.status||issue.status;if(!STATUSES.includes(target))fail(400,'상태를 확인하세요.');
    const transitions={'접수':['담당 부서 지정','보류'],'담당 부서 지정':['검토 중','보류'],'검토 중':['추가 확인 필요','검토 완료','보류'],'추가 확인 필요':['검토 중','보류'],'검토 완료':['협력업체 회신 대기','보류'],'협력업체 회신 대기':['구매 후속 조치 중','추가 확인 필요','보류'],'구매 후속 조치 중':['최종 완료','추가 확인 필요','보류'],'최종 완료':['접수'],'보류':['접수','담당 부서 지정','검토 중']};
    if(target!==issue.status&&!transitions[issue.status]?.includes(target))fail(409,'허용되지 않는 상태 전환입니다.');
    const depts=d.assigned_depts||arr(issue.assigned_depts);
    if(target==='담당 부서 지정'&&!depts.length)fail(409,'검토 부서를 먼저 지정하세요.');
    if(target==='검토 완료'){
     const rr=await rows(db,'SELECT department,status,created_at FROM issue_reviews WHERE issue_id=? ORDER BY created_at',id);
     const latest={};for(const r of rr)latest[r.department]=r.status;
     if(!depts.length||depts.some(dep=>latest[dep]!=='검토 완료'))fail(409,'모든 배정 부서의 검토 완료가 필요합니다.');
    }
    if(target==='협력업체 회신 대기'&&!await one(db,"SELECT id FROM issue_messages WHERE issue_id=? AND kind='final_reply' AND visibility='external'",id))fail(409,'구매팀 최종 회신을 먼저 기록하세요.');
    if(target==='최종 완료'){
     const aa=await rows(db,'SELECT action_type,decision FROM purchase_actions WHERE issue_id=?',id);
     if(ACTIONS.some(t=>!aa.some(a=>a.action_type===t&&a.decision!=='필요')))fail(409,'다섯 가지 구매 후속 조치의 처리 여부를 모두 확인하세요.');
     if(!await one(db,"SELECT id FROM issue_messages WHERE issue_id=? AND kind='final_reply' AND acknowledged_at IS NOT NULL",id))fail(409,'협력업체의 회신 확인이 필요합니다.');
    }
    await run(db,'UPDATE issues SET status=?,assigned_depts=?,external_visible=?,title=?,content=?,due_date=? WHERE id=?',target,JSON.stringify(depts),d.external_visible===undefined?issue.external_visible:(d.external_visible?1:0),d.title?req(d.title,'제목',160):issue.title,d.content?req(d.content,'내용'):issue.content,d.due_date||issue.due_date,id);
    await audit(db,u,id,'협의 변경',reason,{before:issue.status,after:target,assigned_depts:depts});return json({ok:true});
   }
   if(sub==='reviews'&&method==='POST'){
    if(u.role!=='기술부서'||!arr(issue.assigned_depts).includes(u.department))fail(403,'배정된 기술부서만 검토를 작성할 수 있습니다.');
    const d=await request.json();if(!['검토 중','추가 확인 필요','검토 완료'].includes(d.status))fail(400,'검토 상태를 확인하세요.');
    if(['최종 완료','보류'].includes(issue.status))fail(409,'종료 또는 보류 협의에는 검토를 추가할 수 없습니다.');
    await run(db,'INSERT INTO issue_reviews (id,issue_id,user_id,department,created_at,opinion,status) VALUES (?,?,?,?,?,?,?)',uid('REV'),id,u.id,u.department,now(),req(d.opinion,'검토 의견'),d.status);
    await audit(db,u,id,'부서 검토',d.status,{department:u.department});return json({ok:true},201);
   }
   if(sub==='messages'&&method==='POST'){
    const d=await request.json();let visibility=supplier(u)?'external':d.visibility==='external'?'external':'internal';
    if(u.role==='기술부서'&&visibility==='external')fail(403,'외부 최종 회신은 구매팀을 통해 기록하세요.');
    if(u.role==='기술부서'&&!arr(issue.assigned_depts).includes(u.department))fail(403,'배정된 부서만 의견을 기록할 수 있습니다.');
    const kind=buyer(u)&&d.kind==='final_reply'?'final_reply':d.kind==='request_info'?'request_info':'message';
    if(kind==='final_reply'&&visibility!=='external')fail(400,'최종 회신은 외부 공개로 기록해야 합니다.');
    if(kind==='final_reply'&&!['검토 완료','협력업체 회신 대기','구매 후속 조치 중'].includes(issue.status))fail(409,'기술 검토 완료 후 최종 회신을 기록하세요.');
    await run(db,'INSERT INTO issue_messages (id,issue_id,user_id,created_at,content,visibility,kind) VALUES (?,?,?,?,?,?,?)',uid('MSG'),id,u.id,now(),req(d.content,'회신 내용'),visibility,kind);
    await audit(db,u,id,'문의/회신 기록','수동 기록',{visibility,kind});return json({ok:true},201);
   }
   if(sub==='ack'&&method==='POST'){
    if(!supplier(u))fail(403,'해당 협력업체만 수신 확인할 수 있습니다.');
    const d=await request.json();const m=await one(db,"SELECT * FROM issue_messages WHERE id=? AND issue_id=? AND visibility='external' AND kind='final_reply'",d.message_id,id);
    if(!m)fail(404,'확인할 회신이 없습니다.');await run(db,'UPDATE issue_messages SET acknowledged_at=? WHERE id=?',now(),m.id);await audit(db,u,id,'회신 확인','협력업체 수신 확인');return json({ok:true});
   }
   if(sub==='actions'&&method==='POST'){
    if(!buyer(u))fail(403,'구매팀만 후속 조치를 기록할 수 있습니다.');
    const d=await request.json();if(!ACTIONS.includes(d.action_type)||!['완료','해당 없음','필요','불필요'].includes(d.decision))fail(400,'조치 유형과 판단을 확인하세요.');
    if(!['검토 완료','협력업체 회신 대기','구매 후속 조치 중'].includes(issue.status))fail(409,'기술 검토 완료 후 구매 조치를 기록하세요.');
    const existing=await one(db,'SELECT id FROM purchase_actions WHERE issue_id=? AND action_type=?',id,d.action_type);
    if(existing)await run(db,'UPDATE purchase_actions SET user_id=?,decision=?,note=?,created_at=? WHERE id=?',u.id,d.decision,req(d.note,'처리 내용'),now(),existing.id);
    else await run(db,'INSERT INTO purchase_actions (id,issue_id,user_id,action_type,decision,note,created_at) VALUES (?,?,?,?,?,?,?)',uid('ACT'),id,u.id,d.action_type,d.decision,req(d.note,'처리 내용'),now());
    await audit(db,u,id,'구매 후속 조치',d.note,{type:d.action_type,decision:d.decision});return json({ok:true},201);
   }
   if(sub==='attachments'&&method==='POST'){
    if(u.role==='기술부서'&&!arr(issue.assigned_depts).includes(u.department))fail(403,'배정된 부서만 첨부할 수 있습니다.');
    const form=await request.formData(),file=form.get('file');if(!file||typeof file==='string')fail(400,'파일을 선택하세요.');
    const mimes=['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv'];if(!mimes.includes(file.type)||file.size>5*1024*1024||!file.size)fail(400,'PDF/이미지/TXT/CSV, 최대 5MB 파일만 허용됩니다.');
    const visibility=supplier(u)?'external':form.get('visibility')==='external'?'external':'internal';
    if(u.role==='기술부서'&&visibility==='external')fail(403,'기술부서 첨부자료의 외부 공개는 구매팀이 관리합니다.');
    const aid=uid('FILE'),key=id+'/'+aid;await env.BUCKET.put(key,await file.arrayBuffer());
    await run(db,'INSERT INTO attachments (id,issue_id,user_id,name,mime,bytes,storage_key,visibility,created_at) VALUES (?,?,?,?,?,?,?,?,?)',aid,id,u.id,file.name.slice(0,180),file.type,file.size,key,visibility,now());
    await audit(db,u,id,'첨부 등록','자료 추가',{visibility,name:file.name});return json({id:aid},201);
   }
   fail(404,'지원하지 않는 요청입니다.');
  }catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('API failure',e);return json({error:'처리 중 오류가 발생했습니다. 저장 상태를 확인한 뒤 다시 시도하세요.'},500);}
 };
}
