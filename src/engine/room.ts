// H6c room floor ops (Andre, 2026-11-07). Pure: (layout, …) => LayoutResult,
// the same layout reference when refused or unchanged. The room is stored on
// the layout as its size and placement mode (roomFit.ts derives the rest).
import { buildLayout } from './layoutBuild';
import { editSection, isSolo, type LayoutResult } from './layoutOps';
import type { Layout, Room, RoomAt } from './layoutTypes';
import { setMeasurements } from './ops';
import { ROOM_MAX, ROOM_MIN } from './roomFit';
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

/** Type the gap from the sofa to the left or back wall; the room stays there (Free) until Center or Back wall. */
export function setRoomGap(l: Layout, wall: 'left' | 'back', inches: number): LayoutResult {
  if (!l.room) return refused(l, 'Add the room first');
  const g = half(inches);
  if (!Number.isFinite(g) || g < 0) return refused(l, 'A gap is 0″ or more', 'infeasible');
  const fit = buildLayout(l).room!;
  const at: RoomAt = { mode: 'free', x: wall === 'left' ? fit.sofa.x - g : fit.rect.x, y: wall === 'back' ? fit.sofa.y - g : fit.rect.y };
  const room: Room = { ...l.room, at };
  return same(l.room, room) ? { layout: l, rejected: null } : withRoom(l, room);
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
