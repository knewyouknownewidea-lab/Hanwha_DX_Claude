from cadgen import step,glb
from full_geometry import assembly
@step(out='../STEP/engine_cutaway.step')
@glb(out='../GLB/engine_cutaway.glb',mesh_tolerance=0.0003,mesh_angular_tolerance=0.15)
def engine_cutaway():return assembly(cutaway=True)
if __name__=='__main__':engine_cutaway()
