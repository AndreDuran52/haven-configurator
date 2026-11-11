// Where the 3D person sits (Andre, 2026-11-11, plan Q79): the middle of the
// back run's widest seat, facing out. Pure; plan inches. The figure's side
// plane (t from the sofa's back, z up) maps to plan (x = seat.x, y = seat.back + t).
import { planCentre, planToWorld, type BuildResult } from '@/engine';
import type { PersonFigure } from './person';
import type { Vec3 } from './screenBasis';

export interface PersonSeat {
  /** The seat's middle along the back run (plan x). */
  x: number;
  /** The sofa's back edge behind that seat (plan y). */
  back: number;
}

/** Half-widths across the body, as ratios of height: the hip joints, the arms' centres; how much wider than deep the torso is. */
export const PERSON_ACROSS = { hip: 0.04, arm: 0.075, torso: 1.25 } as const;

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

/** The figure's bounding box as world points, for the ortho fit (the head is well above the sofa). */
export function personPoints(built: BuildResult, fig: PersonFigure, seat: PersonSeat): Vec3[] {
  const centre = planCentre(built.bounds);
  const half = PERSON_ACROSS.arm * fig.height + fig.thick.arm / 2;
  const t0 = Math.min(fig.seatBack, ...fig.spine.map((p) => p[0] - fig.thick.torso / 2), fig.head[0] - fig.thick.headR);
  const t1 = Math.max(fig.toe[0], fig.ankle[0], fig.knee[0]) + fig.thick.foot / 2;
  const z0 = Math.min(fig.toe[1], fig.ankle[1]) - fig.thick.foot / 2;
  const out: Vec3[] = [];
  for (const x of [seat.x - half, seat.x + half]) for (const t of [t0, t1]) for (const z of [z0, fig.top]) out.push(planToWorld(x, seat.back + t, z, centre));
  return out;
}
