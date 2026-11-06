// Freeform edits (stage 3) as Andre chose them (2026-11-06): a pulled seat's
// row closes up; a grown seat pushes the rest along (refused if it would hit
// another sofa); Turn turns the whole sofa; a refused edit returns the same
// layout reference.
import { describe, expect, it } from 'vitest';
import { buildFree } from './freeBuild';
import { addFree, moveFree, removeFree, setFreeArm, setFreeLength, setFreeShared, setFreeSharedBack, turnFree } from './freeOps';
import { doubleSided, freeL, freeOf, straight } from './freeTesting';
import type { FreeLayout } from './freeTypes';

const pose = (f: FreeLayout, id: string) => buildFree(f).poses.get(id)!;
const bounds = (f: FreeLayout): [number, number, number, number] => {
  const b = buildFree(f).bounds;
  return [b.minX, b.minY, b.maxX, b.maxY];
};

describe('pull a seat out: the row closes up', () => {
  it('a middle seat: the end piece slides over by its length, still one sofa', () => {
    const f = straight(2); // p1 a50 | p2 s36 | p3 s36 | p4 a50
    const r = removeFree(f, 'p2');
    expect(r.rejected).toBeNull();
    expect(pose(r.free, 'p3')).toEqual({ x: 50, y: 0, rot: 0 });
    expect(pose(r.free, 'p4')).toEqual({ x: 86, y: 0, rot: 0 });
    expect(buildFree(r.free).groups).toHaveLength(1);
  });

  it('the first piece (the root): the next piece takes its place', () => {
    const r = removeFree(straight(1), 'p1');
    expect(buildFree(r.free).errors).toEqual([]);
    expect(pose(r.free, 'p2')).toEqual({ x: 50, y: 0, rot: 0 });
  });

  it('a root in the middle of a row: the start side stays, the end side closes up', () => {
    const f = freeOf([
      { id: 'm', kind: 'armless', length: 36, at: { x: 50, y: 0, rot: 0 } },
      { id: 'l', kind: 'oneArm', length: 50, arm: 'start', at: { to: 'm', face: 'start' } },
      { id: 'r', kind: 'oneArm', length: 50, arm: 'end', at: { to: 'm', face: 'end' } },
    ]);
    const r = removeFree(f, 'm');
    expect(buildFree(r.free).errors).toEqual([]);
    expect(pose(r.free, 'l')).toEqual({ x: 0, y: 0, rot: 0 });
    expect(pose(r.free, 'r')).toEqual({ x: 50, y: 0, rot: 0 });
    expect(buildFree(r.free).groups).toHaveLength(1);
  });

  it('a wedge: what was past it stays where it stands, as its own sofa', () => {
    const r = removeFree(freeL(), 'p1');
    const b = buildFree(r.free);
    expect(b.errors).toEqual([]);
    expect(b.groups).toHaveLength(2);
    expect(pose(r.free, 'p2')).toEqual(pose(freeL(), 'p2'));
  });

  it('move: the last seat to the front of the row', () => {
    const f = { ...straight(1), pieces: straight(1).pieces.map((p) => (p.id === 'p3' ? { ...p, kind: 'armless' as const, arm: undefined } : p)) };
    delete (f.pieces[2] as { arm?: string }).arm;
    const r = moveFree(f, 'p2', { to: 'p3', face: 'end' });
    expect(r.rejected).toBeNull();
    expect(pose(r.free, 'p3')).toEqual({ x: 50, y: 0, rot: 0 });
    expect(pose(r.free, 'p2')).toEqual({ x: 100, y: 0, rot: 0 });
  });
});

describe('grow a seat: the rest moves along', () => {
  it('a middle seat 36 → 48 pushes the end piece 12″', () => {
    const r = setFreeLength(straight(1), 'p2', 48);
    expect(r.rejected).toBeNull();
    expect(pose(r.free, 'p3')).toEqual({ x: 98, y: 0, rot: 0 });
  });

  it('refused (same reference) when it would hit another sofa', () => {
    const f = straight(1);
    const g = addFree(f, { kind: 'armless' }, { x: 140, y: 0, rot: 0 });
    expect(g.rejected).toBeNull();
    const r = setFreeLength(g.free, 'p2', 48);
    expect(r.free).toBe(g.free);
    expect(r.rejected?.message).toBe('That would overlap another piece');
  });

  it('sizes outside the rules are refused with the rule', () => {
    expect(setFreeLength(straight(1), 'p2', 12).rejected?.message).toBe('min 20″, max 108″');
    expect(setFreeLength(straight(1), 'p2', 36.25).rejected?.message).toBe('Sizes go in half inches');
  });
});

describe('Turn turns the whole sofa', () => {
  it('an L turns 90° about its centre: width and depth swap, still one sofa', () => {
    const f = freeL();
    const r = turnFree(f, 'p3');
    expect(r.rejected).toBeNull();
    const [x0, y0, x1, y1] = bounds(f);
    const [a0, b0, a1, b1] = bounds(r.free);
    expect([a1 - a0, b1 - b0]).toEqual([y1 - y0, x1 - x0]);
    expect(Math.abs((a0 + a1) / 2 - (x0 + x1) / 2)).toBeLessThanOrEqual(0.5);
    const four = [1, 2, 3].reduce((g) => turnFree(g, 'p3').free, r.free);
    expect(bounds(four)).toEqual(bounds(f));
  });
});

describe('shared fields re-lay every sofa', () => {
  it('D 44 → 36: the wedge follows (auto 52), the leg moves with it, no errors', () => {
    const r = setFreeShared(freeL(), { D: 36 });
    expect(r.rejected).toBeNull();
    expect(buildFree(r.free).wedge.C).toBe(52);
    expect(bounds(r.free)).toEqual([0, 0, 52 + 36 + 50, 52 + 72]);
  });

  it('arm width: seats keep their size, one-arm pieces grow', () => {
    const r = setFreeShared(straight(1), { A: 10 });
    expect(r.free.pieces.filter((p) => p.kind === 'oneArm').map((p) => p.length)).toEqual([46, 46]);
    expect(buildFree(r.free).seats).toEqual(buildFree(straight(1)).seats);
  });

  it('refusals keep the same reference', () => {
    const f = straight(1);
    expect(setFreeShared(f, { D: 60 }).free).toBe(f);
    expect(setFreeShared(f, { wedgeC: 20 }).free).toBe(f);
    expect(setFreeShared(f, { fabric: 'velvet' }).free).toBe(f);
  });
});

describe('arms and backs', () => {
  it('an arm only on a free end; off again keeps the footprint', () => {
    const f = straight(1);
    expect(setFreeArm(f, 'p2', 'end').rejected?.message).toBe('Something is attached at that end');
    const off = setFreeArm(f, 'p3', null);
    expect(off.rejected).toBeNull();
    expect(off.free.pieces[2]).toMatchObject({ kind: 'armless', length: 50 });
  });

  it('shared back on, then off: 88 → 78 → 88 deep', () => {
    const two = doubleSided(false);
    const one = setFreeSharedBack(two, 'p4', true);
    expect(bounds(one.free)[3] - bounds(one.free)[1]).toBe(78);
    expect(bounds(setFreeSharedBack(one.free, 'p4', false).free)[3] - bounds(two)[1]).toBe(88);
    expect(setFreeSharedBack(two, 'p2', true).rejected?.message).toMatch(/back-to-back/);
  });

  it('adding onto an arm or into another piece is refused, same reference', () => {
    const f = straight(1);
    expect(addFree(f, { kind: 'armless' }, { to: 'p1', face: 'start' }).free).toBe(f);
    expect(addFree(f, { kind: 'armless' }, { x: 10, y: 10, rot: 0 }).free).toBe(f);
  });
});
