"""Demonstration geometry only. All lengths mm. Not manufacturer design data."""
from __future__ import annotations
import math
from cadgen import build123d as bd, srgb

BORE = 500.0
STROKE = 2500.0
R = STROKE / 2
L = 3000.0  # assumed conrod center distance
THETA = 30.0  # demonstration crank angle from +Z
PX = R * math.sin(math.radians(THETA))
PZ = R * math.cos(math.radians(THETA))
DZ = math.sqrt(L**2 - PX**2)
CZ = PZ + DZ
TILT = math.degrees(math.atan2(-PX, DZ))
PISTON_BASE = CZ + 2880.0
IDS = ['LINER_01','PISTON_01','PISTON_ROD_01','CROSSHEAD_PIN_01',
       'CROSSHEAD_BRG_01','CONROD_01','CRANK_SECTION_01']
COLORS = ['#69A99C','#E9A84B','#C7CED8','#7499C7','#D6B46D','#7994AD','#596779']

def cy(radius, length):
    return bd.Cylinder(radius, length, rotation=(90,0,0))

PITCH = 1080.0  # demonstration assumption, not a certified cylinder pitch
PHASES = [30,150,270,90,210,330]  # assumed crank geometry, not verified firing order

def color_for(role_index,cylinder_index):
    # cadgen's GLB writer batches equal colors; unique shades preserve part nodes.
    h=COLORS[role_index]
    rgb=[min(255,int(h[k:k+2],16)+(cylinder_index-1)*3) for k in (1,3,5)]
    return '#'+''.join(f'{v:02x}' for v in rgb)

def pose(theta):
    px=R*math.sin(math.radians(theta)); pz=R*math.cos(math.radians(theta))
    dz=math.sqrt(L**2-px**2)
    return px,pz,pz+dz,math.degrees(math.atan2(-px,dz))

def parts(cutaway=False, exploded=False, index=1, theta=30):
    PX,PZ,CZ,TILT=pose(theta)
    PISTON_BASE=CZ+2880
    def place_link(shape):
        return shape.rotate(bd.Axis.Y,TILT).moved(bd.Location((PX,0,PZ)))
    liner = (bd.Cylinder(305,3300)-bd.Cylinder(250,3310)).moved(bd.Location((0,0,6150)))
    flange=(bd.Cylinder(350,100)-bd.Cylinder(250,110)).moved(bd.Location((0,0,4550)))
    liner=liner+flange
    if cutaway:
        liner=liner-bd.Box(1000,1000,4000).moved(bd.Location((0,-500,6150)))
    piston=bd.Cylinder(249,400).moved(bd.Location((0,0,PISTON_BASE+200)))
    # Four schematic ring grooves; ring inserts and internal cooling omitted.
    for offset in (240,280,320,360):
        groove=(bd.Cylinder(252,10)-bd.Cylinder(244,12)).moved(bd.Location((0,0,PISTON_BASE+offset)))
        piston=piston-groove
    # Foot conforms to pin top, rather than intersecting its material.
    shaft=bd.Cylinder(80,2680).moved(bd.Location((0,0,CZ+200+1340)))
    foot=bd.Box(180,200,70).moved(bd.Location((0,0,CZ+195)))
    rod=(shaft+foot)-cy(180,920).moved(bd.Location((0,0,CZ)))
    pin=cy(180,900).moved(bd.Location((0,0,CZ)))
    # A lower half-shell and open saddle are deliberate schematic simplifications.
    shell=cy(225,520)-cy(181,530)
    shell=shell & bd.Box(800,800,500).moved(bd.Location((0,0,-250)))
    bearing=place_link(shell.moved(bd.Location((0,0,L))))
    upper=(cy(290,560)-cy(226,570)) & bd.Box(800,800,500).moved(bd.Location((0,0,-250)))
    upper=upper.moved(bd.Location((0,0,L)))
    lower=cy(350,500)-cy(251,520)
    beam=bd.Box(260,220,L-350).moved(bd.Location((0,0,L/2-25)))
    conrod=upper+lower+beam
    conrod=conrod-cy(251,580)-cy(226,580).moved(bd.Location((0,0,L)))
    conrod=place_link(conrod)
    # Adjacent selectable crank sections meet at the main journal mid-planes.
    crank=cy(250,650).moved(bd.Location((PX,0,PZ)))
    for sign in (-1,1):
        web=cy(370,140)+cy(370,140).moved(bd.Location((0,0,R)))
        web=web+bd.Box(740,140,R).moved(bd.Location((0,0,R/2)))
        web=web.rotate(bd.Axis.Y,theta).moved(bd.Location((0,sign*375,0)))
        journal=cy(300,105).moved(bd.Location((0,sign*487.5,0)))
        crank=crank+web+journal
    objects=[liner,piston,rod,pin,bearing,conrod,crank]
    offsets=[(-1800,0,0),(900,0,650),(1300,0,0),(-900,0,0),(-1500,0,-350),(1000,0,0),(0,0,-800)]
    result=[]
    for i,(obj,pid,col) in enumerate(zip(objects,IDS,COLORS)):
        if exploded: obj=obj.moved(bd.Location(offsets[i]))
        spacing=1500 if exploded else PITCH
        obj=obj.moved(bd.Location((0,(index-3.5)*spacing,0)))
        obj.label=pid[:-2]+f'{index:02d}'
        obj.color=srgb(color_for(i,index))
        result.append(obj)
    return result

def assembly(cutaway=False,exploded=False):
    # Flat physical occurrences let the native Explode tool move individual parts.
    # Logical CYLINDER_01..06 membership remains explicit in parts.json.
    objects=[obj for i,theta in enumerate(PHASES) for obj in parts(cutaway,exploded,i+1,theta)]
    return bd.Compound(children=objects,label='ENGINE_6G50MEC96_PROTO')
