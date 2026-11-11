// The person's body (Andre, 2026-11-11): lengths from the standard
// anthropometric tables and a plain mannequin build, every size a ratio of
// standing height, so a typed height scales the whole figure. Pure.
//
// Lengths are ratios of standing height for adult men, rounded from the usual
// tables (ANSUR-style seated measures; Drillis & Contini segment ratios). At
// 5'9″ (69″, the average US man, CDC) they give: sitting height 36″, shoulder
// height seated 23½″, seat back to behind the knee 19½″, seat back to the
// front of the knee 24″, floor to behind the knee 17″, foot 10½″.
//
// The build is Andre's own (5'10″, from his front and side photos): a head
// about a third of the shoulder width, a short thick neck, a chest that
// tapers to the waist, hips as wide as the shoulders when seated.

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

/** Andre's measurements at 70″, as ratios of height. */
const AT = 70;
const BUILD_RATIO = {
  /** The head: an egg, across × front to back × tall. */
  headW: 6.5 / AT,
  headD: 8 / AT,
  headH: 9 / AT,
  /** The neck's thickness; from the front the chin nearly meets the shoulders. */
  neck: 4.5 / AT,
  /** Across and front to back: the hips on the seat, the waist, the chest, the shoulder line (the arms hang outside it). */
  hipsW: 14.5 / AT,
  hipsD: 8.5 / AT,
  waistW: 11.5 / AT,
  waistD: 7.8 / AT,
  chestW: 13 / AT,
  chestD: 9 / AT,
  shoulderW: 14.5 / AT,
  shoulderD: 7 / AT,
  /** Across the outside of the shoulders, arms included. */
  shoulders: 18 / AT,
  thighHip: 6 / AT,
  thighKnee: 4 / AT,
  shinKnee: 4 / AT,
  shinAnkle: 3 / AT,
  upperArm: 3.5 / AT,
  forearm: 3 / AT,
  /** The foot (in a shoe): how thick, and its sole. */
  foot: 3 / AT,
  sole: 0.6 / AT,
  /** Hip joint to shoulder joint along the back: 20″ at 5'10″. */
  spine: 0.29,
  /** Shoulder joint to the top of the head, the head held upright and relaxed (0.18 sitting to attention). */
  shoulderToCrown: 0.172,
  /** Bone lengths between joints. */
  shin: 0.245,
  upperArmLen: 0.186,
  forearmLen: 0.19,
  /** The buttock to the hip joint. */
  hipBack: 0.07,
  /** The ankle joint above the sole. */
  ankle: 0.039,
} as const;

export type Build = { -readonly [K in keyof typeof BUILD_RATIO]: number };

/** The build for a height, in inches. */
export function buildFor(height: number): Build {
  const out = {} as Build;
  for (const k of Object.keys(BUILD_RATIO) as (keyof Build)[]) out[k] = BUILD_RATIO[k] * height;
  return out;
}
