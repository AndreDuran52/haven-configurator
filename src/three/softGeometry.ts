// Soft, procedural upholstery (Andre, 2026-09-27: "like the real Haven";
// reshaped from his close-ups, 2026-11-11): loose back cushions, knife-edge
// throw pillows and ball pillows. No .glb, no network. Every builder stays inside its box
// (±w/2, ±h/2, ±t/2; front = +z, up = +y), which is what the engine anchors
// and the ortho fit use. UVs are in inches, so the bouclé bump stays to scale.
import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { BACK_CUSHION_SHAPE, type OrientedBox } from '@/engine';
import { cushionRing, type CushionFit } from '@/engine/cushionProfile';
import { pillowPoint, type PillowPress } from '@/ortho/pillowShape';

const D2R = Math.PI / 180;

/** Place a soft shape built in its box (front = +z, up = +y) at an engine anchor (plan x, height, plan y). */
export const boxTransform = (a: OrientedBox) => ({
  position: [a.x, a.z, a.y] as [number, number, number],
  rotation: [-a.lean * D2R, Math.atan2(a.facing[0], a.facing[1]), 0, 'YXZ'] as [number, number, number, 'YXZ'],
});

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

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
 * A knife-edge throw pillow (ortho/pillowShape; Andre, 2026-11-11): two
 * panels full in the middle that meet in a seam all round, no chop. `press` =
 * a back leaning on its front.
 */
export function knifeEdgePillow(w: number, h: number, t: number, press?: PillowPress): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1] as const) {
    const base = pos.length / 3;
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const [x, y, z] = pillowPoint(w, h, t, (i / G) * 2 - 1, (j / G) * 2 - 1, side, press);
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
