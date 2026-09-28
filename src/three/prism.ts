// Parts -> three geometry (plan §7.4 "roundedPrism construction").
import { BufferGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pt } from '@/engine';

const CREASE = Math.PI / 5;
const BEVEL_SEGMENTS = 4; // 3 shows facets at 20 px/in

/**
 * A plan polygon extruded from z0 to z1 (heights, inches) with rounded edges of
 * radius r. bevelOffset = −r pulls the bevel INSIDE, so the side walls sit
 * exactly on the polygon and the Top silhouette equals the SVG plan (parity).
 * rotateX(+π/2) maps shape (x, y, e) -> (x, −e, y): plan y -> three z.
 */
export function roundedPrism(poly: Pt[], z0: number, z1: number, r: number): BufferGeometry {
  const h = z1 - z0;
  let minEdge = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    minEdge = Math.min(minEdge, Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const rr = Math.max(0, Math.min(r, h / 2 - 0.01, minEdge / 2 - 0.01));
  const geo = new ExtrudeGeometry(new Shape(poly.map(([x, y]) => new Vector2(x, y))), {
    depth: h - 2 * rr,
    bevelEnabled: rr > 0,
    bevelThickness: rr,
    bevelSize: rr,
    bevelOffset: -rr,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: 1,
    steps: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, z0 + h - rr, 0);
  return finish(geo);
}

function finish(geo: BufferGeometry): BufferGeometry {
  const creased = toCreasedNormals(geo, CREASE);
  geo.dispose();
  creased.computeBoundingBox();
  return creased;
}
