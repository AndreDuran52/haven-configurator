// The result line's words (UX Phase 3, Andre 2026-11-08).
import { describe, expect, it } from 'vitest';
import { addPiece, editSection, nudgeRoom, setSnug, placeRoom, resizePiece, setArmWidth, setLock, setMeasurements, setRoom, solo, standardStraight, standardU, teeLayout, type Layout } from '@/engine';
import { describeChange } from './changes';

const u = () => solo(standardU());
const edit = (l: Layout, op: Parameters<typeof editSection>[2]) => editSection(l, 'a', op).layout;

describe('describeChange', () => {
  it('measurements and the seat count', () => {
    // One seat number (2026-11-09): 7 comfortable before and after, so no seats item.
    expect(describeChange(u(), edit(u(), (c) => setMeasurements(c, { W: 200 })))).toBe('Width 188″ → 200″ · Seat 36″ → 48″');
    expect(describeChange(u(), setSnug(u(), true).layout)).toBe('Seats 7 → 7 · snug');
    expect(describeChange(u(), edit(u(), (c) => setMeasurements(c, { W: 300 })))).toMatch(/Seats 7 → 11$/);
    expect(describeChange(u(), edit(u(), (c) => setMeasurements(c, { D: 40 })))).toMatch(/^Depth 44″ → 40″/);
  });

  it('a table dropped between two seats: one line for the pair, then the table (2026-11-09)', () => {
    const a = solo(standardStraight()); // 14+46 | 46+14
    const b = edit(a, (c) => addPiece(c, 'table', { run: 'back', at: 'seam', seam: 1 }));
    expect(describeChange(a, b)).toBe('Seats 46″ | 46″ → 30″ | 30″ · Added table 32″ · Seats 3 → 2');
  });

  it('a table that stepped down says why', () => {
    const a = solo(standardU({ W: 170, L: 140, R: 140, wedgeC: 55, dims: { A: 12 } })); // a leg of one 73″ seat: split at 24″
    const b = edit(a, (c) => addPiece(c, 'table', { run: 'left', at: 'split', pieceId: c.runs.left![0]!.id }));
    expect(describeChange(a, b)).toMatch(/Added table 24″ \(32″ would leave a seat under 23″\)/);
  });

  it('resizing a table between two seats: one line for the pair', () => {
    const a = edit(u(), (c) => addPiece(c, 'table', { run: 'left', at: 'split', pieceId: c.runs.left![0]!.id }, { length: 20 }));
    const t = a.sections[0]!.config.runs.left!.find((p) => p.kind === 'table')!.id;
    const b = edit(a, (c) => resizePiece(c, t, 24));
    expect(describeChange(a, b)).toBe('Seats 19″ | 19″ → 17″ | 17″ · Table 20″ → 24″');
  });

  it('arms, the lock and the room', () => {
    expect(describeChange(u(), edit(u(), (c) => setArmWidth(c, 10)))).toMatch(/^Arms 14″ → 10″/);
    expect(describeChange(u(), edit(u(), (c) => setLock(c, false)))).toBe('Sofa size changes');
    const r = setRoom(u(), { w: 240, d: 200 }).layout;
    expect(describeChange(u(), r)).toBe('Room 240″ x 200″');
    expect(describeChange(r, placeRoom(r, 'backWall').layout)).toBe('Sofa on the back wall');
    // Phase 3b: the move pad (a held arrow is one step: before to after).
    const free = nudgeRoom(r, 'right').layout;
    expect(describeChange(r, free)).toBe('Sofa placed in the room');
    const more = nudgeRoom(nudgeRoom(nudgeRoom(free, 'right').layout, 'right').layout, 'back').layout;
    expect(describeChange(free, more)).toBe('Sofa moved 2″ right · Sofa moved 1″ toward the back');
  });

  it('nothing visible changed, or a new sofa: no line', () => {
    const a = u();
    expect(describeChange(a, a)).toBeNull();
    expect(describeChange(a, teeLayout({ total: 229, stem: 110 }))).toBeNull();
  });

  it('long lists are cut at four', () => {
    const a = u();
    const b = edit(a, (c) => setMeasurements(c, { W: 200, L: 140, R: 140, D: 40 }));
    expect(describeChange(a, b)).toMatch(/ · \+\d+ more$/);
  });
});
