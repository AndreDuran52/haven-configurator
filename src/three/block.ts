// Parts -> three geometry (plan §7.4): one upholstered block (Andre, 2026-11-20).
// The footprint with its vertical corners rounded, lofted through rings from
// z0 to z1; the top and bottom edges rounded INSIDE the footprint, so the Top
// silhouette equals the SVG plan (parity). With `puff`, each half (below and
// above `seamAt`) swells out to the footprint at its middle and is `puff` in at
// its ends; at the seam the stitching pulls the fabric in `pinch` more over
// about ½″: a stitch line with a slight pinch, not a groove. UVs are in inches,
// as ExtrudeGeometry's were, so the bouclé and the wood grain stay to scale.
import { BufferAttribute, BufferGeometry } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pt } from '@/engine';

export interface Edges {
  /** Radius of the top edge (inches). */
  top: number;
  /** Radius of the bottom edge. */
  bottom: number;
  /** Radius of the vertical corners, in plan. */
  corner: number;
  /** How far each half's ends sit in from its fullest point (0 or absent = flat faces). */
  puff?: number;
  /** Height of the stitched seam (with `puff`). */
  seamAt?: number;
  /** How much more the seam pulls in. */
  pinch?: number;
}

export interface Ring {
  z: number;
  pts: Pt[];
}

const CREASE = Math.PI / 5;
const ARC = 6; // samples per vertical corner
const FILLET = 5; // samples per top / bottom edge
/** Half the height over which the stitching pulls the fabric in. */
export const PINCH_SPREAD = 0.5;
/** The height over which the upper half steps to its own (seam-inset) footprint. */
const STEP = 0.5;

const signedArea = (poly: Pt[]) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) a += poly[i]![0] * poly[(i + 1) % poly.length]![1] - poly[(i + 1) % poly.length]![0] * poly[i]![1];
  return a / 2;
};

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The wall's set-in from the footprint at height z (no edge rounding). */
export function wallSetIn(z: number, z0: number, z1: number, e: Edges): number {
  const puff = e.puff ?? 0;
  if (!puff) return 0;
  const seam = e.seamAt ?? (z0 + z1) / 2;
  const [a, b] = z <= seam ? [z0, seam] : [seam, z1];
  const u = Math.min(1, Math.max(0, (z - a) / (b - a)));
  const k = Math.max(0, 1 - Math.abs(z - seam) / PINCH_SPREAD);
  return puff * (1 - Math.sin(Math.PI * u)) + (e.pinch ?? 0) * k ** 1.5;
}

/** A convex CCW polygon set in `d`, its corners rounded to `rc` (ARC points per corner). */
function roundRing(poly: Pt[], d: number, rc: number): Pt[] {
  const n = poly.length;
  const normal = (i: number): Pt => {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % n]!;
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [-(y1 - y0) / l, (x1 - x0) / l];
  };
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = normal((i - 1 + n) % n);
    const b = normal(i);
    const k = (d + rc) / (1 + a[0] * b[0] + a[1] * b[1]);
    const c: Pt = [poly[i]![0] + (a[0] + b[0]) * k, poly[i]![1] + (a[1] + b[1]) * k];
    const a0 = Math.atan2(a[1], a[0]);
    const delta = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
    for (let j = 0; j < ARC; j++) {
      const t = a0 + (delta * j) / (ARC - 1);
      out.push([c[0] - rc * Math.cos(t), c[1] - rc * Math.sin(t)]);
    }
  }
  return out;
}

/**
 * The block's rings, bottom to top, in plan inches. `upper` (same vertex count
 * as `poly`) is the footprint above the seam, for the ⅛″ seam between
 * neighbouring seats; it never reaches past `poly`.
 */
export function blockRings(poly: Pt[], z0: number, z1: number, e: Edges, upper?: Pt[]): Ring[] {
  const ccw = signedArea(poly) < 0;
  const lo = ccw ? [...poly].reverse() : poly;
  const hi = upper ? (ccw ? [...upper].reverse() : upper) : lo;
  const h = z1 - z0;
  let minEdge = Infinity;
  for (let i = 0; i < lo.length; i++) minEdge = Math.min(minEdge, Math.hypot(lo[(i + 1) % lo.length]![0] - lo[i]![0], lo[(i + 1) % lo.length]![1] - lo[i]![1]));
  const rt = Math.max(0, Math.min(e.top, h / 2 - 0.01));
  const rb = Math.max(0, Math.min(e.bottom, h / 2 - 0.01));
  const corner = Math.max(0, Math.min(e.corner, minEdge / 2 - 0.01));
  const seam = e.seamAt ?? (z0 + z1) / 2;
  const footAt = (z: number): Pt[] => {
    const w = upper ? smooth((z - seam) / STEP) : 0;
    return w === 0 ? lo : w === 1 ? hi : lo.map((p, i) => [p[0] + (hi[i]![0] - p[0]) * w, p[1] + (hi[i]![1] - p[1]) * w]);
  };
  const ring = (z: number, fillet: number): Ring => ({ z, pts: roundRing(footAt(z), wallSetIn(z, z0, z1, e) + fillet, Math.max(0, corner - fillet)) });

  const out: Ring[] = [];
  for (let k = 0; k <= FILLET; k++) {
    const a = ((k / FILLET) * Math.PI) / 2;
    out.push(ring(z0 + rb * (1 - Math.cos(a)), rb * (1 - Math.sin(a))));
  }
  // The wall: flat faces need no rings between the edges; a puffed one is sampled
  // through each half, closer together at the seam and at each half's fullest.
  const zs = new Set<number>();
  if (e.puff) {
    for (const [a, b] of [[z0, seam], [seam, z1]] as const) for (let i = 1; i < 10; i++) zs.add(a + ((b - a) * i) / 10);
    zs.add(seam);
    for (const dz of [0.05, 0.12, 0.22, 0.35, PINCH_SPREAD, 0.7]) zs.add(seam - dz).add(seam + dz);
  }
  if (upper) for (let i = 1; i < 6; i++) zs.add(seam + (STEP * i) / 6);
  for (const z of [...zs].filter((q) => q > z0 + rb + 1e-6 && q < z1 - rt - 1e-6).sort((p, q) => p - q)) out.push(ring(z, 0));
  for (let k = 0; k <= FILLET; k++) {
    const a = ((k / FILLET) * Math.PI) / 2;
    out.push(ring(z1 - rt + rt * Math.sin(a), rt * (1 - Math.cos(a))));
  }
  return out;
}

/** The block as three geometry: plan (x, y) and height z -> three (x, z, y). */
export function upholsteredBlock(poly: Pt[], z0: number, z1: number, e: Edges, upper?: Pt[]): BufferGeometry {
  const rings = blockRings(poly, z0, z1, e, upper);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = rings[0]!.pts.length;
  // Walls: each ring closed with a repeated first point, u = inches round the ring, v = height.
  for (const r of rings) {
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const p = r.pts[i % n]!;
      if (i > 0) s += Math.hypot(p[0] - r.pts[i - 1]![0], p[1] - r.pts[i - 1]![1]);
      pos.push(p[0], r.z, p[1]);
      uv.push(s, r.z);
    }
  }
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const aL = k * (n + 1) + i;
      const bL = aL + 1;
      const aU = aL + n + 1;
      const bU = aU + 1;
      idx.push(aL, aU, bL, bL, aU, bU);
    }
  }
  // Caps: a fan from the centre (every footprint is convex).
  const cap = (r: Ring, up: boolean) => {
    const base = pos.length / 3;
    const cx = r.pts.reduce((m, p) => m + p[0], 0) / n;
    const cy = r.pts.reduce((m, p) => m + p[1], 0) / n;
    pos.push(cx, r.z, cy);
    uv.push(cx, cy);
    for (const p of r.pts) {
      pos.push(p[0], r.z, p[1]);
      uv.push(p[0], p[1]);
    }
    for (let i = 0; i < n; i++) {
      const a = base + 1 + i;
      const b = base + 1 + ((i + 1) % n);
      if (up) idx.push(base, b, a);
      else idx.push(base, a, b);
    }
  };
  cap(rings[0]!, false);
  cap(rings[rings.length - 1]!, true);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx);
  const creased = toCreasedNormals(geo, CREASE);
  geo.dispose();
  creased.computeBoundingBox();
  return creased;
}
