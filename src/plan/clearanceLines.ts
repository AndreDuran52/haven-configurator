// Live coffee-table clearances for the plan (plan §8 "Loose pieces"): for each
// sofa region, the closest pair of points between the table and that region,
// so the plan can draw a dimension line. The distances match the engine's G7
// clearances (same convex polygons, Euclidean).
import { CLEARANCE_MIN, rectPoly, type BuildResult, type BuiltPiece, type Pt } from '@/engine';

export interface ClearanceLine {
  region: string;
  a: Pt;
  b: Pt;
  dist: number;
  short: boolean;
}

function closestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return [a[0] + t * dx, a[1] + t * dy];
}

const edges = (poly: Pt[]): [Pt, Pt][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]!]);

/** Closest point pair between two convex, non-overlapping polygons (a on A, b on B). */
export function closestPair(A: Pt[], B: Pt[]): { a: Pt; b: Pt; d: number } {
  let best = { a: A[0]!, b: B[0]!, d: Infinity };
  const consider = (a: Pt, b: Pt) => {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d < best.d - 1e-9) best = { a, b, d };
  };
  for (const p of A) for (const [s, t] of edges(B)) consider(p, closestOnSeg(p, s, t));
  for (const p of B) for (const [s, t] of edges(A)) consider(closestOnSeg(p, s, t), p);
  return best;
}

const regionOf = (p: BuiltPiece): string | null => p.corner ?? p.run;

/**
 * One line per region. Where the table faces a straight run edge the closest
 * pair is a whole segment; the line is then drawn at the middle of the overlap.
 */
export function clearanceLines(b: BuildResult, id: string): ClearanceLine[] {
  const table = b.pieces.find((p) => p.id === id && p.kind === 'coffeeTable');
  const cl = b.clearances.find((c) => c.pieceId === id);
  if (!table || !cl || cl.overlap) return [];
  const T = rectPoly(table.bbox);
  const out: ClearanceLine[] = [];
  const byRegion = new Map<string, BuiltPiece[]>();
  for (const p of b.pieces) {
    const r = regionOf(p);
    if (r && p.kind !== 'ottoman' && p.kind !== 'coffeeTable') byRegion.set(r, [...(byRegion.get(r) ?? []), p]);
  }
  for (const [region, pieces] of byRegion) {
    let best: { a: Pt; b: Pt; d: number } | null = null;
    for (const p of pieces) {
      const c = closestPair(T, p.polygon);
      if (!best || c.d < best.d) best = c;
    }
    if (!best || best.d > 240) continue;
    // Straight faces: centre the line on the shared span (axis-aligned cases).
    const a: Pt = [...best.a];
    const bb: Pt = [...best.b];
    const r = table.bbox;
    if (Math.abs(a[1] - bb[1]) < 1e-6 || Math.abs(a[0] - bb[0]) < 1e-6) {
      const span = pieces.map((p) => p.bbox);
      if (Math.abs(a[0] - bb[0]) < 1e-6) {
        const lo = Math.max(r.x, Math.min(...span.map((s) => s.x)));
        const hi = Math.min(r.x + r.w, Math.max(...span.map((s) => s.x + s.w)));
        if (hi > lo) a[0] = bb[0] = (lo + hi) / 2;
      } else {
        const lo = Math.max(r.y, Math.min(...span.map((s) => s.y)));
        const hi = Math.min(r.y + r.h, Math.max(...span.map((s) => s.y + s.h)));
        if (hi > lo) a[1] = bb[1] = (lo + hi) / 2;
      }
    }
    const dist = Math.round(best.d * 10) / 10;
    out.push({ region, a, b: bb, dist, short: dist < CLEARANCE_MIN });
  }
  return out;
}
