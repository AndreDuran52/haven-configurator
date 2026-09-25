// Height profiles (§7.4, 3D-06): the z-ranges every view builds parts from, as
// data derived from HavenDims, so craft answers (Q9, Q10, Q12–Q14) stay data.
// Run-local coordinates: s along the run, t depth from the back (outside) edge.
import type { HavenDims } from './types';

export interface ZRange {
  z0: number;
  z1: number;
}

export interface Profiles {
  leg: ZRange;
  /** Body under the seat, t from backFrame to D. */
  body: ZRange;
  /** Back frame, t 0..backFrame. */
  backFrame: ZRange & { t0: number; t1: number };
  /** Back cushion, t backFrame..B. */
  backCushion: ZRange & { t0: number; t1: number };
  /** Seat cushion from t = B: `edge` at its ends, crowned to `crown` mid-span. */
  seatCushion: { t0: number; z0: number; edge: number; crown: number };
  arm: ZRange;
  table: ZRange;
  ottoman: ZRange;
  coffeeTable: ZRange;
}

/** The back cushion stops this far below the frame top (§7.4: 10–26 under a 27 back). */
export const BACK_CUSHION_DROP = 1;

export function profiles(d: HavenDims): Profiles {
  return {
    leg: { z0: 0, z1: d.legHeight },
    body: { z0: d.legHeight, z1: d.deckHeight },
    backFrame: { t0: 0, t1: d.backFrame, z0: d.legHeight, z1: d.backHeight },
    backCushion: { t0: d.backFrame, t1: d.B, z0: d.deckHeight, z1: d.backHeight - BACK_CUSHION_DROP },
    seatCushion: { t0: d.B, z0: d.deckHeight, edge: d.deckHeight + d.cushionEdge, crown: d.deckHeight + d.cushionCrown },
    arm: { z0: d.legHeight, z1: d.armHeight },
    table: { z0: d.legHeight, z1: d.tableHeight },
    ottoman: { z0: 0, z1: d.ottomanHeight },
    coffeeTable: { z0: 0, z1: d.coffeeTableHeight },
  };
}
