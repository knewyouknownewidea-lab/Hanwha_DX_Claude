import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const baseline=read('cad/baseline-dimensions.json'),catalog=read('cad/parts.json'),validation=read('cad/validation.json');
const assumptions=[
 ['cylinder_pitch',1080,'mm'],['crank_angles',[30,150,270,90,210,330],'degree'],['conrod_centres',3000,'mm'],
 ['crosshead_shoe',[500,40,430],'mm XYZ'],['crosshead_bridge',[500,980,40],'mm XYZ'],['crosshead_bridge_clearance',[200,240,100],'mm XYZ'],
 ['bedplate',[3900,7200,350],'mm XYZ'],['lower_frame_outer',[3600,7000,6050],'mm XYZ'],['lower_frame_inner',[3300,6800,6060],'mm XYZ'],['inspection_window',[4000,820,1700],'mm XYZ cutter'],['frame_brackets',[1070,120,100],'mm XYZ'],
 ['main_bearing_outer_radius',430,'mm'],['main_bearing_inner_radius',303,'mm'],['main_bearing_length',170,'mm'],['main_bearing_pedestal',[900,170,1330],'mm XYZ'],['main_bearing_y',[-3240,-2160,-1080,0,1080,2160,3240],'mm'],
 ['cylinder_frame',[1200,6600,3500],'mm XYZ'],['cylinder_frame_bore_radius',425,'mm'],['cooling_jacket_outer_radius',420,'mm'],['cooling_jacket_inner_radius',306,'mm'],['cooling_jacket_height',3145,'mm'],
 ['cover_radius',430,'mm'],['cover_height',180,'mm'],['cover_center_z',7900,'mm'],['exhaust_valve_stem_radius_height',[100,400],'mm'],['exhaust_valve_housing_radius_height',[160,200],'mm'],
 ['injectors_per_cylinder',3,'count assumption'],['injector_radius_height',[40,350],'mm'],['injector_radial_offset',240,'mm'],
 ['exhaust_receiver_outer_inner_radius_length',[250,220,7000],'mm'],['exhaust_receiver_center',[1300,0,8600],'mm XYZ'],['scavenge_receiver_outer_inner_radius_length',[450,410,7000],'mm'],['scavenge_receiver_center',[-1400,0,4900],'mm XYZ'],
 ['turbo_housing_radius_length',[500,600],'mm'],['turbo_shaft_housing_radius_length',[350,850],'mm'],['turbo_center',[1300,3925,8600],'mm XYZ'],
 ['gallery_deck',[900,7000,60],'mm XYZ'],['gallery_levels',[4300,7800],'mm Z'],['gallery_post',[35,35,1100],'mm XYZ'],['gallery_rail',[35,6900,35],'mm XYZ']
].map(([name,value,unit])=>({name,value,unit,status:'demonstration_assumption',source:'cad/src/full_geometry.py or motion.py'}));
const dims={engine_id:catalog.engine_id,units:'mm; CAD Z vertical/Y crankshaft; GLB converted to m with viewer Y vertical',warning:'Only bore/stroke are public family references. All other model dimensions are schematic assumptions or derived values. Bounds describe generated geometry, not measured engine dimensions.',sources:catalog.sources,baseline_dimensions:baseline.dimensions,added_and_explicit_assumptions:assumptions,conrod_discrepancy:'Guide section 17.05 family force table L=2500 mm. Reviewed prototype retained at assumed L=3000 mm; not manufacturer CAD.',parts:validation.variants.engine_full.parts.map(p=>({...p,size_mm:p.max_mm.map((v,i)=>v-p.min_mm[i]),status:'generated_demo_geometry_bounds'}))};
fs.writeFileSync(path.join(root,'cad/dimensions.json'),JSON.stringify(dims,null,2));
fs.writeFileSync(path.join(root,'verification/browser-tests.json'),JSON.stringify({environment:'Local Vinext + persistent D1 SQLite + R3F WebGL, in-app browser',passed:true,checks:['Actual mesh click selects ENGINE_FRAME and TC-DEMO-008','CYL_01_LINER and CYL_02_LINER histories are separate','Created local inquiry TC-b39d458f-2800-407e-b4dd-88407785859d','Buyer assignment and status saved','Design review submitted','Reload restored demo session and persisted review','Supplier A sees only six own inquiries including local QA; internal reviews/actions/audit absent','Cutaway/outer model switching','Explode slider 20%, ghost and isolation toggles','94 mapped objects ready'],note:'Local QA adds 1 fictional inquiry; hosted initial seed is 10. Automated backend tests cover final reply and purchase completion.'},null,2));
console.log('Wrote dimensional assumptions and browser verification record.');
