import { Vector3, type Camera, type DirectionalLight } from 'three';

const v = new Vector3();

/**
 * Camera-relative key light (plan §7.3): always from the view's upper-left-front
 * (camera space (−0.55, 0.75, 1)), re-aimed every frame and for export cameras.
 * A fixed world light made the side elevation look grey.
 */
export function aimKeyLight(light: DirectionalLight, camera: Camera): void {
  v.set(-0.55, 0.75, 1).applyQuaternion(camera.quaternion).normalize().multiplyScalar(1000);
  light.position.copy(v);
  light.target.position.set(0, 0, 0);
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
}
