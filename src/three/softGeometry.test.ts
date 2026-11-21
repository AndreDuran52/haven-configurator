import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { backCushions, BALL_PILLOW, buildHaven, DEFAULT_DIMS, SQUARE_PILLOW, standardL, standardU, type OrientedBox } from '@/engine';
import { cushionSide } from '@/engine/cushionProfile';
import { ballPillow, boxTransform, chopPillow, looseCushion, pressPillow } from './softGeometry';

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
  it('loose back cushions: inside their boxes; placed, they rest on the seat (¼″ in, nothing deeper; Andre, 2026-11-20) and peak at 31″', () => {
    for (const c of [standardU(), standardL('left'), standardU({ D: 36 })]) {
      for (const k of backCushions(buildHaven(c))) {
        const g = looseCushion(k.w, k);
        expect(inBox(g, k.w, k.h, k.t), k.key).toBe(true);
        const world = placed(g, k);
        const top = Math.max(...world.map((v) => v.y));
        const bottom = Math.min(...world.map((v) => v.y));
        expect(top, k.key).toBeGreaterThan(30.9);
        expect(top, k.key).toBeLessThanOrEqual(31 + 1e-6);
        // Resting on the 18″ seat: the underside ¼″ in, no vertex below it.
        expect(bottom, k.key).toBeGreaterThan(17.75 - 1e-3);
        expect(bottom, k.key).toBeLessThan(17.76);
        g.dispose();
      }
    }
  });

  it('the placed cushion leans back: its top is further back than its belly; its normals face out', () => {
    const k = backCushions(buildHaven(standardU())).find((c) => c.key === 'p2:back0')!;
    const g = looseCushion(k.w, k);
    const world = placed(g, k);
    const top = world.reduce((a, v) => (v.y > a.y ? v : a));
    const belly = Math.max(...world.filter((v) => v.y < 24).map((v) => v.z));
    expect(top.z).toBeLessThan(belly - 4);
    // The most forward vertex of the unplaced shape has a normal pointing forward.
    const pos = vertices(g);
    const i = pos.reduce((m, v, n) => (v.z > pos[m]!.z ? n : m), 0);
    expect(new Vector3().fromBufferAttribute(g.getAttribute('normal'), i).z).toBeGreaterThan(0.8);
  });

  it('Andre\'s close-ups (2026-11-11): 5″ at the stitching filling to 8″, the belly low, a half-round top, the front 18″ from the back', () => {
    const k = backCushions(buildHaven(standardU())).find((c) => c.key === 'p2:back0')!;
    const g = looseCushion(k.w, k);
    const vs = vertices(g);
    const thick = (pick: (v: Vector3) => boolean) => {
      const zs = vs.filter(pick).map((v) => v.z);
      return Math.max(...zs) - Math.min(...zs);
    };
    // Through the middle: 8″ at its fullest; at the end's stitched seam: about 5″.
    expect(thick((v) => Math.abs(v.x) < 1.1)).toBeGreaterThan(7.8);
    expect(thick((v) => Math.abs(v.x) < 1.1)).toBeLessThanOrEqual(8 + 1e-6);
    const seamX = k.w / 2 - 0.75;
    expect(thick((v) => Math.abs(Math.abs(v.x) - seamX) < 0.01)).toBeGreaterThan(4.6);
    expect(thick((v) => Math.abs(Math.abs(v.x) - seamX) < 0.01)).toBeLessThan(5.6);
    // The fullest point is below mid-height.
    const mid = vs.filter((v) => Math.abs(v.x) < 1.1);
    const fullest = mid.reduce((a, v) => (v.z > a.z ? v : a));
    expect(fullest.y).toBeLessThan(0);
    // The top crowns: lower at the corners than in the middle; the top corners are rounded off.
    const topAt = (x: number) => Math.max(...vs.filter((v) => Math.abs(v.x - x) < 0.6).map((v) => v.y));
    expect(topAt(0) - topAt(k.w / 2 - 3)).toBeGreaterThan(0.2);
    expect(topAt(0) - topAt(k.w / 2 - 0.3)).toBeGreaterThan(1);
    g.dispose();
    // The side profile the drawing and the person use: peak 31″, most forward at 18″, slimmer and rounder at the top.
    const side = cushionSide(DEFAULT_DIMS);
    expect(side.peak[1]).toBeCloseTo(31, 1);
    expect(Math.max(...side.outline.map((p) => p[0]))).toBeGreaterThan(17.9);
    expect(Math.max(...side.outline.map((p) => p[0]))).toBeLessThan(18.15);
    expect(side.front(28)).toBeLessThan(side.front(21) - 1.2); // it leans back
    const r = (side.front(28) - side.peak[0]) ; // from the top's middle to its face 3″ down: about the top's radius
    expect(r).toBeGreaterThan(3);
    expect(r).toBeLessThan(4.2);
  });

  it('karate-chop squares (the stand-in for the Blender model) and ball pillows stay inside their boxes; a back presses only the front', () => {
    const { w, h, t } = SQUARE_PILLOW;
    const sq = chopPillow(w, h, t);
    expect(inBox(sq, w, h, t)).toBe(true);
    const vs = vertices(sq);
    // The chop: the top is lower in the middle than at its ears.
    const topAt = (x: number) => Math.max(...vs.filter((v) => Math.abs(v.x - x) < 0.8).map((v) => v.y));
    expect(topAt(7) - topAt(0)).toBeGreaterThan(2);
    // A back leaning on it presses the front in where it leans, and leaves the back panel and the top alone.
    const pressedGeo = pressPillow(sq, w, h, t, { depth: 2, at: -0.2 });
    const pressed = vertices(pressedGeo);
    expect(inBox(pressedGeo, w, h, t)).toBe(true);
    const front = (list: Vector3[], y: number) => Math.max(...list.filter((v) => Math.abs(v.x) < 0.8 && Math.abs(v.y - y) < 0.5).map((v) => v.z));
    expect(front(vs, -2) - front(pressed, -2)).toBeGreaterThan(1.5);
    expect(front(vs, 6) - front(pressed, 6)).toBeLessThan(0.6);
    vs.forEach((v, i) => {
      if (v.z <= 0) expect(pressed[i]!.z).toBe(v.z);
      else expect(pressed[i]!.z).toBeGreaterThanOrEqual(0); // never past the middle
    });
    // Its own copy: the source is untouched.
    expect(vertices(sq).every((v, i) => v.z === vs[i]!.z)).toBe(true);
    const ball = ballPillow(BALL_PILLOW);
    expect(vertices(ball).every((v) => v.length() <= BALL_PILLOW / 2 + 1e-6)).toBe(true);
  });
});
