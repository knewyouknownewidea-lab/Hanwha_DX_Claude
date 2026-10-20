from cadgen import step
from full_geometry import assembly
@step(out='../STEP/stage_upper.step')
def stage_upper():return assembly(stage='upper')
if __name__=='__main__':stage_upper()
