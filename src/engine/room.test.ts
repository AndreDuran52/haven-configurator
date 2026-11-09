// H6c room floor (Andre, 2026-11-07): a rectangle; Center (default) or Back
// wall, or placed by typed gaps; Fill the width; "doesn't fit" and "walkway
// under 30″" warnings; link v5, written only when a room is set.
import { describe, expect, it } from 'vitest';
import { checksum, decode } from './codec';
import { decodeLayout, encodeLayout } from './codecLayout';
import { standardStraight, standardU } from './defaults';
import { buildLayout } from './layoutBuild';
import { editSection, solo } from './layoutOps';
import type { Layout } from './layoutTypes';
import { addLoose } from './looseOps';
import { setMeasurements } from './ops';
import { clearRoom, fillRoomWidth, nudgeRoom, placeRoom, setRoom, setRoomGap } from './room';
import { teeLayout } from './tee';
import { canon, deepFreeze } from './testing';

/** Golden v5 links: kept forever. */
const GOLDEN_V5: Record<string, string> = {
  uCenter: '5UW188L132R132D44_bt32s36_la72_ra72_Mw240d200.zy',
  straightBackWall: '5iW120L44R44D44_ba60Sa60E_Mw200d150B.2x',
  uFree: '5UW188L132R132D44_bt32s36_la72_ra72_Mw240d200x-10y-34.q9',
  teeCenter: '5rW119.5L110R110D44_ba59.5_ra50_PglW119.5L110R110H_ba59.5_la50_Mw300d200.s6',
};

const room = (l: Layout) => buildLayout(l).room!;
const codes = (l: Layout) => buildLayout(l).warnings.map((w) => w.code);
const uRoom = () => setRoom(solo(standardU()), { w: 240, d: 200 }).layout; // the U is 188 × 132

describe('placing the room', () => {
  it('the first room is centred on the sofa: 26″ each side, 34″ back and front', () => {
    const l = deepFreeze(uRoom());
    expect(l.room).toEqual({ w: 240, d: 200, at: { mode: 'center' } });
    expect(room(l).rect).toEqual({ x: -26, y: -34, w: 240, h: 200 });
    expect(room(l).gaps).toEqual({ left: 26, right: 26, back: 34, front: 34 });
  });

  it('Back wall: the back on the wall, centred across; Center goes back', () => {
    const b = placeRoom(uRoom(), 'backWall').layout;
    expect(room(b).gaps).toEqual({ left: 26, right: 26, back: 0, front: 68 });
    expect(room(placeRoom(b, 'center').layout).gaps.back).toBe(34);
  });

  it('Center and Back wall follow the sofa as it changes; a typed gap stays put', () => {
    const b = placeRoom(uRoom(), 'backWall').layout;
    const wider = editSection(b, 'a', (c) => setMeasurements(c, { W: 200 })).layout;
    expect(room(wider).gaps).toMatchObject({ left: 20, right: 20, back: 0 });
    const typed = setRoomGap(b, 'left', 10).layout;
    expect(typed.room!.at).toEqual({ mode: 'free', x: -10, y: 0 });
    const typedWider = editSection(typed, 'a', (c) => setMeasurements(c, { W: 200 })).layout;
    expect(room(typedWider).gaps).toMatchObject({ left: 10, right: 30 });
    expect(room(setRoomGap(typed, 'back', 12).layout).gaps).toMatchObject({ left: 10, back: 12 });
  });

  it('Phase 3b: a typed right or front distance moves the room; the opposite one follows', () => {
    const l = uRoom(); // 26 | 26 across, 34 | 34 back to front
    expect(room(setRoomGap(l, 'right', 10).layout).gaps).toEqual({ left: 42, right: 10, back: 34, front: 34 });
    expect(room(setRoomGap(l, 'front', 0).layout).gaps).toEqual({ left: 26, right: 26, back: 68, front: 0 });
    expect(setRoomGap(l, 'right', 10).layout.room!.at.mode).toBe('free');
  });

  it('Phase 3b move pad: 1″ per step, the room stays put after, and the sofa stops at a wall', () => {
    const l = deepFreeze(uRoom());
    const r = nudgeRoom(l, 'right').layout;
    expect(room(r).gaps).toEqual({ left: 27, right: 25, back: 34, front: 34 });
    expect(r.room!.at.mode).toBe('free');
    expect(room(nudgeRoom(nudgeRoom(l, 'back').layout, 'back').layout).gaps).toMatchObject({ back: 32, front: 36 });
    expect(room(nudgeRoom(l, 'front').layout).gaps).toMatchObject({ back: 35, front: 33 });
    expect(room(nudgeRoom(l, 'left').layout).gaps).toMatchObject({ left: 25, right: 27 });
    // Against the back wall: no further back, and a big step stops at the wall.
    const wall = placeRoom(l, 'backWall').layout;
    const stuck = nudgeRoom(wall, 'back');
    expect(stuck.layout).toBe(wall);
    expect(stuck.rejected?.message).toBe('The sofa is against the back wall');
    expect(room(nudgeRoom(l, 'left', 40).layout).gaps).toMatchObject({ left: 0, right: 52 });
    expect(nudgeRoom(solo(standardU()), 'left').rejected?.message).toBe('Add the room first');
  });

  it('resizing keeps the mode; a room on a T is centred on both halves', () => {
    const l = setRoom(placeRoom(uRoom(), 'backWall').layout, { w: 260 }).layout;
    expect(l.room).toEqual({ w: 260, d: 200, at: { mode: 'backWall' } });
    const t = setRoom(teeLayout({ total: 229, stem: 110 }), { w: 300, d: 200 }).layout;
    expect(room(t).gaps).toEqual({ left: 35.5, right: 35.5, back: 45, front: 45 });
  });

  it('refusals and no-ops keep the same reference; clearing leaves no room key', () => {
    const l = deepFreeze(uRoom());
    expect(setRoom(l, { w: 12 }).layout).toBe(l);
    expect(setRoom(l, { w: 2000 }).rejected?.message).toBe('Rooms go from 24″ to 1200″');
    expect(setRoom(l, { w: 240 }).layout).toBe(l);
    expect(setRoomGap(l, 'left', -1).layout).toBe(l);
    expect(placeRoom(l, 'center').layout).toBe(l);
    const none = solo(standardU());
    expect(placeRoom(none, 'backWall').rejected?.message).toBe('Add the room first');
    const cleared = clearRoom(l).layout;
    expect('room' in cleared).toBe(false);
    expect(clearRoom(none).layout).toBe(none);
  });

  it('a section edit keeps the room', () => {
    const l = editSection(uRoom(), 'a', (c) => setMeasurements(c, { D: 40 })).layout;
    expect(l.room).toEqual(uRoom().room);
  });
});

describe('warnings', () => {
  it('walkways under 30″ at the sides and front warn; the back never does; 30″ is fine', () => {
    expect(buildLayout(uRoom()).warnings.filter((w) => w.code === 'walkwayUnder30').map((w) => w.message)).toEqual([
      'Walkway 26″ between the sofa and the left wall (under 30)',
      'Walkway 26″ between the sofa and the right wall (under 30)',
    ]);
    expect(codes(setRoom(uRoom(), { w: 248 }).layout)).not.toContain('walkwayUnder30');
    const tight = setRoomGap(setRoom(uRoom(), { w: 248 }).layout, 'back', 5).layout;
    expect(codes(tight)).not.toContain('walkwayUnder30');
  });

  it('a sofa touching a wall is meant: no walkway warning at 0″', () => {
    const l = setRoomGap(setRoom(solo(standardStraight()), { w: 200, d: 150 }).layout, 'left', 0).layout;
    expect(room(l).gaps.left).toBe(0);
    expect(buildLayout(l).warnings.map((w) => w.message).some((m) => m.includes('left wall'))).toBe(false);
  });

  it('past a wall: the worst overshoot is named', () => {
    const l = setRoom(uRoom(), { w: 180 }).layout;
    expect(buildLayout(l).warnings.find((w) => w.code === 'roomTooSmall')?.message).toBe('The sofa is 4″ past the left wall');
    const c = addLoose(standardStraight(), 'coffeeTable');
    const withTable = setRoom(solo(c.config), { w: 200, d: 90 }).layout;
    expect(buildLayout(withTable).warnings.find((w) => w.code === 'roomTooSmall')?.message).toMatch(/^The coffee table is \d+(\.5)?″ past the front wall$/);
  });
});

describe('Fill the width', () => {
  it('a straight sofa 10″ from the left wall grows to 10″ from each wall', () => {
    const l = setRoomGap(setRoom(solo(standardStraight()), { w: 200, d: 150 }).layout, 'left', 10).layout;
    const f = fillRoomWidth(l);
    expect(f.rejected).toBeNull();
    expect(f.layout.sections[0]!.config.W).toBe(180);
    expect(room(f.layout).gaps).toMatchObject({ left: 10, right: 10 });
  });

  it('a centred U fills to its current side gaps; past the walls it goes wall to wall', () => {
    const l = setRoom(uRoom(), { w: 180 }).layout;
    const f = fillRoomWidth(l).layout;
    expect(f.sections[0]!.config.W).toBe(180);
    expect(room(f).gaps).toMatchObject({ left: 0, right: 0 });
    const same = fillRoomWidth(f);
    expect(same.layout).toBe(f);
  });

  it('a T is refused, same reference', () => {
    const t = setRoom(teeLayout({ total: 229, stem: 110 }), { w: 300, d: 200 }).layout;
    const r = fillRoomWidth(t);
    expect(r.layout).toBe(t);
    expect(r.rejected?.message).toBe('Fill the width works on one sofa');
  });
});

describe('link v5', () => {
  it('the goldens decode and re-encode byte for byte', () => {
    const made: Record<string, Layout> = {
      uCenter: uRoom(),
      straightBackWall: placeRoom(setRoom(solo(standardStraight()), { w: 200, d: 150 }).layout, 'backWall').layout,
      uFree: setRoomGap(uRoom(), 'left', 10).layout,
      teeCenter: setRoom(teeLayout({ total: 229, stem: 110 }), { w: 300, d: 200 }).layout,
    };
    for (const [name, l] of Object.entries(made)) {
      expect(encodeLayout(l), name).toBe(GOLDEN_V5[name]);
      const d = decodeLayout(GOLDEN_V5[name]!);
      expect('layout' in d, name).toBe(true);
      if ('layout' in d) {
        expect(d.layout.room, name).toEqual(l.room);
        expect(d.layout.sections.map((s) => canon(s.config)), name).toEqual(l.sections.map((s) => canon(s.config)));
      }
    }
  });

  it('no room: the link is exactly as before (v1)', () => {
    expect(encodeLayout(clearRoom(uRoom()).layout)).toBe('1UW188L132R132D44_bt32s36_la72_ra72.wh');
  });

  it('a room token in an older version or out of range is damaged; the one-sofa decoder calls it newer', () => {
    const body = GOLDEN_V5.uCenter!.slice(1, -3);
    expect(decodeLayout(`4${body}.${checksum(`4${body}`)}`)).toEqual({ error: 'damaged' });
    const bad = body.replace('w240', 'w10');
    expect(decodeLayout(`5${bad}.${checksum(`5${bad}`)}`)).toEqual({ error: 'damaged' });
    expect(decode(GOLDEN_V5.uCenter!)).toEqual({ error: 'newer' });
    expect(decodeLayout(`6${GOLDEN_V5.uCenter!.slice(1)}`)).toEqual({ error: 'newer' });
  });
});
