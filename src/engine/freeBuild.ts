// Freeform build (stage 3): free layout -> world pieces, sofas (groups), rows
// (chains), seats, warnings, errors. Lays out and validates only, like
// buildHaven. Pieces never overlap, except frame on frame: a shared back.
import { clearanceFor, convexOverlap, rectPoly } from './clearance';
import { CLEARANCE_MIN, SEAT_DEPTH_MIN, WEDGE_FACE_MIN } from './defaults';
import { builtFree, frameZones, isSeatKind, lengthOf, turnVec } from './freeGeom';
import { derivePoses, isRoot } from './freePose';
import { wedgeC } from './layout';
import { ABSORB_FLOOR, ARM_MAX, ARM_MIN, MAX_PIECE, SEAT_WARN, TABLE_MAX, TABLE_MIN, WEDGE_RANGE } from './pieces';
import { countSeats, fmt, runStretches, seatDepth, wedgeFace, wedgeReadout } from './seating';
import type { Bounds, BuiltPiece, Clearance, Pt, Rect, Warning } from './types';
import type { FreeBuild, FreeLayout, FreePiece, FreeShared, Pose } from './freeTypes';

const inside = (a: Rect, z: Rect) => a.x >= z.x - 1e-9 && a.y >= z.y - 1e-9 && a.x + a.w <= z.x + z.w + 1e-9 && a.y + a.h <= z.y + z.h + 1e-9;
const meet = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 1e-9 && h > 1e-9 ? { x, y, w, h } : null;
};

/** Two pieces overlap, unless only their frames do (a shared back). */
export function overlapping(a: BuiltPiece, za: Rect[], b: BuiltPiece, zb: Rect[]): boolean {
  if (!convexOverlap(a.polygon, b.polygon)) return false;
  const m = meet(a.bbox, b.bbox);
  return !(m && za.some((z) => inside(m, z)) && zb.some((z) => inside(m, z)));
}

/** Shared-field and per-piece rules that make a layout unbuildable. */
export function freeRuleErrors(f: FreeLayout): string[] {
  const s = f.shared;
  const e: string[] = [];
  if (!(s.D > s.dims.B)) e.push(`depth ${s.D}" must exceed the back ${s.dims.B}"`);
  const C = wedgeC(s);
  if (!Number.isInteger(s.D) || !Number.isInteger(C)) e.push(`D ${s.D} and C ${C} must be whole inches`);
  if (s.wedgeC !== null && !(s.wedgeC >= s.D && s.wedgeC <= s.D + WEDGE_RANGE)) e.push(`wedge ${s.wedgeC}" outside ${s.D}–${s.D + WEDGE_RANGE}`);
  if (!(s.seatWidth > 0 && s.snugWidth > 0)) e.push('seat widths must be positive');
  if (!(s.dims.A >= ARM_MIN && s.dims.A <= ARM_MAX)) e.push(`arm ${s.dims.A}" outside ${ARM_MIN}–${ARM_MAX}`);
  for (const p of f.pieces) {
    if (p.kind === 'wedge') {
      if (p.length !== undefined || p.arm !== undefined) e.push(`${p.id}: a wedge takes its size from the corner`);
      continue;
    }
    const L = p.length ?? 0;
    if (!(L > 0) || Math.round(L * 2) !== L * 2) e.push(`${p.id}: length ${L} is not a positive half inch`);
    if ((p.kind === 'oneArm') !== (p.arm !== undefined)) e.push(`${p.id}: only a one-arm seat has an arm`);
    if (isSeatKind(p.kind) && L - (p.kind === 'oneArm' ? s.dims.A : 0) < ABSORB_FLOOR) e.push(`${p.id}: seat under ${ABSORB_FLOOR}"`);
    if (p.kind === 'table' && L > MAX_PIECE) e.push(`${p.id}: table over ${MAX_PIECE}"`);
  }
  return e;
}

const find = (parent: Map<string, string>, x: string): string => {
  let r = x;
  while (parent.get(r) !== r) r = parent.get(r)!;
  parent.set(x, r);
  return r;
};

/** Sets of ids joined by the given edges (each set in stored order). */
function unions(ids: string[], edges: [string, string][]): string[][] {
  const parent = new Map(ids.map((i) => [i, i]));
  for (const [a, b] of edges) if (parent.has(a) && parent.has(b)) parent.set(find(parent, a), find(parent, b));
  const out = new Map<string, string[]>();
  for (const i of ids) out.set(find(parent, i), [...(out.get(find(parent, i)) ?? []), i]);
  return [...out.values()];
}

function boundsOf(points: Pt[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function warningsOf(f: FreeLayout, built: Map<string, BuiltPiece>, clearances: Clearance[]): Warning[] {
  const s = f.shared;
  const w: Warning[] = [];
  for (const p of f.pieces) {
    const b = built.get(p.id);
    if (!b || p.kind === 'wedge') continue;
    if (b.length > MAX_PIECE) w.push({ code: 'pieceOver108', pieceId: p.id, message: `Piece ${fmt(b.length)}″ (over ${MAX_PIECE})` });
    if (b.cushion !== null && b.cushion < SEAT_WARN) w.push({ code: 'seatNarrow', pieceId: p.id, message: `Seat ${fmt(b.cushion)}″ (under ${SEAT_WARN})` });
    if (p.kind === 'table' && (b.length < TABLE_MIN || b.length > TABLE_MAX)) {
      w.push({ code: 'tableOutOfRange', pieceId: p.id, message: `Table ${fmt(b.length)}″ (outside ${TABLE_MIN}–${TABLE_MAX})` });
    }
  }
  const face = wedgeFace(wedgeC(s), s.D);
  if (f.pieces.some((p) => p.kind === 'wedge') && face > 0 && face < WEDGE_FACE_MIN) {
    w.push({ code: 'wedgeFaceUnder8', message: `Wedge angled face ${face.toFixed(1)}″ (under ${WEDGE_FACE_MIN})` });
  }
  const depth = seatDepth(s);
  if (f.pieces.some((p) => isSeatKind(p.kind)) && depth < SEAT_DEPTH_MIN) {
    w.push({ code: 'seatDepthShort', message: `Seat depth ${fmt(depth)}″ (under ${SEAT_DEPTH_MIN})` });
  }
  for (const cl of clearances) {
    if (cl.overlap) w.push({ code: 'coffeeOverlap', pieceId: cl.pieceId, message: 'Coffee table overlaps the sofa' });
    else if (cl.min !== null && cl.min < CLEARANCE_MIN) {
      w.push({ code: 'coffeeClearanceUnder14', pieceId: cl.pieceId, message: `Coffee table clearance ${fmt(cl.min)}″ (under ${CLEARANCE_MIN})` });
    }
  }
  return w;
}

/** Rows: seats and tables joined end to end (not through a wedge, not back to back), each ordered along its back. */
function chainsOf(f: FreeLayout, poses: Map<string, Pose>, childFace: Map<string, string>): string[][] {
  const row = f.pieces.filter((p) => p.kind !== 'wedge' && poses.has(p.id));
  const byId = new Map(f.pieces.map((p) => [p.id, p]));
  const edges: [string, string][] = [];
  for (const p of row) {
    if (isRoot(p.at) || p.at.face === 'back') continue;
    const parent = byId.get(p.at.to);
    const cf = childFace.get(p.id);
    if (parent && parent.kind !== 'wedge' && (cf === 'start' || cf === 'end')) edges.push([p.at.to, p.id]);
  }
  return unions(
    row.map((p) => p.id),
    edges,
  ).map((ids) => {
    const dir = turnVec([1, 0], poses.get(ids[0]!)!.rot);
    const along = (id: string) => poses.get(id)!.x * dir[0] + poses.get(id)!.y * dir[1];
    return [...ids].sort((a, b) => along(a) - along(b));
  });
}

export function buildFree(f: FreeLayout): FreeBuild {
  const s: FreeShared = f.shared;
  const C = wedgeC(s);
  const d = derivePoses(f);
  const errors = [...freeRuleErrors(f), ...d.errors];
  const built = new Map<string, BuiltPiece>();
  const zones = new Map<string, Rect[]>();
  for (const p of f.pieces) {
    const pose = d.poses.get(p.id);
    if (!pose) continue;
    built.set(p.id, builtFree(p, pose, s));
    zones.set(p.id, frameZones(p, pose, s));
  }
  const sofa = [...built.values()];
  for (let i = 0; i < sofa.length; i++) {
    for (let j = i + 1; j < sofa.length; j++) {
      const a = sofa[i]!;
      const b = sofa[j]!;
      if (overlapping(a, zones.get(a.id)!, b, zones.get(b.id)!)) errors.push(`${a.id} and ${b.id} overlap`);
    }
  }
  const groups = unions(
    f.pieces.map((p) => p.id),
    f.pieces.flatMap((p): [string, string][] => (isRoot(p.at) ? [] : [[p.at.to, p.id]])),
  );
  const chains = chainsOf(f, d.poses, d.childFace);
  const byId = new Map(f.pieces.map((p) => [p.id, p]));
  const stretches = chains.flatMap((ids) =>
    runStretches(
      ids.map((id) => {
        const p = byId.get(id)!;
        // Rows hold seats and tables only (chainsOf leaves wedges out).
        return { kind: p.kind as Exclude<FreePiece['kind'], 'wedge'>, length: lengthOf(p, s), ...(p.arm ? { arm: p.arm } : {}) };
      }),
      s.dims.A,
    ),
  );
  const seats = countSeats(f.pieces.filter((p) => p.kind === 'wedge').length, stretches, s.seatWidth, s.snugWidth);
  const loose: BuiltPiece[] = f.loose.map((l) => {
    const rect = { x: l.x, y: l.y, w: l.w, h: l.d };
    return {
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
      height: l.kind === 'ottoman' ? s.dims.ottomanHeight : s.dims.coffeeTableHeight,
      splitGroup: null,
    };
  });
  const clearances = f.loose.filter((l) => l.kind === 'coffeeTable').map((t) => clearanceFor(t.id, { x: t.x, y: t.y, w: t.w, h: t.d }, sofa, true));
  const pieces = [...sofa, ...loose];
  return {
    pieces,
    poses: d.poses,
    groups,
    chains,
    seats,
    wedge: { C, auto: s.wedgeC === null, face: wedgeFace(C, s.D), readout: wedgeReadout(C, s.D) },
    seatDepth: seatDepth(s),
    clearances,
    warnings: warningsOf(f, built, clearances),
    errors,
    bounds: boundsOf(pieces.flatMap((p) => p.polygon)),
    exportBlocked: errors.length > 0,
  };
}

/** The world pose of every piece (for ops), or null if the layout doesn't lay out. */
export const posesOf = (f: FreeLayout): Map<string, Pose> | null => {
  const d = derivePoses(f);
  return d.errors.length ? null : d.poses;
};

export type { FreePiece };
