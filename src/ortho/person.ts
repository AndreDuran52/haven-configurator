// The person on the sofa (Andre, 2026-11-11, plan Q63 / Q79): a plain
// mannequin whose every size is a ratio of height (personBuild.ts), seated on
// the Haven in the side plane (t = inches from the sofa's back, z = inches
// above the floor), with an across position for every joint. The Side drawing
// and the 3D figure are both built from this, so they always agree. Pure.
//
// How people sit on the Haven (Andre's photos on the showroom sofa, 5'10″):
// - the seat gives: the hips sink 3″, the thighs come up to about the seat's
//   top at its front edge; the feet are always flat on the floor;
// - Upright: the knees bend at the front edge, the feet nearly under them; a
//   throw pillow fills the space behind the back, which reclines 10–15°,
//   relaxed, the head upright;
// - Lounge: the hips slide forward (the knees up to 6″ past the edge), the
//   pelvis rolls back and the back bends through its middle until the upper
//   back rests on the back cushion near its top; the lower back does not
//   touch it; the head stays upright, about 6″ lower than in Upright.
import { SQUARE_PILLOW } from '@/engine';
import { bodySizes, buildFor, type BodySizes, type Build } from './personBuild';
import type { PersonPose } from './personLimits';
import { gapAt, settle, spineFrom, type Pt2, type SpinePoint } from './personSpine';
import type { PillowPress } from './pillowShape';

export { PERSON_HEIGHT, PERSON_MAX, PERSON_MIN, type PersonPose } from './personLimits';
export { bodySizes, type BodySizes } from './personBuild';
export { feetInches, parseHeight } from './personHeight';
export type { Pt2, SpinePoint } from './personSpine';

/** The throw pillow behind an upright back: its centre, how far it leans back, its box, and where the back presses it. */
export interface PersonPillow {
  c: Pt2;
  lean: number;
  w: number;
  h: number;
  t: number;
  press: PillowPress | null;
}

export interface PersonFigure {
  /** Standing height, inches. */
  height: number;
  pose: PersonPose;
  sizes: BodySizes;
  build: Build;
  /** Joint centres (t, z). */
  hip: Pt2;
  shoulder: Pt2;
  /** Where the arm hangs from: half an arm's thickness down the back from the shoulder joint, so the arm's rounded top is level with the shoulder. */
  armRoot: Pt2;
  /** The head's centre; it is held upright. */
  head: Pt2;
  knee: Pt2;
  ankle: Pt2;
  toe: Pt2;
  elbow: Pt2;
  hand: Pt2;
  /** The back, hip joint to shoulder joint, with the body's depth and width at each point. */
  spine: SpinePoint[];
  /** Each joint's distance from the body's middle, across the seat (the figure is symmetric). */
  across: { hip: number; knee: number; ankle: number; toe: number; shoulder: number; elbow: number; hand: number };
  /** How far the back reclines from upright, hip joint to shoulder joint, degrees. */
  lean: number;
  /** Where the buttock is (t). */
  seatBack: number;
  /** Upright: the throw pillow behind the back, or null. */
  pillow: PersonPillow | null;
  /** Feet flat on the floor: always. */
  feetOnFloor: boolean;
  /** The highest point (the top of the head). */
  top: number;
  /** For the checks: the gap behind the waist, the knee joint past the front edge, the feet ahead of the knees, how far the thigh's underside is below the seat's top at its front edge. */
  measures: { waistGap: number; kneePast: number; feetAhead: number; edgeSink: number; headClear: number };
}

export interface SeatProfile {
  /** Seat height, the back cushion's belly front (from the sofa's back) and the seat's front edge (the sofa's depth). */
  seatHeight: number;
  pillowFront: number;
  D: number;
  /** The back cushion's top (default 13″ above the seat). */
  pillowTop?: number;
  /** Where the back cushion's leaning front face is at a height (engine/cushionProfile); without it the face stands straight up at pillowFront. */
  backFront?: (z: number) => number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const add = (p: Pt2, len: number, d: number): Pt2 => [p[0] + len * Math.cos(rad(d)), p[1] + len * Math.sin(rad(d))];

/** The seat gives under a person: how far the hips sink into it (Andre: 3″, tapering toward the knee; the legs' own lengths bring the thigh up to the seat's top at its front edge). */
export const SEAT_SINK = { hip: 3, knee: 1 };
/** The throw pillow behind an upright back: the sofa's own 20″ karate-chop pillow (engine SQUARE_PILLOW); the space it fills, min to max. */
export const UPRIGHT_PILLOW = { size: SQUARE_PILLOW.w, t: SQUARE_PILLOW.t, min: 3, max: 6.5 } as const;
/** How far a back presses into the cushion it leans on, and the buttock into the cushion's soft foot. */
const BACK_SQUASH = 1;
const FOOT_SQUASH = 2;
/** Feet ahead of the knees. */
const FEET_AHEAD = { lounge: 6, upright: 2 } as const;
/** Lounge: the knee joint goes no further than this past the front edge (the thigh needs the seat), and the shoulders come down to this far under the cushion's top. */
const KNEE_PAST = 6;
const SHOULDER_UNDER = 0.75;
/** The back's lean, degrees from upright. */
const LEAN = { upright: 13.5, min: 5, max: 62, noPillow: 16 } as const;

/** A two-bone arm from the shoulder to the hand, the elbow bent back. */
function arm(shoulder: Pt2, want: Pt2, upper: number, fore: number): { elbow: Pt2; hand: Pt2 } {
  let d = Math.hypot(want[0] - shoulder[0], want[1] - shoulder[1]);
  const reach = upper + fore - 0.3;
  const hand: Pt2 = d > reach ? [shoulder[0] + ((want[0] - shoulder[0]) / d) * reach, shoulder[1] + ((want[1] - shoulder[1]) / d) * reach] : want;
  d = clamp(d, Math.abs(upper - fore) + 0.3, reach);
  const toHand = deg(Math.atan2(hand[1] - shoulder[1], hand[0] - shoulder[0]));
  const bend = deg(Math.acos(clamp((upper * upper + d * d - fore * fore) / (2 * upper * d), -1, 1)));
  return { elbow: add(shoulder, upper, toHand - bend), hand };
}

export function personFigure(height: number, pose: PersonPose, seat: SeatProfile, sink: number = SEAT_SINK.hip): PersonFigure {
  const sizes = bodySizes(height);
  const b = buildFor(height);
  const top = seat.pillowTop ?? seat.seatHeight + 13;
  const face = seat.backFront ?? ((z: number) => (z <= top ? seat.pillowFront : -Infinity));
  // The hips sink into the seat; the hip joint is half a thigh above their underside.
  const hz = seat.seatHeight - sink + b.thighHip / 2;
  const kneeOff = (sizes.buttockKnee - sizes.thigh) / 2; // behind the knee to the knee joint
  const thighLen = sizes.buttockKnee - b.hipBack - kneeOff;
  // The lower leg stands on the floor (in a shoe), the foot a little ahead of the knee: that sets the knee's height.
  const ankleZ = b.sole + b.ankle;
  const kneeZ = ankleZ + Math.sqrt(b.shin * b.shin - FEET_AHEAD[pose] ** 2);
  const slope = Math.asin(clamp((kneeZ - hz) / thighLen, -0.7, 0.7));
  const run = thighLen * Math.cos(slope);
  // Upright: the back of the knee 1″ inside the front edge; no further back than the cushion's soft foot allows.
  const foot = face(seat.seatHeight + 1);
  let hipT = Math.max(seat.D - 1 + kneeOff - run, (Number.isFinite(foot) ? foot : seat.pillowFront) - FOOT_SQUASH + b.hipBack);

  let back: { lean: number; spine: SpinePoint[] };
  let pillow: PersonPillow | null = null;
  if (pose === 'lounge') {
    // Slide forward until the shoulders are just under the cushion's top, the knee at most KNEE_PAST beyond the edge.
    const at = (t: number) => settle([t, hz], b, pose, face, BACK_SQUASH, [LEAN.min, LEAN.max]);
    const shoulderZ = (t: number) => at(t).spine[at(t).spine.length - 1]!.p[1];
    const cap = Math.max(hipT, seat.D + KNEE_PAST - run);
    if (shoulderZ(hipT) > top - SHOULDER_UNDER) {
      let [lo, hi] = [hipT, cap];
      if (shoulderZ(cap) > top - SHOULDER_UNDER) lo = cap;
      else
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          if (shoulderZ(mid) > top - SHOULDER_UNDER) lo = mid;
          else hi = mid;
        }
      hipT = shoulderZ(cap) > top - SHOULDER_UNDER ? cap : hi;
    }
    back = at(hipT);
  } else {
    // Where the back would rest with no pillow: nearly upright already means no pillow is needed.
    const bare = settle([hipT, hz], b, pose, face, BACK_SQUASH, [LEAN.min, LEAN.max]);
    if (bare.lean <= LEAN.noPillow) back = bare;
    else {
      const mid = seat.seatHeight + UPRIGHT_PILLOW.size / 2;
      const gap = (t: number, lean: number) => gapAt(spineFrom([t, hz], b, pose, lean), face, mid);
      // A thin space: the pillow moves the hips forward. A deep one: the back reclines until the pillow fills it.
      hipT += Math.max(0, UPRIGHT_PILLOW.min - gap(hipT, LEAN.upright));
      let lean: number = LEAN.upright;
      if (gap(hipT, lean) > UPRIGHT_PILLOW.max) {
        let [lo, hi] = [lean, bare.lean];
        for (let i = 0; i < 24; i++) {
          const m = (lo + hi) / 2;
          if (gap(hipT, m) > UPRIGHT_PILLOW.max) lo = m;
          else hi = m;
        }
        lean = hi;
      }
      const spine = spineFrom([hipT, hz], b, pose, lean);
      back = { lean, spine };
      // The pillow stands in the space, leaning with it: its middle line runs between the cushion's face and the back.
      const midAt = (z: number) => face(z) + gapAt(spine, face, z) / 2;
      const [z1, z2] = [hz + 1, Math.min(seat.seatHeight + 15, top - 2, spine[spine.length - 1]!.p[1] - 2)];
      const g = gap(hipT, lean);
      // A back too far away to hold it (a short person on a deep seat): it just leans on the cushion.
      const held = Number.isFinite(midAt(z1)) && Number.isFinite(midAt(z2)) && z2 > z1 + 4 && g <= UPRIGHT_PILLOW.max + 0.5;
      const tilt = held ? clamp(deg(Math.atan2(midAt(z1) - midAt(z2), z2 - z1)), 6, 24) : 22;
      const cz = seat.seatHeight - 0.5 + (UPRIGHT_PILLOW.size / 2) * Math.cos(rad(tilt));
      // Where the space is wider than the pillow, it rests back on the cushion.
      const ct = held ? midAt(z1) - (cz - z1) * Math.tan(rad(tilt)) - Math.max(0, g - UPRIGHT_PILLOW.t) / 2 : face(seat.seatHeight + 1) + UPRIGHT_PILLOW.t / 2 - (cz - seat.seatHeight) * Math.tan(rad(tilt));
      pillow = {
        c: [ct, cz],
        lean: tilt,
        w: UPRIGHT_PILLOW.size,
        h: UPRIGHT_PILLOW.size,
        t: UPRIGHT_PILLOW.t,
        press: held && g < UPRIGHT_PILLOW.t ? { depth: Math.min(UPRIGHT_PILLOW.t - g, 2.4), at: -0.1 } : null,
      };
    }
  }

  const hip: Pt2 = [hipT, hz];
  const spine = back.spine;
  const shoulder = spine[spine.length - 1]!.p;
  const knee: Pt2 = [hipT + run, hz + thighLen * Math.sin(slope)];
  const ankle: Pt2 = [knee[0] + FEET_AHEAD[pose], ankleZ];
  const toe: Pt2 = [ankle[0] + sizes.foot * 0.7, b.foot / 2];
  // The head is held upright over the shoulders (chin a little down when lounging), never behind the cushion's face.
  const headZ = shoulder[1] + b.shoulderToCrown - b.headH / 2;
  const headBack = face(Math.min(headZ, top - 2.5)); // the cushion's face where its round top begins
  const head: Pt2 = [Math.max(shoulder[0] + (pose === 'lounge' ? 1.5 : 0.8), (Number.isFinite(headBack) ? headBack : -Infinity) + b.headD / 2 + 0.3), headZ];
  // Arms: each joint has its own place across the body. Upright: hands on the seat beside the thighs. Lounge: hands together on the lap.
  const across = {
    hip: b.hipsW / 2 - b.thighHip / 2,
    knee: 0.07 * height,
    ankle: 0.07 * height,
    toe: 0.07 * height + sizes.foot * 0.7 * Math.sin(rad(10)),
    shoulder: b.shoulders / 2 - b.upperArm / 2,
    elbow: pose === 'lounge' ? b.shoulders / 2 - b.upperArm / 2 + 0.3 : b.shoulders / 2 + 0.012 * height, // upright, the elbows sit out a little
    hand: pose === 'lounge' ? b.forearm / 2 + 0.3 : b.hipsW / 2 + b.forearm / 2 + 0.8,
  };
  const want: Pt2 = pose === 'lounge' ? [hipT + run * 0.42, hz + b.thighHip / 2 + b.forearm / 2] : [hipT + run * 0.62, seat.seatHeight + b.forearm / 2 - 0.5];
  // Seen from the side a limb that also runs across the body looks shorter.
  const flat = (len: number, dx: number) => Math.sqrt(Math.max(1, len * len - dx * dx));
  const sn = spine[spine.length - 1]!.n;
  const armRoot: Pt2 = [shoulder[0] + (sn[1] * b.upperArm) / 2, shoulder[1] - (sn[0] * b.upperArm) / 2];
  const { elbow, hand } = arm(armRoot, want, flat(b.upperArmLen, across.elbow - across.shoulder), flat(b.forearmLen, across.elbow - across.hand));
  const waist = spine[Math.round((spine.length - 1) * 0.32)]!;
  const edgeZ = hz + (seat.D - hipT) * Math.tan(slope);
  const edgeR = (b.thighHip + (b.thighKnee - b.thighHip) * clamp((seat.D - hipT) / run, 0, 1)) / 2;
  return {
    height,
    pose,
    sizes,
    build: b,
    hip,
    shoulder,
    armRoot,
    head,
    knee,
    ankle,
    toe,
    elbow,
    hand,
    spine,
    across,
    lean: deg(Math.atan2(hip[0] - shoulder[0], shoulder[1] - hip[1])),
    seatBack: hipT - b.hipBack,
    pillow,
    feetOnFloor: true,
    top: head[1] + b.headH / 2,
    measures: {
      waistGap: gapAt(spine, face, waist.p[1] - (waist.n[1] * waist.depth) / 2),
      kneePast: knee[0] - seat.D,
      feetAhead: ankle[0] - knee[0],
      edgeSink: seat.seatHeight - (edgeZ - edgeR),
      headClear: head[0] - b.headD / 2 - (Number.isFinite(headBack) ? headBack : seat.pillowFront),
    },
  };
}
