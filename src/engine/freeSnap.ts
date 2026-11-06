// Freeform snapping (stage 3): where a piece can go. Every open end face of a
// seat or table (not an arm), both faces of a wedge, and a seat's back (back to
// back, lined up with either end). A target that would overlap is left out.
// Wedges only meet seats and tables (never another wedge).
import { overlapping } from './freeBuild';
import { armFace, attachPose, builtFree, endFaces, frameZones, isSeatKind, lengthOf, toWorld } from './freeGeom';
import { derivePoses } from './freePose';
import { ARMLESS_DEFAULT, ONE_ARM_SEAT_DEFAULT, TABLE_DEFAULT } from './pieces';
import type { AttachAt, FaceId, FreeLayout, FreePiece, FreeShared, FreeSpec, Target } from './freeTypes';
import type { Pt } from './types';

/** A new piece of a spec (default lengths as the tray's; a one-arm seat's arm defaults to its end). */
export function pieceOf(spec: FreeSpec, s: FreeShared, id: string): FreePiece {
  if (spec.kind === 'wedge') return { id, kind: 'wedge', at: { x: 0, y: 0, rot: 0 } };
  const length = spec.length ?? (spec.kind === 'armless' ? ARMLESS_DEFAULT : spec.kind === 'oneArm' ? ONE_ARM_SEAT_DEFAULT + s.dims.A : TABLE_DEFAULT);
  return { id, kind: spec.kind, length, ...(spec.kind === 'oneArm' ? { arm: spec.arm ?? 'end' } : {}), at: { x: 0, y: 0, rot: 0 } };
}

/** The end faces nothing uses yet (no arm faces). */
export function openFaces(f: FreeLayout): { id: string; face: FaceId; back: Pt; front: Pt }[] {
  const d = derivePoses(f);
  const out: { id: string; face: FaceId; back: Pt; front: Pt }[] = [];
  for (const p of f.pieces) {
    const pose = d.poses.get(p.id);
    if (!pose) continue;
    for (const [face, ef] of Object.entries(endFaces(p, f.shared)) as [FaceId, { back: Pt; front: Pt }][]) {
      if (d.used.get(p.id)?.has(face) || armFace(p) === face) continue;
      out.push({ id: p.id, face, back: toWorld(pose, ef.back), front: toWorld(pose, ef.front) });
    }
  }
  return out;
}

/** Every place a piece of `spec` can snap to in `f` (none if `f` itself doesn't lay out). */
export function snapTargets(f: FreeLayout, spec: FreeSpec): Target[] {
  const s = f.shared;
  const d = derivePoses(f);
  if (d.errors.length) return [];
  const child = pieceOf(spec, s, '__new');
  const byId = new Map(f.pieces.map((p) => [p.id, p]));
  const placed = f.pieces.map((p) => ({ b: builtFree(p, d.poses.get(p.id)!, s), z: frameZones(p, d.poses.get(p.id)!, s) }));
  const out: Target[] = [];
  const tryAt = (parent: FreePiece, at: AttachAt, anchor: Pt) => {
    const r = attachPose(parent, d.poses.get(parent.id)!, child, at, s);
    if (!r || armFace(child) === r.face) return;
    const b = builtFree(child, r.pose, s);
    const z = frameZones(child, r.pose, s);
    if (placed.some((q) => overlapping(b, z, q.b, q.z))) return;
    out.push({ ...at, pose: r.pose, anchor });
  };
  for (const o of openFaces(f)) {
    const parent = byId.get(o.id)!;
    if (parent.kind === 'wedge' && child.kind === 'wedge') continue;
    tryAt(parent, { to: o.id, face: o.face }, [(o.back[0] + o.front[0]) / 2, (o.back[1] + o.front[1]) / 2]);
  }
  if (isSeatKind(child.kind)) {
    const Lc = lengthOf(child, s);
    for (const p of f.pieces) {
      if (!isSeatKind(p.kind)) continue;
      const Lp = lengthOf(p, s);
      for (const offset of [...new Set([0, Lp - Lc])]) {
        tryAt(p, { to: p.id, face: 'back', offset, sharedBack: false }, toWorld(d.poses.get(p.id)!, [offset + Lc / 2, 0]));
      }
    }
  }
  return out;
}
