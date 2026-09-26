// Soft, procedural upholstery (Andre, 2026-09-27: "like the real Haven"):
// loose back cushions, down-feather "karate chop" throw pillows and ball
// pillows. No .glb, no network. Every builder stays inside its box
// (±w/2, ±h/2, ±t/2; front = +z, up = +y), which is what the engine anchors
// and the ortho fit use. UVs are in inches, so the bouclé bump stays to scale.
import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { BACK_CUSHION_SHAPE, type OrientedBox } from '@/engine';

const D2R = Math.PI / 180;

/** Place a soft shape built in its box (front = +z, up = +y) at an engine anchor (plan x, height, plan y). */
export const boxTransform = (a: OrientedBox) => ({
  position: [a.x, a.z, a.y] as [number, number, number],
  rotation: [-a.lean * D2R, Math.atan2(a.facing[0], a.facing[1]), 0, 'YXZ'] as [number, number, number, 'YXZ'],
});

/** A face grid on the unit cube: which axis it faces and its two in-plane axes. */
const FACES: { n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }[] = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, // front
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // back
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // right
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] }, // left
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, // top
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }, // bottom
];

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** How deep the piping line is pinched in, inches. */
const PIPING = 0.15;
const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp((x - e0) / (e1 - e0), 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * A loose back cushion (engine BACK_CUSHION_SHAPE): front and back panels that
 * dome out, a half-round boxing all round (its radius is what is left of the
 * depth after the bulge, so the shape fills its box and never leaves it),
 * tapered toward the top, the top crowned between rolled ends, the corners
 * pulled in like a down-filled cushion, and a soft piping line where the
 * panels meet the boxing.
 */
export function looseCushion(w: number, h: number, t: number): BufferGeometry {
  const { bulge, radius, taper, crown, pinch } = BACK_CUSHION_SHAPE;
  // The core box, before the bulge (depth) and the crown (height) grow it back
  // to w × h × t: it sits crown/2 low, so its bottom stays on the box bottom.
  const half = new Vector3(w / 2, h / 2 - crown / 2, t / 2 - bulge);
  const r = Math.min(radius, half.x - 0.1, half.y - 0.1, half.z);
  const inner = new Vector3(half.x - r, half.y - r, half.z - r);
  const N = { x: Math.max(10, Math.round(w / 2)), y: Math.max(8, Math.round(h / 1.6)), z: 8 };
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new Vector3();
  const core = new Vector3();
  const d = new Vector3();
  for (const f of FACES) {
    const base = pos.length / 3;
    const nu = Math.abs(f.u[0]) ? N.x : Math.abs(f.u[2]) ? N.z : N.y;
    const nv = Math.abs(f.v[1]) ? N.y : Math.abs(f.v[2]) ? N.z : N.x;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const a = (i / nu) * 2 - 1;
        const b = (j / nv) * 2 - 1;
        // A point on the core box's surface…
        p.set(
          (f.n[0] + f.u[0] * a + f.v[0] * b) * half.x,
          (f.n[1] + f.u[1] * a + f.v[1] * b) * half.y,
          (f.n[2] + f.u[2] * a + f.v[2] * b) * half.z,
        );
        // The piping: where the front/back panel meets the boxing (same rule on
        // both faces' grids, so their shared vertices stay together).
        const rim = Math.abs(Math.abs(p.z) - half.z) < 1e-6 && (Math.abs(Math.abs(p.x) - half.x) < 1e-6 || Math.abs(Math.abs(p.y) - half.y) < 1e-6);
        // …rounded: the nearest point on the inner box plus r along the way out.
        core.set(clamp(p.x, -inner.x, inner.x), clamp(p.y, -inner.y, inner.y), clamp(p.z, -inner.z, inner.z));
        d.subVectors(p, core);
        if (d.lengthSq() > 1e-9) d.setLength(rim ? r - PIPING : r);
        p.addVectors(core, d);
        const nx = p.x / half.x;
        const ny = clamp(p.y / half.y, -1, 1);
        // Front and back panels dome out, broad across the width, reaching the box face mid-panel.
        const panel = smooth(0.3, 0.95, Math.abs(p.z) / half.z) * (1 - nx ** 4) * (1 - ny * ny);
        p.z += Math.sign(p.z) * bulge * panel;
        // Down fill: the corners pull in.
        p.z *= 1 - pinch * (nx * nx * ny * ny) ** 2;
        // Taper toward the top; the top crowns up between its rolled ends.
        p.z *= 1 - (1 - taper) * (ny * 0.5 + 0.5);
        p.y += crown * (1 - nx * nx) * Math.max(0, ny) ** 3;
        // Bowed ends: the end walls draw in toward the top and bottom corners.
        p.x *= 1 - 0.05 * ny ** 4;
        p.y -= crown / 2;
        pos.push(p.x, p.y, p.z);
        uv.push(p.x + p.z, p.y);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i;
        const b = a + 1;
        const c = a + nu + 1;
        idx.push(a, b, c + 1, a, c + 1, c);
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
