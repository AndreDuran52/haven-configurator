// G6 minimum outside sizes and the G3 wedge-slider range.
import { ABSORB_FLOOR, WEDGE_RANGE, isSeat, toH, toIn } from './pieces';
import { reshapeRuns } from './absorb';
import { makeAlloc, runIds, wedgeC } from './layout';
import type { Config, RunPiece } from './types';

/** Smallest run that holds these pieces: tables + arms + a 6" cushion per seat unit (gaps shrink to 0). */
export function minRun(pieces: RunPiece[], A: number): number {
  let h = 0;
  let lastGroup: string | undefined;
  for (const p of pieces) {
    if (p.kind === 'table') h += toH(p.length);
    if (p.kind === 'oneArm') h += toH(A);
    if (isSeat(p) && !(p.splitGroup && p.splitGroup === lastGroup)) h += toH(ABSORB_FLOOR);
    lastGroup = p.splitGroup;
  }
  return toIn(h);
}

/**
 * G6: the minimum W / L / R for the current pieces and wedge C:
 * corners + tables + arms + 6" x each seat unit.
 * e.g. W 140 on the Standard U: 2 x 60 + 32 + 6 = 158.
 */
export function limits(c: Config): { W: number; L?: number; R?: number } {
  const C = wedgeC(c);
  const A = c.dims.A;
  const out: { W: number; L?: number; R?: number } = {
    W: minRun(c.runs.back ?? [], A) + (c.shape === 'U' ? 2 * C : C),
  };
  for (const run of runIds(c.shape)) {
    if (run === 'left') out.L = minRun(c.runs.left ?? [], A) + C;
    if (run === 'right') out.R = minRun(c.runs.right ?? [], A) + C;
  }
  return out;
}

/** The measurements of `c` that are below their minimum (for a refusal's `min`). */
export function shortfall(c: Config): Partial<Record<'W' | 'L' | 'R', number>> {
  const m = limits(c);
  const out: Partial<Record<'W' | 'L' | 'R', number>> = {};
  if (c.W < m.W) out.W = m.W;
  if (m.L !== undefined && c.L < m.L) out.L = m.L;
  if (m.R !== undefined && c.R < m.R) out.R = m.R;
  return Object.keys(out).length ? out : m;
}

export const minMessage = (min: Partial<Record<string, number>>): string =>
  `Can't fit: ${Object.entries(min)
    .map(([k, v]) => `min ${k} ${v}″`)
    .join(', ')}`;

/** Can every run absorb wedge size C (outside sizes held)? */
export function wedgeFits(c: Config, C: number): boolean {
  const draft = JSON.parse(JSON.stringify(c)) as Config;
  const oldC = wedgeC(draft);
  draft.wedgeC = C;
  return reshapeRuns(draft, makeAlloc(draft), C - oldC, 0, 0, 0);
}

/**
 * G3: the slider's live feasible range within [D, D + 30]. Shrinking the wedge
 * only frees space, so the minimum is always D; the maximum is the last whole
 * inch every run can still absorb, scanning up from the current C.
 */
export function wedgeRange(c: Config): { min: number; max: number } {
  const C = wedgeC(c);
  let max = C;
  while (max < c.D + WEDGE_RANGE && wedgeFits(c, max + 1)) max++;
  return { min: c.D, max };
}
