import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { decode, encode, FABRIC_CODES, FINISH_CODES } from './codec';
import { standardL, standardStraight, standardU } from './defaults';
import { FABRICS, FINISHES } from './fabrics';
import { backCushions } from './cushions';
import { BALL_PILLOW, PAIR_PRESS, PILLOW_MAX_LEAN, PILLOW_PRESS, SQUARE_PILLOW, pillowAnchors, pillowCorners } from './pillows';
import { boxDistance, boxesClash, runInward } from './softBox';
import { setFabric, setMeasurements, setTableFinish } from './ops';
import { moveTable } from './tableOps';
import type { Config, Pt } from './types';

const inPoly = (pt: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

describe('pillows (Q15; Andre 2026-11-18: like his styled Haven picture)', () => {
  const group = (key: string) => key.split(':').slice(0, -1).join(':');

  it('Standard U: at every corner and arm end two squares (one taupe, one light) and one ball: cream at an arm end, taupe at a corner', () => {
    const b = buildHaven(standardU());
    const a = pillowAnchors(b);
    expect(a).toHaveLength(12);
    const groups = new Map<string, typeof a>();
    for (const p of a) groups.set(group(p.key), [...(groups.get(group(p.key)) ?? []), p]);
    expect(groups.size).toBe(4);
    for (const [g, ps] of groups) {
      expect(ps.map((p) => p.kind).sort(), g).toEqual(['ball', 'square', 'square']);
      expect(ps.filter((p) => p.kind === 'square').map((p) => p.tone).sort(), g).toEqual(['oatmeal', 'taupe']);
      expect(ps.find((p) => p.kind === 'ball')!.tone, g).toBe(g.startsWith('wedge') ? 'taupe' : 'cream');
    }
  });

  it('none at table or open ends: 3a (table in place of the left arm) loses that arm group', () => {
    const u = standardU();
    const id = u.runs.back!.find((p) => p.kind === 'table')!.id;
    const a = pillowAnchors(buildHaven(moveTable(u, id, { run: 'left', at: 'replaceArm' }).config));
    expect(a).toHaveLength(9);
  });

  it('L shapes: one wedge and two arm ends', () => {
    for (const side of ['left', 'right'] as const) expect(pillowAnchors(buildHaven(standardL(side)))).toHaveLength(9);
  });

  it('every pillow sits over the sofa (footprint), never over an arm or a table; all sit on the 18″ seat', () => {
    for (const c of [standardU(), standardL('left'), standardL('right'), standardU({ W: 300, D: 36 })]) {
      const b = buildHaven(c);
      const polys = b.pieces.filter((p) => (p.run || p.corner) && p.kind !== 'table').map((p) => p.polygon);
      const blocked = b.pieces.flatMap((p) => (p.arm ? [p.arm.rect] : p.kind === 'table' ? [p.bbox] : []));
      for (const p of pillowAnchors(b)) {
        const corners = pillowCorners(p);
        // A ball is checked as the sphere it is (its box corners stick out past a wedge's angled face).
        const rim = Array.from({ length: 16 }, (_, i): Pt => [p.x + (p.w / 2) * Math.cos((i * Math.PI) / 8), p.y + (p.w / 2) * Math.sin((i * Math.PI) / 8)]);
        for (const [x, y] of p.kind === 'ball' ? rim : corners) {
          expect(polys.some((poly) => inPoly([x, y], poly)), `${p.key} (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
          expect(blocked.some((r) => x > r.x + 0.01 && x < r.x + r.w - 0.01 && y > r.y + 0.01 && y < r.y + r.h - 0.01), `${p.key} over an arm or table`).toBe(false);
        }
        // They rest on the seat (Andre, 2026-11-20): squares on their bottom-back edge, ½″ in; balls on their underside, ¼″ in.
        const bottom = p.kind === 'square' ? Math.min(...corners.map((q) => q[2])) : p.z - p.h / 2;
        expect(bottom, p.key).toBeCloseTo(p.kind === 'square' ? 17.5 : 17.75, 9);
      }
    }
  });

  it('they stand up (Andre, 2026-11-18): 6″ thick, leaning 10°, never more than 15°, facing straight out (0–8°), tops 6–7½″ above the back cushions (resting on the seat, 2026-11-20)', () => {
    expect(SQUARE_PILLOW).toEqual({ w: 20, h: 20, t: 6, lean: 10 });
    for (const D of [36, 40, 44]) {
      for (const c of [standardU({ D }), standardL('left', { D }), standardL('right', { D }), standardStraight({ D })]) {
        const b = buildHaven(c);
        for (const p of pillowAnchors(b).filter((q) => q.kind === 'square')) {
          expect(p.lean, p.key).toBeLessThanOrEqual(PILLOW_MAX_LEAN);
          const piece = b.pieces.find((q) => p.key.startsWith(`${q.id}:`))!;
          const inward = piece.run ? runInward(piece.run) : runInward('back');
          const yaw = (Math.acos(Math.min(1, p.facing[0] * inward[0] + p.facing[1] * inward[1])) * 180) / Math.PI;
          expect(yaw, p.key).toBeLessThanOrEqual(8 + 1e-9);
          const top = Math.max(...pillowCorners(p).map((q) => q[2]));
          expect(top - 31, `D${D} ${p.key}`).toBeGreaterThan(6);
          expect(top - 31, `D${D} ${p.key}`).toBeLessThan(7.5);
        }
      }
    }
  });

  it('a pair overlaps by about a third, the front one 2–3″ forward of the other (Andre, 2026-11-18)', () => {
    const b = buildHaven(standardU());
    const a = pillowAnchors(b);
    for (const g of ['p3', 'p4', 'wedge:backLeft', 'wedge:backRight']) {
      const [s1, s2] = [a.find((p) => p.key === `${g}:sq1`)!, a.find((p) => p.key === `${g}:sq2`)!];
      const piece = b.pieces.find((q) => q.id === g)!;
      const run = piece.run ?? 'back';
      const inward = runInward(run);
      const along: Pt = run === 'back' ? [1, 0] : [0, 1];
      const ds = Math.abs((s1.x - s2.x) * along[0] + (s1.y - s2.y) * along[1]);
      const dt = (s1.x - s2.x) * inward[0] + (s1.y - s2.y) * inward[1];
      expect(ds / SQUARE_PILLOW.w, g).toBeGreaterThan(0.6);
      expect(ds / SQUARE_PILLOW.w, g).toBeLessThan(0.72);
      // Arm ends: the taupe at the arm, in front. Corners: the taupe tucked in, the light one in front.
      expect(Math.abs(dt), g).toBeGreaterThan(2);
      expect(Math.abs(dt), g).toBeLessThan(3);
      expect(dt > 0, g).toBe(!g.startsWith('wedge'));
    }
  });

  it('nothing passes through anything: squares only press into the back cushions and other groups; a pair leans together; balls press only into their squares (D 30–48)', () => {
    for (const D of [30, 34, 36, 40, 44, 48]) {
      for (const c of [standardU({ D }), standardL('left', { D }), standardL('right', { D }), standardU({ W: 240, D })]) {
        const b = buildHaven(c);
        const cushions = backCushions(b);
        const all = pillowAnchors(b);
        const squares = all.filter((p) => p.kind === 'square');
        for (const p of all) {
          if (p.kind === 'square') {
            // A down pillow presses into the soft back cushion it leans on (PILLOW_PRESS), no further.
            for (const o of cushions) expect(boxesClash(p, o, -PILLOW_PRESS - 1e-6), `D${D} ${p.key} × ${o.key}`).toBe(false);
            for (const o of squares) if (o !== p && group(o.key) !== group(p.key)) expect(boxesClash(p, o, -PAIR_PRESS - 1e-6), `D${D} ${p.key} × ${o.key}`).toBe(false);
          } else {
            for (const o of cushions) expect(boxDistance(o, [p.x, p.y, p.z]), `D${D} ${p.key}`).toBeGreaterThanOrEqual(BALL_PILLOW / 2);
            for (const o of squares) expect(boxDistance(o, [p.x, p.y, p.z]), `D${D} ${p.key} × ${o.key}`).toBeGreaterThanOrEqual(BALL_PILLOW / 2 - 2 - 1e-6);
          }
        }
      }
    }
  });

  it('the standard layouts at 44″, 40″ and 36″ deep: two squares and a ball at every corner and arm end (Andre, 2026-11-18: balls at the arm ends too)', () => {
    const count = (c: Config, D: number) => {
      const a = pillowAnchors(buildHaven(setMeasurements(c, { D }).config));
      return [a.filter((p) => p.kind === 'square').length, a.filter((p) => p.kind === 'ball').length];
    };
    for (const D of [44, 40, 36]) {
      expect(count(standardU(), D), `U ${D}`).toEqual([8, 4]);
      expect(count(standardL('left'), D), `L left ${D}`).toEqual([6, 3]);
      expect(count(standardL('right'), D), `L right ${D}`).toEqual([6, 3]);
      expect(count(standardStraight(), D), `Straight ${D}`).toEqual([4, 2]);
    }
  });

  it('shallow seats get fewer, never more', () => {
    expect(pillowAnchors(buildHaven(standardU({ D: 36 })))).toHaveLength(12);
    expect(pillowAnchors(buildHaven(standardU({ D: 30 }))).length).toBeLessThan(12);
    expect(pillowAnchors(buildHaven(standardU({ D: 48 })))).toHaveLength(12);
  });

  it('they touch: the back square of each pair rests on a back cushion, the front one on it; each ball against its pair', () => {
    for (const c of [standardU(), standardL('left'), standardL('right'), standardU({ D: 36 })]) {
      const b = buildHaven(c);
      const cushions = backCushions(b);
      const all = pillowAnchors(b);
      for (const p of all.filter((q) => q.kind === 'square')) {
        const mate = all.find((q) => q.kind === 'square' && q !== p && group(q.key) === group(p.key));
        expect(cushions.some((o) => boxesClash(p, o)) || (!!mate && boxesClash(p, mate)), `${p.key} rests on something`).toBe(true);
      }
      for (const ball of all.filter((q) => q.kind === 'ball')) {
        const pairOf = all.filter((q) => q.kind === 'square' && group(q.key) === group(ball.key));
        expect(Math.min(...pairOf.map((q) => boxDistance(q, [ball.x, ball.y, ball.z]))) - BALL_PILLOW / 2, `${ball.key} against its pair`).toBeLessThan(0.6);
      }
    }
  });

  it('the same arrangement after the layout travels through a share link', () => {
    for (const c of [standardU(), standardL('right'), standardU({ D: 36 })]) {
      const d = decode(encode(c));
      if (!('config' in d)) throw new Error('link did not decode');
      const strip = (b: ReturnType<typeof buildHaven>) => pillowAnchors(b).map(({ key: _k, ...box }) => box);
      expect(strip(buildHaven(d.config))).toEqual(strip(buildHaven(c)));
    }
  });
});

describe('look data (H5): every fabric and finish round-trips through the link', () => {
  it('FABRICS and FINISHES keys all have link codes', () => {
    for (const f of FABRICS) expect(FABRIC_CODES).toContain(f.key);
    for (const f of FINISHES) expect(FINISH_CODES).toContain(f.key);
  });

  it('setFabric / setTableFinish, then encode/decode', () => {
    for (const f of FABRICS) {
      for (const w of FINISHES) {
        const c = setTableFinish(setFabric(standardU(), f.key).config, w.key).config;
        const d = decode(encode(c));
        expect('config' in d && [d.config.fabric, d.config.tableFinish]).toEqual([f.key, w.key]);
      }
    }
    expect(setFabric(standardU(), 'mystery').rejected?.code).toBe('notAllowed');
  });
});
