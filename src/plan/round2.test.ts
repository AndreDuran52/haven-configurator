// Phase 3c round 2 (Andre, 2026-11-09): with a room, the sofa's dimensions
// stay outside the walls and no line crosses the floor (Q74); the U's inside
// width and depth (Q75).
import { describe, expect, it } from 'vitest';
import { buildLayout, buildHaven, setRoom, solo, standardU } from '@/engine';
import { fitSource } from './dimLayout';
import { soloSource } from './dims';
import { withInsideDims } from './insideDims';
import { withRoom } from './roomDims';

const inside = (r: { x: number; y: number; w: number; h: number }, [x, y]: [number, number]) => x > r.x + 1e-6 && x < r.x + r.w - 1e-6 && y > r.y + 1e-6 && y < r.y + r.h - 1e-6;

describe('a room: no dimension line across the floor (Q74)', () => {
  it("Andre's 266 × 276 room round the Standard U: every line and label of the sofa's dimensions is outside the room", () => {
    const lb = buildLayout(setRoom(solo(standardU()), { w: 266, d: 276 }).layout);
    const room = lb.room!.rect;
    const { layout } = fitSource(withRoom(soloSource(lb.sections[0]!.built), lb.room), 860, 700);
    for (const l of layout.lines) {
      expect(inside(room, l.a) || inside(room, l.b), `${l.kind} ${l.a} → ${l.b}`).toBe(false);
    }
    for (const t of layout.texts) expect(inside(room, [t.x, t.y]), t.text).toBe(false);
    // The numbers are all still there.
    expect(layout.texts.map((t) => t.text)).toEqual(expect.arrayContaining(['60"', '32"', '36"', '44"D', `188" (15'-8")`, `132" (11'-0")`]));
  });

  it('without a room the extension lines still start at the sofa', () => {
    const b = buildHaven(standardU());
    const { layout } = fitSource(soloSource(b), 860, 700);
    const ext = layout.lines.filter((l) => l.kind === 'ext');
    expect(ext.some((l) => Math.abs(l.a[1] - 0) < 2 && l.a[1] < 0)).toBe(true); // just above the back edge
  });
});

describe('inside the U (Q75)', () => {
  const added = (b: ReturnType<typeof buildHaven>) => {
    const { layout } = fitSource(soloSource(b), 860, 700);
    const all = withInsideDims(b, layout);
    return { texts: all.texts.slice(layout.texts.length).map((t) => t.text), lines: all.lines.slice(layout.lines.length) };
  };

  it('the Standard U: 100″ between the sides, 88″ back to front; Andre’s 173″ sides: 129″; the shorter side counts', () => {
    expect(added(buildHaven(standardU())).texts).toEqual(['100"', '88"']);
    expect(added(buildHaven(standardU({ L: 173, R: 173 }))).texts).toEqual(['100"', '129"']);
    expect(added(buildHaven(standardU({ L: 173, R: 150 }))).texts).toEqual(['100"', '106"']);
  });

  it('the lines run from seat front to seat front and from the back seat to the end of the shorter side', () => {
    const [w, d] = added(buildHaven(standardU())).lines;
    expect([w!.a[0], w!.b[0]]).toEqual([44, 144]);
    expect([d!.a[1], d!.b[1]]).toEqual([44, 132]);
  });

  it('only a U', () => {
    const b = buildHaven(standardU());
    const { layout } = fitSource(soloSource(b), 860, 700);
    expect(withInsideDims({ ...b, shape: 'L-left', opening: null }, layout)).toBe(layout);
  });
});
