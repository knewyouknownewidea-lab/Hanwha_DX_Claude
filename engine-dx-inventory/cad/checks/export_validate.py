import json,sys,struct,hashlib,math
from pathlib import Path
from itertools import combinations
from cadgen import read_scene
from cadgen.geometry import overlap_volume,closest_points
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from full_geometry import objects
catalog=[{k:v for k,v in p.items() if k!='shape'} for p in objects()]
lookup={p['id']:p for p in catalog};assert len(lookup)==len(catalog)
def linear(h):
    rgb=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
report={'parts':len(catalog),'variants':{},'collision_pairs':[],'overlap_limit_mm3':.01,'failures':[]}
for stem in ['engine_full','engine_cutaway']:
    path=ROOT/'STEP'/f'{stem}.step';scene=read_scene(path);leaves=list(scene.leaves())
    labels=[p.label for p in leaves]
    assert sorted(labels)==sorted(lookup),(stem,len(labels),set(labels)-set(lookup),set(lookup)-set(labels))
    shapes={p.label:p.shape() for p in leaves};info=[]
    for pid,s in shapes.items():
        assert s.is_valid and len(s.solids())==1 and s.volume>0,(stem,pid,len(s.solids()))
        b=s.bounding_box();info.append({'id':pid,'volume_mm3':s.volume,'min_mm':list(b.min),'max_mm':list(b.max)})
    if stem=='engine_full':
        boxes={p:s.bounding_box() for p,s in shapes.items()};exact=0;excluded=0
        for a,b in combinations(lookup,2):
            aa,bb=boxes[a],boxes[b]
            if min(min(getattr(aa.max,k),getattr(bb.max,k))-max(getattr(aa.min,k),getattr(bb.min,k)) for k in ['X','Y','Z']) < -1e-5:excluded+=1;continue
            v=sum(overlap_volume(sa,sb) for sa in shapes[a].solids() for sb in shapes[b].solids());exact+=1
            if v>.01:report['failures'].append({'a':a,'b':b,'overlap_mm3':v})
        report['collision_pairs']={'total':len(lookup)*(len(lookup)-1)//2,'exact':exact,'excluded_by_bounds':excluded}
        crank=shapes['ENGINE_CRANKSHAFT'];assert len(crank.solids())==1
        report['crankshaft']={'single_continuous_solid':True,'volume_mm3':crank.volume,'source':'6 fused saved STEP sections'}
    gp=ROOT/'GLB'/f'{stem}.glb';data=gp.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);tail=data[20+n:]
    assert len(doc['nodes'])==len(catalog),(stem,len(doc['nodes']),len(catalog))
    matched=[]
    for node in doc['nodes']:
        mesh=doc['meshes'][node['mesh']]; colors=[doc['materials'][p['material']]['pbrMetallicRoughness']['baseColorFactor'][:3] for p in mesh['primitives']]
        ids=[p['id'] for p in catalog if all(max(abs(a-b) for a,b in zip(linear(p['color']),v))<1e-5 for v in colors)]
        assert len(ids)==1,ids
        pid=ids[0];b=shapes[pid].bounding_box();expected=[b.min.X/1000,b.min.Z/1000,-b.max.Y/1000,b.max.X/1000,b.max.Z/1000,-b.min.Y/1000]
        pos=[doc['accessors'][p['attributes']['POSITION']] for p in mesh['primitives']]
        actual=[min(p['min'][k] for p in pos) for k in range(3)]+[max(p['max'][k] for p in pos) for k in range(3)]
        error=max(abs(a-b) for a,b in zip(expected,actual))*1000;assert error<3,(pid,error)
        node['name']=pid;mesh['name']=pid;node.setdefault('extras',{}).update({'part_instance_id':pid,'part_type_id':pid[7:] if pid.startswith('CYL_') else pid,'cylinder':lookup[pid]['cylinder']})
        matched.append({'id':pid,'node_index':doc['nodes'].index(node),'bounds_error_mm':error})
    assert sorted(p['id'] for p in matched)==sorted(lookup)
    raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
    gp.write_bytes(struct.pack('<III',0x46546c67,2,20+len(raw)+len(tail))+struct.pack('<II',len(raw),0x4e4f534a)+raw+tail)
    report['variants'][stem]={'parts':info,'glb_mapping':matched,'geometry_buffers_unchanged':True}
for p in catalog:
    p['part_instance_id']=p['id'];p['part_type_id']=p['id'][7:] if p['id'].startswith('CYL_') else p['id']
    p['geometry_status']='시연용 단순화';p['legacy_ids']=[p['old_id']] if p['old_id'] else []
catalog[0]['legacy_ids']=[f'CRANK_SECTION_{i:02d}' for i in range(1,7)]
result={'model':'6G50ME-C9.6','version':'DEMO-CAD-2.0','units':{'CAD':'mm','GLB':'m'},'parts':catalog,
 'public_dimensions':{'bore_mm':500,'stroke_mm':2500},'sources':json.loads((ROOT/'baseline-dimensions.json').read_text(encoding='utf8'))['sources'],
 'assumptions':['Cylinder pitch 1080 mm; phases [30,150,270,90,210,330] not confirmed firing order.',
 'Reuse demonstration conrod length 3000 mm; guide force table lists family L=2500 mm but not applied to preserve reviewed prototype.',
 'All added frame, cover, bearing support, receiver, turbocharger and gallery dimensions are demonstration assumptions.',
 'Bearings 303 mm bore radius around 300 mm journals; virtual clearance, not manufacturing tolerance.',
 'No claim of exact manufacturer CAD, no ERP/MES/PLM integration.']}
(ROOT/'parts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'parts':len(catalog),'interferences':report['failures'],'pair_counts':report['collision_pairs']},ensure_ascii=False,indent=2))
assert not report['failures']
