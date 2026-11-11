// The person on the sofa (Andre, 2026-11-11, plan Q63 / Q79): a plain figure
// with standard body proportions scaled by height, seated on the Haven, in the
// side plane (t = inches from the sofa's back, z = inches above the floor).
// The side drawing and the 3D figure are both built from these joints, so they
// always agree. Pure: no three, no React.
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
  /** The bottom of the torso: its rounded end rests on the seat. */
  pelvis: Pt2;
  shoulder: Pt2;
  head: Pt2;
  knee: Pt2;
  ankle: Pt2;
  toe: Pt2;
  elbow: Pt2;
  hand: Pt2;
  /** Limb thicknesses (inches): torso, thigh, shin, arm, foot; the head's radius. */
  thick: { torso: number; thigh: number; shin: number; arm: number; foot: number; headR: number };
  /** Where the back of the person's seat is (t): the back pillow's front, or further forward on the extra pillow. */
  seatBack: number;
  /** Upright on a deep seat: the square pillow behind the back (t0..t1 on the seat, z0..z1), or null. */
  pillow: { t0: number; t1: number; z0: number; z1: number } | null;
  /** Feet flat on the floor (else the legs rest out along the seat, or the feet hang). */
  feetOnFloor: boolean;
  /** The highest point (the top of the head). */
  top: number;
}

export interface SeatProfile {
  /** Seat height, the back pillow's front (from the sofa's back) and the seat's front edge (the sofa's depth). */
  seatHeight: number;
  pillowFront: number;
  D: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const add = (p: Pt2, len: number, deg: number): Pt2 => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))];

/** How far the hips sit forward of the back pillow when lounging. */
export const LOUNGE_SLOUCH = 2;
/** A leg this close to the floor (inches) stands flat on it: the seat gives that much under a person. */
const FLAT_REACH = 2.5;

/** The square pillow behind the back in Upright: 20″, and how thick it can fill (it is left out under 3″). */
export const UPRIGHT_PILLOW = { size: 20, min: 3, max: 9 } as const;

/**
 * The seated figure.
 * - Lounge: all the way back against the back pillow, leaning on it. When the
 *   seat is deeper than the thigh, the knees can't bend at the front edge, so
 *   the legs rest out along the seat.
 * - Upright: a square pillow behind the back fills the gap, so the knees bend
 *   at the front edge and the feet go to the floor.
 */
export function personFigure(height: number, pose: PersonPose, seat: SeatProfile): PersonFigure {
  const b = bodySizes(height);
  const thick = { torso: 0.135 * height, thigh: 0.085 * height, shin: 0.062 * height, arm: 0.05 * height, foot: 0.042 * height, headR: (0.13 * height) / 2 };
  const usable = seat.D - seat.pillowFront;
  // Where the back of the seat is: Upright moves forward so the knee bends just past the front edge.
  const gap = usable - b.thigh - 1;
  const fill = pose === 'upright' && gap >= UPRIGHT_PILLOW.min ? Math.min(gap, UPRIGHT_PILLOW.max) : 0;
  // Lounging, the hips slide a little forward and the back sinks into the pillow.
  const seatBack = seat.pillowFront + (pose === 'lounge' ? LOUNGE_SLOUCH : fill);
  const hipBack = 0.07 * height; // back of the seat to the hip joint
  const hip: Pt2 = [seatBack + hipBack, seat.seatHeight + thick.thigh / 2];
  // The torso leans back from the hip: 20° in Lounge, 8° upright.
  const lean = pose === 'lounge' ? 20 : 8;
  const pelvis: Pt2 = [hip[0], seat.seatHeight + thick.torso / 2];
  const shoulder = add(hip, b.shoulderHeight - thick.thigh / 2, 90 + lean);
  const head = add(shoulder, b.sittingHeight - b.shoulderHeight - thick.headR, 90 + lean / 2);
  const thighLen = b.buttockKnee - hipBack - 0.03 * height; // hip joint to knee joint
  const shinLen = 0.245 * height; // knee joint to ankle joint
  const ankleH = 0.04 * height;
  const kneeBehind = seatBack + b.thigh;
  const hangs = kneeBehind >= seat.D - 1.01; // the knee reaches the front edge
  let knee: Pt2;
  let ankle: Pt2;
  let toe: Pt2;
  let feetOnFloor = false;
  if (hangs) {
    // The knee bends at the front edge and the lower leg hangs straight down.
    knee = add(hip, thighLen, 0);
    const reach = knee[1] - shinLen; // where the ankle hangs
    const flat = reach - ankleH <= FLAT_REACH;
    ankle = [knee[0] + 1, flat ? ankleH : reach];
    // The foot is flat when the leg reaches the floor; a little short, the toes point down to it.
    const footLen = b.foot * 0.7; // ankle to toe
    const toeDrop = flat ? ankle[1] - thick.foot / 2 : Math.min(ankle[1] - thick.foot / 2, footLen * 0.6);
    feetOnFloor = flat || ankle[1] - thick.foot / 2 <= footLen * 0.6;
    toe = [ankle[0] + Math.sqrt(footLen * footLen - toeDrop * toeDrop), ankle[1] - toeDrop];
  } else {
    // The legs rest out along the seat: the calf lies over the front edge.
    knee = add(hip, thighLen, 4);
    const edge: Pt2 = [seat.D, seat.seatHeight + thick.shin / 2];
    const down = knee[0] < edge[0] ? Math.max(4, (Math.atan2(knee[1] - edge[1], edge[0] - knee[0]) * 180) / Math.PI) : 35;
    ankle = add(knee, shinLen, -Math.min(down, 60));
    toe = add(ankle, b.foot * 0.7, 55);
  }
  // The arm rests on the lap.
  const armUp = 0.186 * height;
  const elbow = add(shoulder, armUp, -90 + lean + 12);
  const lap: Pt2 = [Math.min(knee[0] - 3, hip[0] + thighLen * 0.75), hip[1] + thick.thigh / 2 + thick.arm / 2];
  const d = Math.hypot(lap[0] - elbow[0], lap[1] - elbow[1]) || 1;
  const fore = Math.min(0.2 * height, d);
  const hand: Pt2 = [elbow[0] + ((lap[0] - elbow[0]) / d) * fore, elbow[1] + ((lap[1] - elbow[1]) / d) * fore];
  return {
    height,
    sizes: b,
    hip,
    pelvis,
    shoulder,
    head,
    knee,
    ankle,
    toe,
    elbow,
    hand,
    thick,
    seatBack,
    pillow: fill ? { t0: seat.pillowFront, t1: seatBack, z0: seat.seatHeight, z1: seat.seatHeight + UPRIGHT_PILLOW.size } : null,
    feetOnFloor,
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
