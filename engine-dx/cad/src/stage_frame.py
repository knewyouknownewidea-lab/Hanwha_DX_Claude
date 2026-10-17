from cadgen import step
from full_geometry import assembly
@step(out='../STEP/stage_frame.step')
def stage_frame():return assembly(stage='frame')
if __name__=='__main__':stage_frame()
