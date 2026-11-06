// Freeform geometry: one piece in its own frame, turned and moved into the
// world, and the attach rule (stage 3). 90° turns only, done with exact swaps
// (no trigonometry), so poses stay on the half-inch grid and rects stay rects.
import { rectPoly } from './clearance';
import { wedgeC } from './layout';
import { half, wedgePolygon } from './pieces';
import { BACK_CUSHION } from './profiles';
import type { BuiltPiece, Pt, Rect } from './types';
import type { AttachAt, FaceId, FreePiece, FreeShared, Pose, Rot } from './freeTypes';

/** Turn a local vector by `rot` (clockwise on screen, y down): s → (cos, sin), t → (−sin, cos). */
export function turnVec([u, v]: Pt, rot: Rot): Pt {
  if (rot === 0) return [u + 0, v + 0];
  if (rot === 90) return [-v + 0, u + 0];
  if (rot === 180) return [-u + 0, -v + 0];
  return [v + 0, -u + 0];
}

export const toWorld = (pose: Pose, p: Pt): Pt => {
  const [x, y] = turnVec(p, pose.rot);
  return [pose.x + x, pose.y + y];
};

export const addRot = (a: Rot, b: number): Rot => ((((a + b) % 360) + 360) % 360) as Rot;

/** A local rect in the world (still a rect: 90° turns). */
export function rectToWorld(pose: Pose, r: Rect): Rect {
  const a = toWorld(pose, [r.x, r.y]);
  const b = toWorld(pose, [r.x + r.w, r.y + r.h]);
  return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
}

/** The piece's footprint along s: its length, or the shared C for a wedge. */
export const lengthOf = (p: Pick<FreePiece, 'kind' | 'length'>, s: FreeShared): number => (p.kind === 'wedge' ? wedgeC(s) : (p.length ?? 0));

/** An end face in local inches: the back point, the front point, and the outward normal. */
export interface Face {
  back: Pt;
  front: Pt;
  n: Pt;
}

/** The faces a piece can attach by (and be attached at): a seat's or table's ends, a wedge's two faces. */
export function endFaces(p: Pick<FreePiece, 'kind' | 'length'>, s: FreeShared): Partial<Record<FaceId, Face>> {
  const D = s.D;
  if (p.kind === 'wedge') {
    const C = wedgeC(s);
    return { a: { back: [C, 0], front: [C, D], n: [1, 0] }, b: { back: [0, C], front: [D, C], n: [0, 1] } };
  }
  const L = lengthOf(p, s);
  return { start: { back: [0, 0], front: [0, D], n: [-1, 0] }, end: { back: [L, 0], front: [L, D], n: [1, 0] } };
}

/** A one-arm seat's arm face takes nothing (Andre: corners only through a wedge; arms close a row). */
export const armFace = (p: FreePiece): FaceId | null => (p.kind === 'oneArm' ? (p.arm ?? 'end') : null);

const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const unit = (a: Pt, b: Pt): Pt => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};
const ROTS: Rot[] = [0, 90, 180, 270];

/**
 * The attach rule. The child's start or end (a wedge: a or b) meets the parent's
 * face back point to back point and front to front, normals opposed. Exactly one
 * child face and turn fits (a mirror never does), so a wedge on a seat's end
 * always turns toward the seat side. A back attachment turns the child 180°
 * with its back on the parent's (shared: on the parent's frame, B in).
 * Returns the child's pose and the child face used, or null when it can't attach.
 */
export function attachPose(
  parent: FreePiece,
  parentPose: Pose,
  child: FreePiece,
  at: AttachAt,
  s: FreeShared,
): { pose: Pose; face: FaceId } | null {
  if (at.face === 'back') {
    if (!isSeatKind(parent.kind) || !isSeatKind(child.kind)) return null;
    const off = at.offset ?? 0;
    const origin = toWorld(parentPose, [off + lengthOf(child, s), at.sharedBack ? s.dims.B : 0]);
    return { pose: { x: half(origin[0]), y: half(origin[1]), rot: addRot(parentPose.rot, 180) }, face: 'back' };
  }
  const pf = endFaces(parent, s)[at.face];
  if (!pf) return null;
  const pBack = toWorld(parentPose, pf.back);
  const pFront = toWorld(parentPose, pf.front);
  const pn = turnVec(pf.n, parentPose.rot);
  const want: Pt = [-pn[0], -pn[1]];
  const dir = unit(pBack, pFront);
  for (const [face, cf] of Object.entries(endFaces(child, s)) as [FaceId, Face][]) {
    for (const rot of ROTS) {
      if (!same(turnVec(cf.n, rot), want) || !same(turnVec(unit(cf.back, cf.front), rot), dir)) continue;
      const o = turnVec(cf.back, rot);
      return { pose: { x: half(pBack[0] - o[0]), y: half(pBack[1] - o[1]), rot }, face };
    }
  }
  return null;
}

export const isSeatKind = (k: string): boolean => k === 'armless' || k === 'oneArm';

/** A seat or wedge's top: the loose back cushions, 4″ above the 27″ frame (as buildHaven). */
const pieceTop = (s: FreeShared): number => s.dims.backHeight + BACK_CUSHION.rise;

/**
 * The frame zones a piece may share with another piece's (shared backs): a
 * seat's full back strip (its arm span included), a wedge's two back strips. World.
 */
export function frameZones(p: FreePiece, pose: Pose, s: FreeShared): Rect[] {
  const B = s.dims.B;
  if (p.kind === 'wedge') {
    const C = wedgeC(s);
    return [rectToWorld(pose, { x: 0, y: 0, w: C, h: B }), rectToWorld(pose, { x: 0, y: 0, w: B, h: C })];
  }
  return isSeatKind(p.kind) ? [rectToWorld(pose, { x: 0, y: 0, w: lengthOf(p, s), h: B })] : [];
}

/** One free piece as a world BuiltPiece (the shape every drawing and the 3D read). */
export function builtFree(p: FreePiece, pose: Pose, s: FreeShared): BuiltPiece {
  const { D } = s;
  const { A, B } = s.dims;
  const L = lengthOf(p, s);
  const poly = (p.kind === 'wedge' ? wedgePolygon(L, D) : rectPoly({ x: 0, y: 0, w: L, h: D })).map((q) => toWorld(pose, q));
  const xs = poly.map((q) => q[0]);
  const ys = poly.map((q) => q[1]);
  const bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const base = { id: p.id, run: null, corner: null, index: null, offset: null, length: L, depth: D, bbox, polygon: poly, splitGroup: null };
  if (p.kind === 'wedge') {
    return { ...base, kind: 'wedge', cushion: null, arm: null, backs: frameZones(p, pose, s), cushionRect: null, height: pieceTop(s) };
  }
  if (p.kind === 'table') {
    return { ...base, kind: 'table', cushion: null, arm: null, backs: [], cushionRect: null, height: s.dims.tableHeight };
  }
  const arm = p.kind === 'oneArm' ? (p.arm ?? 'end') : null;
  const armSpan: [number, number] | null = arm === 'start' ? [0, A] : arm === 'end' ? [L - A, L] : null;
  const cushion: [number, number] = arm === 'start' ? [A, L] : arm === 'end' ? [0, L - A] : [0, L];
  return {
    ...base,
    kind: p.kind,
    cushion: cushion[1] - cushion[0],
    arm: armSpan && arm ? { at: arm, facing: arm === 'start' ? 'LAF' : 'RAF', rect: rectToWorld(pose, { x: armSpan[0], y: 0, w: A, h: D }) } : null,
    backs: [rectToWorld(pose, { x: cushion[0], y: 0, w: cushion[1] - cushion[0], h: B })],
    cushionRect: rectToWorld(pose, { x: cushion[0], y: B, w: cushion[1] - cushion[0], h: D - B }),
    height: pieceTop(s),
  };
}
