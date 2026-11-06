// Freeform stage 3 (Andre, 2026-11-06): shapes the app can't make today, built
// from free pieces, lay out exactly; snapping offers only real, open faces.
import { describe, expect, it } from 'vitest';
import { buildFree } from './freeBuild';
import { attachPose, turnVec } from './freeGeom';
import { openFaces, snapTargets } from './freeSnap';
import { doubleSided, facing, freeL, straight } from './freeTesting';
import type { FreePiece } from './freeTypes';

const size = (f: Parameters<typeof buildFree>[0]) => {
  const b = buildFree(f).bounds;
  return [b.maxX - b.minX, b.maxY - b.minY];
};

describe('turns and the attach rule', () => {
  it('turns are exact quarter turns, clockwise on screen (y down)', () => {
    expect(turnVec([1, 0], 90)).toEqual([0, 1]);
    expect(turnVec([0, 1], 90)).toEqual([-1, 0]);
    expect(turnVec([3, 4], 180)).toEqual([-3, -4]);
    expect(turnVec(turnVec([3, 4], 270), 90)).toEqual([3, 4]);
  });

  it('a wedge on a seat end turns toward the seat side; a seat continues a row in line', () => {
    const f = straight(0);
    const seat = f.pieces[0]!;
    const wedge: FreePiece = { id: 'w', kind: 'wedge', at: { to: 'p1', face: 'end' } };
    const end: FreePiece = { ...seat, arm: 'start', at: { x: 0, y: 0, rot: 0 } };
    expect(attachPose(end, { x: 0, y: 0, rot: 0 }, wedge, { to: 'p1', face: 'end' }, f.shared)).toEqual({ pose: { x: 110, y: 0, rot: 90 }, face: 'b' });
    const next: FreePiece = { id: 'n', kind: 'armless', length: 36, at: { to: 'p1', face: 'end' } };
    expect(attachPose(end, { x: 0, y: 0, rot: 0 }, next, { to: 'p1', face: 'end' }, f.shared)).toEqual({ pose: { x: 50, y: 0, rot: 0 }, face: 'start' });
  });
});

describe('free fixtures lay out', () => {
  it('a straight 3-seat sofa: 136 × 44, arms both ends, Seats 3–4, nothing open', () => {
    const b = buildFree(straight(1));
    expect(b.errors).toEqual([]);
    expect(size(straight(1))).toEqual([136, 44]);
    expect(b.seats.label).toBe('Seats 3–4');
    expect(b.chains).toEqual([['p1', 'p2', 'p3']]);
    expect(openFaces(straight(1))).toEqual([]);
  });

  it('an L from scratch: wedge 60, a row to the right, a leg down', () => {
    const b = buildFree(freeL());
    expect(b.errors).toEqual([]);
    expect(size(freeL())).toEqual([60 + 36 + 50, 60 + 72]);
    expect(b.chains).toHaveLength(2);
    expect(b.groups).toHaveLength(1);
  });

  it('double-sided, two backs (88 deep) and one shared frame (78 deep)', () => {
    for (const [shared, depth] of [[false, 88], [true, 78]] as const) {
      const f = doubleSided(shared);
      expect(buildFree(f).errors).toEqual([]);
      expect(size(f)).toEqual([136, depth]);
      expect(buildFree(f).groups).toHaveLength(1);
      expect(buildFree(f).seats.label).toBe('Seats 6–8');
    }
  });

  it('two sofas facing each other: two groups, the coffee table between them warns, never errors', () => {
    const b = buildFree(facing());
    expect(b.errors).toEqual([]);
    expect(b.groups.filter((g) => g.length > 1)).toHaveLength(2);
    expect(b.clearances[0]!.min).toBe(6);
    expect(b.warnings.map((w) => w.code)).toContain('coffeeClearanceUnder14');
  });

  it('an overlap is an error; a frame-on-frame overlap only with a shared back', () => {
    const f = straight(1);
    const bad = { ...f, pieces: [...f.pieces, { id: 'x', kind: 'armless' as const, length: 36, at: { x: 10, y: 10, rot: 0 as const } }] };
    expect(buildFree(bad).errors.some((e) => e.endsWith('overlap'))).toBe(true);
  });

  it('an arm face takes nothing; a missing parent or a loop is an error, never a throw', () => {
    const f = straight(0);
    const onArm = { ...f, pieces: [...f.pieces, { id: 'x', kind: 'armless' as const, length: 36, at: { to: 'p1', face: 'start' as const } }] };
    expect(buildFree(onArm).errors.join()).toMatch(/attached to an arm/);
    const lost = { ...f, pieces: [...f.pieces, { id: 'x', kind: 'armless' as const, length: 36, at: { to: 'nope', face: 'end' as const } }] };
    expect(buildFree(lost).errors.join()).toMatch(/missing piece/);
  });
});

describe('snap targets', () => {
  it('a row with arms at both ends only offers its backs', () => {
    const t = snapTargets(straight(1), { kind: 'armless' });
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((x) => x.face === 'back')).toBe(true);
    expect(snapTargets(straight(1), { kind: 'wedge' })).toEqual([]);
  });

  it('an open row end takes a seat in line and a wedge turning toward the seats', () => {
    const f = { ...straight(0), pieces: [{ id: 'p1', kind: 'armless' as const, length: 36, at: { x: 0, y: 0, rot: 0 as const } }] };
    const seats = snapTargets(f, { kind: 'armless' }).filter((t) => t.face !== 'back');
    expect(seats.map((t) => [t.face, t.pose])).toEqual([
      ['start', { x: -36, y: 0, rot: 0 }],
      ['end', { x: 36, y: 0, rot: 0 }],
    ]);
    const wedges = snapTargets(f, { kind: 'wedge' });
    expect(wedges.map((t) => t.pose.rot).sort()).toEqual([0, 90]);
  });

  it('a target that would overlap is left out', () => {
    const f = facing();
    const t = snapTargets(f, { kind: 'armless', length: 100 });
    for (const x of t) expect(x.face).toBe('back');
  });
});
