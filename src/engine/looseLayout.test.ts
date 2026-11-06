// QA fixes on the T (2026-11-06): loose pieces from either half live in the
// root and start in that half's bay; a new loose piece never lands on another;
// the stem refusal reads in the stem's own words.
import { describe, expect, it } from 'vitest';
import { standardU } from './defaults';
import { layoutErrors, offsets } from './layoutBuild';
import { addLooseInLayout, solo } from './layoutOps';
import { addLoose } from './looseOps';
import { setTeeStem, teeLayout } from './tee';
import type { LoosePiece } from './types';

const overlap = (a: LoosePiece, b: LoosePiece) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

describe('loose pieces in a layout', () => {
  it('one sofa: exactly addLoose on its config (the Standard U default is unchanged)', () => {
    const c = standardU();
    for (const kind of ['coffeeTable', 'ottoman'] as const) {
      const l = addLooseInLayout(solo(c), 'a', kind).layout;
      expect(l.sections[0]!.config.loose).toEqual(addLoose(c, kind).config.loose);
    }
  });

  for (const sharedBack of [true, false]) {
    it(`a T (${sharedBack ? 'shared back' : 'two backs'}): added from the right half, it lives in the root inside the right bay`, () => {
      const t = teeLayout({ total: 229, stem: 110, sharedBack });
      const r = addLooseInLayout(t, 'b', 'coffeeTable');
      expect(r.rejected).toBeNull();
      expect(r.layout.sections[1]!.config.loose).toHaveLength(0);
      const [p] = r.layout.sections[0]!.config.loose;
      const b = t.sections[1]!.config;
      const [ox] = offsets(t).get('b')!;
      expect(p!.x).toBeGreaterThanOrEqual(ox + b.D);
      expect(p!.x + p!.w).toBeLessThanOrEqual(ox + b.W);
      expect(p!.y).toBeGreaterThanOrEqual(b.D);
      expect(layoutErrors(r.layout)).toEqual([]);
      // From the left half it goes to the left bay.
      const left = addLooseInLayout(t, 'a', 'coffeeTable').layout.sections[0]!.config.loose[0]!;
      expect(left.x + left.w).toBeLessThanOrEqual(t.sections[0]!.config.W - t.sections[0]!.config.D);
    });
  }

  it('an ottoman added after a coffee table does not land on it (U and T)', () => {
    for (const [l, id] of [[solo(standardU()), 'a'], [teeLayout({ total: 229, stem: 110 }), 'a'], [teeLayout({ total: 229, stem: 110 }), 'b']] as const) {
      const one = addLooseInLayout(l, id, 'coffeeTable').layout;
      const two = addLooseInLayout(one, id, 'ottoman').layout;
      const [table, ottoman] = two.sections[0]!.config.loose;
      expect(overlap(table!, table!)).toBe(true); // the check itself works
      expect(overlap(table!, ottoman!)).toBe(false);
    }
  });
});

describe('a full bay', () => {
  it('a T: when the right bay has no room left, the ottoman goes to the left bay, never outside', () => {
    const t = teeLayout({ total: 229, stem: 110 });
    const one = addLooseInLayout(t, 'b', 'coffeeTable').layout;
    const [, ottoman] = addLooseInLayout(one, 'b', 'ottoman').layout.sections[0]!.config.loose;
    const a = t.sections[0]!.config;
    expect(ottoman!.x + ottoman!.w).toBeLessThanOrEqual(a.W - a.D);
    expect(ottoman!.y + ottoman!.d).toBeLessThanOrEqual(a.R);
  });
});

describe('the T stem refusal', () => {
  it('names the minimum, not the leg letter', () => {
    const r = setTeeStem(teeLayout({ total: 229, stem: 110 }), 60);
    expect(r.rejected?.message).toMatch(/^min \d+(\.5)?″$/);
  });
});
