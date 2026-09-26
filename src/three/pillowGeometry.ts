// Procedural pillows (Andre, 2026-09-26: "pillows like the showroom photo").
// No .glb, no network: a knife-edge square pillow is two puffed grids (front
// and back) that meet at a pinched rim with slightly bowed edges and pointed
// corners; a ball is a sphere. UVs are in inches, like every other part, so
// the bouclé bump stays at real-world scale.
import { BufferGeometry, Float32BufferAttribute, SphereGeometry } from 'three';

const N = 24;

export function squarePillow(w: number, h: number, t: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * 2 - 1;
        const v = (j / N) * 2 - 1;
        const puff = Math.sqrt(Math.max(0, 1 - u ** 8)) * Math.sqrt(Math.max(0, 1 - v ** 8));
        const x = (u * w) / 2 * (1 - 0.07 * v * v);
        const y = (v * h) / 2 * (1 - 0.07 * u * u);
        pos.push(x, y, (side * t * puff) / 2);
        uv.push(x, y);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = base + j * (N + 1) + i;
        const b = a + 1;
        const c = a + N + 1;
        const d = c + 1;
        // Outward winding on both sides.
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
  return g;
}

export const ballPillow = (d: number): BufferGeometry => new SphereGeometry(d / 2, 32, 20);
