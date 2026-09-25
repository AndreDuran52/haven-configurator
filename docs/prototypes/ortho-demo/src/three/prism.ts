import { BufferGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Vec2 } from '../haven/standardU'

/**
 * A plan polygon extruded from z0 to z1 (heights, inches) with rounded edges of radius r.
 * The OUTER boundary equals the polygon exactly (bevelOffset = −r pulls the bevel inside),
 * so the top-view silhouette matches the SVG plan to the inch — the parity property.
 *
 * ExtrudeGeometry extrudes shape XY along +Z. rotateX(+π/2) maps (x, y, e) → (x, −e, y), i.e.
 * plan y → three z and extrusion → −y; the translate puts the prism on [z0, z1].
 * Works for convex polygons (all Haven parts are rectangles or the §8 wedge pentagon).
 */
export function roundedPrism(poly: Vec2[], z0: number, z1: number, r: number, bevelSegments = 3): BufferGeometry {
  const h = z1 - z0
  let minEdge = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    minEdge = Math.min(minEdge, Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const rr = Math.max(0, Math.min(r, h / 2 - 0.01, minEdge / 2 - 0.01))
  const shape = new Shape(poly.map(([x, y]) => new Vector2(x, y)))
  const geo = new ExtrudeGeometry(shape, {
    depth: h - 2 * rr,
    bevelEnabled: rr > 0,
    bevelThickness: rr,
    bevelSize: rr,
    bevelOffset: -rr,
    bevelSegments,
    curveSegments: 1,
    steps: 1,
  })
  geo.rotateX(Math.PI / 2)
  geo.translate(0, z0 + h - rr, 0)
  const creased = toCreasedNormals(geo, Math.PI / 5)
  geo.dispose()
  creased.computeBoundingBox()
  return creased
}

/** Sharp (non-beveled) prism of the same footprint — used as the proxy for <Edges> line art. */
export function sharpPrism(poly: Vec2[], z0: number, z1: number): BufferGeometry {
  const shape = new Shape(poly.map(([x, y]) => new Vector2(x, y)))
  const geo = new ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1, steps: 1 })
  geo.rotateX(Math.PI / 2)
  geo.translate(0, z1, 0)
  return geo
}
