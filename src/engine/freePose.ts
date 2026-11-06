// Freeform: every piece's world pose, derived from the roots through the
// attachments (stage 3). Bad attachments (a missing parent, a loop, a face used
// twice, an arm face, a face that can't fit) are errors, never thrown.
import { armFace, attachPose } from './freeGeom';
import type { FaceId, FreeLayout, FreePiece, Pose, RootAt } from './freeTypes';

export const isRoot = (at: FreePiece['at']): at is RootAt => 'rot' in at;

export interface Derived {
  poses: Map<string, Pose>;
  /** The face an attached piece touches its parent with. */
  childFace: Map<string, FaceId>;
  /** Children by parent id, in stored order. */
  children: Map<string, FreePiece[]>;
  /** The end faces in use on each piece (by its parent or a child; backs are not ends). */
  used: Map<string, Set<FaceId>>;
  errors: string[];
}

export function derivePoses(f: FreeLayout): Derived {
  const byId = new Map(f.pieces.map((p) => [p.id, p]));
  const poses = new Map<string, Pose>();
  const childFace = new Map<string, FaceId>();
  const children = new Map<string, FreePiece[]>();
  const used = new Map<string, Set<FaceId>>();
  const errors: string[] = [];
  if (byId.size !== f.pieces.length) errors.push('two pieces share an id');
  const occupy = (id: string, face: FaceId) => {
    if (face === 'back') return;
    const set = used.get(id) ?? new Set<FaceId>();
    if (set.has(face)) errors.push(`face ${face} of ${id} is used twice`);
    set.add(face);
    used.set(id, set);
  };
  for (const p of f.pieces) {
    if (isRoot(p.at)) continue;
    if (!byId.has(p.at.to)) errors.push(`${p.id} is attached to a missing piece`);
    else children.set(p.at.to, [...(children.get(p.at.to) ?? []), p]);
  }
  const queue: FreePiece[] = [];
  for (const p of f.pieces) {
    if (!isRoot(p.at)) continue;
    poses.set(p.id, { x: p.at.x, y: p.at.y, rot: p.at.rot });
    queue.push(p);
  }
  while (queue.length) {
    const parent = queue.shift()!;
    for (const child of children.get(parent.id) ?? []) {
      const at = child.at as Exclude<FreePiece['at'], RootAt>;
      if (at.face !== 'back' && armFace(parent) === at.face) errors.push(`${child.id} is attached to an arm`);
      const r = attachPose(parent, poses.get(parent.id)!, child, at, f.shared);
      if (!r) {
        errors.push(`${child.id} can't attach to face ${at.face} of ${parent.id}`);
        continue;
      }
      if (armFace(child) === r.face) errors.push(`${child.id} is attached by its arm`);
      occupy(parent.id, at.face);
      occupy(child.id, r.face);
      poses.set(child.id, r.pose);
      childFace.set(child.id, r.face);
      queue.push(child);
    }
  }
  for (const p of f.pieces) if (!poses.has(p.id) && !errors.some((e) => e.startsWith(p.id))) errors.push(`${p.id} is not attached to any sofa`);
  return { poses, childFace, children, used, errors };
}
