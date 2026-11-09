// UX Phase 3c, keep my work (Andre, 2026-11-09): switching shape converts the
// sofa in place and "the seats stay": every seat and table keeps its size and
// the width changes by the corner. Standard U 188″ -> L left 142″; Straight
// 120″ -> U 212″ with 132″ legs; switching back gives the same sofa.
import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { standardL, standardStraight, standardU } from './defaults';
import { addLooseInLayout, setSnug, solo } from './layoutOps';
import { setLayoutShape } from './shapeLayout';
import type { Layout } from './layoutTypes';
import { setMeasurements, setSeatWidth } from './ops';
import { cushionOf, isSeat } from './pieces';
import { nudgeRoom, setRoom } from './room';
import { setShape } from './shape';
import { addTable, centralTable } from './tablePlace';
import { teeLayout } from './tee';
import { deepFreeze, desc, valid } from './testing';
import type { Config, Shape } from './types';

const SHAPES: Shape[] = ['U', 'L-left', 'L-right', 'straight'];
const standard = (s: Shape): Config => (s === 'U' ? standardU() : s === 'straight' ? standardStraight() : standardL(s === 'L-left' ? 'left' : 'right'));
const to = (c: Config, s: Shape): Config => {
  const r = setShape(deepFreeze(c), s);
  expect(r.rejected).toBeNull();
  valid(r.config);
  return r.config;
};
/** The back's seat cushions and tables, in order (what the client sees along the back; a long seat split in two reads as one). */
const backLook = (c: Config) => {
  const out: string[] = [];
  let group: string | undefined;
  let total = 0;
  for (const p of c.runs.back!) {
    if (isSeat(p) && p.splitGroup && p.splitGroup === group) {
      total += cushionOf(p, c.dims.A);
      out[out.length - 1] = `seat ${total}`;
      continue;
    }
    group = isSeat(p) ? p.splitGroup : undefined;
    total = isSeat(p) ? cushionOf(p, c.dims.A) : 0;
    out.push(isSeat(p) ? `seat ${total}` : `${p.kind} ${p.length}`);
  }
  return out;
};
/** The drawn sofa: shape, sizes that are drawn, every run (ids aside). */
const drawn = (c: Config) => {
  const b = buildHaven(c);
  return { shape: c.shape, W: b.W, D: c.D, sides: [c.runs.left ? c.L : null, c.runs.right ? c.R : null], runs: Object.fromEntries(Object.keys(c.runs).map((r) => [r, desc(c, r as never)])) };
};

describe('switching shape keeps the seats', () => {
  it("Andre's examples: Standard U 188″ -> L left 142″; Straight 120″ -> U 212″ with 132″ legs", () => {
    const l = to(standardU(), 'L-left');
    expect([l.W, l.L]).toEqual([142, 132]);
    expect(backLook(l)).toEqual(['table 32', 'seat 36']);
    const u = to(standardStraight(), 'U');
    expect([u.W, u.L, u.R]).toEqual([212, 132, 132]);
    expect(desc(u, 'back')).toEqual(['armless 46', 'armless 46']);
    expect(desc(u, 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(u, 'right')).toEqual(['oneArm 72=58+14@end']);
  });

  it('every switch between the four standard sofas: the back keeps its seats and tables; switching back gives the same sofa', () => {
    for (const a of SHAPES) {
      for (const b of SHAPES) {
        if (a === b) continue;
        const from = standard(a);
        const c = to(from, b);
        const mirrored = (a === 'L-left' && b === 'L-right') || (a === 'L-right' && b === 'L-left');
        expect(backLook(c), `${a} -> ${b}`).toEqual(mirrored ? backLook(from).reverse() : backLook(from));
        expect(drawn(to(c, a)), `${a} -> ${b} -> ${a}`).toEqual(drawn(from));
      }
    }
  });

  it('L -> U adds a copy of the existing leg (a mirror): same pieces, same side', () => {
    const l = to(setMeasurements(standardL('left'), { L: 150 }).config, 'L-left');
    const withTable = addTable(l, { run: 'left', at: 'seam', seam: 0 }).config;
    const u = to(withTable, 'U');
    expect(desc(u, 'right')).toEqual(desc(u, 'left'));
    expect(u.R).toBe(u.L);
    const ids = Object.values(u.runs).flatMap((r) => r!.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a kept leg is untouched; an L becoming a straight sofa keeps its back seat (one arm, the other end open)', () => {
    const u = centralTable(standardU()).config;
    const l = to(u, 'L-right');
    expect(l.runs.right).toEqual(u.runs.right);
    const s = to(standardL('left'), 'straight');
    expect(desc(s, 'back')).toEqual(['oneArm 72=58+14@end']);
    expect([s.W, s.L, s.R]).toEqual([72, 44, 44]);
  });

  it('many sofas (depths, widths, tables, seat widths), every target shape: valid, back seats and tables kept', () => {
    const configs: Config[] = [];
    for (const D of [36, 44]) for (const W of [170, 240]) configs.push(setMeasurements(standardU(), { D, W }).config);
    configs.push(standardL('left', { W: 200 }), standardL('right', { W: 120, R: 100 }), standardStraight({ W: 212 }));
    for (const c of [...configs]) {
      const t = centralTable(c);
      if (!t.rejected) configs.push(t.config);
    }
    for (const c of [...configs]) configs.push(setSeatWidth(c, 24).config);
    for (const c of configs) {
      for (const s of SHAPES) {
        if (s === c.shape) continue;
        const r = to(c, s);
        const mirrored = c.shape !== 'U' && c.shape !== 'straight' && s !== 'U' && s !== 'straight';
        expect(backLook(r)).toEqual(mirrored ? backLook(c).reverse() : backLook(c));
      }
    }
  });

  it('loose pieces move with the back seats (and mirror between the two L’s)', () => {
    const l = addLooseInLayout(solo(standardU()), 'a', 'coffeeTable').layout;
    const c = l.sections[0]!.config;
    const x = c.loose[0]!.x;
    expect(to(c, 'L-left').loose[0]!.x).toBe(x); // the left corner stays: nothing moves
    expect(to(c, 'L-right').loose[0]!.x).toBe(x - 60); // the left corner goes: the back moves 60″ left
    const ll = to(c, 'L-left');
    const lr = to(ll, 'L-right');
    expect(lr.loose[0]!.x).toBe(ll.W - x - ll.loose[0]!.w);
  });
});

describe('the layout switch', () => {
  const u = (): Layout => solo(standardU());

  it('keeps the room and Snug; a centred room follows the sofa', () => {
    const l = setSnug(setRoom(u(), { w: 240, d: 200 }).layout, true).layout;
    const r = setLayoutShape(deepFreeze(l), 'L-left');
    expect(r.rejected).toBeNull();
    expect(r.layout.room).toEqual(l.room);
    expect(r.layout.snug).toBe(true);
    expect(r.layout.sections[0]!.config.shape).toBe('L-left');
  });

  it('a placed (Custom) room moves with the seats, so they stay where they were in the room', () => {
    const placed = nudgeRoom(setRoom(u(), { w: 240, d: 200 }).layout, 'left', 4).layout;
    const at = placed.room!.at as { mode: 'free'; x: number; y: number };
    expect(at.mode).toBe('free');
    const r = setLayoutShape(placed, 'L-right');
    expect(r.layout.room!.at).toEqual({ ...at, x: at.x - 60 });
  });

  it('a T starts fresh instead (refused, same reference); the same shape is a no-op', () => {
    const t = teeLayout({ total: 229, stem: 110 });
    expect(setLayoutShape(t, 'U').layout).toBe(t);
    expect(setLayoutShape(t, 'U').rejected?.code).toBe('notAllowed');
    const l = u();
    expect(setLayoutShape(l, 'U')).toEqual({ layout: l, rejected: null });
  });
});
