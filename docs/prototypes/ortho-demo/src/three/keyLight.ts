import { Vector3, type Camera, type DirectionalLight } from 'three'

const v = new Vector3()
/** Aim a directional light from the camera's upper-left-front (camera space (−0.55, 0.75, 1)). */
export function aimKeyLight(light: DirectionalLight, camera: Camera) {
  v.set(-0.55, 0.75, 1).applyQuaternion(camera.quaternion).normalize().multiplyScalar(1000)
  light.position.copy(v)
  light.target.position.set(0, 0, 0)
  light.updateMatrixWorld()
  light.target.updateMatrixWorld()
}
