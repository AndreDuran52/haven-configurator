// Shared test harness for the engine tests (not a test file itself).
import { expect } from 'vitest';
import { buildHaven } from './buildHaven';
import { blankConfig, standardL, standardU } from './defaults';
import { available, openEnd, runIds, wedgeC } from './layout';
import { ABSORB_FLOOR, cushionOf, isSeat } from './pieces';
import { armInvariantOk, assertInvariants } from './rules';
import * as raw from './index';
import type { BuildResult, BuiltPiece, Config, EditResult, Rejection, RunId } from './types';

export { raw };

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/**
 * The §11 invariant (§12 test 9), asserted on EVERY config a test produces:
 * each run (gaps included) sums to its available space; no seat or table over
 * 108; lengths > 0 on the 0.5 grid; D and C whole inches; every cushion >= 6;
 * the G11 arm invariant; no build errors; a lossless JSON round trip.
 */
export function valid(c: Config): BuildResult {
  const b = buildHaven(c);
  expect(b.errors).toEqual([]);
  expect(() => assertInvariants(c)).not.toThrow();
  expect(Number.isInteger(c.D) && Number.isInteger(wedgeC(c))).toBe(true);
  for (const r of b.runs) {
    expect(r.sum).toBe(r.available);
    expect(r.available).toBe(available(c, r.id));
    if (r.unfilled === 0) expect(r.filled).toBe(r.available);
  }
  for (const run of runIds(c.shape)) {
    const ps = c.runs[run]!;
    expect(armInvariantOk(ps, openEnd(c.shape, run))).toBe(true);
    for (const p of ps) {
      expect(p.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.length * 2)).toBe(true);
      if (p.kind !== 'gap') expect(p.length).toBeLessThanOrEqual(108);
      if (isSeat(p)) expect(cushionOf(p, c.dims.A)).toBeGreaterThanOrEqual(ABSORB_FLOOR);
    }
  }
  expect(JSON.parse(JSON.stringify(c))).toStrictEqual(c);
  return b;
}

/** Wrap an op: freeze its input (purity), require success, validate the output. */
export function guard<A extends unknown[]>(f: (c: Config, ...a: A) => EditResult) {
  return (c: Config, ...a: A): Config => {
    deepFreeze(c);
    const r = f(c, ...a);
    expect(r.rejected).toBeNull();
    valid(r.config);
    return r.config;
  };
}

/** Assert a refusal: same reference back, with this code. */
export function refused(r: EditResult, input: Config, code: Rejection['code']): Rejection {
  expect(r.config).toBe(input);
  expect(r.rejected?.code).toBe(code);
  return r.rejected!;
}

export const op = {
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
  fillGap: guard(raw.fillGap),
  addLoose: guard(raw.addLoose),
  moveLoose: guard(raw.moveLoose),
  resizeLoose: guard(raw.resizeLoose),
};

export const U = (): Config => {
  const c = standardU();
  valid(c);
  return deepFreeze(c);
};

/** Compact run description, e.g. ['table 32', 'armless 36', 'oneArm 72=58+14@end']. */
export function desc(c: Config, run: RunId): string[] {
  return c.runs[run]!.map((p) =>
    p.kind === 'oneArm' ? `oneArm ${p.length}=${p.length - c.dims.A}+${c.dims.A}@${p.arm}` : `${p.kind} ${p.length}`,
  );
}

/** Lengths only, per run: for "equals the Standard U lengths" checks. */
export const shapeOf = (c: Config) =>
  Object.fromEntries(runIds(c.shape).map((r) => [r, desc(c, r)])) as Record<RunId, string[]>;

export const idAt = (c: Config, run: RunId, i: number): string => c.runs[run]![i]!.id;
export const tableId = (c: Config): string => {
  for (const r of ['back', 'left', 'right'] as const) {
    const t = c.runs[r]?.find((p) => p.kind === 'table');
    if (t) return t.id;
  }
  throw new Error('no table');
};
export const piece = (b: BuildResult, id: string): BuiltPiece => b.pieces.find((p) => p.id === id)!;
export const codes = (b: BuildResult) => b.warnings.map((w) => w.code);
export const runOf = (b: BuildResult, id: RunId) => b.runs.find((r) => r.id === id)!;

/** The sofa's back edge from x=0 to x=W as [kind length] (wedges and back-run pieces), checking contiguity. */
export function backLine(b: BuildResult): string[] {
  const along = b.pieces.filter((p) => p.kind === 'wedge' || p.run === 'back').sort((p, q) => p.bbox.x - q.bbox.x);
  let x = 0;
  for (const p of along) {
    expect(p.bbox.x).toBe(x);
    x += p.bbox.w;
  }
  expect(x).toBe(b.W);
  return along.map((p) => `${p.kind} ${p.length}`);
}

/** Standard U after test 3b (table split into the left leg). */
export function test3b(): Config {
  const u = U();
  return op.moveTable(u, tableId(u), { run: 'left', at: 'split', pieceId: idAt(u, 'left', 0) });
}

/** The nine fixtures of plan §11 (T1–T8 + T5's blank variant), as configs. */
export function fixtures(): Record<string, Config> {
  const u = U();
  return {
    T1: u,
    T2: op.setMeasurements(u, { D: 36 }),
    T3a: op.moveTable(u, tableId(u), { run: 'left', at: 'replaceArm' }),
    T3b: test3b(),
    T4: standardL('right', { W: 120, R: 100 }),
    T5: standardU({ W: 300 }),
    T6: op.setWedge(u, 55),
    T7: op.setEndCap(u, 'right', 'open'),
    T8: blankConfig('U'),
  };
}

/** Ids are regenerated on decode: rename them by position (tables, groups and joins follow). */
export function canon(c: Config) {
  const ids = new Map<string, string>();
  const name = (id: string, prefix: string) => ids.get(id) ?? (ids.set(id, `${prefix}${ids.size}`), ids.get(id)!);
  const runs = Object.fromEntries(
    runIds(c.shape).map((r) => [r, c.runs[r]!.map((p) => ({ ...p, id: name(p.id, 'p') }))]),
  ) as Record<RunId, Config['runs'][RunId]>;
  for (const ps of Object.values(runs)) {
    for (const p of ps!) {
      if (p.splitGroup) p.splitGroup = name(p.splitGroup, 'g');
      if (p.joinedBy) p.joinedBy = name(p.joinedBy, 'p');
    }
  }
  return { ...c, runs, loose: c.loose.map((l) => ({ ...l, id: name(l.id, 'p') })), nextId: 0 };
}

/** A config that exercises every optional link field (golden test). */
export function kitchenSink(): Config {
  let c = standardU({ W: 300.5, D: 40, wedgeC: 60, seatWidth: 26, snugWidth: 22, tableFinish: 'darkWood', dims: { cushionCrown: 7 } });
  c = raw.setLock(c, false).config;
  c = raw.addLoose(c, 'coffeeTable').config;
  return raw.addLoose(c, 'ottoman', { x: -10.5, y: 150, w: 30, d: 20 }).config;
}
