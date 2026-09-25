import { describe, expect, it } from 'vitest';
import { buildHaven } from './buildHaven';
import { blankConfig, standardL, standardU } from './defaults';
import { available } from './layout';
import * as raw from './ops';
import type { BuildResult, BuiltPiece, Config, Pt, RunId } from './types';

// ---------------------------------------------------------------------------
// Harness

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/**
 * §12 test 9, asserted on EVERY config a test produces: each run adds up
 * exactly to its available space (gaps included — "filled" runs have none),
 * no piece is over 108", lengths sit on the 0.5" grid, buildHaven reports no
 * errors, and the config is plain JSON (share link / undo safe).
 */
function valid(c: Config): BuildResult {
  const b = buildHaven(c);
  expect(b.errors).toEqual([]);
  for (const r of b.runs) {
    expect(r.sum).toBe(r.available);
    expect(r.available).toBe(available(c, r.id));
    if (r.unfilled === 0) expect(r.filled).toBe(r.available);
  }
  for (const p of b.pieces) {
    if (p.run) {
      expect(p.length).toBeLessThanOrEqual(108);
      expect(Number.isInteger(p.length * 2)).toBe(true);
    }
  }
  expect(JSON.parse(JSON.stringify(c))).toStrictEqual(c);
  return b;
}

/** Wrap an op: freeze its input (purity) and validate its output (test 9). */
function guard<A extends unknown[]>(f: (c: Config, ...a: A) => Config) {
  return (c: Config, ...a: A): Config => {
    deepFreeze(c);
    const next = f(c, ...a);
    valid(next);
    return next;
  };
}

const op = {
  setMeasurements: guard(raw.setMeasurements),
  setWedge: guard(raw.setWedge),
  resetWedge: guard(raw.resetWedge),
  setLock: guard(raw.setLock),
  setSeatWidth: guard(raw.setSeatWidth),
  setShape: guard(raw.setShape),
  resizePiece: guard(raw.resizePiece),
  dragSeam: guard(raw.dragSeam),
  addPiece: guard(raw.addPiece),
  deletePiece: guard(raw.deletePiece),
  convertPiece: guard(raw.convertPiece),
  setEndCap: guard(raw.setEndCap),
  moveTable: guard(raw.moveTable),
  reorderPiece: guard(raw.reorderPiece),
  addLoose: guard(raw.addLoose),
  moveLoose: guard(raw.moveLoose),
};

const U = (): Config => {
  const c = standardU();
  valid(c);
  return deepFreeze(c);
};

/** Compact run description, e.g. ['table 32', 'armless 36', 'oneArm 72=58+14@end']. */
function desc(c: Config, run: RunId): string[] {
  return c.runs[run]!.map((p) =>
    p.kind === 'oneArm' ? `oneArm ${p.length}=${p.length - c.dims.A}+${c.dims.A}@${p.arm}` : `${p.kind} ${p.length}`,
  );
}

const idAt = (c: Config, run: RunId, i: number): string => c.runs[run]![i]!.id;
const tableId = (c: Config): string => {
  for (const r of ['back', 'left', 'right'] as const) {
    const t = c.runs[r]?.find((p) => p.kind === 'table');
    if (t) return t.id;
  }
  throw new Error('no table');
};
const piece = (b: BuildResult, id: string): BuiltPiece => b.pieces.find((p) => p.id === id)!;
const codes = (b: BuildResult) => b.warnings.map((w) => w.code);

/** The sofa's back edge from x=0 to x=W as [kind length] (wedges and back-run pieces), checking contiguity. */
function backLine(b: BuildResult): string[] {
  const along = b.pieces
    .filter((p) => p.kind === 'wedge' || p.run === 'back')
    .sort((p, q) => p.bbox.x - q.bbox.x);
  let x = 0;
  for (const p of along) {
    expect(p.bbox.x).toBe(x);
    x += p.bbox.w;
  }
  expect(x).toBe(b.W);
  return along.map((p) => `${p.kind} ${p.length}`);
}

// ---------------------------------------------------------------------------
// §12 engine tests, exactly as written

describe('§12 spec tests', () => {
  it('1. Standard U: back [wedge 60][table 32][armless 36][wedge 60] = 188, legs one-arm 72, depth 34, opening 100x88, Seats 7', () => {
    const c = U();
    const b = valid(c);
    expect([b.W, b.L, b.R, b.D, b.wedge.C]).toEqual([188, 132, 132, 44, 60]);
    expect(backLine(b)).toEqual(['wedge 60', 'table 32', 'armless 36', 'wedge 60']);
    expect(desc(c, 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(c, 'right')).toEqual(['oneArm 72=58+14@end']);
    expect(b.seatDepth).toBe(34);
    expect(b.opening).toEqual({ width: 100, depth: 88 });
    expect(b.seats.label).toBe('Seats 7');
    expect(b.warnings).toEqual([]);
    expect(b.exportBlocked).toBe(false);
  });

  it('1. (geometry) exact §8 coordinates: wedge polygons, rects, arms, backs, cushions', () => {
    const c = U();
    const b = valid(c);
    expect(piece(b, 'wedge:backLeft').polygon).toEqual([[0, 0], [60, 0], [60, 44], [44, 60], [0, 60]]);
    expect(piece(b, 'wedge:backRight').polygon).toEqual([[188, 0], [188, 60], [144, 60], [128, 44], [128, 0]]);
    expect(piece(b, 'wedge:backLeft').backs).toEqual([{ x: 0, y: 0, w: 60, h: 10 }, { x: 0, y: 0, w: 10, h: 60 }]);
    expect(piece(b, tableId(c)).bbox).toEqual({ x: 60, y: 0, w: 32, h: 44 });
    expect(piece(b, idAt(c, 'back', 1)).bbox).toEqual({ x: 92, y: 0, w: 36, h: 44 });
    const left = piece(b, idAt(c, 'left', 0));
    expect(left.bbox).toEqual({ x: 0, y: 60, w: 44, h: 72 });
    expect(left.arm).toEqual({ at: 'end', facing: 'LAF', rect: { x: 0, y: 118, w: 44, h: 14 } });
    expect(left.backs).toEqual([{ x: 0, y: 60, w: 10, h: 58 }]);
    expect(left.cushionRect).toEqual({ x: 10, y: 60, w: 34, h: 58 });
    const right = piece(b, idAt(c, 'right', 0));
    expect(right.bbox).toEqual({ x: 144, y: 60, w: 44, h: 72 });
    expect(right.arm).toEqual({ at: 'end', facing: 'RAF', rect: { x: 144, y: 118, w: 44, h: 14 } });
    expect(right.backs).toEqual([{ x: 178, y: 60, w: 10, h: 58 }]);
    expect(right.cushionRect).toEqual({ x: 144, y: 60, w: 34, h: 58 });
    expect(b.runs.map((r) => [r.id, r.endCap])).toEqual([['back', null], ['left', 'arm'], ['right', 'arm']]);
    expect(b.wedge.readout).toBe('Wedge 60 × 60 · angled face 22.6"');
  });

  it('2. D = 36, auto wedge: C = 52, back armless 52, legs 80 (66+14), seat depth 26, outside 188/132/132', () => {
    for (const c of [op.setMeasurements(U(), { D: 36 }), standardU({ D: 36 })]) {
      const b = valid(c);
      expect(b.wedge).toMatchObject({ C: 52, auto: true });
      expect(desc(c, 'back')).toEqual(['table 32', 'armless 52']);
      expect(desc(c, 'left')).toEqual(['oneArm 80=66+14@end']);
      expect(desc(c, 'right')).toEqual(['oneArm 80=66+14@end']);
      expect(b.seatDepth).toBe(26);
      expect([b.W, b.L, b.R]).toEqual([188, 132, 132]);
    }
  });

  it('3a. table from the back to the end of the left leg in place of the arm: left 40 armless + 32 table, back armless 68', () => {
    const c0 = U();
    const c = op.moveTable(c0, tableId(c0), { run: 'left', at: 'replaceArm' });
    expect(desc(c, 'left')).toEqual(['armless 40', 'table 32']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    expect(valid(c).runs.find((r) => r.id === 'left')!.endCap).toBe('table');
    expect(c.runs.left![1]!.id).toBe(tableId(c0)); // the same table moved
  });

  it('3b. table to the middle of the left leg: 13 + 32 + 13 + 14 arm, and "seat under 20" fires', () => {
    const c0 = U();
    const c = op.moveTable(c0, tableId(c0), { run: 'left', at: 'split', pieceId: idAt(c0, 'left', 0) });
    expect(desc(c, 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27=13+14@end']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    const under = b.warnings.filter((w) => w.code === 'seatUnder20');
    // Both cushions are 13" — including the one-arm piece whose FOOTPRINT is 27".
    expect(under.map((w) => w.pieceId)).toEqual([idAt(c, 'left', 0), idAt(c, 'left', 2)]);
    expect(b.exportBlocked).toBe(false); // warnings never block
  });

  it('4. L-right W120 R100 C60: back one-arm 60 (46+14), leg one-arm 40 (26+14)', () => {
    const c = standardL('right', { W: 120, R: 100 });
    const b = valid(c);
    expect(b.wedge.C).toBe(60);
    expect(desc(c, 'back')).toEqual(['oneArm 60=46+14@start']);
    expect(desc(c, 'right')).toEqual(['oneArm 40=26+14@end']);
    expect(c.runs.left).toBeUndefined();
    expect(piece(b, idAt(c, 'back', 0)).arm).toEqual({ at: 'start', facing: 'LAF', rect: { x: 0, y: 0, w: 14, h: 44 } });
    expect(piece(b, idAt(c, 'right', 0)).bbox).toEqual({ x: 76, y: 60, w: 44, h: 40 });
    expect(backLine(b)).toEqual(['oneArm 60', 'wedge 60']);
    expect(b.opening).toBeNull();
  });

  it('5. auto-split: U with W = 300 -> back armless 148 becomes 2 x 74', () => {
    for (const c of [standardU({ W: 300 }), op.setMeasurements(U(), { W: 300 })]) {
      expect(desc(c, 'back')).toEqual(['table 32', 'armless 74', 'armless 74']);
      const [, a, b] = c.runs.back!;
      expect(a!.splitGroup).toBeDefined();
      expect(a!.splitGroup).toBe(b!.splitGroup);
      expect(valid(c).W).toBe(300);
    }
  });

  it('6. wedge slider 60 -> 55 on the Standard U: legs 77 (63+14), back armless 46, outside unchanged', () => {
    const c = op.setWedge(U(), 55);
    const b = valid(c);
    expect(b.wedge).toMatchObject({ C: 55, auto: false });
    expect(desc(c, 'left')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(c, 'right')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 46']);
    expect([b.W, b.L, b.R]).toEqual([188, 132, 132]);
  });

  it('7. open end on the right leg: one 72 armless piece', () => {
    const c = op.setEndCap(U(), 'right', 'open');
    expect(desc(c, 'right')).toEqual(['armless 72']);
    expect(valid(c).runs.find((r) => r.id === 'right')!.endCap).toBe('open');
  });

  it('8. Blank U W188 L132 R132, only the wedges placed: unfilled 68 / 72 / 72 and export blocked', () => {
    const c = deepFreeze(blankConfig('U', { W: 188, L: 132, R: 132 }));
    const b = valid(c);
    expect(b.pieces.map((p) => p.kind)).toEqual(['wedge', 'wedge']);
    expect(b.gaps.map((g) => [g.run, g.length, g.label])).toEqual([
      ['back', 68, 'unfilled 68"'],
      ['left', 72, 'unfilled 72"'],
      ['right', 72, 'unfilled 72"'],
    ]);
    expect(b.runs.map((r) => r.unfilled)).toEqual([68, 72, 72]);
    expect(b.exportBlocked).toBe(true);
  });

  it('9. every §12 case: each run sums exactly to its space and no piece exceeds 108', () => {
    const u = U();
    const cases = [
      u,
      op.setMeasurements(u, { D: 36 }),
      op.moveTable(u, tableId(u), { run: 'left', at: 'replaceArm' }),
      op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) }),
      standardL('right', { W: 120, R: 100 }),
      standardU({ W: 300 }),
      op.setWedge(u, 55),
      op.setEndCap(u, 'right', 'open'),
      blankConfig('U'),
    ];
    for (const c of cases) {
      const b = valid(c);
      for (const r of b.runs) {
        const sum = c.runs[r.id]!.reduce((s, p) => s + p.length, 0);
        expect(sum).toBe(available(c, r.id));
      }
      expect(b.pieces.every((p) => p.run === null || p.length <= 108)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases the model must decide

describe('shapes', () => {
  it('L-left is the exact mirror of test 4 (x -> W - x, LAF <-> RAF)', () => {
    const r = valid(standardL('right', { W: 120, R: 100 }));
    const l = valid(standardL('left', { W: 120, L: 100 }));
    const norm = (poly: Pt[]) => poly.map((p) => `${p[0]},${p[1]}`).sort().join(' ');
    const mirror = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [120 - x, y]);
    const sofa = (b: BuildResult) => b.pieces.filter((p) => p.run || p.corner);
    expect(sofa(l).map((p) => norm(p.polygon)).sort()).toEqual(sofa(r).map((p) => norm(mirror(p.polygon))).sort());
    const armOf = (b: BuildResult, run: RunId) => b.pieces.find((p) => p.run === run)!.arm!;
    expect(armOf(r, 'back')).toMatchObject({ at: 'start', facing: 'LAF', rect: { x: 0, w: 14 } });
    expect(armOf(l, 'back')).toMatchObject({ at: 'end', facing: 'RAF', rect: { x: 106, w: 14 } });
    expect(armOf(r, 'right').facing).toBe('RAF');
    expect(armOf(l, 'left').facing).toBe('LAF');
    expect(r.seats).toEqual(l.seats);
  });

  it('setShape keeps a surviving leg and default-fills the back (its end kinds changed)', () => {
    const c = op.setShape(op.setEndCap(U(), 'right', 'open'), 'L-right');
    expect(desc(c, 'right')).toEqual(['armless 72']);
    // back = W - C = 128 -> one-arm 128 (arm at the open start) -> auto-split, equal cushions 57 / 57
    expect(desc(c, 'back')).toEqual(['oneArm 71=57+14@start', 'armless 57']);
  });
});

describe('lock outside size', () => {
  it('lock OFF: edits grow/shrink runs and W/L/R are derived from the pieces; lock ON freezes them', () => {
    const c1 = op.setLock(U(), false);
    const backSeat = idAt(c1, 'back', 1);
    const c2 = op.resizePiece(c1, backSeat, 50);
    expect(desc(c2, 'back')).toEqual(['table 32', 'armless 50']);
    expect([c2.W, c2.L, c2.R]).toEqual([202, 132, 132]); // 60 + 32 + 50 + 60
    expect(valid(c2).opening).toEqual({ width: 114, depth: 88 });
    const c3 = op.addPiece(c2, 'armless', { run: 'left', at: 'seam', seam: 0 });
    expect(desc(c3, 'left')).toEqual(['armless 36', 'oneArm 72=58+14@end']);
    expect(c3.L).toBe(168);
    expect(op.deletePiece(c1, backSeat).W).toBe(152); // run shrinks when unlocked
    const moved = op.moveTable(c1, tableId(c1), { run: 'left', at: 'seam', seam: 1 });
    expect([moved.W, moved.L]).toEqual([156, 164]); // back loses 32, left gains 32

    const c4 = op.setLock(c3, true);
    expect([c4.W, c4.L, c4.R]).toEqual([202, 168, 132]);
    const c5 = op.resizePiece(c4, tableId(c4), 40);
    expect(desc(c5, 'back')).toEqual(['table 40', 'armless 42']);
    expect(c5.W).toBe(202);
    const c6 = op.deletePiece(c4, idAt(c4, 'left', 0));
    expect(desc(c6, 'left')).toEqual(['oneArm 108=94+14@end']);
    expect(c6.L).toBe(168);
  });

  it('typed measurements always rebalance, even with the lock off', () => {
    const c = op.setMeasurements(op.resizePiece(op.setLock(U(), false), idAt(U(), 'back', 1), 50), { W: 210 });
    expect(c.W).toBe(210);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 58']);
  });

  it('lock ON rejects an edit nothing can absorb (same reference back)', () => {
    const u = U();
    // back seat 36 -> 60 would need the table to shrink: tables never absorb
    expect(raw.resizePiece(u, idAt(u, 'back', 1), 60)).toBe(u);
    // W = 140: the back needs -48 but its only seat can give 30 (6" floor)
    expect(raw.setMeasurements(u, { W: 140 })).toBe(u);
    // ...while the preset at W = 140 drops the table and warns about the opening
    const small = standardU({ W: 140 });
    expect(desc(small, 'back')).toEqual(['armless 20']);
    expect(codes(valid(small))).toContain('openingUnder60');
  });
});

describe('tables', () => {
  it('table OUTSIDE the arm at a run end with the lock on', () => {
    const u = U();
    const c = op.moveTable(u, tableId(u), { run: 'left', at: 'seam', seam: 1 });
    expect(desc(c, 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']);
    expect(desc(c, 'back')).toEqual(['armless 68']);
    const b = valid(c);
    expect(b.runs.find((r) => r.id === 'left')!.endCap).toBe('armTable');
    expect(piece(b, idAt(c, 'left', 0)).arm!.rect).toEqual({ x: 0, y: 86, w: 44, h: 14 });
    expect(piece(b, tableId(c)).bbox).toEqual({ x: 0, y: 100, w: 44, h: 32 });
    expect(b.seats.label).toBe('Seats 6–7'); // the 26" left stretch is 0 comfortable / 1 snug
    // end-cap menu from armTable
    expect(desc(op.setEndCap(c, 'left', 'table'), 'left')).toEqual(['armless 40', 'table 32']);
    expect(desc(op.setEndCap(c, 'left', 'arm'), 'left')).toEqual(['oneArm 72=58+14@end']);
    expect(desc(op.setEndCap(c, 'left', 'open'), 'left')).toEqual(['armless 72']);
  });

  it('several tables: end cap "table" adds one; same-run moves are pure reorders', () => {
    const u = U();
    const c = op.setEndCap(u, 'right', 'table');
    expect(desc(c, 'right')).toEqual(['armless 40', 'table 32']);
    expect(valid(c).pieces.filter((p) => p.kind === 'table')).toHaveLength(2);
    const r = op.moveTable(u, tableId(u), { run: 'back', at: 'seam', seam: 1 });
    expect(desc(r, 'back')).toEqual(['armless 36', 'table 32']);
    expect(raw.moveTable(u, tableId(u), { run: 'back', at: 'seam', seam: 0 })).toBe(u); // no-op
  });

  it('absorber tie-break: nearest seat, then the LARGER cushion, then the lower index', () => {
    // [T][70][50]: a table dropped between the two seats is paid for by the 70
    const g = standardU({ W: 272 }); // back [T][60][60] (split group)
    const uneven = op.dragSeam(g, 'back', 2, 10);
    expect(desc(uneven, 'back')).toEqual(['table 32', 'armless 70', 'armless 50']);
    expect(desc(op.addPiece(uneven, 'table', { run: 'back', at: 'seam', seam: 2 }), 'back')).toEqual([
      'table 32', 'armless 38', 'table 32', 'armless 50',
    ]);
    // equal sizes -> the lower index (toward the run start) pays; the split group dissolves
    const even = op.addPiece(g, 'table', { run: 'back', at: 'seam', seam: 2 });
    expect(desc(even, 'back')).toEqual(['table 32', 'armless 28', 'table 32', 'armless 60']);
    expect(even.runs.back!.every((p) => p.splitGroup === undefined)).toBe(true);
  });

  it('split placement with an odd remainder: the extra 0.5 goes to the side away from the arm', () => {
    const u = U();
    const c = op.addPiece(u, 'table', { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) }, { length: 31.5 });
    expect(desc(c, 'left')).toEqual(['armless 13.5', 'table 31.5', 'oneArm 27=13+14@end']);
  });
});

describe('table dragging', () => {
  it('snapTable picks the nearest feasible snap target from the drag-start config', () => {
    const u = U();
    const t = tableId(u);
    const snap = (c: Config, p: [number, number]) => {
      deepFreeze(c);
      const next = raw.snapTable(c, t, p);
      valid(next);
      return next;
    };
    // along the back: the other seam (a pure reorder)...
    expect(desc(snap(u, [120, 22]), 'back')).toEqual(['armless 36', 'table 32']);
    // ...or the middle of the back seat, which first re-absorbs the table (68) then splits it
    expect(desc(snap(u, [95, 22]), 'back')).toEqual(['armless 18', 'table 32', 'armless 18']);
    // middle of the left leg -> splits the seat = test 3b
    const mid = snap(u, [22, 96]);
    expect(desc(mid, 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27=13+14@end']);
    // end of the left leg -> outside the arm; the end-cap menu then swaps the arm for the table = test 3a
    const end = snap(u, [22, 125]);
    expect(desc(end, 'left')).toEqual(['oneArm 40=26+14@end', 'table 32']);
    expect(desc(op.setEndCap(end, 'left', 'table'), 'left')).toEqual(['armless 40', 'table 32']);
    // pointer on the table's own spot -> nothing changes
    expect(raw.snapTable(u, t, [76, 22])).toBe(u);
  });

  it('PAIN POINT: moves are path-dependent — taking the table back out does not re-merge the split leg', () => {
    const u = U();
    const t = tableId(u);
    const mid = op.moveTable(u, t, { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) });
    const back = op.moveTable(mid, t, { run: 'back', at: 'seam', seam: 0 });
    expect(desc(back, 'back')).toEqual(desc(u, 'back')); // the back is restored...
    expect(desc(back, 'left')).toEqual(['armless 45', 'oneArm 27=13+14@end']); // ...the leg is not (was one-arm 72)
    // undo (restoring the earlier config) is the only exact way back
    expect(desc(u, 'left')).toEqual(['oneArm 72=58+14@end']);
  });

  it('PAIN POINT: seam drags must use the cumulative dx from the gesture start (per-event 0.5" snapping drifts)', () => {
    const s = standardU({ W: 272 }); // back [T][60 g][60 g]
    let inc = s;
    for (let k = 0; k < 10; k++) inc = raw.dragSeam(inc, 'back', 2, 0.3); // ten pointer events of 0.3"
    const cumulative = op.dragSeam(s, 'back', 2, 3);
    expect(desc(cumulative, 'back')).toEqual(['table 32', 'armless 63', 'armless 57']);
    expect(desc(inc, 'back')).toEqual(['table 32', 'armless 65', 'armless 55']);
  });
});

describe('auto-split and re-merge', () => {
  it('uneven splits at 0.5" resolution: remainder half-inches go to the run start', () => {
    expect(desc(standardU({ W: 301 }), 'back')).toEqual(['table 32', 'armless 74.5', 'armless 74.5']); // 149 divides at 0.5
    expect(desc(standardU({ W: 300.5 }), 'back')).toEqual(['table 32', 'armless 74.5', 'armless 74']);
    expect(desc(standardU({ W: 369 }), 'back')).toEqual(['table 32', 'armless 72.5', 'armless 72.5', 'armless 72']);
  });

  it('one-arm over 108: the arm stays on the open-end piece and is EXTRA to equal cushions', () => {
    // 130 = 116 cushion + 14 arm -> cushions 58 / 58 -> [58][72]
    expect(desc(standardU({ L: 190 }), 'left')).toEqual(['armless 58', 'oneArm 72=58+14@end']);
    // 216 = 202 + 14: two pieces would need 101 + 14 = 115 > 108, so three: 67.5 / 67.5 / 67 (+14)
    expect(desc(standardU({ R: 276 }), 'right')).toEqual(['armless 67.5', 'armless 67.5', 'oneArm 81=67+14@end']);
    // arm at the run START (L-right back): the odd half-inch goes to the piece away from the arm
    expect(desc(standardL('right', { W: 190.5 }), 'back')).toEqual(['oneArm 72=58+14@start', 'armless 58.5']);
  });

  it('a split group re-merges when the run shrinks, and re-splits on the way back', () => {
    const u = U();
    const big = op.setMeasurements(u, { W: 300 });
    const back = op.setMeasurements(big, { W: 188 });
    expect(back.runs.back).toStrictEqual(u.runs.back); // same pieces, same ids
    expect(desc(op.setMeasurements(back, { W: 300 }), 'back')).toEqual(['table 32', 'armless 74', 'armless 74']);
    // growth inside the group stays equal: W 300 -> 310
    expect(desc(op.setMeasurements(big, { W: 310 }), 'back')).toEqual(['table 32', 'armless 79', 'armless 79']);
  });

  it('a manual seam drag dissolves the group; user-owned pieces never re-merge', () => {
    const big = standardU({ W: 300 });
    const dragged = op.dragSeam(big, 'back', 2, 10);
    expect(desc(dragged, 'back')).toEqual(['table 32', 'armless 84', 'armless 64']);
    expect(dragged.runs.back!.some((p) => p.splitGroup)).toBe(false);
    // W 300 -> 250: -25 at each wedge end, each absorbed by the seat nearest that end
    expect(desc(op.setMeasurements(dragged, { W: 250 }), 'back')).toEqual(['table 32', 'armless 59', 'armless 39']);
  });
});

describe('wedge slider', () => {
  it('manual C sticks when D changes until "Reset wedge"', () => {
    const a = op.setWedge(U(), 55);
    const b = op.setMeasurements(a, { D: 36 });
    const bb = valid(b);
    expect(bb.wedge).toMatchObject({ C: 55, auto: false, readout: 'Wedge 55 × 55 · angled face 26.9"' });
    expect(desc(b, 'left')).toEqual(['oneArm 77=63+14@end']);
    expect(desc(b, 'back')).toEqual(['table 32', 'armless 46']);
    const c = op.resetWedge(b);
    expect(valid(c).wedge).toMatchObject({ C: 52, auto: true });
    expect(desc(c, 'left')).toEqual(['oneArm 80=66+14@end']);
    expect(desc(c, 'back')).toEqual(['table 32', 'armless 52']);
  });

  it('a manual C outside the new D..D+30 range is clamped (and stays manual)', () => {
    const d = op.setWedge(U(), 74);
    expect(desc(d, 'back')).toEqual(['table 32', 'armless 8']);
    const e = op.setMeasurements(d, { D: 40 });
    expect(e.wedgeC).toBe(70);
    expect(desc(e, 'left')).toEqual(['oneArm 62=48+14@end']);
    expect(desc(e, 'back')).toEqual(['table 32', 'armless 16']);
  });

  it('snaps to 1", clamps to D..D+30; square corner has no angled-face warning, < 8" does', () => {
    const u = U();
    expect(op.setWedge(u, 55.4).wedgeC).toBe(55);
    expect(op.setWedge(u, 100).wedgeC).toBe(74);
    const sq = op.setWedge(u, 30);
    const b = valid(sq);
    expect(sq.wedgeC).toBe(44);
    expect(piece(b, 'wedge:backLeft').polygon).toEqual([[0, 0], [44, 0], [44, 44], [0, 44]]);
    expect(b.wedge.face).toBe(0);
    expect(codes(b)).not.toContain('wedgeFaceUnder8');
    expect(codes(valid(op.setWedge(u, 49)))).toContain('wedgeFaceUnder8'); // 5 * sqrt2 = 7.1
    const same = op.setWedge(u, 55);
    expect(raw.setWedge(same, 55)).toBe(same);
  });
});

describe('blank mode', () => {
  it('reports gaps while partially filled; new pieces eat the nearest gap first, then cascade into seats', () => {
    const b0 = blankConfig('U');
    const b1 = op.addPiece(b0, 'oneArm', { run: 'left', at: 'seam', seam: 1 });
    expect(desc(b1, 'left')).toEqual(['gap 22', 'oneArm 50=36+14@end']);
    const g = valid(b1).gaps.find((x) => x.run === 'left')!;
    expect(g).toMatchObject({ offset: 0, length: 22, label: 'unfilled 22"', rect: { x: 0, y: 60, w: 44, h: 22 } });
    expect(valid(b1).runs.find((r) => r.id === 'left')).toMatchObject({ filled: 50, unfilled: 22, endCap: 'arm' });
    const b2 = op.addPiece(b1, 'table', { run: 'back', at: 'seam', seam: 0 });
    expect(desc(b2, 'back')).toEqual(['table 32', 'gap 36']);
    expect(valid(b2).exportBlocked).toBe(true);
    // 30" into [gap 22][oneArm 50]: the gap gives 22, the seat gives the other 8
    const b3 = op.addPiece(b1, 'armless', { run: 'left', at: 'seam', seam: 0 }, { length: 30 });
    expect(desc(b3, 'left')).toEqual(['armless 30', 'oneArm 42=28+14@end']);
  });

  it('in a partially filled run, deletes and growth leave gaps in place (placed pieces do not move)', () => {
    const b2 = op.addPiece(blankConfig('U'), 'table', { run: 'back', at: 'seam', seam: 0 });
    const b4 = op.addPiece(b2, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 20 });
    expect(desc(b4, 'back')).toEqual(['table 32', 'armless 20', 'gap 16']);
    const b5 = op.deletePiece(b4, tableId(b4));
    expect(desc(b5, 'back')).toEqual(['gap 32', 'armless 20', 'gap 16']);
    const backGaps = valid(b5).gaps.filter((x) => x.run === 'back');
    expect(backGaps.map((x) => [x.offset, x.length])).toEqual([[0, 32], [52, 16]]);
    const b1 = op.addPiece(blankConfig('U'), 'oneArm', { run: 'left', at: 'seam', seam: 1 });
    expect(desc(op.setMeasurements(b1, { L: 142 }), 'left')).toEqual(['gap 22', 'oneArm 50=36+14@end', 'gap 10']);
    // deleting the last piece of a filled run leaves a gap too (nothing to absorb)
    expect(desc(op.deletePiece(U(), idAt(U(), 'left', 0)), 'left')).toEqual(['gap 72']);
  });

  it('filling every gap unblocks export and reproduces the Standard U', () => {
    let c = blankConfig('U');
    c = op.addPiece(c, 'table', { run: 'back', at: 'seam', seam: 0 });
    c = op.addPiece(c, 'armless', { run: 'back', at: 'seam', seam: 1 });
    c = op.addPiece(c, 'oneArm', { run: 'left', at: 'seam', seam: 0 }, { length: 72 });
    c = op.addPiece(c, 'oneArm', { run: 'right', at: 'seam', seam: 0 }, { length: 72 });
    const b = valid(c);
    expect(b.gaps).toEqual([]);
    expect(b.exportBlocked).toBe(false);
    for (const r of ['back', 'left', 'right'] as const) expect(desc(c, r)).toEqual(desc(U(), r));
    expect(b.seats.label).toBe('Seats 7');
  });
});

describe('seam handles', () => {
  const s0 = () => {
    const u = U();
    return op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) }); // [13][T32][27]
  };

  it('keeps the pair total, snaps to 0.5 and clamps (table 16..40, seat >= min(20, now), piece <= 108)', () => {
    const s = s0();
    expect(desc(op.dragSeam(s, 'left', 1, 10), 'left')).toEqual(['armless 23', 'table 22', 'oneArm 27=13+14@end']);
    expect(desc(op.dragSeam(s, 'left', 1, 25), 'left')).toEqual(['armless 29', 'table 16', 'oneArm 27=13+14@end']);
    expect(raw.dragSeam(s, 'left', 1, -5)).toBe(s); // the 13" seat may not shrink further
    expect(desc(op.dragSeam(s, 'left', 2, -3.3), 'left')).toEqual(['armless 13', 'table 28.5', 'oneArm 30.5=16.5+14@end']);
    const u = U();
    expect(raw.dragSeam(u, 'back', 0, 5)).toBe(u); // wedge edge: use the wedge slider
    expect(raw.dragSeam(u, 'left', 1, 5)).toBe(u); // open end: no neighbour
    const big = standardU({ W: 300 });
    expect(desc(op.dragSeam(big, 'back', 2, 50), 'back')).toEqual(['table 32', 'armless 108', 'armless 40']);
  });

  it('a split group on one side of a seam moves as one logical seat (stays equal, keeps its group)', () => {
    const big = standardU({ W: 300 }); // [T 32][74 g][74 g]
    const wider = op.dragSeam(big, 'back', 1, 4);
    expect(desc(wider, 'back')).toEqual(['table 36', 'armless 72', 'armless 72']);
    expect(wider.runs.back![1]!.splitGroup).toBe(big.runs.back![1]!.splitGroup);
    expect(desc(op.dragSeam(big, 'back', 1, -10), 'back')).toEqual(['table 22', 'armless 79', 'armless 79']);
    expect(desc(op.dragSeam(big, 'back', 1, 20), 'back')).toEqual(['table 40', 'armless 70', 'armless 70']); // table clamps at 40
  });

  it('dragging into a blank-mode gap resizes the piece; the gap disappears at 0', () => {
    const b2 = op.addPiece(blankConfig('U'), 'table', { run: 'back', at: 'seam', seam: 0 });
    const b4 = op.addPiece(b2, 'armless', { run: 'back', at: 'seam', seam: 1 }, { length: 20 });
    expect(desc(op.dragSeam(b4, 'back', 2, 10), 'back')).toEqual(['table 32', 'armless 30', 'gap 6']);
    const full = op.dragSeam(b4, 'back', 2, 99);
    expect(desc(full, 'back')).toEqual(['table 32', 'armless 36']);
    expect(valid(full).runs.find((r) => r.id === 'back')).toMatchObject({ unfilled: 0, filled: 68 });
  });
});

describe('pieces menu', () => {
  it('convert keeps the footprint; reorder is a pure permutation', () => {
    const u = U();
    expect(desc(op.convertPiece(u, idAt(u, 'left', 0)), 'left')).toEqual(['armless 72']);
    expect(desc(op.convertPiece(u, idAt(u, 'back', 1)), 'back')).toEqual(['table 32', 'oneArm 36=22+14@end']);
    const s = op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) });
    expect(raw.convertPiece(s, idAt(s, 'left', 0))).toBe(s); // 13" can't carry a 14" arm
    expect(desc(op.reorderPiece(u, tableId(u), 1), 'back')).toEqual(['armless 36', 'table 32']);
  });
});

describe('seat count', () => {
  it('"Seats 7–8" when comfortable and snug differ; seat width is a setting', () => {
    const c = op.setMeasurements(U(), { D: 36 }); // back stretch 52: 1 @28, 2 @24
    expect(valid(c).seats).toEqual({ comfortable: 7, snug: 8, label: 'Seats 7–8' });
    expect(valid(op.setSeatWidth(c, 24)).seats.label).toBe('Seats 8');
    expect(valid(op.setSeatWidth(c, 22)).seats).toEqual({ comfortable: 10, snug: 10, label: 'Seats 10' });
  });

  it('warns on seat depth under 24', () => {
    expect(codes(valid(standardU({ D: 32 })))).toContain('seatDepthUnder24');
    expect(codes(valid(standardU({ D: 36 })))).not.toContain('seatDepthUnder24');
  });
});

describe('coffee table', () => {
  it('clearance per side; warns under 14"; the wedge angled face is measured exactly', () => {
    const c = op.addLoose(U(), 'coffeeTable');
    const id = c.loose[0]!.id;
    const b = valid(c);
    expect(c.loose[0]).toMatchObject({ x: 70, y: 64, w: 48, d: 48 });
    expect(b.clearances).toEqual([{ pieceId: id, back: 20, left: 26, right: 26, front: null, min: 20 }]);
    expect(codes(b)).not.toContain('coffeeClearanceUnder14');
    const near = valid(op.moveLoose(c, id, 70, 54));
    expect(near.clearances[0]).toMatchObject({ back: 10, min: 10 });
    expect(near.warnings.find((w) => w.code === 'coffeeClearanceUnder14')!.message).toBe(
      'Coffee table clearance 10" is under 14"',
    );
    // at (58, 58) the back seats / leg are 14" away but the wedge's angled face is 12";
    // on the right the back-right wedge's face (x = 142 at y = 58) beats the leg at x = 144
    const corner = valid(op.moveLoose(c, id, 58, 58));
    expect(corner.clearances[0]).toMatchObject({ back: 12, left: 12, right: 36, front: null });
  });
});

describe('undo / purity', () => {
  it('undo = restoring a previous config; configs are plain JSON and never mutated', () => {
    const history: Config[] = [U()];
    const snapshots: string[] = [JSON.stringify(buildHaven(history[0]!))];
    const push = (c: Config) => {
      history.push(c);
      snapshots.push(JSON.stringify(buildHaven(c)));
    };
    push(op.setWedge(history[0]!, 55));
    push(op.moveTable(history[1]!, tableId(history[1]!), { run: 'left', at: 'split', pieceId: idAt(history[1]!, 'left', 0) }));
    push(op.setMeasurements(history[2]!, { W: 300 }));
    push(op.setLock(history[3]!, false));
    push(op.resizePiece(history[4]!, idAt(history[4]!, 'back', 0), 60));
    // every earlier config still builds exactly as it did (nothing was mutated)
    history.forEach((c, i) => expect(JSON.stringify(buildHaven(c))).toBe(snapshots[i]));
    // undo x2, redo x1 = pick an index
    let cursor = history.length - 1;
    cursor -= 2;
    expect(JSON.stringify(buildHaven(history[cursor]!))).toBe(snapshots[3]);
    cursor += 1;
    expect(history[cursor]!.lockOutside).toBe(false);
    // a share-link round trip continues editing identically (ids included)
    const parsed = JSON.parse(JSON.stringify(history[2]!)) as Config;
    expect(op.setMeasurements(parsed, { W: 300 })).toStrictEqual(history[3]);
    // rejected / no-op edits hand back the same reference (UI: "nothing happened")
    expect(raw.setLock(history[0]!, true)).toBe(history[0]);
  });
});

// ---------------------------------------------------------------------------
// Property test: random edit sequences never break the invariants

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('property', () => {
  it('4000 random ops from random starts keep every invariant (or are rejected untouched)', () => {
    const rnd = mulberry32(12345);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    const stats: Record<string, { ok: number; no: number }> = {};
    const outside = (c: Config) => [c.W, c.L, c.R].join('/');
    for (let seq = 0; seq < 200; seq++) {
      const m = { W: int(200, 360), L: int(110, 240), R: int(110, 240), D: pick([36, 40, 44]) };
      let c: Config = pick([
        () => standardU(m),
        () => standardL('left', m),
        () => standardL('right', m),
        () => blankConfig('U', m),
        () => blankConfig('L-right', m),
      ])();
      for (let step = 0; step < 20; step++) {
        const runs = (Object.keys(c.runs) as RunId[]).filter((r) => c.runs[r]);
        const run = pick(runs);
        const ps = c.runs[run]!;
        const any = ps.length ? pick(ps) : undefined;
        const tables = runs.flatMap((r) => c.runs[r]!.filter((p) => p.kind === 'table'));
        const seam = int(0, ps.length);
        const placement = () =>
          pick([
            { run, at: 'seam' as const, seam: int(0, ps.length) },
            { run, at: 'replaceArm' as const },
            ...(any ? [{ run, at: 'split' as const, pieceId: any.id }] : []),
          ]);
        // [name, keeps W/L/R when locked?, op]
        const [name, pieceEdit, f] = pick<[string, boolean, () => Config]>([
          ['setMeasurements W', false, () => raw.setMeasurements(c, { W: c.W + int(-30, 30) / 2 })],
          ['setMeasurements L/R', false, () => raw.setMeasurements(c, { L: c.L + int(-20, 20), R: c.R + int(-20, 20) })],
          ['setMeasurements D', true, () => raw.setMeasurements(c, { D: pick([36, 40, 44, 38.5]) })],
          ['setWedge', true, () => raw.setWedge(c, int(30, 80))],
          ['resetWedge', true, () => raw.resetWedge(c)],
          ['setLock', false, () => raw.setLock(c, rnd() < 0.5)],
          ['resizePiece', true, () => (any ? raw.resizePiece(c, any.id, any.length + int(-40, 40) / 2) : c)],
          ['dragSeam', true, () => raw.dragSeam(c, run, seam, int(-60, 60) / 2)],
          ['addPiece', true, () => raw.addPiece(c, pick(['armless', 'oneArm', 'table'] as const), placement())],
          ['deletePiece', true, () => (any ? raw.deletePiece(c, any.id) : c)],
          ['convertPiece', true, () => (any ? raw.convertPiece(c, any.id) : c)],
          ['setEndCap', true, () => raw.setEndCap(c, run, pick(['arm', 'table', 'open'] as const))],
          ['moveTable', true, () => (tables.length ? raw.moveTable(c, pick(tables).id, placement()) : c)],
          ['reorderPiece', true, () => (any ? raw.reorderPiece(c, any.id, int(0, ps.length - 1)) : c)],
          ['setShape', false, () => raw.setShape(c, pick(['U', 'L-left', 'L-right'] as const))],
        ]);
        deepFreeze(c);
        const before = JSON.stringify(c);
        const next = f();
        expect(JSON.stringify(c)).toBe(before); // input untouched
        const s = (stats[name] ??= { ok: 0, no: 0 });
        if (next === c) {
          s.no++;
          continue;
        }
        s.ok++;
        valid(next);
        // Lock ON: no piece/wedge/depth edit may move the outside size.
        if (pieceEdit && c.lockOutside) expect(outside(next)).toBe(outside(c));
        // A seam drag only trades inches between its two neighbours.
        if (name === 'dragSeam') {
          const pair = (x: Config) => x.runs[run]!.reduce((t, p) => t + p.length, 0);
          expect(pair(next)).toBe(pair(c));
          expect(outside(next)).toBe(outside(c));
        }
        c = next;
      }
    }
    const total = Object.values(stats).reduce((t, s) => t + s.ok + s.no, 0);
    expect(total).toBe(4000);
    // every op kind was actually exercised and accepted many times
    for (const [name, s] of Object.entries(stats)) expect(s.ok, name).toBeGreaterThan(25);
  });
});
