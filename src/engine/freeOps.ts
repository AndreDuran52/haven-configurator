// Freeform edits (stage 3; Andre 2026-11-06). Every op returns the SAME layout
// reference when refused (G6) and never mutates its input. Positions are
// derived, so pulling a seat out of a row closes the row up, growing one pushes
// the rest along, and Turn turns the whole sofa a piece belongs to.
import { FABRIC_CODES, FINISH_CODES, TABLE_STYLE_CODES } from './codec';
import { buildFree } from './freeBuild';
import { addRot, isSeatKind } from './freeGeom';
import { derivePoses, isRoot } from './freePose';
import { pieceOf } from './freeSnap';
import { clampWedge } from './layout';
import { D_MAX, D_MIN } from './ops';
import { ARM_MAX, ARM_MIN, MAX_PIECE, MIN_SEAT, TABLE_MAX, TABLE_MIN, WEDGE_RANGE, half } from './pieces';
import type { Rejection } from './types';
import type { AttachAt, FreeLayout, FreePiece, FreeResult, FreeShared, FreeSpec, Pose, RootAt } from './freeTypes';

const no = (f: FreeLayout, message: string, code: Rejection['code'] = 'notAllowed'): FreeResult => ({ free: f, rejected: { code, message } });

/** Accept `next` if it lays out; an overlap reads "would overlap". */
export function settleFree(f: FreeLayout, next: FreeLayout): FreeResult {
  const e = buildFree(next).errors;
  if (!e.length) return { free: next, rejected: null };
  return no(f, e.some((m) => m.endsWith('overlap')) ? 'That would overlap another piece' : e[0]!, 'noRoom');
}

/** Parents before children, keeping the stored order otherwise (encode relies on it). */
export function ordered(pieces: FreePiece[]): FreePiece[] {
  const out: FreePiece[] = [];
  const done = new Set<string>();
  let left = pieces;
  while (left.length) {
    const ready = left.filter((p) => isRoot(p.at) || done.has(p.at.to));
    if (!ready.length) return [...out, ...left]; // a loop: buildFree reports it
    for (const p of ready) done.add(p.id);
    out.push(...ready);
    left = left.filter((p) => !done.has(p.id));
  }
  return out;
}

const rootAt = (pose: Pose): RootAt => ({ x: pose.x, y: pose.y, rot: pose.rot });

/**
 * The layout without piece `id`. A row closes up: the piece after it in the
 * row takes its place (a root's start-side neighbour becomes the root and the
 * end side re-attaches to it). Pieces past a wedge or on its back stay where
 * they are, as roots of their own sofas. Null if the layout doesn't lay out.
 */
export function without(f: FreeLayout, id: string): FreeLayout | null {
  const d = derivePoses(f);
  if (d.errors.length) return null;
  const p = f.pieces.find((q) => q.id === id);
  if (!p) return null;
  const kids = f.pieces.filter((q) => !isRoot(q.at) && q.at.to === id);
  const relink = new Map<string, FreePiece['at']>();
  for (const k of kids) relink.set(k.id, rootAt(d.poses.get(k.id)!));
  const inline = p.kind !== 'wedge';
  if (isRoot(p.at)) {
    const s = kids.find((k) => (k.at as AttachAt).face === 'start');
    const e = kids.find((k) => (k.at as AttachAt).face === 'end');
    if (inline && s && e) relink.set(e.id, { to: s.id, face: d.childFace.get(s.id)! });
  } else if (inline && p.at.face !== 'back') {
    const cf = d.childFace.get(id);
    const opposite = cf === 'start' ? 'end' : cf === 'end' ? 'start' : null;
    const next = kids.find((k) => (k.at as AttachAt).face === opposite);
    if (next) relink.set(next.id, { to: p.at.to, face: p.at.face });
  }
  const pieces = f.pieces.filter((q) => q.id !== id).map((q) => (relink.has(q.id) ? { ...q, at: relink.get(q.id)! } : q));
  return { ...f, pieces: ordered(pieces) };
}

function specError(spec: FreeSpec, s: FreeShared): string | null {
  if (spec.kind === 'wedge' || spec.length === undefined) return null;
  const L = spec.length;
  if (Math.round(L * 2) !== L * 2) return 'Sizes go in half inches';
  if (spec.kind === 'table') return L >= TABLE_MIN && L <= TABLE_MAX ? null : `Tables are ${TABLE_MIN}–${TABLE_MAX}″`;
  const min = MIN_SEAT + (spec.kind === 'oneArm' ? s.dims.A : 0);
  return L >= min && L <= MAX_PIECE ? null : `min ${min}″, max ${MAX_PIECE}″`;
}

/** Add a piece at a snap target (or, with a pose, on the empty floor as a new sofa). */
export function addFree(f: FreeLayout, spec: FreeSpec, where: AttachAt | RootAt): FreeResult {
  const err = specError(spec, f.shared);
  if (err) return no(f, err);
  const piece = { ...pieceOf(spec, f.shared, `p${f.nextId}`), at: where };
  return settleFree(f, { ...f, pieces: ordered([...f.pieces, piece]), nextId: f.nextId + 1 });
}

/** Pick a piece up (its row closes up) and put it down at a target or on the floor. */
export function moveFree(f: FreeLayout, id: string, where: AttachAt | RootAt): FreeResult {
  const p = f.pieces.find((q) => q.id === id);
  if (!p) return no(f, 'No such piece');
  if (!isRoot(where) && where.to === id) return no(f, "A piece can't attach to itself");
  const rest = without(f, id);
  if (!rest) return no(f, 'This layout needs fixing first');
  return settleFree(f, { ...rest, pieces: ordered([...rest.pieces, { ...p, at: where }]) });
}

/** Take a piece away: its row closes up. */
export function removeFree(f: FreeLayout, id: string): FreeResult {
  const rest = without(f, id);
  return rest ? settleFree(f, rest) : no(f, 'No such piece');
}

/** Turn the whole sofa a piece belongs to 90° clockwise, about its centre (on the half-inch grid). */
export function turnFree(f: FreeLayout, id: string): FreeResult {
  const b = buildFree(f);
  if (b.errors.length) return no(f, 'This layout needs fixing first');
  const group = b.groups.find((g) => g.includes(id));
  const root = f.pieces.find((p) => group?.includes(p.id) && isRoot(p.at));
  if (!group || !root) return no(f, 'No such piece');
  const pts = b.pieces.filter((p) => group.includes(p.id)).flatMap((p) => p.polygon);
  const cx = (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2;
  const cy = (Math.min(...pts.map((q) => q[1])) + Math.max(...pts.map((q) => q[1]))) / 2;
  const at = root.at as RootAt;
  const turned: RootAt = { x: half(cx - (at.y - cy)), y: half(cy + (at.x - cx)), rot: addRot(at.rot, 90) };
  return settleFree(f, { ...f, pieces: f.pieces.map((p) => (p.id === root.id ? { ...p, at: turned } : p)) });
}

/** A seat's or table's size (a one-arm seat's includes its arm); the rest of the row moves along. */
export function setFreeLength(f: FreeLayout, id: string, length: number): FreeResult {
  const p = f.pieces.find((q) => q.id === id);
  if (!p) return no(f, 'No such piece');
  if (p.kind === 'wedge') return no(f, 'Size the corner with the wedge');
  if (p.length === length) return { free: f, rejected: null };
  const err = specError({ kind: p.kind, length }, f.shared);
  if (err) return no(f, err);
  return settleFree(f, { ...f, pieces: f.pieces.map((q) => (q.id === id ? { ...q, length } : q)) });
}

/** Add an arm at one end of a seat (that end must be free), or take it off; the footprint stays. */
export function setFreeArm(f: FreeLayout, id: string, arm: 'start' | 'end' | null): FreeResult {
  const p = f.pieces.find((q) => q.id === id);
  if (!p || !isSeatKind(p.kind)) return no(f, 'Only seats have arms');
  if ((arm === null && p.kind === 'armless') || (arm !== null && p.arm === arm)) return { free: f, rejected: null };
  if (arm !== null) {
    if (derivePoses(f).used.get(id)?.has(arm)) return no(f, 'Something is attached at that end');
    if ((p.length ?? 0) - f.shared.dims.A < MIN_SEAT) return no(f, `The seat would be under ${MIN_SEAT}″`);
  }
  const next: FreePiece = arm === null ? { id, kind: 'armless', length: p.length!, at: p.at } : { id, kind: 'oneArm', length: p.length!, arm, at: p.at };
  return settleFree(f, { ...f, pieces: f.pieces.map((q) => (q.id === id ? next : q)) });
}

/** A back-to-back pair: one shared frame, or two backs. */
export function setFreeSharedBack(f: FreeLayout, id: string, on: boolean): FreeResult {
  const p = f.pieces.find((q) => q.id === id);
  if (!p || isRoot(p.at) || p.at.face !== 'back') return no(f, 'Only a back-to-back seat has a shared back');
  if (!!p.at.sharedBack === on) return { free: f, rejected: null };
  return settleFree(f, { ...f, pieces: f.pieces.map((q) => (q.id === id ? { ...q, at: { ...(q.at as AttachAt), sharedBack: on } } : q)) });
}

/** Depth, corner, seat widths, arm width (seats keep their size), fabric, finish, table style: for every piece. */
export function setFreeShared(f: FreeLayout, patch: Partial<Omit<FreeShared, 'dims'>> & { A?: number }): FreeResult {
  const s = f.shared;
  const D = patch.D ?? s.D;
  if (!(Number.isInteger(D) && D >= D_MIN && D <= D_MAX && D > s.dims.B)) return no(f, `Depth ${D_MIN}–${D_MAX}″`);
  let wedgeC = patch.wedgeC !== undefined ? patch.wedgeC : s.wedgeC;
  if (patch.wedgeC !== undefined && wedgeC !== null && !(Number.isInteger(wedgeC) && wedgeC >= D && wedgeC <= D + WEDGE_RANGE)) {
    return no(f, `The corner is ${D}–${D + WEDGE_RANGE}″`);
  }
  if (patch.D !== undefined && wedgeC !== null) wedgeC = clampWedge(wedgeC, D);
  const A = patch.A ?? s.dims.A;
  if (!(A >= ARM_MIN && A <= ARM_MAX && half(A) === A)) return no(f, `Arms are ${ARM_MIN}–${ARM_MAX}″`);
  for (const [k, list] of [['fabric', FABRIC_CODES], ['tableFinish', FINISH_CODES], ['tableStyle', TABLE_STYLE_CODES]] as const) {
    if (patch[k] !== undefined && !(list as readonly string[]).includes(patch[k] as string)) return no(f, `Unknown ${k}`);
  }
  for (const k of ['seatWidth', 'snugWidth'] as const) if (patch[k] !== undefined && !(patch[k]! > 0)) return no(f, 'Seat widths must be positive');
  const { A: _a, ...rest } = patch;
  const shared: FreeShared = { ...s, ...rest, D, wedgeC, dims: { ...s.dims, A } };
  const dA = A - s.dims.A;
  const pieces = dA ? f.pieces.map((p) => (p.kind === 'oneArm' ? { ...p, length: p.length! + dA } : p)) : f.pieces;
  const next = { ...f, shared, pieces };
  return JSON.stringify(next) === JSON.stringify(f) ? { free: f, rejected: null } : settleFree(f, next);
}

