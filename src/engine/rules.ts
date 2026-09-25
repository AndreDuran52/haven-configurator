// The rules every config must satisfy (§5.4 invariant, G11 arm invariant, the
// cushion floor). ruleViolation() turns a user-caused break into a refusal;
// assertInvariants() throws, because anything it catches is an engine bug.
import { ABSORB_FLOOR, MAX_PIECE, cushionOf, half, isSeat, toH } from './pieces';
import { available, openEnd, runIds, runSum, wedgeC } from './layout';
import type { Config, Rejection, RunEnd, RunPiece } from './types';

export const ARM_MESSAGE = 'Remove the arm first (end cap Open)';

/**
 * G11: each one-arm piece's arm faces the run's open end, with nothing but at
 * most one table between it and that end. Runs with no open end hold no arms.
 */
export function armInvariantOk(pieces: RunPiece[], open: RunEnd | null): boolean {
  return pieces.every((p, i) => {
    if (p.kind !== 'oneArm') return true;
    if (!open || p.arm !== open) return false;
    const between = open === 'end' ? pieces.slice(i + 1) : pieces.slice(0, i);
    return between.length === 0 || (between.length === 1 && between[0]!.kind === 'table');
  });
}

/** A rule the user's edit would break, as a refusal; null if the draft is fine. */
export function ruleViolation(d: Config): Rejection | null {
  const A = d.dims.A;
  for (const run of runIds(d.shape)) {
    const pieces = d.runs[run] ?? [];
    if (!armInvariantOk(pieces, openEnd(d.shape, run))) return { code: 'notAllowed', message: ARM_MESSAGE };
    for (const p of pieces) {
      if (isSeat(p) && cushionOf(p, A) < ABSORB_FLOOR) {
        return { code: 'noRoom', message: `A seat cushion would be under ${ABSORB_FLOOR}″` };
      }
      if (p.kind === 'table' && p.length > MAX_PIECE) {
        return { code: 'notAllowed', message: `Tables can't be over ${MAX_PIECE}″ (they don't split)` };
      }
    }
  }
  return null;
}

/** Throws on any invariant violation (§11): an engine bug, never a user error. */
export function assertInvariants(d: Config): void {
  const fail = (msg: string): never => {
    throw new Error(`engine invariant: ${msg}`);
  };
  if (!Number.isInteger(d.D)) fail(`D ${d.D} is not a whole inch`);
  if (!Number.isInteger(wedgeC(d))) fail(`C ${wedgeC(d)} is not a whole inch`);
  const rule = ruleViolation(d);
  if (rule) fail(rule.message);
  for (const run of runIds(d.shape)) {
    const pieces = d.runs[run];
    if (!pieces) return fail(`run ${run} is missing`);
    const av = available(d, run);
    if (av < 0 || toH(runSum(pieces)) !== toH(av)) fail(`run ${run} sums ${runSum(pieces)}, available ${av}`);
    for (const p of pieces) {
      if (!(p.length > 0) || half(p.length) !== p.length) fail(`bad length ${JSON.stringify(p)}`);
      if (p.kind !== 'gap' && p.length > MAX_PIECE) fail(`piece over ${MAX_PIECE} ${JSON.stringify(p)}`);
      if ((p.kind === 'oneArm') !== (p.arm !== undefined)) fail(`arm mismatch ${JSON.stringify(p)}`);
      if (p.joinedBy && !isSeat(p)) fail(`joinedBy on a non-seat ${JSON.stringify(p)}`);
    }
  }
}
