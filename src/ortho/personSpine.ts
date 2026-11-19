// The person's back (Andre, 2026-11-11): never a straight rod. Three parts
// (pelvis, lower back, chest) of fixed lengths, each leaning a little
// differently so the bend happens through the middle, smoothed into one curve
// of the body's true hip-to-shoulder length. The lean is solved so the back's
// real surface (the chest has depth) rests on what is behind it. Pure; the
// side plane: t = inches from the sofa's back, z = inches above the floor.
import type { Build } from './personBuild';
import type { PersonPose } from './personLimits';

export type Pt2 = [number, number];

export interface SpinePoint {
  /** On the body's centre line. */
  p: Pt2;
  /** The body there: front to back, and across. */
  depth: number;
  width: number;
  /** The unit normal pointing to the person's front. */
  n: Pt2;
}

/** How much more (or less) than the back's base lean each part reclines, degrees: a C-curve when lounging, a relaxed back upright. */
export const BEND: Record<PersonPose, { pelvis: number; lower: number; chest: number }> = {
  lounge: { pelvis: 12, lower: 6, chest: -12 },
  upright: { pelvis: 5, lower: 2, chest: -6 },
};
/** Each part's share of the hip-to-shoulder length. */
const SHARE = { pelvis: 0.22, lower: 0.33, chest: 0.45 } as const;
const N = 14;

const rad = (deg: number) => (deg * Math.PI) / 180;
const up = (p: Pt2, len: number, lean: number): Pt2 => [p[0] - len * Math.sin(rad(lean)), p[1] + len * Math.cos(rad(lean))];
const mix = (a: number, b: number, k: number) => a + (b - a) * (k * k * (3 - 2 * k));

/** The body's depth and width at s along the back (0 = the hip joint, 1 = the shoulder joint). */
function section(b: Build, s: number): { depth: number; width: number } {
  const keys: [number, number, number][] = [
    [0, b.hipsD, b.hipsW],
    [0.32, b.waistD, b.waistW],
    [0.72, b.chestD, b.chestW],
    [1, b.shoulderD, b.shoulderW],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    const [s0, d0, w0] = keys[i]!;
    const [s1, d1, w1] = keys[i + 1]!;
    if (s <= s1) {
      const k = (s - s0) / (s1 - s0);
      return { depth: mix(d0, d1, k), width: mix(w0, w1, k) };
    }
  }
  return { depth: b.shoulderD, width: b.shoulderW };
}

/** A smooth curve through the part ends (Catmull–Rom), `n` points, then scaled from the hip to the body's true length. */
function smooth(keys: Pt2[], length: number): Pt2[] {
  const at = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))]!;
  const out: Pt2[] = [];
  for (let k = 0; k < N; k++) {
    const u = (k / (N - 1)) * (keys.length - 1);
    const i = Math.min(keys.length - 2, Math.floor(u));
    const f = u - i;
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (c2 - a) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (3 * b - a - 3 * c2 + d) * f * f * f);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  const len = out.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - out[i]![0], p[1] - out[i]![1]), 0);
  const k = length / len;
  return out.map((p): Pt2 => [keys[0]![0] + (p[0] - keys[0]![0]) * k, keys[0]![1] + (p[1] - keys[0]![1]) * k]);
}

/** The back from the hip joint to the shoulder joint, its base lean `lean` degrees back from upright. */
export function spineFrom(hip: Pt2, b: Build, pose: PersonPose, lean: number): SpinePoint[] {
  const bend = BEND[pose];
  const k1 = up(hip, b.spine * SHARE.pelvis, lean + bend.pelvis);
  const k2 = up(k1, b.spine * SHARE.lower, lean + bend.lower);
  const k3 = up(k2, b.spine * SHARE.chest, lean + bend.chest);
  const pts = smooth([hip, k1, k2, k3], b.spine);
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const c = pts[Math.min(pts.length - 1, i + 1)]!;
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    return { p, ...section(b, i / (pts.length - 1)), n: [(c[1] - a[1]) / l, -(c[0] - a[0]) / l] };
  });
}

/** The back's surface behind a spine point. */
export const backOf = (s: SpinePoint): Pt2 => [s.p[0] - (s.n[0] * s.depth) / 2, s.p[1] - (s.n[1] * s.depth) / 2];

/** How far the upper back presses into a support whose front face is at `front(z)` (negative = a gap). */
export function pressInto(spine: SpinePoint[], front: (z: number) => number): number {
  let most = -Infinity;
  for (let i = Math.floor(spine.length * 0.45); i < spine.length; i++) {
    const [t, z] = backOf(spine[i]!);
    most = Math.max(most, front(z) - t);
  }
  return most;
}

/**
 * The back settled against a support: the base lean (within `range`) at which
 * the upper back presses `squash` into it. More lean presses further, so this
 * is a bisection; at the range's ends it is what the range allows.
 */
export function settle(hip: Pt2, b: Build, pose: PersonPose, front: (z: number) => number, squash: number, range: [number, number]): { lean: number; spine: SpinePoint[]; touching: boolean } {
  const at = (lean: number) => spineFrom(hip, b, pose, lean);
  const press = (lean: number) => pressInto(at(lean), front);
  let [lo, hi] = range;
  if (press(lo) >= squash) return { lean: lo, spine: at(lo), touching: true };
  if (press(hi) < squash) return { lean: hi, spine: at(hi), touching: false };
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (press(mid) < squash) lo = mid;
    else hi = mid;
  }
  return { lean: hi, spine: at(hi), touching: true };
}

/** The gap between the back's surface and a support's face at height z (the waist, say); Infinity above the support. */
export function gapAt(spine: SpinePoint[], front: (z: number) => number, z: number): number {
  const backs = spine.map(backOf);
  for (let i = 0; i < backs.length - 1; i++) {
    const [a, b] = [backs[i]!, backs[i + 1]!];
    if ((z - a[1]) * (z - b[1]) <= 0 && a[1] !== b[1]) return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) - front(z);
  }
  return Infinity;
}
