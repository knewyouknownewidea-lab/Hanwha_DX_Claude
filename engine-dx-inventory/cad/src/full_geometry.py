"""Reuse saved motion STEP. Exterior is deliberately schematic, dimensions mm."""
from __future__ import annotations
from pathlib import Path
import math,colorsys
from cadgen import read_scene, build123d as bd,srgb
from motion import PHASES,PITCH,pose
ROOT=Path(__file__).resolve().parents[1]

def cy(r,length):return bd.Cylinder(r,length,rotation=(90,0,0))
def box(x,y,z,at):return bd.Box(x,y,z).moved(bd.Location(at))
def cyl(r,h,at):return bd.Cylinder(r,h).moved(bd.Location(at))

def objects(stage='full',cutaway=False):
    source=read_scene(ROOT/'inputs/motion.step')
    old={p.label:p.shape() for p in source.leaves()}
    out=[]
    def add(shape,pid,name,group,cylinder=None,old_id=None):
        out.append({'shape':shape,'id':pid,'name_ko':name,'group':group,'cylinder':cylinder,'old_id':old_id})
    cranks=[old[f'CRANK_SECTION_{i:02d}'] for i in range(1,7)]
    crank=cranks[0]
    for s in cranks[1:]:crank=crank+s
    add(crank,'ENGINE_CRANKSHAFT','공통 크랭크축','운동부')
    roles=[('LINER','라이너'),('PISTON','피스톤'),('PISTON_ROD','피스톤 로드'),
           ('CROSSHEAD_PIN','크로스헤드 핀'),('CROSSHEAD_BRG','크로스헤드 베어링'),('CONROD','커넥팅로드')]
    for i,theta in enumerate(PHASES,1):
        tag=f'CYL_{i:02d}';y=(i-3.5)*PITCH; _,_,h,_=pose(theta)
        for role,name in roles:
            shape=old[f'{role}_{i:02d}']
            if cutaway and role=='LINER':shape=shape-box(1000,1100,4000,(500,y,6150))
            add(shape,f'{tag}_{role}',name,'실린더' if role=='LINER' else '운동부',i,f'{role}_{i:02d}')
        shoes=[box(500,40,430,(0,y+s*470,h)) for s in (-1,1)]
        bridge=box(500,980,40,(0,y,h+225))-box(200,240,100,(0,y,h+225))
        add(shoes[0]+shoes[1]+bridge,f'{tag}_CROSSHEAD','크로스헤드 가이드 슈 및 요크','운동부',i)
    if stage!='motion':
        add(box(3900,7200,350,(0,0,-1925)),'ENGINE_BEDPLATE','베드플레이트','구조물')
        frame=box(3600,7000,6050,(0,0,1275))-box(3300,6800,6060,(0,0,1275))
        # Large inspection windows: shell retained for overall structural context.
        for i in range(6):frame=frame-box(4000,820,1700,(0,(i-2.5)*PITCH,1700))
        for i in range(6):
            for sign in (-1,1):frame=frame+box(1070,120,100,(sign*1135,(i-2.5)*PITCH,4250))
        if cutaway:frame=frame-box(2000,8000,7000,(1000,0,1300))
        add(frame,'ENGINE_FRAME','하부 프레임','구조물')
        for j,y in enumerate([-3240,-2160,-1080,0,1080,2160,3240],1):
            shell=(cy(430,170)-cy(303,180)) & box(1000,1000,500,(0,0,-250))
            support=shell+box(900,170,1330,(0,0,-1085))
            add(support.moved(bd.Location((0,y,0))),f'ENGINE_MAIN_BEARING_{j:02d}','주베어링 및 지지대','하부')
    if stage in ['upper','full']:
        cf=box(1200,6600,3500,(0,0,6050))
        for i in range(1,7):cf=cf-cyl(425,3520,(0,(i-3.5)*PITCH,6050))
        if cutaway:cf=cf-box(800,7200,4000,(400,0,6050))
        add(cf,'ENGINE_CYLINDER_FRAME','실린더 프레임','구조물')
        for i in range(1,7):
            y=(i-3.5)*PITCH;tag=f'CYL_{i:02d}'
            jacket=cyl(420,3145,(0,y,6177.5))-cyl(306,3160,(0,y,6177.5))
            if cutaway:jacket=jacket-box(1000,1100,3600,(500,y,6150))
            add(jacket,tag+'_COOLING_JACKET','냉각 재킷','실린더',i)
            add(cyl(430,180,(0,y,7900)),tag+'_COVER','실린더 커버','상부',i)
            valve=cyl(100,400,(0,y,8190))+cyl(160,200,(0,y,8490))
            add(valve,tag+'_EXHAUST_VALVE','배기밸브','상부',i)
            for k in range(3):
                ang=2*math.pi*k/3
                inj=cyl(40,350,(240*math.cos(ang),y+240*math.sin(ang),8165))
                add(inj,f'{tag}_FUEL_INJECTOR_{k+1:02d}','연료분사장치 외형','상부',i)
        er=(cy(250,7000)-cy(220,7010)).moved(bd.Location((1300,0,8600)))
        add(er,'ENGINE_EXHAUST_RECEIVER','공통 배기 리시버','보조장치')
        scav=(cy(450,7000)-cy(410,7010)).moved(bd.Location((-1400,0,4900)))
        add(scav,'ENGINE_SCAVENGE_RECEIVER','소기 공기 리시버','보조장치')
    if stage=='full':
        turbo=(cy(500,600)+cy(350,850)).moved(bd.Location((1300,3925,8600)))
        # Trim at receiver end plane so housing and receiver contact without overlap.
        turbo=turbo-box(2400,1000,2000,(1300,3000,8600))
        add(turbo,'ENGINE_TURBOCHARGER','터보차저 외형','보조장치')
        for label,z in [('LOWER',4300),('UPPER',7800)]:
            gallery=box(900,7000,60,(2250,0,z+30))
            for x in (1830,2670):
                for y in (-3400,-2000,0,2000,3400):
                    gallery=gallery+box(35,35,1100,(x,y,z+610))
                gallery=gallery+box(35,6900,35,(x,0,z+1142.5))
            add(gallery,'ENGINE_GALLERY_'+label,'유지보수 갤러리 '+label,'외부설비')
    # Color is unique per selectable occurrence, preventing GLB material batching.
    for n,item in enumerate(out):
        hue={'운동부':0.59,'실린더':0.46,'상부':0.45,'구조물':0.39,'하부':0.57,'보조장치':0.41,'외부설비':0.34}[item['group']]
        rgb=colorsys.hls_to_rgb((hue+n*0.0007)%1,0.42+(n%8)*0.012,0.25)
        # Encode occurrence in one channel; check uniqueness in export validation.
        rgb=[round(v*255) for v in rgb];rgb[2]=min(250,50+n)
        color='#'+''.join(f'{v:02x}' for v in rgb)
        item['color']=color;item['shape'].label=item['id'];item['shape'].color=srgb(color)
    return out

def assembly(stage='full',cutaway=False):
    return bd.Compound(children=[p['shape'] for p in objects(stage,cutaway)],label='ENGINE_6G50MEC96_FULL_DEMO')
