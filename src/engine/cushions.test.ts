import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { decode, encode } from './codec';
import { BACK_CUSHION_LEAN, backCushions, boxTop } from './cushions';
import { standardL, standardU } from './defaults';
import { moveTable } from './tableOps';
import { boxCorners, boxesClash, planToRun } from './softBox';
import { test3b } from './testing';
import type { BuildResult, Config, Pt } from './types';

const inPoly = (pt: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const u = standardU();
const layouts: [string, Config][] = [
  ['Standard U', u],
  ['L left', standardL('left')],
  ['L right', standardL('right')],
  ['U 36″ deep', standardU({ D: 36 })],
  ['U 30″ deep', standardU({ D: 30 })],
  ['3a', moveTable(u, u.runs.back!.find((p) => p.kind === 'table')!.id, { run: 'left', at: 'replaceArm' }).config],
  ['3b', test3b()],
];

describe('loose back cushions (Andre, 2026-09-27)', () => {
  it('Standard U: 2 on each one-arm leg (58″ of seat), 1 on the 36″ back seat, 2 per wedge; none on the table', () => {
    const count = new Map<string, number>();
    for (const c of backCushions(buildHaven(u))) count.set(c.pieceId, (count.get(c.pieceId) ?? 0) + 1);
    expect(Object.fromEntries(count)).toEqual({ p2: 1, p3: 2, p4: 2, 'wedge:backLeft': 2, 'wedge:backRight': 2 });
  });

  it('stand on the seat (sunk 1″) against the 10″ frame, 8″ deep; the box holds the soft top (it peaks at 31″, three/softGeometry.test)', () => {
    for (const [name, c] of layouts) {
      const b = buildHaven(c);
      for (const k of backCushions(b)) {
        const corners = boxCorners(k);
        expect(Math.min(...corners.map((q) => q[2])), `${name} ${k.key}`).toBeCloseTo(17, 9);
        expect(boxTop(k) - 31, `${name} ${k.key}`).toBeGreaterThan(0);
        expect(boxTop(k) - 31, `${name} ${k.key}`).toBeLessThan(0.5);
        expect(k.t).toBe(8);
        expect(Math.abs(k.lean - BACK_CUSHION_LEAN)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('stay over the sofa, never over an arm or a table, and clear of each other', () => {
    for (const [name, c] of layouts) {
      const b = buildHaven(c);
      const seats = b.pieces.filter((p) => (p.run || p.corner) && p.kind !== 'table');
      const blocked = b.pieces.flatMap((p) => (p.arm ? [p.arm.rect] : p.kind === 'table' ? [p.bbox] : []));
      const all = backCushions(b);
      for (const k of all) {
        for (const [x, y] of boxCorners(k)) {
          expect(seats.some((p) => inPoly([x, y], p.polygon)), `${name} ${k.key} (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
          expect(blocked.some((r) => x > r.x + 0.01 && x < r.x + r.w - 0.01 && y > r.y + 0.01 && y < r.y + r.h - 0.01), `${name} ${k.key} over an arm or table`).toBe(false);
        }
        for (const o of all) if (o !== k) expect(boxesClash(k, o), `${name} ${k.key} × ${o.key}`).toBe(false);
      }
    }
  });

  it('the back of each cushion rests on the frame line (t = 10) along its run', () => {
    const b: BuildResult = buildHaven(u);
    for (const k of backCushions(b).filter((q) => q.key.startsWith('p'))) {
      const run = b.runs.find((r) => r.id === b.pieces.find((p) => p.id === k.pieceId)!.run)!;
      const ts = boxCorners(k).map((q) => planToRun({ run: run.id, origin: run.origin, W: b.W }, [q[0], q[1]])[1]);
      // The bottom-back edge sits on the frame's face; the top leans back over it.
      expect(Math.max(...ts)).toBeLessThanOrEqual(18.01);
      expect(ts.filter((t) => Math.abs(t - 10) < 1e-9)).toHaveLength(2);
    }
  });

  it('look the same after the layout travels through a share link (keyed by position, not id)', () => {
    for (const [, c] of layouts) {
      const d = decode(encode(c));
      expect('config' in d).toBe(true);
      if (!('config' in d)) continue;
      const strip = (b: BuildResult) => backCushions(b).map(({ key: _k, pieceId: _p, ...box }) => box);
      expect(strip(buildHaven(d.config))).toEqual(strip(buildHaven(c)));
    }
  });
});
