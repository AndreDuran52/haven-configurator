// config -> pieces[] (pure, no React). Lays out and VALIDATES only: it never
// rebalances or splits (the ops already stored the final lengths).
import { available, corners, endCapState, openEnd, runEnds, runIds, wedgeC } from './layout';
import { MAX_PIECE, cushionOf, half, isSeat } from './pieces';
import { coffeeClearances, rectPoly } from './clearance';
import { ruleViolation } from './rules';
import { collectWarnings, opening, seatCount, wedgeFace, wedgeReadout } from './seating';
import type {
  Bounds,
  BuildResult,
  BuiltGap,
  BuiltPiece,
  BuiltRun,
  BuiltSeam,
  Config,
  CornerId,
  Facing,
  Pt,
  Rect,
  RunEnd,
  RunId,
} from './types';

/** Arm side as seen FACING the piece from the opening (see the report for the derivation). */
const FACING: Record<RunId, Record<RunEnd, Facing>> = {
  back: { start: 'LAF', end: 'RAF' },
  left: { start: 'RAF', end: 'LAF' },
  right: { start: 'LAF', end: 'RAF' },
};

interface Frame {
  axis: 'x' | 'y';
  /** Absolute along-axis coordinate of the run start. */
  start: number;
  /** Absolute cross-axis coordinate of the OUTSIDE (back) edge, and which way is inward. */
  outside: number;
  inward: 1 | -1;
}

function frameOf(c: Config, run: RunId, C: number): Frame {
  if (run === 'back') return { axis: 'x', start: c.shape === 'L-right' ? 0 : C, outside: 0, inward: 1 };
  if (run === 'left') return { axis: 'y', start: C, outside: 0, inward: 1 };
  return { axis: 'y', start: C, outside: c.W, inward: -1 };
}

/** Rect from along-run [a0, a1] and depth-from-outside [d0, d1]. */
function frameRect(f: Frame, a0: number, a1: number, d0: number, d1: number): Rect {
  const c0 = f.inward === 1 ? f.outside + d0 : f.outside - d1;
  const c1 = f.inward === 1 ? f.outside + d1 : f.outside - d0;
  return f.axis === 'x'
    ? { x: f.start + a0, y: c0, w: a1 - a0, h: c1 - c0 }
    : { x: c0, y: f.start + a0, w: c1 - c0, h: a1 - a0 };
}

function wedgePiece(c: Config, corner: CornerId, C: number): BuiltPiece {
  const { D, W } = c;
  const B = c.dims.B;
  // §8: (0,0) (C,0) (C,D) (D,C) (0,C); mirrored (and re-wound) for back-right.
  let polygon: Pt[] =
    corner === 'backLeft'
      ? [[0, 0], [C, 0], [C, D], [D, C], [0, C]]
      : [[W, 0], [W, C], [W - D, C], [W - C, D], [W - C, 0]];
  polygon = polygon.filter((p, i) => {
    const q = polygon[(i + 1) % polygon.length]!;
    return p[0] !== q[0] || p[1] !== q[1];
  });
  const x0 = corner === 'backLeft' ? 0 : W - C;
  const backs: Rect[] =
    corner === 'backLeft'
      ? [{ x: 0, y: 0, w: C, h: B }, { x: 0, y: 0, w: B, h: C }]
      : [{ x: W - C, y: 0, w: C, h: B }, { x: W - B, y: 0, w: B, h: C }];
  return {
    id: `wedge:${corner}`,
    kind: 'wedge',
    run: null,
    corner,
    index: null,
    offset: null,
    length: C,
    depth: D,
    cushion: null,
    bbox: { x: x0, y: 0, w: C, h: C },
    polygon,
    arm: null,
    backs,
    cushionRect: null,
    height: c.dims.backHeight,
    splitGroup: null,
  };
}

export function buildHaven(config: Config): BuildResult {
  const c = config;
  const C = wedgeC(c);
  const { D } = c;
  const { A, B } = c.dims;
  const errors: string[] = [];
  const pieces: BuiltPiece[] = corners(c.shape).map((k) => wedgePiece(c, k, C));
  const gaps: BuiltGap[] = [];
  const runs: BuiltRun[] = [];

  if (!(D > B)) errors.push(`depth ${D}" must exceed the back ${B}"`);
  if (!Number.isInteger(D) || !Number.isInteger(C)) errors.push(`D ${D} and C ${C} must be whole inches`);
  const rule = ruleViolation(c);
  if (rule) errors.push(rule.message);

  for (const run of runIds(c.shape)) {
    const stored = c.runs[run];
    if (!stored) {
      errors.push(`run ${run} is missing`);
      continue;
    }
    const f = frameOf(c, run, C);
    const seams: BuiltSeam[] = [];
    let s = 0;
    stored.forEach((p, index) => {
      if (index > 0) {
        const pt = frameRect(f, s, s, 0, 0);
        seams.push({ index, offset: s, point: [pt.x, pt.y] });
      }
      if (!(p.length > 0) || half(p.length) !== p.length) errors.push(`${p.id}: length ${p.length} is not a positive multiple of 0.5`);
      if (p.kind === 'oneArm' && p.arm !== 'start' && p.arm !== 'end') errors.push(`${p.id}: one-arm piece without an arm side`);
      if (p.kind !== 'oneArm' && p.arm !== undefined) errors.push(`${p.id}: only one-arm pieces carry an arm`);
      if (isSeat(p) && p.length > MAX_PIECE) errors.push(`${p.id}: ${p.length}" was not auto-split`);
      const rect = frameRect(f, s, s + p.length, 0, D);
      if (p.kind === 'gap') {
        gaps.push({ run, index, offset: s, length: p.length, rect, label: `unfilled ${p.length}"` });
      } else {
        let arm: BuiltPiece['arm'] = null;
        let cushionSpan: [number, number] = [s, s + p.length];
        if (p.kind === 'oneArm' && p.arm) {
          const span: [number, number] = p.arm === 'start' ? [s, s + A] : [s + p.length - A, s + p.length];
          arm = { at: p.arm, facing: FACING[run][p.arm], rect: frameRect(f, span[0], span[1], 0, D) };
          cushionSpan = p.arm === 'start' ? [s + A, s + p.length] : [s, s + p.length - A];
        }
        const seatPiece = isSeat(p);
        pieces.push({
          id: p.id,
          kind: p.kind,
          run,
          corner: null,
          index,
          offset: s,
          length: p.length,
          depth: D,
          cushion: seatPiece ? cushionOf(p, A) : null,
          bbox: rect,
          polygon: rectPoly(rect),
          arm,
          backs: seatPiece ? [frameRect(f, cushionSpan[0], cushionSpan[1], 0, B)] : [],
          cushionRect: seatPiece ? frameRect(f, cushionSpan[0], cushionSpan[1], B, D) : null,
          height: p.kind === 'table' ? c.dims.tableHeight : c.dims.backHeight,
          splitGroup: p.splitGroup ?? null,
        });
      }
      s += p.length;
    });
    const av = available(c, run);
    if (s !== av) errors.push(`run ${run}: pieces sum to ${s}" but ${av}" is available`);
    const gapSum = stored.filter((p) => p.kind === 'gap').reduce((t, p) => t + p.length, 0);
    const open = openEnd(c.shape, run);
    const origin = frameRect(f, 0, 0, 0, 0);
    runs.push({
      id: run,
      available: av,
      sum: s,
      filled: s - gapSum,
      unfilled: gapSum,
      ends: runEnds(c.shape, run),
      openEnd: open,
      endCap: open ? endCapState(stored, open) : null,
      axis: f.axis,
      origin: [origin.x, origin.y],
      pieceIds: stored.map((p) => p.id),
      seams,
    });
  }

  for (const l of c.loose) {
    const rect = { x: l.x, y: l.y, w: l.w, h: l.d };
    pieces.push({
      id: l.id,
      kind: l.kind,
      run: null,
      corner: null,
      index: null,
      offset: null,
      length: l.w,
      depth: l.d,
      cushion: null,
      bbox: rect,
      polygon: rectPoly(rect),
      arm: null,
      backs: [],
      cushionRect: null,
      height: l.kind === 'ottoman' ? c.dims.ottomanHeight : c.dims.coffeeTableHeight,
      splitGroup: null,
    });
  }

  const clearances = coffeeClearances(c, pieces);
  const bounds = boundsOf([...pieces.flatMap((p) => p.polygon), ...gaps.flatMap((g) => rectPoly(g.rect))]);
  return {
    shape: c.shape,
    W: c.W,
    L: c.L,
    R: c.R,
    D,
    seatDepth: D - B,
    wedge: { C, auto: c.wedgeC === null, face: wedgeFace(C, D), readout: wedgeReadout(C, D) },
    runs,
    pieces,
    gaps,
    seats: seatCount(c),
    opening: opening(c),
    clearances,
    warnings: collectWarnings(c, C, clearances),
    errors,
    exportBlocked: gaps.length > 0 || errors.length > 0,
    bounds,
    heights: { ...c.dims },
  };
}

/** G4: plan extents (feeds the SVG viewBox, the ortho fit and the elevations). */
function boundsOf(points: Pt[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
