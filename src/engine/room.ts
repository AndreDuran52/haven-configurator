// H6c room floor ops (Andre, 2026-11-07). Pure: (layout, …) => LayoutResult,
// the same layout reference when refused or unchanged. The room is stored on
// the layout as its size and placement mode (roomFit.ts derives the rest).
import { buildLayout } from './layoutBuild';
import { editSection, isSolo, type LayoutResult } from './layoutOps';
import type { Layout, Room, RoomAt } from './layoutTypes';
import { setMeasurements } from './ops';
import { gapsOf, ROOM_MAX, ROOM_MIN, type Wall } from './roomFit';
import type { Rejection } from './types';

const half = (x: number): number => Math.round(x * 2) / 2 + 0;
const refused = (layout: Layout, message: string, code: Rejection['code'] = 'notAllowed'): LayoutResult => ({ layout, rejected: { code, message } });
const withRoom = (l: Layout, room: Room): LayoutResult => ({ layout: { ...l, room }, rejected: null });
const same = (a: Room, b: Room) => JSON.stringify(a) === JSON.stringify(b);

/** Set the room's size (either or both). The first room is centred on the sofa. A Free room keeps its back-left corner. */
export function setRoom(l: Layout, size: { w?: number; d?: number }): LayoutResult {
  const cur = l.room;
  const w = half(size.w ?? cur?.w ?? NaN);
  const d = half(size.d ?? cur?.d ?? NaN);
  if (!Number.isFinite(w) || !Number.isFinite(d)) return refused(l, 'Type the room width and depth');
  if (w < ROOM_MIN || d < ROOM_MIN || w > ROOM_MAX || d > ROOM_MAX) return refused(l, `Rooms go from ${ROOM_MIN}″ to ${ROOM_MAX}″`, 'infeasible');
  const room: Room = { w, d, at: cur?.at ?? { mode: 'center' } };
  return cur && same(cur, room) ? { layout: l, rejected: null } : withRoom(l, room);
}

/** Center: the sofa in the middle of the room. Back wall: its back on the back wall, centred across. */
export function placeRoom(l: Layout, mode: 'center' | 'backWall'): LayoutResult {
  if (!l.room) return refused(l, 'Add the room first');
  if (l.room.at.mode === mode) return { layout: l, rejected: null };
  return withRoom(l, { ...l.room, at: { mode } });
}

/**
 * Type the distance from the sofa to one wall (Phase 3b: any of the four); the
 * opposite one follows, and the room stays there (Free, "Custom") until
 * Center or Back wall.
 */
export function setRoomGap(l: Layout, wall: Wall, inches: number): LayoutResult {
  if (!l.room) return refused(l, 'Add the room first');
  const g = half(inches);
  if (!Number.isFinite(g) || g < 0) return refused(l, 'A distance is 0″ or more', 'infeasible');
  const { sofa, rect } = buildLayout(l).room!;
  const x = wall === 'left' ? sofa.x - g : wall === 'right' ? sofa.x + sofa.w + g - rect.w : rect.x;
  const y = wall === 'back' ? sofa.y - g : wall === 'front' ? sofa.y + sofa.h + g - rect.h : rect.y;
  const room: Room = { ...l.room, at: { mode: 'free', x, y } };
  return same(l.room, room) ? { layout: l, rejected: null } : withRoom(l, room);
}

/** The move pad (Phase 3b): which way the sofa moves in the room. */
export type Nudge = 'left' | 'right' | 'back' | 'front';
const NUDGE: Record<Nudge, [number, number]> = { left: [-1, 0], right: [1, 0], back: [0, -1], front: [0, 1] };

/**
 * Move the sofa in the room by `inches` (1″ per tap of the move pad): the room
 * moves the other way and stays there (Free). The sofa stops at a wall: a move
 * toward a wall it already touches (or is past) is refused.
 */
export function nudgeRoom(l: Layout, dir: Nudge, inches = 1): LayoutResult {
  if (!l.room) return refused(l, 'Add the room first');
  const { sofa, rect } = buildLayout(l).room!;
  const gap = gapsOf(sofa, rect)[dir];
  const step = Math.min(inches, gap);
  if (!(step > 0)) return refused(l, `The sofa is against the ${dir} wall`);
  const [dx, dy] = NUDGE[dir];
  const at: RoomAt = { mode: 'free', x: half(rect.x - dx * step), y: half(rect.y - dy * step) };
  return withRoom(l, { ...l.room, at });
}

export function clearRoom(l: Layout): LayoutResult {
  if (!l.room) return { layout: l, rejected: null };
  const { room: _gone, ...rest } = l;
  return { layout: rest, rejected: null };
}

/**
 * Fill the width: the sofa's W becomes the room's width less the left gap on
 * both sides (wall to wall when the sofa touches the left wall or is past it).
 * The seats settle as for a typed W. One sofa only.
 */
export function fillRoomWidth(l: Layout): LayoutResult {
  if (!l.room) return refused(l, 'Add the room first');
  if (!isSolo(l)) return refused(l, 'Fill the width works on one sofa');
  const fit = buildLayout(l).room!;
  const g = Math.max(0, fit.gaps.left);
  const W = half(l.room.w - 2 * g);
  if (W === l.sections[0]!.config.W) return { layout: l, rejected: null };
  return editSection(l, l.sections[0]!.id, (c) => setMeasurements(c, { W }));
}
