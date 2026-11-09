// Where the numbered seat markers go (Andre, 2026-11-09): one circle per seat
// the count gives, so the markers and the "Seats N" label always agree. Each
// straight stretch of cushion (broken by a table, a gap, an arm or a corner,
// exactly as seatStretches) gets floor(length / width) markers spread evenly
// along it, across the middle of the seat; each corner wedge is one seat, at
// the middle of its seat area (the wedge less its back frames). The order runs
// round the sofa from its left end to its right end: the left leg from its open
// end, the left corner, the back left to right, the right corner, the right leg
// to its open end. Pure; plan inches.
import type { BuildResult, BuiltPiece, Pt, Rect } from './types';

export interface SeatCountMode {
  snug: boolean;
  seatWidth: number;
  snugWidth: number;
}

const inRect = (r: Rect, [x, y]: Pt) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function inPolygon(poly: Pt[], [x, y]: Pt): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The middle of a wedge's seat: the average of 1″ samples inside its outline and outside its back frames. */
function wedgeSeat(w: BuiltPiece): Pt {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let x = w.bbox.x + 0.5; x < w.bbox.x + w.bbox.w; x++) {
    for (let y = w.bbox.y + 0.5; y < w.bbox.y + w.bbox.h; y++) {
      const p: Pt = [x, y];
      if (!inPolygon(w.polygon, p) || w.backs.some((b) => inRect(b, p))) continue;
      sx += x;
      sy += y;
      n++;
    }
  }
  return n ? [sx / n, sy / n] : [w.bbox.x + w.bbox.w / 2, w.bbox.y + w.bbox.h / 2];
}

/** One run's markers, in increasing x (back) or y (legs). */
function runMarkers(b: BuildResult, runId: string, width: number): Pt[] {
  const run = b.runs.find((r) => r.id === runId);
  if (!run) return [];
  const byId = new Map(b.pieces.map((p) => [p.id, p]));
  const out: Pt[] = [];
  let stretch: BuiltPiece[] = [];
  const flush = () => {
    const len = stretch.reduce((s, p) => s + (p.cushion ?? 0), 0);
    const rects = stretch.map((p) => p.cushionRect).filter((r): r is Rect => !!r);
    stretch = [];
    const n = Math.floor(len / width);
    if (!n || !rects.length) return;
    const x = run.axis === 'x';
    const a0 = Math.min(...rects.map((r) => (x ? r.x : r.y)));
    const a1 = Math.max(...rects.map((r) => (x ? r.x + r.w : r.y + r.h)));
    const across = x ? rects[0]!.y + rects[0]!.h / 2 : rects[0]!.x + rects[0]!.w / 2;
    for (let k = 0; k < n; k++) {
      const along = a0 + ((k + 0.5) * (a1 - a0)) / n;
      out.push(x ? [along, across] : [across, along]);
    }
  };
  for (const id of run.pieceIds) {
    const p = byId.get(id);
    if (!p || (p.kind !== 'armless' && p.kind !== 'oneArm')) {
      flush();
      continue;
    }
    if (p.kind === 'oneArm' && p.arm?.at === 'start') flush();
    stretch.push(p);
    if (p.kind === 'oneArm' && p.arm?.at === 'end') flush();
  }
  flush();
  return out;
}

/** The seat markers of one sofa, numbered in this order (the count is the layout's: comfortable or snug). */
export function seatMarkers(b: BuildResult, mode: SeatCountMode): Pt[] {
  const width = mode.snug ? Math.min(mode.snugWidth, mode.seatWidth) : mode.seatWidth;
  const wedge = (corner: 'backLeft' | 'backRight') => b.pieces.filter((p) => p.kind === 'wedge' && p.corner === corner).map(wedgeSeat);
  return [
    ...runMarkers(b, 'left', width).reverse(), // from the left leg's open end up to the corner
    ...wedge('backLeft'),
    ...runMarkers(b, 'back', width),
    ...wedge('backRight'),
    ...runMarkers(b, 'right', width),
  ];
}

/** Every marker of a layout, section by section (a T numbers on from its first half). */
export function layoutSeatMarkers(sections: { built: BuildResult; offset: Pt }[], mode: SeatCountMode): Pt[] {
  return sections.flatMap((s) => seatMarkers(s.built, mode).map(([x, y]): Pt => [x + s.offset[0], y + s.offset[1]]));
}
