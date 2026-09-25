import { describe, expect, it } from 'vitest';
import { blankConfig, standardL, standardU } from './defaults';
import { deepFreeze, valid, raw } from './testing';
import type { Config, RunId } from './types';

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
