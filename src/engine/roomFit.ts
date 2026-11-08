// H6c room floor (Andre, 2026-11-07): where the room sits around the sofa and
// how the sofa fits in it. Pure geometry, derived on every build: the room's
// size and placement mode are stored, its position never is (Center and Back
// wall follow the sofa as it changes).
import type { Room } from './layoutTypes';
import type { BuiltPiece, LooseKind, Pt, Rect, Warning } from './types';

/** A room is at least this big each way. */
export const ROOM_MIN = 24;
/** ... and at most this big (100 ft). */
export const ROOM_MAX = 1200;
/** A walkway between the sofa (or a coffee table) and a wall narrower than this warns. */
export const WALKWAY_MIN = 30;

export type Wall = 'left' | 'right' | 'back' | 'front';
export type Gaps = Record<Wall, number>;

export interface RoomFit {
  /** The room's rectangle in world plan inches. */
  rect: Rect;
  /** The sofa's box (every section, no loose pieces). */
  sofa: Rect;
  /** Sofa to each wall (negative = past the wall). */
  gaps: Gaps;
  /** Each loose piece to each wall. */
  loose: { id: string; kind: LooseKind; gaps: Gaps }[];
  warnings: Warning[];
}

const half = (x: number): number => Math.round(x * 2) / 2 + 0;
const fmt = (n: number): string => String(Math.round(n * 10) / 10);

const LOOSE = new Set(['ottoman', 'coffeeTable']);

/** The sofa's box in world inches: every placed section's pieces, loose pieces left out. */
export function sofaRect(sections: { built: { pieces: BuiltPiece[] }; offset: Pt }[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of sections) {
    for (const p of s.built.pieces) {
      if (LOOSE.has(p.kind)) continue;
      x0 = Math.min(x0, p.bbox.x + s.offset[0]);
      y0 = Math.min(y0, p.bbox.y + s.offset[1]);
      x1 = Math.max(x1, p.bbox.x + p.bbox.w + s.offset[0]);
      y1 = Math.max(y1, p.bbox.y + p.bbox.h + s.offset[1]);
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}

/** The room's rectangle: centred on the sofa, back on the back wall (centred across), or where it was typed. */
export function roomRect(room: Room, sofa: Rect): Rect {
  const cx = half(sofa.x + (sofa.w - room.w) / 2);
  if (room.at.mode === 'free') return { x: room.at.x, y: room.at.y, w: room.w, h: room.d };
  const y = room.at.mode === 'backWall' ? sofa.y : half(sofa.y + (sofa.h - room.d) / 2);
  return { x: cx, y, w: room.w, h: room.d };
}

export function gapsOf(r: Rect, room: Rect): Gaps {
  return { left: r.x - room.x, right: room.x + room.w - (r.x + r.w), back: r.y - room.y, front: room.y + room.h - (r.y + r.h) };
}

const WALL_NAME: Record<Wall, string> = { left: 'left wall', right: 'right wall', back: 'back wall', front: 'front wall' };

/** Gaps, and the room warnings: past a wall, and walkways under 30″ (never behind the sofa; a sofa touching a wall is meant). */
export function roomFit(room: Room, sofa: Rect, loose: { id: string; kind: LooseKind; rect: Rect }[]): RoomFit {
  const rect = roomRect(room, sofa);
  const gaps = gapsOf(sofa, rect);
  const looseGaps = loose.map((l) => ({ id: l.id, kind: l.kind, gaps: gapsOf(l.rect, rect) }));
  const warnings: Warning[] = [];
  // The worst overshoot of anything past a wall.
  let worst: { by: number; wall: Wall; what: string } | null = null;
  const past = (g: Gaps, what: string) => {
    for (const w of Object.keys(g) as Wall[]) if (g[w] < 0 && (!worst || -g[w] > worst.by)) worst = { by: -g[w], wall: w, what };
  };
  past(gaps, 'The sofa');
  for (const l of looseGaps) past(l.gaps, l.kind === 'ottoman' ? 'The ottoman' : 'The coffee table');
  const w = worst as { by: number; wall: Wall; what: string } | null;
  if (w) warnings.push({ code: 'roomTooSmall', message: `${w.what} is ${fmt(w.by)}″ past the ${WALL_NAME[w.wall]}` });
  const walk = (g: Gaps, what: string, pieceId?: string) => {
    for (const wall of ['left', 'right', 'front'] as const) {
      if (g[wall] > 0 && g[wall] < WALKWAY_MIN) {
        warnings.push({ code: 'walkwayUnder30', message: `Walkway ${fmt(g[wall])}″ between the ${what} and the ${WALL_NAME[wall]} (under ${WALKWAY_MIN})`, ...(pieceId ? { pieceId } : {}) });
      }
    }
  };
  walk(gaps, 'sofa');
  for (const l of looseGaps) if (l.kind === 'coffeeTable') walk(l.gaps, 'coffee table', l.id);
  return { rect, sofa, gaps, loose: looseGaps, warnings };
}
