from cadgen import step,glb
from full_geometry import assembly
@step(out='../STEP/engine_full.step')
@glb(out='../GLB/engine_full.glb',mesh_tolerance=0.0003,mesh_angular_tolerance=0.15)
def engine_full():return assembly()
if __name__=='__main__':engine_full()
