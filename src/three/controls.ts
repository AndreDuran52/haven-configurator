import { CameraControlsImpl } from '@react-three/drei';

/**
 * With frameloop="demand", R3F hands useFrame the raw clock delta: after the
 * view has idled, the first frame of a tween gets a delta of seconds and
 * camera-controls' smoothDamp jumps nearly to the end (plan §7.1, measured
 * 98.6 %). This subclass treats the first update after rest as one 60 Hz frame
 * and caps later deltas at 100 ms.
 */
export class DemandSafeCameraControls extends CameraControlsImpl {
  private resting = true;
  override update(delta: number): boolean {
    const moved = super.update(this.resting ? 1 / 60 : Math.min(delta, 0.1));
    this.resting = !moved;
    return moved;
  }
}
