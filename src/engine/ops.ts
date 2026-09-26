// Measurements, wedge, lock and settings (§5.3). These ALWAYS hold the typed
// outside sizes (regardless of the lock): the runs absorb the change.
import { half } from './pieces';
import { reshapeRuns } from './absorb';
import { clampWedge, wedgeC } from './layout';
import { edit, refuse, type Outcome } from './edit';
import { minMessage, shortfall, wedgeFits } from './limits';
import { FABRICS, FINISHES } from './fabrics';
import type { Config, EditResult, TableFinish, TableStyle } from './types';

export const D_MIN = 30;
export const D_MAX = 48;

/** Candidate config with new sizes but the old pieces, for `limits`. */
const withSizes = (c: Config, s: Partial<Pick<Config, 'W' | 'L' | 'R' | 'D' | 'wedgeC'>>): Config => ({ ...c, ...s });

export function setMeasurements(config: Config, patch: Partial<Pick<Config, 'W' | 'L' | 'R' | 'D'>>): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const oldC = wedgeC(d);
    const next = {
      W: half(patch.W ?? d.W),
      L: half(patch.L ?? d.L),
      R: half(patch.R ?? d.R),
      D: Math.round(patch.D ?? d.D),
    };
    if (!(next.D >= D_MIN && next.D <= D_MAX) || !(next.D > d.dims.B)) {
      return refuse('infeasible', `Depth must be ${D_MIN}–${D_MAX}″`);
    }
    if (![next.W, next.L, next.R].every(Number.isFinite)) return refuse('infeasible', 'Not a size');
    const dW = next.W - d.W;
    const dL = next.L - d.L;
    const dR = next.R - d.R;
    if (!dW && !dL && !dR && next.D === d.D) return null;
    Object.assign(d, next);
    // §5: a manual wedge sticks when D changes, clamped into the new D..D+30 range.
    if (d.wedgeC !== null) d.wedgeC = clampWedge(d.wedgeC, d.D);
    if (reshapeRuns(d, alloc, wedgeC(d) - oldC, dW, dL, dR)) return true;
    const min = shortfall(withSizes(config, { ...next, wedgeC: d.wedgeC }));
    return refuse('infeasible', minMessage(min), min);
  });
}

/**
 * §5 wedge slider: snaps to 1", clamps to D..D+30 and becomes manual. G3: if
 * the runs can't absorb the target, it stops at the last whole inch that fits
 * (scanning from the current C toward the target) instead of being refused.
 */
export function setWedge(config: Config, C: number): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const cur = wedgeC(d);
    const target = clampWedge(Math.round(C), d.D);
    let to = target;
    if (!wedgeFits(config, target)) {
      to = cur;
      const step = Math.sign(target - cur);
      while (to !== target && wedgeFits(config, to + step)) to += step;
    }
    if (to === cur) {
      if (to !== target) return refuse('noRoom', 'No room for a bigger wedge');
      if (config.wedgeC !== null) return null;
    }
    d.wedgeC = to;
    return reshapeRuns(d, alloc, to - cur, 0, 0, 0) || refuse('noRoom', 'No room for a bigger wedge');
  });
}

/** Back to auto (C = D + 16). Refused with the minimum W/L/R if that C doesn't fit (the slider clamps, this doesn't). */
export function resetWedge(config: Config): EditResult {
  return edit(config, (d, alloc): Outcome => {
    if (d.wedgeC === null) return null;
    const oldC = wedgeC(d);
    d.wedgeC = null;
    if (reshapeRuns(d, alloc, wedgeC(d) - oldC, 0, 0, 0)) return true;
    const min = shortfall(withSizes(config, { wedgeC: null }));
    return refuse('infeasible', minMessage(min), min);
  });
}

/** Turning the lock ON freezes the (already derived) W/L/R; OFF lets runs grow. */
export function setLock(config: Config, on: boolean): EditResult {
  return edit(config, (d) => {
    if (d.lockOutside === on) return null;
    d.lockOutside = on;
    return true;
  });
}

export function setSeatWidth(config: Config, width: number): EditResult {
  return edit(config, (d) => {
    const w = half(width);
    if (!(w > 0)) return refuse('notAllowed', 'Seat width must be positive');
    if (w === d.seatWidth) return null;
    d.seatWidth = w;
    return true;
  });
}

/** Table style for every table insert: standard (wood top on a fabric base) or all wood. */
export function setTableStyle(config: Config, style: TableStyle): EditResult {
  return edit(config, (d) => {
    if (d.tableStyle === style) return null;
    d.tableStyle = style;
    return true;
  });
}

/** Fabric (a FABRICS key) for every upholstered part. */
export function setFabric(config: Config, key: string): EditResult {
  return edit(config, (d) => {
    if (!FABRICS.some((f) => f.key === key)) return refuse('notAllowed', 'Unknown fabric');
    if (d.fabric === key) return null;
    d.fabric = key;
    return true;
  });
}

/** Wood finish for every table (and the coffee table). */
export function setTableFinish(config: Config, finish: TableFinish): EditResult {
  return edit(config, (d) => {
    if (!FINISHES.some((f) => f.key === finish)) return refuse('notAllowed', 'Unknown finish');
    if (d.tableFinish === finish) return null;
    d.tableFinish = finish;
    return true;
  });
}
