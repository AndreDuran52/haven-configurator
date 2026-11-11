// The Side view as a cut through a seat (Andre, 2026-11-11, plan Q78): the
// sofa's profile with its real measurements, in place of the 3D side render
// (on a U that one hides the seat behind the near side). Pure geometry in
// inches: t = depth from the sofa's back, z = height above the floor.
//
// The Haven (Andre's numbers): 1″ leg; a tight seat, one upholstered piece
// from 1″ to 18″ with a stitch line at its exact middle; a 10″ back, 27″
// tall; back pillows standing on the seat against the back, 5″ at the
// stitching and filling to 8″, tops at 31″; 23″ arms.
import { BACK_CUSHION, type HavenDims } from '@/engine';

export interface Box {
  t0: number;
  t1: number;
  z0: number;
  z1: number;
}

/** How thick the back pillow is at its stitched edge (it fills to BACK_CUSHION.depth). */
export const BACK_PILLOW_STITCH = 5;

export interface SideSection {
  /** Total depth, back to front. */
  D: number;
  back: Box;
  seat: Box;
  /** The stitch line's height (the middle of the seat piece). */
  stitch: number;
  pillow: Box;
  /** The arm beyond the seat, seen behind it. */
  arm: Box;
  legs: Box[];
  /** Front of the back pillow to the front edge. */
  usableSeat: number;
  heights: { leg: number; seat: number; arm: number; back: number; pillow: number };
}

export function sideSection(dims: HavenDims, D: number): SideSection {
  const pillowTop = dims.backHeight + BACK_CUSHION.rise;
  const pillowFront = dims.backFrame + BACK_CUSHION.depth;
  const leg = (t: number): Box => ({ t0: t, t1: t + 3, z0: 0, z1: dims.legHeight });
  return {
    D,
    back: { t0: 0, t1: dims.backFrame, z0: dims.legHeight, z1: dims.backHeight },
    seat: { t0: dims.backFrame, t1: D, z0: dims.legHeight, z1: dims.seatHeight },
    stitch: (dims.legHeight + dims.seatHeight) / 2,
    pillow: { t0: dims.backFrame, t1: pillowFront, z0: dims.seatHeight, z1: pillowTop },
    arm: { t0: 0, t1: D, z0: dims.legHeight, z1: dims.armHeight },
    legs: [leg(4), leg(D - 9)],
    usableSeat: D - pillowFront,
    heights: { leg: dims.legHeight, seat: dims.seatHeight, arm: dims.armHeight, back: dims.backHeight, pillow: pillowTop },
  };
}
