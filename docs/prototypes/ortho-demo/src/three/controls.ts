import { CameraControlsImpl } from '@react-three/drei'

/**
 * With frameloop="demand", R3F hands useFrame the raw clock delta — after the view has been
 * idle for a few seconds the first frame of a preset transition gets delta ≈ seconds, and
 * camera-controls' smoothDamp jumps (almost) straight to the end: the "animation" snaps.
 * drei's <Bounds> works around the same problem internally. This subclass treats the first
 * update after rest as a normal 60 Hz frame and caps later deltas at 100 ms.
 * Pass it to drei via <CameraControls impl={DemandSafeCameraControls} />.
 */
export class DemandSafeCameraControls extends CameraControlsImpl {
  static clampEnabled = true
  private resting = true
  override update(delta: number): boolean {
    const d = DemandSafeCameraControls.clampEnabled ? (this.resting ? 1 / 60 : Math.min(delta, 0.1)) : delta
    const moved = super.update(d)
    this.resting = !moved
    return moved
  }
}
