// Dimensions for a layout of joined sections (shapes milestone, B1), in WORLD
// plan inches. One sofa uses today's requests() unchanged. A T (an L-right and
// an L-left, legs back to back) gets:
// - top: one chain across both halves (a shared back merges the two corners
//   into one junction span, 2C - B) and the overall width;
// - left / right: the depth at each wing end, and in each bay the stem side's
//   pieces (seat | arm) with the stem's overall length;
// - bottom: the stem's width across both sides at its end.
import type { BuiltPiece, BuildResult, LayoutBuild, Pt } from '@/engine';
import { teeOf } from '@/engine';
import { fmtFtIn, fmtIn } from './format';
import { soloSource, type DimProfile, type DimSource, type Group, type Seg } from './dims';

type Span = { a: number; b: number; label: string; weight: 400 | 600; dashed: boolean };

/** A piece's spans along an axis, a one-arm seat split into seat | arm (Andre, 2026-09-28). */
function pieceSpans(pc: BuiltPiece, axis: 'x' | 'y', off: number): Span[] {
  const bb = pc.bbox;
  const a0 = (axis === 'x' ? bb.x : bb.y) + off;
  const a1 = a0 + (axis === 'x' ? bb.w : bb.h);
  const weight = pc.kind === 'table' ? 600 : 400;
  const ar = pc.arm?.rect;
  if (!ar) return [{ a: a0, b: a1, label: fmtIn(a1 - a0), weight, dashed: false }];
  const r0 = (axis === 'x' ? ar.x : ar.y) + off;
  const r1 = r0 + (axis === 'x' ? ar.w : ar.h);
  const seat = Math.abs(r0 - a0) < 1e-6 ? { a: r1, b: a1 } : { a: a0, b: r0 };
  return [
    { ...seat, label: fmtIn(seat.b - seat.a), weight, dashed: false },
    { a: r0, b: r1, label: fmtIn(r1 - r0), weight, dashed: false },
  ];
}

function gapSpans(b: BuildResult, run: string, axis: 'x' | 'y', off: number): Span[] {
  return b.gaps
    .filter((g) => g.run === run)
    .map((g) => {
      const a = (axis === 'x' ? g.rect.x : g.rect.y) + off;
      const len = axis === 'x' ? g.rect.w : g.rect.h;
      return { a, b: a + len, label: fmtIn(g.length), weight: 400 as const, dashed: true };
    });
}

/** Sort and merge overlapping spans (the two corners of a shared back become one junction span). */
function merge(list: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of [...list].sort((x, y) => x.a - y.a)) {
    const prev = out[out.length - 1];
    if (prev && s.a < prev.b - 1e-6) {
      prev.b = Math.max(prev.b, s.b);
      prev.label = fmtIn(prev.b - prev.a);
    } else out.push({ ...s });
  }
  return out;
}

const segs = (list: Span[]): Seg[] => list.map((s) => ({ s0: s.a, s1: s.b, label: s.label, weight: s.weight, dashed: s.dashed }));

function teeGroups(lb: LayoutBuild, p: DimProfile): Group[] {
  const [A, B] = lb.sections as [LayoutBuild['sections'][0], LayoutBuild['sections'][0]];
  const D = A.config.D;
  const ox = B.offset[0];
  const total = lb.overall.W;
  const stemA = A.config.R;
  const stemB = B.config.L;
  const deep = Math.max(stemA, stemB, D);
  const overall = (len: number) => (p.feetInches && len >= 24 ? `${fmtIn(len)} (${fmtFtIn(len)})` : fmtIn(len));
  const groups: Group[] = [];
  const chainOrCallout = (side: Group['side'], edgeU: number, list: Span[]) => {
    if (!list.length) return;
    groups.push({ side, role: list.length > 1 ? 'chain' : 'callout', edgeU, segs: segs(list) });
  };

  // Top: both halves' back runs and corners, in world x.
  const top: Span[] = [];
  for (const s of [A, B]) {
    for (const pc of s.built.pieces) if (pc.corner || pc.run === 'back') top.push(...pieceSpans(pc, 'x', s.offset[0]));
    top.push(...gapSpans(s.built, 'back', 'x', s.offset[0]));
  }
  chainOrCallout('top', 0, merge(top));
  groups.push({ side: 'top', role: 'overall', edgeU: 0, segs: [{ s0: 0, s1: total, label: overall(total), weight: 600, dashed: false }] });

  // Left: the wing end's depth; the left side of the stem (seat fronts at x = W_A - D).
  const leftFace = A.config.W - D;
  groups.push({ side: 'left', role: 'callout', edgeU: 0, segs: [{ s0: 0, s1: D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] });
  const legA = [...A.built.pieces.filter((pc) => pc.run === 'right').flatMap((pc) => pieceSpans(pc, 'y', 0)), ...gapSpans(A.built, 'right', 'y', 0)];
  chainOrCallout('left', -leftFace, merge(legA));
  groups.push({ side: 'left', role: 'overall', edgeU: -leftFace, segs: [{ s0: 0, s1: stemA, label: overall(stemA), weight: 600, dashed: false }] });

  // Right: mirrored (seat fronts at x = x_B + D).
  const rightFace = ox + D;
  groups.push({ side: 'right', role: 'callout', edgeU: 0, segs: [{ s0: 0, s1: D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] });
  const legB = [...B.built.pieces.filter((pc) => pc.run === 'left').flatMap((pc) => pieceSpans(pc, 'y', 0)), ...gapSpans(B.built, 'left', 'y', 0)];
  chainOrCallout('right', rightFace - total, merge(legB));
  if (stemB !== stemA) groups.push({ side: 'right', role: 'overall', edgeU: rightFace - total, segs: [{ s0: 0, s1: stemB, label: overall(stemB), weight: 600, dashed: false }] });

  // Bottom: the stem's width at its end (each leg's depth when the sides differ).
  if (stemA === stemB) {
    groups.push({ side: 'bottom', role: 'callout', edgeU: stemA - deep, segs: [{ s0: leftFace, s1: rightFace, label: fmtIn(rightFace - leftFace), weight: 600, dashed: false }] });
  } else {
    groups.push({ side: 'bottom', role: 'callout', edgeU: stemA - deep, segs: [{ s0: leftFace, s1: leftFace + D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] });
    groups.push({ side: 'bottom', role: 'callout', edgeU: stemB - deep, segs: [{ s0: ox, s1: rightFace, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] });
  }
  return groups;
}

/** The dimension source for a layout: today's plan for one sofa, the T's world dims for a T. */
export function layoutDimSource(lb: LayoutBuild): DimSource {
  if (lb.solo) return soloSource(lb.sections[0]!.built);
  const l = { schema: 1 as const, sections: lb.sections.map((s) => ({ id: s.id, config: s.config, join: s.join })) };
  if (!teeOf(l)) throw new Error('dims: only T layouts are supported');
  return {
    groups: (p) => teeGroups(lb, p),
    frame: { x0: 0, y0: 0, x1: lb.overall.W, y1: Math.max(lb.sections[0]!.config.R, lb.sections[1]!.config.L, lb.sections[0]!.config.D) },
  };
}

/** Where the one seat label of a layout goes (the left bay of a T). */
export function layoutSeatsAt(lb: LayoutBuild): Pt {
  const A = lb.sections[0]!.config;
  return [(A.W - A.D) / 2, A.D + (A.R - A.D) / 2];
}
