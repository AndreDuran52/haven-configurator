// Pure hit-testing in plan inches against buildHaven() output (plan §8), ported
// from docs/prototypes/planview/src/plan/hitTest.ts. The DOM never decides what
// was hit, so overlapping touch targets cannot exist.
//
// Seam GRIPS sit on the seat-front side of each run, pushed out into the open
// area, so a short piece's body stays tappable. The nearest grip wins; crowded
// grips are staggered outward. Then: the seam line (mouse/pen only), tables,
// loose pieces, seats, wedges, gaps.
import type { BuildResult, BuiltPiece, Pt, RunId } from '@/engine';

export interface Grip {
  run: RunId;
  seam: number;
  axis: 'x' | 'y';
  /** seam position along the run axis (plan in) */
  at: number;
  /** grip centre (plan in) */
  pt: Pt;
  /** 0 = first row, 1 = staggered further out */
  row: 0 | 1;
}

export type Hit =
  | { type: 'seam'; run: RunId; seam: number; axis: 'x' | 'y'; at: number }
  | { type: 'piece'; id: string; kind: BuiltPiece['kind'] }
  | { type: 'gap'; run: RunId; index: number }
  | null;

/** Grip radius in px: 22 => a 44 pt target (plan §8). */
export const GRIP_R = 22;
/** First-row grip centre, px outside the seat front. */
export const GRIP_OFFSET = 14;

/** What sits at each stored index of a run (gaps included). */
function kindsByIndex(b: BuildResult, run: RunId): Map<number, BuiltPiece['kind'] | 'gap'> {
  const m = new Map<number, BuiltPiece['kind'] | 'gap'>();
  for (const p of b.pieces) if (p.run === run && p.index !== null) m.set(p.index, p.kind);
  for (const g of b.gaps) if (g.run === run) m.set(g.index, 'gap');
  return m;
}

const isSeatKind = (k: string | undefined) => k === 'armless' || k === 'oneArm';

/**
 * Grips for every seam that has a handle (seat|seat, seat|table, seat|gap;
 * dragSeam refuses the rest).
 * @param k plan inches per CSS px (grip geometry is in px so it stays thumb-sized)
 */
export function gripPoints(b: BuildResult, k: number, r = GRIP_R): Grip[] {
  const out: Grip[] = [];
  const off0 = GRIP_OFFSET * k;
  const off1 = off0 + 2 * r * k;
  for (const run of b.runs) {
    const kinds = kindsByIndex(b, run.id);
    let lastAt = -Infinity;
    let lastRow = 1 as 0 | 1;
    for (const s of run.seams) {
      if (!isSeatKind(kinds.get(s.index - 1)) && !isSeatKind(kinds.get(s.index))) continue;
      const at = run.axis === 'x' ? s.point[0] : s.point[1];
      const crowded = (at - lastAt) / k < 2 * r;
      const row: 0 | 1 = crowded && lastRow === 0 ? 1 : 0;
      const off = row ? off1 : off0;
      const pt: Pt = run.id === 'back' ? [at, b.D + off] : run.id === 'left' ? [b.D + off, at] : [b.W - b.D - off, at];
      out.push({ run: run.id, seam: s.index, axis: run.axis, at, pt, row });
      lastAt = at;
      lastRow = row;
    }
  }
  return out;
}

export function inPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Hit tolerance by pointer type (plan §8): mouse and pen also get the seam line. */
export const lineTolPx = (pointerType: string) => (pointerType === 'touch' ? 0 : 7);

export function hitTest(b: BuildResult, grips: Grip[], pt: Pt, o: { k: number; gripR?: number; lineTolPx: number }): Hit {
  const rIn = (o.gripR ?? GRIP_R) * o.k;
  let best: Grip | null = null;
  let bestD = Infinity;
  for (const g of grips) {
    const d = Math.hypot(pt[0] - g.pt[0], pt[1] - g.pt[1]);
    if (d <= rIn && d < bestD) {
      best = g;
      bestD = d;
    }
  }
  if (best) return { type: 'seam', run: best.run, seam: best.seam, axis: best.axis, at: best.at };
  // The seam line itself (precise pointers: 7 px; touch: 0 so bodies stay tappable).
  if (o.lineTolPx > 0) {
    const tol = o.lineTolPx * o.k;
    for (const g of grips) {
      const along = g.axis === 'x' ? pt[0] : pt[1];
      const across = g.axis === 'x' ? pt[1] : pt[0];
      const [a0, a1] = g.run === 'right' ? [b.W - b.D, b.W] : [0, b.D];
      if (Math.abs(along - g.at) <= tol && across >= a0 && across <= a1) return { type: 'seam', run: g.run, seam: g.seam, axis: g.axis, at: g.at };
    }
  }
  const order: BuiltPiece['kind'][] = ['table', 'ottoman', 'coffeeTable', 'armless', 'oneArm', 'wedge'];
  // Loose pieces are drawn on top: test them from the last one drawn.
  const pieces = [...b.pieces].reverse();
  for (const kind of order) {
    for (const p of pieces) if (p.kind === kind && inPoly(pt, p.polygon)) return { type: 'piece', id: p.id, kind: p.kind };
  }
  for (const g of b.gaps) {
    const r = g.rect;
    if (pt[0] >= r.x && pt[0] <= r.x + r.w && pt[1] >= r.y && pt[1] <= r.y + r.h) return { type: 'gap', run: g.run, index: g.index };
  }
  return null;
}
