// Height profiles (§7.4, 3D-06): the z-ranges every view builds parts from, as
// data derived from HavenDims, so craft answers stay data. The real Haven
// (Andre, 2026-09-27): a TIGHT seat (one upholstered block, flat top, a seam
// round it at the deck), a 10″ back frame 27″ tall, 23″ arms, and loose back
// cushions standing on the seat in front of the frame, tops at 31″.
// Run-local coordinates: s along the run, t depth from the back (outside) edge.
import type { HavenDims } from './types';

/**
 * The loose back cushions (Andre, 2026-09-27): 8″ deep, standing on the seat
 * against the back frame; their tops `rise` above the 27″ frame (31″ overall).
 * Constants, not HavenDims, so the share-link codec is unchanged.
 */
export const BACK_CUSHION = { depth: 8, rise: 4 } as const;

export interface ZRange {
  z0: number;
  z1: number;
}

export interface Profiles {
  leg: ZRange;
  /** The tight seat's lower block, t backFrame..D; its top is the seam. */
  seatBase: ZRange;
  /** The tight seat's upper band, flat, same footprint. */
  seat: ZRange;
  /** Back frame, t 0..backFrame. */
  backFrame: ZRange & { t0: number; t1: number };
  /** Loose back cushions: on the seat (sunk `sink`), against the frame, `depth` deep at the bottom. */
  looseBack: ZRange & { t0: number; t1: number; sink: number };
  arm: ZRange;
  table: ZRange;
  /** Standard table: a 2″ wood top on a fabric base. */
  tableTop: ZRange;
  tableBase: ZRange;
  ottoman: ZRange;
  coffeeTable: ZRange;
}

/** The standard table's wood top thickness (Andre, 2026-09-26). */
export const TABLE_TOP_THICKNESS = 2;
/** How far the loose back cushions sink into the seat under them. */
export const BACK_CUSHION_SINK = 1;

export function profiles(d: HavenDims): Profiles {
  return {
    leg: { z0: 0, z1: d.legHeight },
    seatBase: { z0: d.legHeight, z1: d.deckHeight },
    seat: { z0: d.deckHeight, z1: d.seatHeight },
    backFrame: { t0: 0, t1: d.backFrame, z0: d.legHeight, z1: d.backHeight },
    looseBack: {
      t0: d.backFrame,
      t1: d.backFrame + BACK_CUSHION.depth,
      z0: d.seatHeight - BACK_CUSHION_SINK,
      z1: d.backHeight + BACK_CUSHION.rise,
      sink: BACK_CUSHION_SINK,
    },
    arm: { z0: d.legHeight, z1: d.armHeight },
    table: { z0: d.legHeight, z1: d.tableHeight },
    tableTop: { z0: d.tableHeight - TABLE_TOP_THICKNESS, z1: d.tableHeight },
    tableBase: { z0: d.legHeight, z1: d.tableHeight - TABLE_TOP_THICKNESS },
    ottoman: { z0: 0, z1: d.ottomanHeight },
    coffeeTable: { z0: 0, z1: d.coffeeTableHeight },
  };
}
