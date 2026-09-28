// §2 / §3: real Haven dimensions and the "Start from" presets (§5.4 "Presets").
import { ABSORB_FLOOR, TABLE_DEFAULT, half } from './pieces';
import { available, clampWedge, defaultFill, makeAlloc, openEnd, runIds, seat } from './layout';
import { finalize } from './normalize';
import type { Config, HavenDims, Shape, TableFinish, TableStyle } from './types';

/**
 * §3 heights and depths. Q12, Q29 defaults accepted by Andre (2026-09-25);
 * Q9, Q10, Q13, Q14 answered from the real Haven (2026-09-27): a tight seat
 * (flat, 18″, seam at the 10″ deck), a 10″-thick back frame 27″ tall, loose
 * back cushions standing on the seat (profiles.ts BACK_CUSHION), the table flush with the seat.
 */
export const DEFAULT_DIMS: HavenDims = {
  A: 14,
  B: 10, // the 10″ back frame (the loose back cushions sit on the seat, in front of it)
  backFrame: 10,
  legHeight: 1,
  deckHeight: 10, // the seam round the tight seat
  seatHeight: 18,
  cushionCrown: 8,
  cushionEdge: 8, // tight seat: flat (10 + 8 = 18)
  armHeight: 23,
  backHeight: 27, // top of the back frame
  tableHeight: 18, // Q9 (2026-09-27): flush with the seat
  ottomanHeight: 18, // Q29
  coffeeTableHeight: 16, // Q29
};

export const DEFAULT_MEASURES = { W: 188, L: 132, R: 132, D: 44 } as const;
export const DEPTH_PRESETS = [44, 40, 36] as const;
export const DEFAULT_FABRIC = 'boucle-white';
export const DEFAULT_FINISH: TableFinish = 'walnut';
export const DEFAULT_TABLE_STYLE: TableStyle = 'standard';

// §8 seating / warning thresholds
export const SEAT_WIDTH_DEFAULT = 28;
export const SNUG_SEAT_WIDTH = 24;
export const CLEARANCE_MIN = 14;
export const OPENING_MIN = 60;
/** Seat depth is measured to the back cushions (D − B − 8): under 16 warns (the old 24 to the frame). */
export const SEAT_DEPTH_MIN = 16;
export const WEDGE_FACE_MIN = 8;

export interface PresetOptions {
  W?: number;
  L?: number;
  R?: number;
  D?: number;
  /** A number = manual wedge; omitted/null = auto (D + 16). */
  wedgeC?: number | null;
  seatWidth?: number;
  snugWidth?: number;
  lockOutside?: boolean;
  fabric?: string;
  tableFinish?: TableFinish;
  tableStyle?: TableStyle;
  dims?: Partial<HavenDims>;
}

function base(shape: Shape, o: PresetOptions, W: number): Config {
  const D = Math.round(o.D ?? DEFAULT_MEASURES.D);
  return {
    schema: 1,
    shape,
    W: half(o.W ?? W),
    L: half(o.L ?? DEFAULT_MEASURES.L),
    R: half(o.R ?? DEFAULT_MEASURES.R),
    D,
    wedgeC: o.wedgeC == null ? null : clampWedge(Math.round(o.wedgeC), D),
    lockOutside: o.lockOutside ?? true,
    runs: {},
    loose: [],
    seatWidth: o.seatWidth ?? SEAT_WIDTH_DEFAULT,
    snugWidth: o.snugWidth ?? SNUG_SEAT_WIDTH,
    fabric: o.fabric ?? DEFAULT_FABRIC,
    tableFinish: o.tableFinish ?? DEFAULT_FINISH,
    tableStyle: o.tableStyle ?? DEFAULT_TABLE_STYLE,
    dims: { ...DEFAULT_DIMS, ...o.dims },
    nextId: 1,
  };
}

function build(shape: Shape, o: PresetOptions, fill: 'standardU' | 'default' | 'blank', W: number): Config {
  const draft = base(shape, o, W);
  const alloc = makeAlloc(draft);
  const A = draft.dims.A;
  for (const run of runIds(shape)) {
    const len = available(draft, run);
    if (len < 0) throw new Error(`measurements too small for ${shape}: ${run} has ${len}"`);
    if (fill === 'blank') {
      draft.runs[run] = len > 0 ? [{ id: alloc('p'), kind: 'gap', length: len }] : [];
    } else if (run === 'back' && fill === 'standardU' && len - TABLE_DEFAULT >= ABSORB_FLOOR) {
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

/** §2 Standard Haven U (loads first): W 188, L 132, R 132, D 44. */
export const standardU = (o: PresetOptions = {}): Config => build('U', o, 'standardU', DEFAULT_MEASURES.W);

/**
 * Standard L (Q5 default a): 132 × 132, default fill, no table. Follows spec
 * test 4 rather than the literal "U minus one leg".
 */
export const standardL = (side: 'left' | 'right', o: PresetOptions = {}): Config =>
  build(side === 'left' ? 'L-left' : 'L-right', o, 'default', 132);

/** §2 Blank: wedges come with the shape; every run starts as one gap. */
export const blankConfig = (shape: Shape, o: PresetOptions = {}): Config =>
  build(shape, o, 'blank', DEFAULT_MEASURES.W);
