// Piece library (§4) and the per-piece size rules (§3, §8).
import type { RunEnd, RunPiece, RunPieceKind } from './types';

/** Max single piece INCLUDING its arm (§3). Anything longer auto-splits. */
export const MAX_PIECE = 108;
/** Warn below this seat cushion length (§3). Never blocking. */
export const MIN_SEAT = 20;
/**
 * Hard floor for a seat cushion when it is squeezed by rebalancing (and for
 * resize/convert). Not in the spec: it only stops degenerate slivers. The
 * 20" rule above stays a warning, which is why test 3b's 13" seats are legal.
 */
export const ABSORB_FLOOR = 6;
/** A table split needs at least this much cushion left to share (6" each side). */
export const SPLIT_MIN_CUSHION = 12;

export const TABLE_MIN = 16;
export const TABLE_MAX = 40;
export const TABLE_DEFAULT = 32;
export const ARMLESS_DEFAULT = 36;
/** Default cushion of a new one-arm piece (footprint = this + A). */
export const ONE_ARM_SEAT_DEFAULT = 36;

/** Wedge size rule (§5): auto C = D + 16, slider range D .. D + 30, 1" snap. */
export const WEDGE_AUTO_OFFSET = 16;
export const WEDGE_RANGE = 30;

export const LOOSE_DEFAULTS = {
  ottoman: { w: 36, d: 36 },
  coffeeTable: { w: 48, d: 48 },
} as const;

/** What the "Add piece" tray shows. */
export const PIECE_LIBRARY = [
  { kind: 'armless', label: 'Armless seat', min: MIN_SEAT, max: MAX_PIECE, defaultLength: ARMLESS_DEFAULT },
  { kind: 'oneArm', label: 'One-arm seat', min: MIN_SEAT, max: MAX_PIECE, defaultLength: ONE_ARM_SEAT_DEFAULT, note: 'length includes the 14" arm' },
  { kind: 'table', label: 'Table insert', min: TABLE_MIN, max: TABLE_MAX, defaultLength: TABLE_DEFAULT },
  { kind: 'ottoman', label: 'Ottoman (loose)', ...LOOSE_DEFAULTS.ottoman },
  { kind: 'coffeeTable', label: 'Coffee table (loose)', ...LOOSE_DEFAULTS.coffeeTable },
] as const;

/** Round to the 0.5" grid. `+ 0` normalises -0 so configs survive a JSON round trip. */
export const half = (x: number): number => Math.round(x * 2) / 2 + 0;

/** G10: inches <-> integer half-inches, so sums and splits are exact. */
export const toH = (inches: number): number => Math.round(inches * 2);
export const toIn = (halves: number): number => halves / 2 + 0;

export const isSeat = (p: RunPiece): boolean => p.kind === 'armless' || p.kind === 'oneArm';
export const armLen = (p: RunPiece, A: number): number => (p.kind === 'oneArm' ? A : 0);
export const cushionOf = (p: RunPiece, A: number): number => p.length - armLen(p, A);

export function defaultLength(kind: Exclude<RunPieceKind, 'gap'>, A: number): number {
  if (kind === 'armless') return ARMLESS_DEFAULT;
  if (kind === 'oneArm') return ONE_ARM_SEAT_DEFAULT + A;
  return TABLE_DEFAULT;
}

/**
 * Split x (a multiple of 0.5) into two halves on the 0.5 grid. The FIRST half
 * gets the extra 0.5 in magnitude when x/2 is off-grid.
 */
export function splitHalf(x: number): [number, number] {
  const h = toH(x);
  const a = Math.sign(h) * Math.ceil(Math.abs(h) / 2);
  return [toIn(a), toIn(h - a)];
}

/**
 * G9: n pieces of equal overall footprint (arm included) for one logical seat.
 * Remainder half-inches go to the pieces FARTHEST FROM THE ARM; with no arm, to
 * the pieces nearest the run start.
 */
export function distribute(total: number, n: number, arm: RunEnd | null): number[] {
  const halves = toH(total);
  const base = Math.floor(halves / n);
  const rem = halves - base * n;
  const order = Array.from({ length: n }, (_, i) => (arm === 'start' ? n - 1 - i : i));
  const out = new Array<number>(n).fill(base);
  for (let k = 0; k < rem; k++) out[order[k]!]! += 1;
  return out.map(toIn);
}

/** Auto-split (§7): n = ceil(len / 108) pieces of equal footprint. */
export function splitLengths(total: number, arm: RunEnd | null): number[] {
  return distribute(total, Math.max(1, Math.ceil(toH(total) / toH(MAX_PIECE))), arm);
}
