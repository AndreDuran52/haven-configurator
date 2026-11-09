// Same both sides of a U (UX Phase 3c, Andre 2026-11-09, Q60): "Copy left to
// right" and "Copy right to left". A mirror copy: the other leg gets the same
// pieces (legs run from their corner, so a copy is a mirror) and the same side
// length; after that each side edits on its own.
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

/** Copy one side of a U onto the other. Same reference when they already match. */
export function copySide(config: Config, from: Side): EditResult {
  return edit(config, (d, alloc): Outcome => {
    if (d.shape !== 'U') return notAllowed('Only a U has two sides');
    if (sidesMatch(d)) return null;
    const to: Side = from === 'left' ? 'right' : 'left';
    d.runs[to] = cloneRun(d.runs[from]!, alloc);
    if (from === 'left') d.R = d.L;
    else d.L = d.R;
    return true;
  });
}
