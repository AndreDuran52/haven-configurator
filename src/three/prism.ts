// Parts -> three geometry (plan §7.4 "roundedPrism construction").
import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Matrix4, Shape, Vector2 } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pt } from '@/engine';
import type { CrownPart } from './parts';

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

/**
 * The crowned seat cushion (plan §7.4, required in H3): its side profile (s
 * along the run, height) rises from `edge` at the ends to `crown` mid-span and
 * is extruded across the run's depth t. The footprint stays exact, so Top
 * parity holds, and Front matches the shop sheet's vector elevation.
 */
export function crownedCushion(c: CrownPart, segments = 16): BufferGeometry {
  const len = c.s1 - c.s0;
  const depth = c.t1 - c.t0;
  const rr = Math.max(0, Math.min(c.r, depth / 2 - 0.01, len / 2 - 0.01, (c.edge - c.z0) / 2 - 0.01));
  const pts = [new Vector2(0, c.z0), new Vector2(len, c.z0)];
  for (let i = 0; i <= segments; i++) {
    const u = len * (1 - i / segments);
    const k = (2 * u) / len - 1;
    pts.push(new Vector2(u, c.edge + (c.crown - c.edge) * (1 - k * k)));
  }
  const geo = new ExtrudeGeometry(new Shape(pts), {
    depth: depth - 2 * rr,
    bevelEnabled: rr > 0,
    bevelThickness: rr,
    bevelSize: rr,
    bevelOffset: -rr,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, rr); // local: x = s from s0, y = height, z = t from t0 (0..depth)
  // local -> three world-before-offset (x = plan x, y = height, z = plan y)
  const m = new Matrix4();
  const [ox, oy] = c.origin;
  if (c.run === 'back') m.makeTranslation(ox + c.s0, 0, c.t0);
  else if (c.run === 'right') m.set(0, 0, -1, c.W - c.t0, 0, 1, 0, 0, 1, 0, 0, oy + c.s0, 0, 0, 0, 1);
  else m.set(0, 0, 1, c.t0, 0, 1, 0, 0, 1, 0, 0, oy + c.s0, 0, 0, 0, 1);
  geo.applyMatrix4(m);
  if (m.determinant() < 0) flipWinding(geo);
  return finish(geo);
}

/** A mirroring transform turns faces inside out; swap two corners of every triangle. */
function flipWinding(geo: BufferGeometry): void {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of ['position', 'normal', 'uv'] as const) {
    const a = g.getAttribute(name) as BufferAttribute | undefined;
    if (!a) continue;
    const n = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = a.array[i1]!;
        a.array[i1] = a.array[i2]!;
        a.array[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

function finish(geo: BufferGeometry): BufferGeometry {
  const creased = toCreasedNormals(geo, CREASE);
  geo.dispose();
  creased.computeBoundingBox();
  return creased;
}
