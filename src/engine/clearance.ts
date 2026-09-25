// G7 coffee-table clearance: exact Euclidean distance from the table rectangle
// to the built sofa polygons (wedges, seats, tables; never gaps), per region.
// Every sofa polygon is convex (rectangles and the §8 wedge pentagon).
import type { BuiltPiece, Clearance, Config, Pt, Rect } from './types';

const EPS = 1e-9;

function segPointDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

const edges = (poly: Pt[]): [Pt, Pt][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]!]);

/** Separating-axis test: do the interiors of two convex polygons overlap? (Touching is not overlap.) */
export function convexOverlap(a: Pt[], b: Pt[]): boolean {
  for (const [p, q] of [...edges(a), ...edges(b)]) {
    const n: Pt = [q[1] - p[1], p[0] - q[0]];
    const proj = (poly: Pt[]) => poly.map((v) => v[0] * n[0] + v[1] * n[1]);
    const pa = proj(a);
    const pb = proj(b);
    if (Math.max(...pa) <= Math.min(...pb) + EPS || Math.max(...pb) <= Math.min(...pa) + EPS) return false;
  }
  return true;
}

/** Distance between two convex polygons (0 when they touch or overlap). */
export function convexDistance(a: Pt[], b: Pt[]): number {
  if (convexOverlap(a, b)) return 0;
  let best = Infinity;
  for (const p of a) for (const [s, t] of edges(b)) best = Math.min(best, segPointDist(p, s, t));
  for (const p of b) for (const [s, t] of edges(a)) best = Math.min(best, segPointDist(p, s, t));
  return best;
}

export const rectPoly = (r: Rect): Pt[] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
];

const round1 = (x: number): number => Math.round(x * 10) / 10 + 0;

type Region = 'back' | 'left' | 'right' | 'backLeft' | 'backRight';

const regionOf = (p: BuiltPiece): Region | null => {
  if (p.corner) return p.corner;
  return p.run;
};

/** Clearances from one table rectangle to every sofa region. */
export function clearanceFor(pieceId: string, table: Rect, pieces: BuiltPiece[]): Clearance {
  const poly = rectPoly(table);
  const out: Record<Region, number | null> = { back: null, left: null, right: null, backLeft: null, backRight: null };
  let overlap = false;
  for (const p of pieces) {
    const region = regionOf(p);
    if (!region) continue;
    if (convexOverlap(poly, p.polygon)) overlap = true;
    const dist = convexDistance(poly, p.polygon);
    const prev = out[region];
    out[region] = prev === null ? dist : Math.min(prev, dist);
  }
  const values = Object.values(out).filter((v): v is number => v !== null);
  return {
    pieceId,
    back: out.back === null ? null : round1(out.back),
    left: out.left === null ? null : round1(out.left),
    right: out.right === null ? null : round1(out.right),
    backLeft: out.backLeft === null ? null : round1(out.backLeft),
    backRight: out.backRight === null ? null : round1(out.backRight),
    min: values.length ? round1(Math.min(...values)) : null,
    overlap,
  };
}

/** One Clearance per coffee table in the config. */
export function coffeeClearances(c: Config, pieces: BuiltPiece[]): Clearance[] {
  const sofa = pieces.filter((p) => p.run !== null || p.corner !== null);
  return c.loose
    .filter((l) => l.kind === 'coffeeTable')
    .map((t) => clearanceFor(t.id, { x: t.x, y: t.y, w: t.w, h: t.d }, sofa));
}
