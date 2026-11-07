// H6c (Andre, 2026-11-07): the plan's dimensions with a room. The frame grows
// to the room so the whole floor is in view; the sofa's own dimensions are
// kept on the sofa's edges (their extension lines run out past the walls),
// and the room's width and depth are the outermost dimensions (bottom, right).
import type { RoomFit } from '@/engine';
import { fmtFtIn, fmtIn } from './format';
import type { DimSource, Frame, Group } from './dims';

/** How far a side's frame edge moved outward (plan inches). */
function shift(side: Group['side'], from: Frame, to: Frame): number {
  if (side === 'top') return from.y0 - to.y0;
  if (side === 'bottom') return to.y1 - from.y1;
  if (side === 'left') return from.x0 - to.x0;
  return to.x1 - from.x1;
}

export function withRoom(src: DimSource, room: RoomFit | null): DimSource {
  if (!room) return src;
  const r = room.rect;
  const f = src.frame;
  const frame: Frame = { x0: Math.min(f.x0, r.x), y0: Math.min(f.y0, r.y), x1: Math.max(f.x1, r.x + r.w), y1: Math.max(f.y1, r.y + r.h) };
  const label = (len: number, feet: boolean) => `Room ${feet && len >= 24 ? `${fmtIn(len)} (${fmtFtIn(len)})` : fmtIn(len)}`;
  return {
    frame,
    groups: (p) => [
      // edgeU is measured outward from the frame edge: a moved edge pushes the sofa's own edges inward.
      ...src.groups(p).map((g) => ({ ...g, edgeU: g.edgeU - shift(g.side, f, frame) })),
      { side: 'bottom', role: 'overall', edgeU: r.y + r.h - frame.y1, segs: [{ s0: r.x, s1: r.x + r.w, label: label(r.w, p.feetInches), weight: 600, dashed: false }] },
      { side: 'right', role: 'overall', edgeU: r.x + r.w - frame.x1, segs: [{ s0: r.y, s1: r.y + r.h, label: label(r.h, p.feetInches), weight: 600, dashed: false }] },
    ],
  };
}

/** The x of the front gap line: the middle of the piece that reaches farthest forward. */
export function frontXOf(sections: { offset: [number, number]; built: { pieces: { kind: string; bbox: { x: number; y: number; w: number; h: number } }[] } }[]): number {
  let best: { y: number; x: number } | null = null;
  for (const s of sections) {
    for (const p of s.built.pieces) {
      if (p.kind === 'ottoman' || p.kind === 'coffeeTable') continue;
      const y = p.bbox.y + p.bbox.h + s.offset[1];
      if (!best || y > best.y + 1e-6) best = { y, x: p.bbox.x + p.bbox.w / 2 + s.offset[0] };
    }
  }
  return best?.x ?? 0;
}
