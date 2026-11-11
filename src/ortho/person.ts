// The person on the sofa (Andre, 2026-11-11, plan Q63 / Q79): a plain figure
// with standard body proportions scaled by height, seated on the Haven, in the
// side plane (t = inches from the sofa's back, z = inches above the floor).
// The side drawing and the 3D figure are both built from these joints, so they
// always agree. Pure: no three, no React.
//
// How people sit on the Haven (Andre's photos on the showroom sofa, 5'10″,
// 2026-11-11): the hips slide forward until the knees bend at the front edge
// and the feet are flat on the floor; the depth shows as how far the back
// reclines onto the back pillow. Upright is the same with a square pillow
// filling the space behind the back. The figure is a stick person (round head,
// slim body and limbs) whose back curves when it reclines.
//
// Proportions are ratios of standing height for adult men, rounded from the
// usual anthropometric tables (ANSUR-style seated measures; Drillis & Contini
// segment ratios). At 5'9″ (69″, the average US man, CDC) they give: sitting
// height 36″, shoulder height seated 23½″, seat back to behind the knee 19½″,
// seat back to the front of the knee 24″, floor to behind the knee 17″, foot 10½″.

import type { PersonPose } from './personLimits';

export { PERSON_HEIGHT, PERSON_MAX, PERSON_MIN, type PersonPose } from './personLimits';

export interface BodySizes {
  /** Seat to the top of the head, sitting straight. */
  sittingHeight: number;
  /** Seat to the shoulder joint. */
  shoulderHeight: number;
  /** Back of the seat (buttock) to behind the knee: the thigh a seat must hold. */
  thigh: number;
  /** Back of the seat to the front of the knee. */
  buttockKnee: number;
  /** Floor to behind the knee: the lower leg a seat height must clear. */
  lowerLeg: number;
  foot: number;
  head: number;
}

const RATIO: BodySizes = { sittingHeight: 0.52, shoulderHeight: 0.34, thigh: 0.285, buttockKnee: 0.345, lowerLeg: 0.248, foot: 0.152, head: 0.13 };

const r1 = (x: number) => Math.round(x * 10) / 10;

/** The body sizes for a height (inches, to 0.1″). */
export function bodySizes(height: number): BodySizes {
  const out = {} as BodySizes;
  for (const k of Object.keys(RATIO) as (keyof BodySizes)[]) out[k] = r1(RATIO[k] * height);
  return out;
}

export type Pt2 = [number, number];

export interface PersonFigure {
  /** Standing height, inches. */
  height: number;
  sizes: BodySizes;
  /** Joint centres (t, z). */
  hip: Pt2;
  /** The bottom of the spine (the same point as the hip joint; kept for the 3D figure). */
  pelvis: Pt2;
  shoulder: Pt2;
  head: Pt2;
  knee: Pt2;
  ankle: Pt2;
  toe: Pt2;
  elbow: Pt2;
  hand: Pt2;
  /** The back from the pelvis to the shoulder: a curve bowed toward the sofa's back as it reclines. */
  spine: Pt2[];
  /** How far the back reclines from upright, degrees. */
  lean: number;
  /** Limb thicknesses (inches): torso, thigh, shin, arm, foot; the head's radius. */
  thick: { torso: number; thigh: number; shin: number; arm: number; foot: number; headR: number };
  /** Where the back of the person's seat is (t): the buttock. */
  seatBack: number;
  /** Upright on a deep seat: the square pillow behind the back (t0..t1 on the seat, z0..z1), or null. */
  pillow: { t0: number; t1: number; z0: number; z1: number } | null;
  /** Feet flat on the floor: always (Andre, 2026-11-11). */
  feetOnFloor: boolean;
  /** The highest point (the top of the head). */
  top: number;
}

export interface SeatProfile {
  /** Seat height, the back pillow's front (from the sofa's back) and the seat's front edge (the sofa's depth). */
  seatHeight: number;
  pillowFront: number;
  D: number;
  /** The back pillow's top (default 13″ above the seat). */
  pillowTop?: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const add = (p: Pt2, len: number, deg: number): Pt2 => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))];

/**
 * The square pillow behind the back in Upright: 20″, and how thick it is when
 * leaned on (4″–9″). Where the space behind the back is thinner than that, the
 * pillow pushes the hips forward; where the back is already nearly upright
 * (under UPRIGHT_NEEDS°), it is left out.
 */
export const UPRIGHT_PILLOW = { size: 20, min: 4, max: 9 } as const;
/** How far a back sinks into the pillow it leans on, and the buttock into the bottom of the back pillow. */
const BACK_SINK = 1;
const SEAT_SINK = 2;
/** How far the thigh may press into the seat's rounded front edge. */
const EDGE_SINK = 3;
/** The recline range, degrees from upright; an Upright back sits at UPRIGHT_LEAN against its pillow. */
const LEAN = { min: 6, max: 50, upright: 7, unsupported: 8 } as const;
/** Upright adds the pillow only when the back would otherwise recline more than this. */
const UPRIGHT_NEEDS = 12;
/** Feet ahead of the knees: a little in Lounge, nearly under them in Upright. */
const FEET_AHEAD = { lounge: 4, upright: 1.5 } as const;

/**
 * The recline at which a back, hinged at `hip`, touches a support whose front
 * is at `front` and whose top is at `top` (it sinks BACK_SINK into it). Null
 * when it cannot reach within LEAN.max.
 */
function reclineTo(hip: Pt2, torsoLen: number, halfW: number, front: number, top: number): number | null {
  const contact = Math.min(top - 0.5, hip[1] + torsoLen * 0.95) - hip[1];
  const back = (deg: number) => hip[0] - contact * Math.tan(rad(deg)) - halfW / Math.cos(rad(deg));
  const target = front - BACK_SINK;
  if (back(LEAN.min) <= target) return LEAN.min;
  if (back(LEAN.max) > target) return null;
  let lo: number = LEAN.min;
  let hi: number = LEAN.max;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (back(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The spine: from `from`, `len` long, leaning `lean` degrees back, bowed backward as it reclines. */
function spineCurve(from: Pt2, len: number, lean: number): Pt2[] {
  const k = Math.min(1, Math.max(0, (lean - 10) / 30)) * 0.12; // the bow, as a share of the chord
  const u: Pt2 = [-Math.sin(rad(lean)), Math.cos(rad(lean))];
  const n: Pt2 = [-Math.cos(rad(lean)), -Math.sin(rad(lean))]; // toward the sofa's back
  const at = (c: number, f: number): Pt2 => [from[0] + f * c * u[0] + 4 * f * (1 - f) * k * c * n[0], from[1] + f * c * u[1] + 4 * f * (1 - f) * k * c * n[1]];
  const N = 8;
  const pts = (c: number) => Array.from({ length: N }, (_, i) => at(c, i / (N - 1)));
  const length = (ps: Pt2[]) => ps.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - ps[i]![0], p[1] - ps[i]![1]), 0);
  return pts(len / length(pts(1))); // the same length however it bows
}

/** A two-bone arm from the shoulder to the hand, the elbow bent down and back. */
function arm(shoulder: Pt2, want: Pt2, upper: number, fore: number): { elbow: Pt2; hand: Pt2 } {
  let d = Math.hypot(want[0] - shoulder[0], want[1] - shoulder[1]);
  const reach = upper + fore - 0.3;
  const hand: Pt2 = d > reach ? [shoulder[0] + ((want[0] - shoulder[0]) / d) * reach, shoulder[1] + ((want[1] - shoulder[1]) / d) * reach] : want;
  d = Math.min(d, reach);
  const toHand = (Math.atan2(hand[1] - shoulder[1], hand[0] - shoulder[0]) * 180) / Math.PI;
  const bend = (Math.acos(Math.min(1, Math.max(-1, (upper * upper + d * d - fore * fore) / (2 * upper * d)))) * 180) / Math.PI;
  return { elbow: add(shoulder, upper, toHand - bend), hand };
}

/**
 * The seated figure.
 * - Both poses: knees bent at the front edge, feet flat on the floor; the
 *   hips go where the thigh puts them (on a seat shorter than the thigh, back
 *   against the back pillow, the knees past the edge).
 * - Lounge: the back reclines until it rests on the back pillow, more on a
 *   deeper sofa, and curves as it does.
 * - Upright: on a seat deeper than the thigh, a square pillow fills the space
 *   behind the back, so it sits nearly straight.
 */
export function personFigure(height: number, pose: PersonPose, seat: SeatProfile): PersonFigure {
  const b = bodySizes(height);
  const h = height;
  const thick = { torso: 0.07 * h, thigh: 0.045 * h, shin: 0.045 * h, arm: 0.035 * h, foot: 0.035 * h, headR: (0.13 * h) / 2 };
  const pillowTop = seat.pillowTop ?? seat.seatHeight + 13;
  const hipBack = 0.07 * h; // the buttock to the hip joint
  const kneeOff = (b.buttockKnee - b.thigh) / 2; // behind the knee to the knee joint
  const thighLen = b.buttockKnee - hipBack - kneeOff;
  const shinLen = 0.245 * h;
  const footLen = b.foot * 0.7;
  const hz = seat.seatHeight + thick.thigh / 2 + 0.3;
  // The knee's height comes from the lower leg standing on the floor, a little forward (both poses use Lounge's knee).
  const ankleZ = thick.foot / 2 + 0.8;
  const kneeZ = ankleZ + Math.sqrt(shinLen * shinLen - FEET_AHEAD.lounge ** 2);
  const slope = Math.asin(Math.max(-0.7, Math.min(0.7, (kneeZ - hz) / thighLen)));
  // The hips: the back of the knee 1″ inside the front edge; not further back than the back pillow allows.
  let hipT = seat.D - 1 + kneeOff - thighLen * Math.cos(slope);
  hipT = Math.max(hipT, seat.pillowFront - SEAT_SINK + hipBack);
  // A thigh sloping down must clear the seat's front edge (short people perch forward).
  if (slope < 0) hipT = Math.min(Math.max(hipT, seat.D - (hz - (seat.seatHeight + thick.thigh / 2 - EDGE_SINK)) / Math.tan(-slope)), seat.D - 3);
  const torsoLen = b.shoulderHeight - (hz - seat.seatHeight);
  const lounge = reclineTo([hipT, hz], torsoLen, thick.torso / 2, seat.pillowFront, pillowTop) ?? LEAN.unsupported;
  // Upright: a square pillow whose front meets a back at LEAN.upright.
  let pillow: PersonFigure['pillow'] = null;
  let lean = lounge;
  if (pose === 'upright' && lounge > UPRIGHT_NEEDS) {
    const top = seat.seatHeight + UPRIGHT_PILLOW.size;
    const contact = Math.min(top - 0.5, hz + torsoLen * 0.95) - hz;
    const front = hipT - contact * Math.tan(rad(LEAN.upright)) - thick.torso / 2 / Math.cos(rad(LEAN.upright)) + BACK_SINK;
    const fill = Math.min(Math.max(front - seat.pillowFront, UPRIGHT_PILLOW.min), UPRIGHT_PILLOW.max);
    hipT += Math.max(0, seat.pillowFront + fill - front); // a thin space: the pillow moves the hips forward
    pillow = { t0: seat.pillowFront, t1: seat.pillowFront + fill, z0: seat.seatHeight, z1: top };
    lean = reclineTo([hipT, hz], torsoLen, thick.torso / 2, pillow.t1, top) ?? LEAN.unsupported;
  }
  const hip: Pt2 = [hipT, hz];
  const knee: Pt2 = [hipT + thighLen * Math.cos(slope), hz + thighLen * Math.sin(slope)];
  const ankle: Pt2 = [knee[0] + FEET_AHEAD[pose], ankleZ];
  const toe: Pt2 = [ankle[0] + footLen, thick.foot / 2];
  const spine = spineCurve(hip, torsoLen, lean);
  const shoulder = spine[spine.length - 1]!;
  const head = add(shoulder, b.sittingHeight - b.shoulderHeight - thick.headR, 90 + lean / 2);
  // Arms: Lounge rests the hand on the seat beside the hip; Upright on the lap.
  const want: Pt2 = pose === 'lounge' ? [hipT + 4, seat.seatHeight + thick.arm / 2] : [hipT + thighLen * 0.55, hz + thick.thigh / 2 + thick.arm / 2];
  const { elbow, hand } = arm(shoulder, want, 0.186 * h, 0.19 * h);
  return {
    height,
    sizes: b,
    hip,
    pelvis: hip,
    shoulder,
    head,
    knee,
    ankle,
    toe,
    elbow,
    hand,
    spine,
    lean,
    thick,
    seatBack: hipT - hipBack,
    pillow,
    feetOnFloor: true,
    top: head[1] + thick.headR,
  };
}

/** 69 -> 5'9″ */
export const feetInches = (inches: number): string => `${Math.floor(Math.round(inches) / 12)}'${Math.round(inches) % 12}″`;

/** "5'9", "5 9", "5ft 9", "69", "69in" -> inches; null when it is not a height. */
export function parseHeight(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/[″"]|in(ches)?$/g, '').trim();
  const m = /^(\d)\s*(?:'|ft|feet|\s)\s*(\d{1,2})?$/.exec(s);
  if (m) return Number(m[1]) * 12 + Number(m[2] ?? 0);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
