// Where the 3D person sits (Andre, 2026-11-11, plan Q79): the middle of the
// back run's widest seat, facing out. Pure; plan inches. The figure's side
// plane (t from the sofa's back, z up) maps to plan (x = seat.x, y = seat.back + t).
import { BACK_CUSHION, planCentre, planToWorld, type BuildResult } from '@/engine';
import { cushionSide } from '@/engine/cushionProfile';
import { personFigure, type PersonFigure, type PersonPose } from './person';
import type { Vec3 } from './screenBasis';

export interface PersonSeat {
  /** The seat's middle along the back run (plan x). */
  x: number;
  /** The sofa's back edge behind that seat (plan y). */
  back: number;
}

export function personSeat(built: BuildResult): PersonSeat | null {
  const run = built.runs.find((r) => r.id === 'back');
  if (!run || run.axis !== 'x') return null;
  let best: PersonSeat | null = null;
  let width = 0;
  for (const id of run.pieceIds) {
    const p = built.pieces.find((q) => q.id === id);
    if (!p?.cushionRect || (p.kind !== 'armless' && p.kind !== 'oneArm')) continue;
    if (p.cushionRect.w > width) {
      width = p.cushionRect.w;
      best = { x: p.cushionRect.x + p.cushionRect.w / 2, back: p.bbox.y };
    }
  }
  return best;
}

/**
 * The sofa's throw pillows with those where the person sits left out (on a
 * straight sofa his seat is also an arm end's: he'd sit in its pillows).
 */
export function pillowsBeside<T extends { x: number; y: number; w: number }>(anchors: T[], built: BuildResult, fig: PersonFigure, seat: PersonSeat): T[] {
  const b = fig.build;
  const half = Math.max(fig.across.shoulder + b.upperArm / 2, fig.across.knee + b.thighKnee / 2);
  return anchors.filter((a) => !(Math.abs(a.x - seat.x) < half + a.w / 2 && a.y > seat.back && a.y < seat.back + built.D));
}

/** The person sitting on this sofa (the 3D view and the View menu read the same figure). */
export function figureOnSofa(built: BuildResult, height: number, pose: PersonPose): PersonFigure {
  const h = built.heights;
  return personFigure(height, pose, { seatHeight: h.seatHeight, pillowFront: h.backFrame + BACK_CUSHION.reach, pillowTop: h.backHeight + BACK_CUSHION.rise, backFront: cushionSide(h).front, D: built.D });
}

/** The figure's bounding box as world points, for the ortho fit (the head is well above the sofa). */
export function personPoints(built: BuildResult, fig: PersonFigure, seat: PersonSeat): Vec3[] {
  const centre = planCentre(built.bounds);
  const b = fig.build;
  const half = Math.max(fig.across.shoulder + b.upperArm / 2, fig.across.elbow + b.upperArm / 2, fig.across.hand + b.forearm / 2, fig.across.toe + b.foot / 2);
  const t0 = Math.min(fig.seatBack, ...fig.spine.map((p) => p.p[0] - p.depth / 2), fig.head[0] - b.headD / 2);
  const t1 = Math.max(fig.toe[0], fig.ankle[0], fig.knee[0]) + b.foot / 2;
  const out: Vec3[] = [];
  for (const x of [seat.x - half, seat.x + half]) for (const t of [t0, t1]) for (const z of [0, fig.top]) out.push(planToWorld(x, seat.back + t, z, centre));
  return out;
}
