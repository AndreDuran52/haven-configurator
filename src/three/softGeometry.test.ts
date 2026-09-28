import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { backCushions, BALL_PILLOW, buildHaven, SQUARE_PILLOW, standardL, standardU, type OrientedBox } from '@/engine';
import { ballPillow, boxTransform, chopPillow, looseCushion } from './softGeometry';

const vertices = (g: BufferGeometry): Vector3[] => {
  const p = g.getAttribute('position');
  return Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i));
};

/** The geometry placed at its anchor exactly as SofaModel / Pillows place it: world x = plan x, y = height, z = plan y. */
function placed(g: BufferGeometry, a: OrientedBox): Vector3[] {
  const { position, rotation } = boxTransform(a);
  const q = new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2], rotation[3]));
  const m = new Matrix4().compose(new Vector3(...position), q, new Vector3(1, 1, 1));
  return vertices(g).map((v) => v.applyMatrix4(m));
}

const inBox = (g: BufferGeometry, w: number, h: number, t: number) =>
  vertices(g).every((v) => Math.abs(v.x) <= w / 2 + 1e-6 && Math.abs(v.y) <= h / 2 + 1e-6 && Math.abs(v.z) <= t / 2 + 1e-6);

describe('soft geometry stays inside the engine’s boxes (what the anchors and the ortho fit use)', () => {
  it('loose back cushions: inside their boxes; placed, they sit on the seat and peak at 31″ (Andre, 2026-09-27)', () => {
    for (const c of [standardU(), standardL('left'), standardU({ D: 36 })]) {
      for (const k of backCushions(buildHaven(c))) {
        const g = looseCushion(k.w, k.h, k.t);
        expect(inBox(g, k.w, k.h, k.t), k.key).toBe(true);
        const world = placed(g, k);
        const top = Math.max(...world.map((v) => v.y));
        const bottom = Math.min(...world.map((v) => v.y));
        expect(top, k.key).toBeGreaterThan(30.9);
        expect(top, k.key).toBeLessThanOrEqual(31 + 1e-6);
        // Sunk into the 18″ seat, never below its 10″ deck (the seam).
        expect(bottom, k.key).toBeGreaterThan(17);
        expect(bottom, k.key).toBeLessThan(18);
        g.dispose();
      }
    }
  });

  it('the placed cushion leans back: its top is further back than its bottom', () => {
    const k = backCushions(buildHaven(standardU())).find((c) => c.key === 'p2:back0')!;
    const world = placed(looseCushion(k.w, k.h, k.t), k);
    const top = world.reduce((a, v) => (v.y > a.y ? v : a));
    const bottomFront = Math.max(...world.filter((v) => v.y < 19).map((v) => v.z));
    expect(top.z).toBeLessThan(bottomFront);
  });

  it('karate-chop squares and ball pillows stay inside their boxes', () => {
    const sq = chopPillow(SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t);
    expect(inBox(sq, SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t)).toBe(true);
    // The chop: the top centre sits well below the ears.
    const vs = vertices(sq);
    const topAt = (x: number) => Math.max(...vs.filter((v) => Math.abs(v.x - x) < 0.8).map((v) => v.y));
    expect(topAt(8) - topAt(0)).toBeGreaterThan(2);
    const ball = ballPillow(BALL_PILLOW);
    expect(vertices(ball).every((v) => v.length() <= BALL_PILLOW / 2 + 1e-6)).toBe(true);
  });
});
