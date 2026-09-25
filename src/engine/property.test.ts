import { describe, expect, it } from 'vitest';
import { blankConfig, standardL, standardU } from './defaults';
import { runIds } from './layout';
import { deepFreeze, raw, valid } from './testing';
import type { Config, EditResult, Placement } from './types';

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
  it('E17 property_4000RandomOps: invariants hold; lock-on piece ops never move W/L/R; refused => same reference', () => {
    const rnd = mulberry32(12345);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    const stats: Record<string, { ok: number; no: number; refused: number }> = {};
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
        const runs = runIds(c.shape);
        const run = pick(runs);
        const ps = c.runs[run]!;
        const any = ps.length ? pick(ps) : undefined;
        const gaps = runs.flatMap((r) => c.runs[r]!.filter((p) => p.kind === 'gap'));
        const tables = runs.flatMap((r) => c.runs[r]!.filter((p) => p.kind === 'table'));
        const placement = (): Placement =>
          pick([
            { run, at: 'seam' as const, seam: int(0, ps.length) },
            { run, at: 'replaceArm' as const },
            ...(any ? [{ run, at: 'split' as const, pieceId: any.id }] : []),
          ]);
        const loose = c.loose.length ? pick(c.loose) : undefined;
        // [name, keeps W/L/R when locked?, op]
        const [name, pieceEdit, f] = pick<[string, boolean, () => EditResult]>([
          ['setMeasurements W', false, () => raw.setMeasurements(c, { W: c.W + int(-30, 30) / 2 })],
          ['setMeasurements L/R', false, () => raw.setMeasurements(c, { L: c.L + int(-20, 20), R: c.R + int(-20, 20) })],
          ['setMeasurements D', true, () => raw.setMeasurements(c, { D: pick([36, 40, 44, 38.5]) })],
          ['setWedge', true, () => raw.setWedge(c, int(30, 80))],
          ['resetWedge', true, () => raw.resetWedge(c)],
          ['setLock', false, () => raw.setLock(c, rnd() < 0.5)],
          ['resizePiece', true, () => raw.resizePiece(c, any?.id ?? 'x', (any?.length ?? 30) + int(-40, 40) / 2)],
          ['dragSeam', true, () => raw.dragSeam(c, run, int(0, ps.length), int(-60, 60) / 2)],
          ['addPiece', true, () => raw.addPiece(c, pick(['armless', 'oneArm', 'table'] as const), placement())],
          ['deletePiece', true, () => raw.deletePiece(c, any?.id ?? 'x')],
          ['convertPiece', true, () => raw.convertPiece(c, any?.id ?? 'x')],
          ['setEndCap', true, () => raw.setEndCap(c, run, pick(['arm', 'table', 'open'] as const))],
          ['moveTable', true, () => raw.moveTable(c, tables.length ? pick(tables).id : 'x', placement())],
          ['snapTable', true, () => (tables.length ? raw.snapTable(c, pick(tables).id, [int(-20, 380), int(-20, 260)]).result : raw.setLock(c, c.lockOutside))],
          ['reorderPiece', true, () => raw.reorderPiece(c, any?.id ?? 'x', int(0, Math.max(0, ps.length - 1)))],
          ['fillGap', true, () => raw.fillGap(c, gaps.length ? pick(gaps).id : 'x', pick(['armless', 'oneArm', 'table'] as const))],
          ['setShape', false, () => raw.setShape(c, pick(['U', 'L-left', 'L-right'] as const))],
          ['loose', true, () => (loose && rnd() < 0.5 ? raw.moveLoose(c, loose.id, int(0, 200), int(0, 200)) : raw.addLoose(c, pick(['ottoman', 'coffeeTable'] as const)))],
        ]);
        deepFreeze(c);
        const before = JSON.stringify(c);
        const r = f();
        expect(JSON.stringify(c)).toBe(before); // input untouched
        const s = (stats[name] ??= { ok: 0, no: 0, refused: 0 });
        if (r.config === c) {
          if (r.rejected) s.refused++;
          else s.no++;
          continue;
        }
        expect(r.rejected).toBeNull(); // refused => same reference
        s.ok++;
        valid(r.config);
        // Lock ON: no piece/wedge/depth edit may move the outside size.
        if (pieceEdit && c.lockOutside) expect(outside(r.config)).toBe(outside(c));
        // A seam drag only trades inches between its two neighbours.
        if (name === 'dragSeam') expect(outside(r.config)).toBe(outside(c));
        c = r.config;
      }
    }
    const total = Object.values(stats).reduce((t, s) => t + s.ok + s.no + s.refused, 0);
    expect(total).toBe(4000);
    // every op kind was actually exercised and accepted many times
    for (const [name, s] of Object.entries(stats)) expect(s.ok, name).toBeGreaterThan(20);
  });
});
