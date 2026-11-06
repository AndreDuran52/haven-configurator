// "Move pieces freely" (stage 3): a standard shape or a T becomes one free
// sofa with the same pieces in the same places (one-way; Undo goes back).
// The back run is turned 0°, the right leg 90°, the left leg 270°, the
// back-left wedge 0° and the back-right one 90°; a T's right half hangs off
// the left half's stem, back to back (shared or two backs, as it was).
import { buildHaven } from './buildHaven';
import { corners } from './layout';
import type { Layout } from './layoutTypes';
import type { Config, Rejection, RunPiece } from './types';
import type { AttachAt, FreeLayout, FreePiece, FreeShared, RootAt } from './freeTypes';

export type ToFree = { free: FreeLayout; rejected: null } | { free: null; rejected: Rejection };

const sharedOf = (c: Config): FreeShared => ({
  D: c.D,
  wedgeC: c.wedgeC,
  seatWidth: c.seatWidth,
  snugWidth: c.snugWidth,
  fabric: c.fabric,
  tableFinish: c.tableFinish,
  tableStyle: c.tableStyle,
  dims: { ...c.dims },
});

const refuse = (message: string): ToFree => ({ free: null, rejected: { code: 'notAllowed', message } });

export function toFree(l: Layout): ToFree {
  const [a, b] = l.sections;
  if (!a || l.sections.length > 2 || (b && (b.join?.kind !== 'legs' || a.config.shape !== 'L-right' || b.config.shape !== 'L-left'))) {
    return refuse('Only one sofa or a T can move freely');
  }
  for (const s of l.sections) {
    const built = buildHaven(s.config);
    if (built.gaps.length) return refuse('Fill the gaps first');
    if (built.errors.length) return refuse(built.errors[0]!);
  }
  let n = 0;
  const id = () => `p${++n}`;
  const out: FreePiece[] = [];
  const add = (p: Omit<FreePiece, 'id'>): string => {
    const pid = id();
    out.push({ id: pid, ...p });
    return pid;
  };
  /** A run piece as a free one; the left leg is turned 270°, so its start and end swap. */
  const piece = (p: RunPiece, at: RootAt | AttachAt, flip = false): Omit<FreePiece, 'id'> => {
    const kind = p.kind as Exclude<FreePiece['kind'], 'wedge'>;
    const arm = p.kind === 'oneArm' ? (flip ? (p.arm === 'start' ? 'end' : 'start') : (p.arm ?? 'end')) : undefined;
    return { kind, length: p.length, ...(arm ? { arm } : {}), at };
  };
  /** One section's pieces; `stemParent` hangs a T's right half off the left half's first stem piece. */
  const section = (c: Config, stemParent?: { to: string; sharedBack: boolean }): { firstRight?: string } => {
    const back = c.runs.back ?? [];
    const left = c.runs.left ?? [];
    const right = c.runs.right ?? [];
    const has = corners(c.shape);
    let wl: string | undefined;
    let first: string;
    if (stemParent) {
      // The right half: its stem piece first (back to back), then its wedge above it, then its back run.
      const top = add(piece(left[0]!, { to: stemParent.to, face: 'back', offset: 0, sharedBack: stemParent.sharedBack }, true));
      wl = add({ kind: 'wedge', at: { to: top, face: 'end' } });
      first = add(piece(back[0]!, { to: wl, face: 'a' }));
      let prev = top;
      for (const p of left.slice(1)) prev = add(piece(p, { to: prev, face: 'start' }, true));
    } else if (has.includes('backLeft')) {
      wl = add({ kind: 'wedge', at: { x: 0, y: 0, rot: 0 } });
      first = add(piece(back[0]!, { to: wl, face: 'a' }));
    } else first = add(piece(back[0]!, { x: 0, y: 0, rot: 0 }));
    let last = first;
    for (const p of back.slice(1)) last = add(piece(p, { to: last, face: 'end' }));
    let firstRight: string | undefined;
    if (has.includes('backRight')) {
      const wr = add({ kind: 'wedge', at: { to: last, face: 'end' } });
      let prev = wr;
      right.forEach((p, i) => {
        prev = add(piece(p, { to: prev, face: i === 0 ? 'a' : 'end' }));
        if (i === 0) firstRight = prev;
      });
    }
    if (wl && !stemParent) {
      let prev = wl;
      left.forEach((p, i) => (prev = add(piece(p, { to: prev, face: i === 0 ? 'b' : 'start' }, true))));
    }
    return { firstRight };
  };
  const root = a.config;
  const { firstRight } = section(root);
  if (b) section(b.config, { to: firstRight!, sharedBack: b.join!.sharedBack });
  const loose = root.loose.map((p) => ({ ...p, id: id() }));
  return { free: { schema: 1, kind: 'free', shared: sharedOf(root), pieces: out, loose, nextId: n + 1 }, rejected: null };
}
