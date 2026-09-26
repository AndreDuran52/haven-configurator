import { describe, expect, it } from 'vitest';
import { anchoredTargets, blankConfig, buildHaven, moveTable, snapTable, standardU, type Pt } from '@/engine';
import { canon, test3b } from '@/engine/testing';
import { gripPoints, hitTest, lineTolPx } from './hitTest';
import { nearestTarget, placementTargets } from './placementTargets';
import { reorderIndex } from './usePlanGestures';

const k = 0.25; // plan inches per px (4 px/in)

describe('hitTest (plan §8)', () => {
  const c = standardU();
  const b = buildHaven(c);
  const grips = gripPoints(b, k);

  it('grips only on seams with a seat side, 14 px outside the seat front', () => {
    expect(grips.map((g) => `${g.run}:${g.seam}`)).toEqual(['back:1']);
    const g = grips[0]!;
    expect(g.pt[1]).toBeCloseTo(b.D + 14 * k);
    expect(g.at).toBe(b.runs[0]!.origin[0] + 32);
  });

  it('a grip wins inside its 22 px radius; touch never grabs the seam line; mouse gets ±7 px', () => {
    const g = grips[0]!;
    expect(hitTest(b, grips, [g.pt[0] + 20 * k, g.pt[1]], { k, lineTolPx: 0 })).toMatchObject({ type: 'seam', run: 'back', seam: 1 });
    const onLine: Pt = [g.at + 5 * k, b.D / 2];
    expect(hitTest(b, grips, onLine, { k, lineTolPx: lineTolPx('touch') })).toMatchObject({ type: 'piece' });
    expect(hitTest(b, grips, onLine, { k, lineTolPx: lineTolPx('mouse') })).toMatchObject({ type: 'seam', seam: 1 });
  });

  it('pieces by polygon (tables before seats), gaps by rect, nothing outside', () => {
    const table = b.pieces.find((p) => p.kind === 'table')!;
    const tc: Pt = [table.bbox.x + table.bbox.w / 2, table.bbox.y + 5];
    expect(hitTest(b, grips, tc, { k, lineTolPx: 0 })).toEqual({ type: 'piece', id: table.id, kind: 'table' });
    expect(hitTest(b, grips, [b.W / 2, b.D + 60], { k, lineTolPx: 0 })).toBeNull();
    const blank = buildHaven(blankConfig('U'));
    const gap = blank.gaps[0]!;
    expect(hitTest(blank, gripPoints(blank, k), [gap.rect.x + gap.rect.w / 2, gap.rect.y + 3], { k, lineTolPx: 0 })).toMatchObject({ type: 'gap', run: gap.run });
  });

  it('wedges are pieces too (the slider sizes them)', () => {
    expect(hitTest(b, grips, [3, 3], { k, lineTolPx: 0 })).toMatchObject({ type: 'piece', kind: 'wedge' });
  });
});

describe('table snapping (tableSnap, §5.4)', () => {
  it('dropping on the 3b anchor gives 3b; hysteresis keeps the current target', () => {
    const c = standardU();
    const id = c.runs.back!.find((p) => p.kind === 'table')!.id;
    const targets = anchoredTargets(c, id);
    const split = targets.find((t) => t.placement.run === 'left' && t.placement.at === 'split')!;
    expect(canon(moveTable(c, id, split.placement).config)).toEqual(canon(test3b()));
    expect(snapTable(c, id, split.anchor).placement).toEqual(split.placement);
    const other = targets.find((t) => t !== split && t.placement.run === 'left')!;
    const mid: Pt = [(split.anchor[0] + other.anchor[0]) / 2, (split.anchor[1] + other.anchor[1]) / 2 + 0.1];
    expect(nearestTarget(targets, mid, split, 6)).toBe(split);
    expect(nearestTarget(targets, other.anchor, split, 6)).toBe(other);
    expect(nearestTarget(targets, [1e4, 1e4], null, 6, 60)).toBeNull();
  });
});

describe('tray placement targets', () => {
  it('armless: every seam and split where addPiece succeeds, each a different layout', () => {
    const t = placementTargets(standardU(), 'armless');
    expect(t.length).toBeGreaterThanOrEqual(2); // Standard U, lock on: one per leg (the back has no room)
    expect(new Set(t.map((x) => JSON.stringify(x.config.runs))).size).toBe(t.length);
  });

  it('one-arm L / R only at open ends, with the facing asked for', () => {
    const l = placementTargets(standardU(), 'oneArmL');
    const r = placementTargets(standardU(), 'oneArmR');
    for (const x of [...l, ...r]) expect(x.placement.run).not.toBe('back');
    expect(l.every((x) => x.placement.run !== r[0]?.placement.run || r.length === 0)).toBe(true);
  });
});

describe('reorder index', () => {
  it('counts the other piece centres before the pointer', () => {
    const c = standardU();
    const seat = c.runs.back![1]!;
    const b = buildHaven(c);
    const x0 = b.runs[0]!.origin[0];
    expect(reorderIndex(c, 'back', seat.id, [x0 + 5, 20])).toBe(0);
    expect(reorderIndex(c, 'back', seat.id, [x0 + 60, 20])).toBe(1);
  });
});
