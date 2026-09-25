// §2 / §3: real Haven dimensions and the "Start from" presets.
import { ABSORB_FLOOR, TABLE_DEFAULT, half } from './pieces';
import {
  available,
  clampWedge,
  defaultFill,
  finalize,
  makeAlloc,
  openEnd,
  runIds,
  seat,
} from './layout';
import type { Config, HavenDims, Shape } from './types';

export const DEFAULT_DIMS: HavenDims = {
  A: 14,
  B: 10, // §14 open question: 4" frame + 6" back cushion
  legHeight: 1,
  seatHeight: 18,
  cushionCrown: 8,
  cushionEdge: 6,
  armHeight: 23,
  backHeight: 27,
  tableHeight: 23, // §14 open question: flush with the arm?
};

export const DEFAULT_MEASURES = { W: 188, L: 132, R: 132, D: 44 } as const;
export const DEPTH_PRESETS = [44, 40, 36] as const;

// §8 seating / warning thresholds
export const SEAT_WIDTH_DEFAULT = 28;
export const SNUG_SEAT_WIDTH = 24;
export const CLEARANCE_MIN = 14;
export const OPENING_MIN = 60;
export const SEAT_DEPTH_MIN = 24;
export const WEDGE_FACE_MIN = 8;

export interface PresetOptions {
  W?: number;
  L?: number;
  R?: number;
  D?: number;
  /** A number = manual wedge; omitted/null = auto (D + 16). */
  wedgeC?: number | null;
  seatWidth?: number;
  lockOutside?: boolean;
  dims?: Partial<HavenDims>;
}

function base(shape: Shape, o: PresetOptions): Config {
  const D = half(o.D ?? DEFAULT_MEASURES.D);
  return {
    schema: 1,
    shape,
    W: half(o.W ?? DEFAULT_MEASURES.W),
    L: half(o.L ?? DEFAULT_MEASURES.L),
    R: half(o.R ?? DEFAULT_MEASURES.R),
    D,
    wedgeC: o.wedgeC == null ? null : clampWedge(Math.round(o.wedgeC), D),
    lockOutside: o.lockOutside ?? true,
    runs: {},
    loose: [],
    seatWidth: o.seatWidth ?? SEAT_WIDTH_DEFAULT,
    dims: { ...DEFAULT_DIMS, ...o.dims },
    nextId: 1,
  };
}

function build(shape: Shape, o: PresetOptions, fillBack: 'standardU' | 'default' | 'blank'): Config {
  const draft = base(shape, o);
  const alloc = makeAlloc(draft);
  const A = draft.dims.A;
  for (const run of runIds(shape)) {
    const len = available(draft, run);
    if (len < 0) throw new Error(`measurements too small for ${shape}: ${run} has ${len}"`);
    if (fillBack === 'blank') {
      draft.runs[run] = len > 0 ? [{ id: alloc('p'), kind: 'gap', length: len }] : [];
    } else if (run === 'back' && fillBack === 'standardU' && len - TABLE_DEFAULT >= ABSORB_FLOOR) {
      // §2: [wedge][table 32][armless rest][wedge]
      draft.runs[run] = [
        { id: alloc('p'), kind: 'table', length: TABLE_DEFAULT },
        seat(alloc('p'), len - TABLE_DEFAULT, null),
      ];
    } else {
      draft.runs[run] = defaultFill(len, openEnd(shape, run), A, alloc);
    }
  }
  return finalize(draft, alloc);
}

/** §2 Standard Haven U (loads first). */
export const standardU = (o: PresetOptions = {}): Config => build('U', o, 'standardU');

/**
 * Standard L: the U minus one leg. Test 4 fixes the L back as the §8 default
 * fill (arm at the open end + one seat), i.e. no table.
 */
export const standardL = (side: 'left' | 'right', o: PresetOptions = {}): Config =>
  build(side === 'left' ? 'L-left' : 'L-right', o, 'default');

/** §2 Blank: wedges are structural (they come with the shape); every run starts as one gap. */
export const blankConfig = (shape: Shape, o: PresetOptions = {}): Config => build(shape, o, 'blank');
