// Every edit is a pure op: (config, ...args) => config.
// - Input is never mutated (each op edits a JSON-cloned draft).
// - A rejected / no-op edit returns the SAME reference (`next === prev`).
// - Output always satisfies the run invariant (finalize() asserts it).
// This file: the edit() choke point, measurements, wedge, lock, settings, shape.
import { half } from './pieces';
import { reshapeRuns } from './absorb';
import { available, clampWedge, defaultFill, makeAlloc, openEnd, runIds, wedgeC, type Alloc } from './layout';
import { finalize } from './normalize';
import type { Config, RunId, RunPiece, Runs, Shape } from './types';

/** Clone -> mutate draft -> normalise + assert. The JSON clone also enforces "config is plain data". */
export function edit(config: Config, fn: (draft: Config, alloc: Alloc) => boolean): Config {
  const draft = JSON.parse(JSON.stringify(config)) as Config;
  const alloc = makeAlloc(draft);
  if (!fn(draft, alloc)) return config;
  return finalize(draft, alloc);
}

export function findPiece(c: Config, id: string): { run: RunId; index: number; piece: RunPiece } | null {
  for (const run of runIds(c.shape)) {
    const index = c.runs[run]?.findIndex((p) => p.id === id) ?? -1;
    if (index >= 0) return { run, index, piece: c.runs[run]![index]! };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Measurements, wedge, lock, settings. These ALWAYS hold the typed outside
// sizes (regardless of the lock): the runs absorb the change.

export function setMeasurements(config: Config, patch: Partial<Pick<Config, 'W' | 'L' | 'R' | 'D'>>): Config {
  return edit(config, (d, alloc) => {
    const oldC = wedgeC(d);
    const next = {
      W: half(patch.W ?? d.W),
      L: half(patch.L ?? d.L),
      R: half(patch.R ?? d.R),
      D: half(patch.D ?? d.D),
    };
    if (!(next.D > d.dims.B)) return false;
    const dW = next.W - d.W;
    const dL = next.L - d.L;
    const dR = next.R - d.R;
    Object.assign(d, next);
    // §5: a manual wedge sticks when D changes, clamped into the new D..D+30 range.
    if (d.wedgeC !== null) d.wedgeC = clampWedge(d.wedgeC, d.D);
    const changed = dW || dL || dR || next.D !== config.D;
    return !!changed && reshapeRuns(d, alloc, wedgeC(d) - oldC, dW, dL, dR);
  });
}

/** §5 wedge slider: snaps to 1", clamps to D..D+30, becomes manual. Outside sizes held. */
export function setWedge(config: Config, C: number): Config {
  return edit(config, (d, alloc) => {
    const oldC = wedgeC(d);
    d.wedgeC = clampWedge(Math.round(C), d.D);
    if (config.wedgeC === d.wedgeC) return false;
    return reshapeRuns(d, alloc, d.wedgeC - oldC, 0, 0, 0);
  });
}

export function resetWedge(config: Config): Config {
  return edit(config, (d, alloc) => {
    if (d.wedgeC === null) return false;
    const oldC = wedgeC(d);
    d.wedgeC = null;
    return reshapeRuns(d, alloc, wedgeC(d) - oldC, 0, 0, 0);
  });
}

/** Turning the lock ON freezes the (already derived) W/L/R; OFF lets runs grow. */
export function setLock(config: Config, on: boolean): Config {
  return edit(config, (d) => {
    if (d.lockOutside === on) return false;
    d.lockOutside = on;
    return true;
  });
}

export function setSeatWidth(config: Config, width: number): Config {
  return edit(config, (d) => {
    const w = half(width);
    if (!(w > 0) || w === d.seatWidth) return false;
    d.seatWidth = w;
    return true;
  });
}

/**
 * Shape picker. A leg that survives keeps its pieces (its space L-C / R-C is
 * unchanged); the back and any new leg get the §8 default fill, because the
 * back's end kinds (wedge/open) change with the shape.
 */
export function setShape(config: Config, shape: Shape): Config {
  return edit(config, (d, alloc) => {
    if (d.shape === shape) return false;
    const old = d.runs;
    d.shape = shape;
    const runs: Runs = {};
    for (const run of runIds(shape)) {
      const len = available(d, run);
      if (len < 0) return false;
      runs[run] = run !== 'back' && old[run] ? old[run] : defaultFill(len, openEnd(shape, run), d.dims.A, alloc);
    }
    d.runs = runs;
    return true;
  });
}
