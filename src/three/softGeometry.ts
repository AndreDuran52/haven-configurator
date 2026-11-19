// Soft, procedural upholstery (Andre, 2026-09-27: "like the real Haven";
// cushions reshaped from his close-ups, 2026-11-11): loose back cushions,
// "karate chop" throw pillows (the stand-in until Andre's Blender model has
// loaded, three/models.ts) and ball pillows. No network. Every builder stays inside its box
// (±w/2, ±h/2, ±t/2; front = +z, up = +y), which is what the engine anchors
// and the ortho fit use. UVs are in inches, so the bouclé bump stays to scale.
import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { BACK_CUSHION_SHAPE, type OrientedBox } from '@/engine';
import { cushionRing, type CushionFit } from '@/engine/cushionProfile';
import { pressAt, type PillowPress } from '@/ortho/pillowShape';

const D2R = Math.PI / 180;

/** Place a soft shape built in its box (front = +z, up = +y) at an engine anchor (plan x, height, plan y). */
export const boxTransform = (a: OrientedBox) => ({
  position: [a.x, a.z, a.y] as [number, number, number],
  rotation: [-a.lean * D2R, Math.atan2(a.facing[0], a.facing[1]), 0, 'YXZ'] as [number, number, number, 'YXZ'],
});

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp((x - e0) / (e1 - e0), 0, 1);
  return k * k * (3 - 2 * k);
};

/** Across positions for the cushion's rings (x ≥ 0): even through the middle, close together through the rounded end, and three at the stitched seam. */
function acrossSamples(w: number): { x: number; inset: number }[] {
  const { corner, seam } = BACK_CUSHION_SHAPE;
  const end = Math.min(corner, w / 2 - 0.1);
  const xs = new Map<number, number>();
  const add = (x: number, inset = 0) => xs.set(Math.round(clamp(x, 0, w / 2) * 1000) / 1000, inset);
  const n = Math.max(4, Math.round((w / 2 - end) / 2));
  for (let i = 0; i <= n; i++) add(((w / 2 - end) * i) / n);
  for (let i = 1; i <= 8; i++) add(w / 2 - end + end * Math.sin(((i / 8) * Math.PI) / 2));
  add(w / 2 - seam - 0.22);
  add(w / 2 - seam + 0.22);
  add(w / 2 - seam, SEAM_DEPTH);
  return [...xs].map(([x, inset]) => ({ x, inset })).sort((a, b) => a.x - b.x);
}

/** How far the stitched seam line is drawn in, inches (a flat stitch, no piping cord). */
const SEAM_DEPTH = 0.1;

/**
 * A loose back cushion (engine/cushionProfile, Andre's close-ups 2026-11-11):
 * rings of its side profile lofted across the width, a flat boxed end at each
 * side with a stitched seam just inside it, the top crowned between rounded
 * corners. It fills its box and never leaves it.
 */
export function looseCushion(w: number, fit: CushionFit): BufferGeometry {
  const half = acrossSamples(w);
  const across = [...half.slice(1).reverse().map((a) => ({ x: -a.x, inset: a.inset })), ...half];
  const rings = across.map((a) => cushionRing(fit, w, a.x, a.inset));
  const M = rings[0]!.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  rings.forEach((ring, i) => {
    for (const [z, y] of ring) {
      pos.push(across[i]!.x, y, z);
      uv.push(across[i]!.x + z, y);
    }
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = a + M;
      const d = b + M;
      idx.push(a, d, b, a, c, d);
    }
  }
  // The flat ends.
  for (const [i, flip] of [[0, false], [rings.length - 1, true]] as const) {
    const ring = rings[i]!;
    const centre = pos.length / 3;
    const cy = ring.reduce((s, p) => s + p[1], 0) / M;
    pos.push(across[i]!.x, cy, 0);
    uv.push(across[i]!.x, cy);
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      if (flip) idx.push(centre, b, a);
      else idx.push(centre, a, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

const G = 28;

/**
 * A down-feather throw pillow with the "karate chop": two puffed panels
 * meeting at a pinched rim, bowed edges and pointed corners, the top centre
 * chopped down into a V with the front creased along it, the ears up.
 */
export function chopPillow(w: number, h: number, t: number, o: { chop?: number } = {}): BufferGeometry {
  const chop = o.chop ?? h * 0.16;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const u = (i / G) * 2 - 1;
        const v = (j / G) * 2 - 1;
        const puff = Math.sqrt(Math.max(0, 1 - u ** 8)) * Math.sqrt(Math.max(0, 1 - v ** 8));
        const top = Math.max(0, v);
        const cut = Math.exp(-((u / 0.3) ** 2)) * top ** 1.6; // the chop, strongest at the top centre
        const ears = smooth(0.55, 1, Math.abs(u)) * smooth(0.55, 1, v);
        let x = ((u * w) / 2) * (1 - 0.08 * v * v);
        let y = ((v * h) / 2) * (1 - 0.06 * u * u) - chop * cut + 0.6 * ears;
        let z = ((side * t * puff) / 2) * (1 - 0.6 * cut);
        if (side > 0) z += 0.9 * ears * puff; // the ears tip forward
        // Keep inside the box.
        x = clamp(x, -w / 2, w / 2);
        y = clamp(y, -h / 2, h / 2);
        z = clamp(z, -t / 2, t / 2);
        pos.push(x, y, z);
        uv.push(x, y);
      }
    }
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const a = base + j * (G + 1) + i;
        const b = a + 1;
        const c = a + G + 1;
        const d = c + 1;
        if (side > 0) idx.push(a, b, d, a, d, c);
        else idx.push(a, d, b, a, c, d);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}


/**
 * A copy of a square pillow (Andre's Blender model, or chopPillow) with a back
 * leaning on its front (ortho/pillowShape pressAt): each front vertex comes
 * in toward the middle; the back panel stays as it is. The geometry is in its
 * box, ±w/2 × ±h/2 × ±t/2.
 */
export function pressPillow(src: BufferGeometry, w: number, h: number, t: number, press: PillowPress): BufferGeometry {
  const g = src.clone();
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 0) p.setZ(i, z * pressAt(p.getX(i) / (w / 2), p.getY(i) / (h / 2), press, t));
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** A ball pillow with six shallow gores (the stitched panels). */
export function ballPillow(d: number): BufferGeometry {
  const g = new SphereGeometry(d / 2, 36, 24);
  const p = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const phi = Math.atan2(v.z, v.x);
    const seam = Math.abs(Math.cos(3 * phi)) ** 24; // 6 meridians
    v.multiplyScalar(1 - 0.025 * seam * Math.sqrt(Math.max(0, 1 - (v.y / (d / 2)) ** 2)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}
