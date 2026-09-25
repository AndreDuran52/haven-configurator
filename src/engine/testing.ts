// Shared test harness for the engine tests (not a test file itself).
import { expect } from 'vitest';
import { buildHaven } from './buildHaven';
import { standardU } from './defaults';
import { available } from './layout';
import * as raw from './index';
import type { BuildResult, BuiltPiece, Config, RunId } from './types';

export { raw };

// ---------------------------------------------------------------------------
// Harness

export function deepFreeze<T>(o: T): T {
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
export function valid(c: Config): BuildResult {
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
export function guard<A extends unknown[]>(f: (c: Config, ...a: A) => Config) {
  return (c: Config, ...a: A): Config => {
    deepFreeze(c);
    const next = f(c, ...a);
    valid(next);
    return next;
  };
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
  addLoose: guard(raw.addLoose),
  moveLoose: guard(raw.moveLoose),
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

/** The sofa's back edge from x=0 to x=W as [kind length] (wedges and back-run pieces), checking contiguity. */
export function backLine(b: BuildResult): string[] {
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
