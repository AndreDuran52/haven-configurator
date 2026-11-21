import { describe, expect, it } from 'vitest';
import { DEFAULT_DIMS, SQUARE_PILLOW } from '@/engine';
import { cushionSide } from '@/engine/cushionProfile';
import { bodySizes, feetInches, parseHeight, PERSON_HEIGHT, personFigure, SEAT_SINK, type PersonFigure } from './person';
import { buildFor } from './personBuild';
import { backOf } from './personSpine';

// The real sofa: the leaning back cushion's face, its top at 31″, the 18″ seat.
const cushion = cushionSide(DEFAULT_DIMS);
const TOP = 31;
const seat = (D: number) => ({ seatHeight: 18, pillowFront: 18, pillowTop: TOP, backFront: cushion.front, D });
const sit = (h: number, pose: 'lounge' | 'upright', D: number) => personFigure(h, pose, seat(D));
const pathLength = (f: PersonFigure) => f.spine.slice(1).reduce((s, q, i) => s + Math.hypot(q.p[0] - f.spine[i]!.p[0], q.p[1] - f.spine[i]!.p[1]), 0);

describe('the person (plan Q79)', () => {
  it("the average US man, 5'9″: the body numbers", () => {
    expect(PERSON_HEIGHT).toBe(69);
    expect(bodySizes(69)).toEqual({ sittingHeight: 35.9, shoulderHeight: 23.5, thigh: 19.7, buttockKnee: 23.8, lowerLeg: 17.1, foot: 10.5, head: 9 });
  });

  it("the build at 5'10″ is Andre's (2026-11-11), and every size is a ratio of height", () => {
    const b = buildFor(70);
    const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(0.1);
    near(b.headW, 6.5);
    near(b.headD, 8);
    near(b.headH, 9);
    near(b.neck, 3.8); // slimmer than the head (Andre, 2026-11-18)
    expect(b.neck).toBeLessThan(0.65 * b.headW);
    near(b.chestW, 13);
    near(b.chestD, 9);
    near(b.waistW, 11.5);
    near(b.shoulders, 18);
    near(b.hipsW, 14.5);
    near(b.thighHip, 6);
    near(b.thighKnee, 4);
    near(b.shinKnee, 4);
    near(b.shinAnkle, 3);
    near(b.upperArm, 3.5);
    near(b.forearm, 3);
    near(b.spine, 20.3); // hip joint to shoulder joint: 0.29 × height
    // The head is about a third of the shoulder width (it was 70%).
    expect(b.headW / b.shoulders).toBeGreaterThan(0.33);
    expect(b.headW / b.shoulders).toBeLessThan(0.4);
    const a = buildFor(62);
    const c = buildFor(75);
    for (const k of Object.keys(b) as (keyof typeof b)[]) {
      expect(a[k] / b[k]).toBeCloseTo(62 / 70, 6);
      expect(c[k] / b[k]).toBeCloseTo(75 / 70, 6);
    }
  });

  it('he sinks 3″ into the seat; the back keeps its true length however it bends', () => {
    expect(SEAT_SINK.hip).toBe(3);
    for (const pose of ['lounge', 'upright'] as const)
      for (const D of [36, 40, 44])
        for (const h of [62, 70, 75]) {
          const f = sit(h, pose, D);
          // The hip joint is half a thigh above the sunk underside: at seat height.
          expect(f.hip[1]).toBeCloseTo(18 - 3 + f.build.thighHip / 2, 6);
          expect(Math.abs(pathLength(f) - 0.29 * h) / (0.29 * h)).toBeLessThan(0.02);
          expect(f.spine[0]!.p).toEqual(f.hip);
          expect(f.spine[f.spine.length - 1]!.p).toEqual(f.shoulder);
        }
    // A 2″ sink sits him 1″ higher (the comparison Andre asked for).
    expect(personFigure(70, 'upright', seat(44), 2).shoulder[1] - sit(70, 'upright', 44).shoulder[1]).toBeCloseTo(1, 6);
  });

  it('feet flat on the floor at every height, depth and pose', () => {
    for (let h = 54; h <= 80; h += 2)
      for (const D of [36, 40, 44])
        for (const pose of ['lounge', 'upright'] as const) {
          const f = sit(h, pose, D);
          expect(f.feetOnFloor).toBe(true);
          expect(f.toe[1] - f.build.foot / 2).toBeCloseTo(0, 6);
          expect(f.ankle[1]).toBeLessThan(5);
          expect(f.ankle[0]).toBeGreaterThan(D); // the lower leg stands in front of the seat
          if (pose === 'lounge') expect(f.measures.kneePast).toBeLessThanOrEqual(6 + 1e-6);
        }
  });

  it("Upright at 5'10″ on 44″ (Andre's side photo, 2026-11-18: back 3–8° from vertical, shoulders about 37–38″, head about 49–50″)", () => {
    const f = sit(70, 'upright', 44);
    expect(f.lean).toBeGreaterThanOrEqual(3);
    expect(f.lean).toBeLessThanOrEqual(8);
    expect(f.shoulder[1]).toBeGreaterThan(36.5);
    expect(f.shoulder[1]).toBeLessThan(38.2);
    expect(f.top).toBeGreaterThan(48.5);
    expect(f.top).toBeLessThan(50.5);
    // The whole head is above the back cushion tops; it is upright over the shoulders.
    expect(f.head[1] - f.build.headH / 2).toBeGreaterThan(TOP);
    expect(Math.abs(f.head[0] - f.shoulder[0])).toBeLessThan(1.5);
    // The knees end just past the front edge; the shins stand straight down, the feet 0–2″ ahead of the knees.
    expect(f.measures.kneePast).toBeGreaterThanOrEqual(-0.5);
    expect(f.measures.kneePast).toBeLessThan(2);
    expect(f.measures.feetAhead).toBeGreaterThanOrEqual(0);
    expect(f.measures.feetAhead).toBeLessThanOrEqual(2);
    const shin = (Math.atan2(f.ankle[0] - f.knee[0], f.knee[1] - f.ankle[1]) * 180) / Math.PI;
    expect(shin).toBeLessThan(5);
    // His hands rest on his thighs near the knees; the upper arms hang close to the ribs.
    expect(Math.hypot(f.hand[0] - f.knee[0], f.hand[1] - f.knee[1])).toBeLessThan(5);
    expect(f.across.elbow).toBeLessThanOrEqual(f.build.shoulders / 2 - f.build.upperArm / 2 + 1e-9);
    expect(f.elbow[1]).toBeLessThan(f.shoulder[1] - 10); // the elbow bent low by his side, not held out
    // The thigh comes up to about the seat's top at its front edge: not swallowed.
    expect(f.measures.edgeSink).toBeLessThan(1);
  });

  it("Upright's pillow: the sofa's own 6″ karate-chop pillow, standing as the sofa's do, pressed where his back leans; about 19–20″ of seat left in front of it", () => {
    const f = sit(70, 'upright', 44);
    const p = f.pillow!;
    expect(p).not.toBeNull();
    expect([p.w, p.h, p.t, p.lean]).toEqual([SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t, SQUARE_PILLOW.lean]);
    expect(p.press!.depth).toBeGreaterThan(0);
    expect(p.press!.depth).toBeLessThanOrEqual(2);
    // It stands on the seat (settled ½″ in; Andre, 2026-11-20) between the cushion's face and his back.
    const a = (p.lean * Math.PI) / 180;
    expect(p.c[1] - (p.h / 2) * Math.cos(a) - (p.t / 2) * Math.sin(a)).toBeCloseTo(17.5, 6);
    expect(p.c[0]).toBeGreaterThan(cushion.front(27) - 0.5);
    expect(p.c[0]).toBeLessThan(f.spine[6]!.p[0]);
    // The seat left in front of the pillow's foot (6″ in front of its bottom-back edge).
    const foot = p.c[0] - (p.t / 2) * Math.cos(a) + (p.h / 2) * Math.sin(a);
    expect(44 - (foot + p.t)).toBeGreaterThan(19);
    expect(44 - (foot + p.t)).toBeLessThan(20.5);
    // 40″: still a pillow (the knees end further past the edge); 36″: no room for it.
    expect(sit(70, 'upright', 40).pillow).not.toBeNull();
    expect(sit(70, 'upright', 36).pillow).toBeNull();
    expect(sit(70, 'lounge', 44).pillow).toBeNull();
  });

  it("Lounge at 5'10″ on 44″ (Andre's side photo: shoulders about 30″, head about 42″)", () => {
    const up = sit(70, 'upright', 44);
    const f = sit(70, 'lounge', 44);
    // The hips slide well forward: the knees 4–6″ past the edge, the feet 4–8″ ahead of them.
    expect(f.hip[0]).toBeGreaterThan(up.hip[0] + 3);
    expect(f.measures.kneePast).toBeGreaterThanOrEqual(4);
    expect(f.measures.kneePast).toBeLessThanOrEqual(6 + 1e-6);
    expect(f.measures.feetAhead).toBeGreaterThanOrEqual(4);
    expect(f.measures.feetAhead).toBeLessThanOrEqual(8);
    // The shoulders are level with, or a little below, the cushion tops; only the head shows above.
    expect(f.shoulder[1] - TOP).toBeGreaterThanOrEqual(-2.5);
    expect(f.shoulder[1] - TOP).toBeLessThanOrEqual(0.5);
    expect(f.head[1] - f.build.headH / 2).toBeGreaterThan(TOP);
    // The head is 5–8″ lower than in Upright, upright, and never behind the cushion's face.
    expect(up.top - f.top).toBeGreaterThanOrEqual(5);
    expect(up.top - f.top).toBeLessThanOrEqual(8);
    expect(f.measures.headClear).toBeGreaterThanOrEqual(0);
    // The lower back does not touch the cushion; the upper back rests on it.
    expect(f.measures.waistGap).toBeGreaterThanOrEqual(2);
    const upper = f.spine.slice(Math.floor(f.spine.length * 0.45)).map(backOf);
    const closest = Math.min(...upper.map(([t, z]) => t - cushion.front(z)));
    expect(closest).toBeGreaterThan(-1.2);
    expect(closest).toBeLessThan(0);
    expect(f.measures.edgeSink).toBeLessThan(1.8);
  });

  it('the bend is through the middle of the back: a C-curve when lounging, nearly straight upright', () => {
    const bow = (f: PersonFigure) => {
      const [a, b] = [f.hip, f.shoulder];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // How far the spine's points lie behind the straight line from hip to shoulder (positive = toward the sofa's back).
      return Math.max(...f.spine.map((q) => ((b[0] - a[0]) * (q.p[1] - a[1]) - (b[1] - a[1]) * (q.p[0] - a[0])) / l));
    };
    expect(bow(sit(70, 'lounge', 44))).toBeGreaterThan(1.2);
    expect(bow(sit(70, 'upright', 44))).toBeGreaterThan(0.2);
    expect(bow(sit(70, 'upright', 44))).toBeLessThan(bow(sit(70, 'lounge', 44)) * 0.7);
    // The chest reclines less than the pelvis: the top of the back is more upright than its foot.
    const f = sit(70, 'lounge', 44);
    const leanOf = (i: number, j: number) => Math.atan2(f.spine[i]!.p[0] - f.spine[j]!.p[0], f.spine[j]!.p[1] - f.spine[i]!.p[1]);
    expect(leanOf(f.spine.length - 3, f.spine.length - 1)).toBeLessThan(leanOf(0, 2) - 0.2);
  });

  it('a shallower sofa leaves less room to slide: Lounge reclines less at 40″ and 36″', () => {
    const lean = (D: number) => sit(70, 'lounge', D).lean;
    expect(lean(36)).toBeLessThan(lean(40));
    expect(lean(40)).toBeLessThan(lean(44));
    expect(sit(70, 'lounge', 36).shoulder[1]).toBeGreaterThan(sit(70, 'lounge', 44).shoulder[1]);
  });

  it("5'2″ and 6'3″ still scale and sit", () => {
    for (const pose of ['lounge', 'upright'] as const) {
      const [small, mid, tall] = [sit(62, pose, 44), sit(70, pose, 44), sit(75, pose, 44)];
      expect(small.top).toBeLessThan(mid.top);
      expect(mid.top).toBeLessThan(tall.top);
      for (const f of [small, tall]) {
        expect(f.feetOnFloor).toBe(true);
        expect(f.hip[0]).toBeGreaterThan(20);
        expect(f.head[1] - f.build.headH / 2).toBeGreaterThan(f.shoulder[1]);
        expect(Number.isFinite(f.elbow[0] + f.elbow[1] + f.hand[0] + f.hand[1])).toBe(true);
      }
    }
  });

  it('every joint has its own place across the body: arms from the outer shoulders, hands on the thighs near the knees (Upright) or together on the lap (Lounge)', () => {
    const up = sit(70, 'upright', 44);
    const lo = sit(70, 'lounge', 44);
    expect(up.across.shoulder * 2 + up.build.upperArm).toBeCloseTo(18, 1);
    expect(up.across.hip * 2 + up.build.thighHip).toBeCloseTo(14.5, 1);
    expect(up.across.hand).toBeCloseTo(up.across.knee, 6); // on the thigh, over the knee
    expect(up.hand[1]).toBeGreaterThan(up.knee[1]); // resting on top of the thigh
    expect(lo.across.hand).toBeLessThan(2.5); // together, in the middle
    expect(lo.hand[1]).toBeGreaterThan(lo.hip[1] + 2); // on the lap
    expect(up.across.toe).toBeGreaterThan(up.across.ankle); // toes turned out a little
  });

  it('heights read and parse as feet and inches', () => {
    expect(feetInches(69)).toBe("5'9″");
    expect(feetInches(72)).toBe("6'0″");
    expect(parseHeight("5'9")).toBe(69);
    expect(parseHeight("5'9″")).toBe(69);
    expect(parseHeight('6 2')).toBe(74);
    expect(parseHeight('6ft')).toBe(72);
    expect(parseHeight('69')).toBe(69);
    expect(parseHeight('69 in')).toBe(69);
    expect(parseHeight('tall')).toBeNull();
  });
});
