// Same both sides of a U (UX Phase 3c, Andre 2026-11-09, Q60, Q71): the
// "Mirror sides" switch. A mirror copy: the other leg gets the same pieces
// (legs run from their corner, so a copy is a mirror) and the same side length.
// While the switch is on, every edit to one side is made to the other too
// (mirrorSides, applied by the store); switched on with different sides, the
// left is copied to the right.
import { edit, notAllowed, type Config, type EditResult, type Outcome, type RunPiece } from './index';
import { cloneRun } from './shape';

type Side = 'left' | 'right';

const look = (p: RunPiece) => `${p.kind}:${p.length}:${p.arm ?? ''}:${p.splitGroup ? 's' : ''}:${p.joinedBy ? 'j' : ''}`;

/** True when both legs of a U are already the same (sizes and pieces). */
export function sidesMatch(c: Config): boolean {
  if (c.shape !== 'U') return true;
  const [l, r] = [c.runs.left ?? [], c.runs.right ?? []];
  return c.L === c.R && l.length === r.length && l.every((p, i) => look(p) === look(r[i]!));
}

/** Same pieces in the same order (sizes aside): a copy then only changes lengths and keeps every id. */
const shape = (p: RunPiece) => `${p.kind}:${p.arm ?? ''}:${p.splitGroup ? 's' : ''}:${p.joinedBy ? 'j' : ''}`;
const sameStructure = (a: RunPiece[], b: RunPiece[]) => a.length === b.length && a.every((p, i) => shape(p) === shape(b[i]!));

/**
 * Copy one side of a U onto the other. When the two sides have the same pieces
 * in the same order, the other side keeps its own pieces (ids, joins) and only
 * takes the lengths, so a selection and the result line follow the change.
 * Same reference when they already match.
 */
export function copySide(config: Config, from: Side): EditResult {
  return edit(config, (d, alloc): Outcome => {
    if (d.shape !== 'U') return notAllowed('Only a U has two sides');
    if (sidesMatch(d)) return null;
    const to: Side = from === 'left' ? 'right' : 'left';
    const src = d.runs[from]!;
    const dst = d.runs[to]!;
    d.runs[to] = sameStructure(src, dst) ? dst.map((p, i) => ({ ...p, length: src[i]!.length })) : cloneRun(src, alloc);
    if (from === 'left') d.R = d.L;
    else d.L = d.R;
    return true;
  });
}

/**
 * Mirror sides (the switch on): after an edit from `before` to `after`, make
 * the two sides of a U the same again. The side that changed is copied; when
 * only the right changed, right to left, otherwise left to right. Anything that
 * can't be copied, any other shape, or sides already alike: `after` as it is.
 */
export function mirrorSides(before: Config, after: Config): Config {
  if (after.shape !== 'U' || sidesMatch(after)) return after;
  const changed = (side: Side) => (side === 'left' ? before.L !== after.L : before.R !== after.R) || JSON.stringify(before.runs[side]) !== JSON.stringify(after.runs[side]);
  const from: Side = before.shape === 'U' && changed('right') && !changed('left') ? 'right' : 'left';
  const r = copySide(after, from);
  return r.rejected ? after : r.config;
}
