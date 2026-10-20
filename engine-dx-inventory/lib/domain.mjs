export const ENGINE='HANWHA_6G50_DEMO';
export const VERSION='DEMO-CAD-2.0';
export const DEPTS=['설계팀','가공팀','품질팀','생산팀'];
export const STATUSES=['접수','담당 부서 지정','검토 중','추가 확인 필요','검토 완료','협력업체 회신 대기','구매 후속 조치 중','최종 완료','보류'];
export const TYPES=['제작 가능 여부','가공 조건 검토','설계 사양 확인','설계변경 검토','입고 품질 문제','검사기준 확인','납품 부품의 기술적 문의'];
export const ACTIONS=['협력업체 최종 회신','발주 변경 필요 여부','기존 발주분 적용 여부','추가 견적 요청 여부','품질 관련 후속 확인'];
export const DEMO_USERS=[
 {id:'buyer',name:'김구매',role:'구매팀',department:'구매팀'},
 {id:'design',name:'이설계',role:'기술부서',department:'설계팀'},
 {id:'machining',name:'박가공',role:'기술부서',department:'가공팀'},
 {id:'quality',name:'최품질',role:'기술부서',department:'품질팀'},
 {id:'production',name:'정생산',role:'기술부서',department:'생산팀'},
 {id:'supplier-a',name:'가상 A 담당자',role:'협력업체',department:'가상협력사 A',supplier_id:'SUP-DEMO-A'},
 {id:'supplier-b',name:'가상 B 담당자',role:'협력업체',department:'가상협력사 B',supplier_id:'SUP-DEMO-B'}];
export const SUPPLIERS=[{id:'SUP-DEMO-A',name:'가상협력사 A',evidence:'시연용 가상 업체 · 실제 공급관계 미확인',families:'G50ME-C9 계열 시연',part_types:'가상 공급범위: 전 부품군'},
 {id:'SUP-DEMO-B',name:'가상협력사 B',evidence:'시연용 가상 업체 · 실제 공급관계 미확인',families:'G50ME-C9 계열 시연',part_types:'가상 공급범위: 전 부품군'}];
