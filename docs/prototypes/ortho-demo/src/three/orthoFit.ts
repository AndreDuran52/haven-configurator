import { Vector3 } from 'three'

// ---------------------------------------------------------------------------------------
// Presets. Angles use camera-controls' spherical convention:
//   azimuth θ = atan2(x, z)  (0 = camera on +z = the OPEN END of the U, looking at the back)
//   elevation e above the floor plane; polar φ = 90° − e.
// Camera up is always world +y (camera-controls requirement). For the top view that makes
// screen-up = −z = plan "back", screen-right = +x — i.e. exactly the SVG plan orientation.

import type { PresetDef } from './presets'
export { PRESETS, ISO_ELEVATION, type PresetDef, type PresetName } from './presets'

const D2R = Math.PI / 180

/** Unit vector from the target toward the camera. */
export function presetDirection(p: PresetDef): Vector3 {
  const th = p.azimuthDeg * D2R
  const e = p.elevationDeg * D2R
  return new Vector3(Math.sin(th) * Math.cos(e), Math.sin(e), Math.cos(th) * Math.cos(e)).normalize()
}

/**
 * Orthonormal screen basis for a view direction, matching what camera-controls produces
 * with camera.up = +y (for the pole: θ = 0 ⇒ screen-up = −z).
 */
export function screenBasis(dir: Vector3, azimuthDeg = 0): { right: Vector3; up: Vector3; back: Vector3 } {
  const back = dir.clone().normalize()
  let right: Vector3
  if (Math.abs(back.y) > 0.999999) {
    const th = azimuthDeg * D2R
    right = new Vector3(Math.cos(th), 0, -Math.sin(th)) // θ = 0 → +x
  } else {
    right = new Vector3(0, 1, 0).cross(back).normalize()
  }
  const up = back.clone().cross(right).normalize()
  return { right, up, back }
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface OrthoFit {
  target: Vector3
  /** CSS px per inch (R3F's default ortho frustum is sized in CSS px, so zoom == px/in). */
  zoom: number
  /** projected extents in inches along screen right/up */
  spanU: number
  spanV: number
}

/**
 * Tight orthographic fit: project every silhouette point onto the screen basis, take the
 * extents, and pick zoom so the extents fill the viewport minus `pad` CSS px on each side.
 * Unlike camera-controls.fitToBox this (a) keeps the requested angle (fitToBox rounds θ/φ
 * to the nearest 90°), (b) pads in pixels instead of world units, and (c) fits the real
 * points instead of an AABB, which for an axonometric view of a U is ~10–20% tighter.
 */
export function fitOrtho(points: ReadonlyArray<readonly [number, number, number]>, preset: PresetDef, viewW: number, viewH: number, pad: Insets): OrthoFit {
  const dir = presetDirection(preset)
  const { right, up, back } = screenBasis(dir, preset.azimuthDeg)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, w0 = Infinity, w1 = -Infinity
  const p = new Vector3()
  for (const [x, y, z] of points) {
    p.set(x, y, z)
    const u = p.dot(right)
    const v = p.dot(up)
    const w = p.dot(back)
    if (u < u0) u0 = u
    if (u > u1) u1 = u
    if (v < v0) v0 = v
    if (v > v1) v1 = v
    if (w < w0) w0 = w
    if (w > w1) w1 = w
  }
  const spanU = Math.max(u1 - u0, 1e-3)
  const spanV = Math.max(v1 - v0, 1e-3)
  const availW = Math.max(viewW - pad.left - pad.right, 1)
  const availH = Math.max(viewH - pad.top - pad.bottom, 1)
  const zoom = Math.min(availW / spanU, availH / spanV)
  // centre of the padded area, expressed as a shift of the target in inches
  const uc = (u0 + u1) / 2 - (pad.left - pad.right) / (2 * zoom)
  const vc = (v0 + v1) / 2 - (pad.bottom - pad.top) / (2 * zoom)
  const wc = (w0 + w1) / 2
  const target = right.clone().multiplyScalar(uc).addScaledVector(up, vc).addScaledVector(back, wc)
  return { target, zoom, spanU, spanV }
}

/** Uniform padding rule: 6% of the short side, clamped to [20, 64] CSS px. */
export function defaultPadding(viewW: number, viewH: number): Insets {
  const p = Math.round(Math.min(64, Math.max(20, 0.06 * Math.min(viewW, viewH))))
  return { top: p, right: p, bottom: p, left: p }
}

/** Shortest-path azimuth: returns an angle equivalent to `to` that is within ±π of `from`. */
export function nearestAngle(from: number, to: number): number {
  const TWO_PI = Math.PI * 2
  let d = (to - from) % TWO_PI
  if (d > Math.PI) d -= TWO_PI
  if (d < -Math.PI) d += TWO_PI
  return from + d
}
