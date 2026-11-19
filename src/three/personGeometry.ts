// The mannequin's shapes (Andre, 2026-11-11): plain, smooth, tapered, made in
// code from ortho/person.ts's joints and sizes (no imported model). The body
// is lofted from elliptical rings along the curved back; limbs taper between
// their joints; the head is an egg. Inches; built in the figure's own frame
// (x across, y up, z = inches from the sofa's back).
import { BufferGeometry, Float32BufferAttribute, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import type { Build } from '@/ortho/personBuild';
import type { SpinePoint } from '@/ortho/person';

const SEG = 20;

interface Ring {
  /** Centre (t, z), the forward normal (t, z), and the half sizes across and front to back. */
  c: [number, number];
  n: [number, number];
  hw: number;
  hd: number;
}

/** The body: hips, waist, chest and shoulders along the back, rounded under the seat bones and drawn in to the neck. */
export function torsoGeometry(spine: SpinePoint[], b: Build): BufferGeometry {
  const rings: Ring[] = spine.map((s) => ({ c: s.p, n: s.n, hw: s.width / 2, hd: s.depth / 2 }));
  const end = (r: Ring, dir: 1 | -1, steps: [number, number, number][]): Ring[] => {
    // The tangent is the normal turned a quarter (up the back).
    const tan: [number, number] = [-r.n[1] * dir, r.n[0] * dir];
    return steps.map(([along, w, d]) => ({ c: [r.c[0] + tan[0] * along, r.c[1] + tan[1] * along], n: r.n, hw: w, hd: d }));
  };
  const first = rings[0]!;
  const last = rings[rings.length - 1]!;
  // Under the hips: a rounded seat. Above the shoulders: a square shoulder line held full width
  // (Andre, 2026-11-18: wider than the waist, a yoke, not a dome), then in to the neck.
  const under = [0.92, 0.72, 0.4, 0.05].map((k, i): [number, number, number] => [first.hd * 0.3 * (i + 1), first.hw * k, first.hd * k]);
  const over: [number, number, number][] = [
    [0.7, last.hw * 1.0, last.hd * 0.95],
    [1.4, last.hw * 0.97, last.hd * 0.85],
    [1.9, last.hw * 0.7, last.hd * 0.7],
    [2.3, b.neck * 0.62, b.neck * 0.6],
    [2.6, b.neck * 0.3, b.neck * 0.3],
  ];
  const all = [...end(first, -1, under).reverse(), ...rings, ...end(last, 1, over)];
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of all) {
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const f = Math.sin(a) * r.hd;
      pos.push(Math.cos(a) * r.hw, r.c[1] + r.n[1] * f, r.c[0] + r.n[0] * f);
    }
  }
  for (let i = 0; i < all.length - 1; i++) {
    for (let k = 0; k < SEG; k++) {
      const a = i * SEG + k;
      const c = i * SEG + ((k + 1) % SEG);
      idx.push(a, a + SEG, c, c, a + SEG, c + SEG);
    }
  }
  // Close both ends.
  for (const [i, flip] of [[0, true], [all.length - 1, false]] as const) {
    const centre = pos.length / 3;
    pos.push(0, all[i]!.c[1], all[i]!.c[0]);
    for (let k = 0; k < SEG; k++) {
      const a = i * SEG + k;
      const c = i * SEG + ((k + 1) % SEG);
      if (flip) idx.push(centre, a, c);
      else idx.push(centre, c, a);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A limb along +y from −len/2 (radius ra) to +len/2 (radius rb), its ends rounded. */
export function limbGeometry(len: number, ra: number, rb: number): BufferGeometry {
  const pts: Vector2[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new Vector2(Math.sin(a) * ra, -len / 2 - Math.cos(a) * ra));
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new Vector2(Math.cos(a) * rb, len / 2 + Math.sin(a) * rb));
  }
  return new LatheGeometry(pts, 14);
}

/** The head: an egg, a little narrower toward the chin. */
export function headGeometry(w: number, h: number, d: number): BufferGeometry {
  const g = new SphereGeometry(1, 28, 20);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const chin = y < 0 ? 1 - 0.16 * y * y : 1;
    p.setXYZ(i, (p.getX(i) * chin * w) / 2, (y * h) / 2, (p.getZ(i) * chin * d) / 2);
  }
  g.computeVertexNormals();
  return g;
}
