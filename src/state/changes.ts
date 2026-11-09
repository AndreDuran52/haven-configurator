// The result line (UX Phase 3, Andre 2026-11-08): after an edit, say what
// changed in plain words, so the client sharing the screen sees it too, e.g.
// "Table 20″ → 24″ · Seats 26½″ | 26½″ → 24½″ | 24½″" or "Width 188″ → 200″".
// Pure: compares the layout before the edit (or before a coalesced burst) with
// the layout after it. Seats are shown as their cushions (an arm is not seat).
import { buildLayout, cushionOf, finishOf, sectionLabel, type Config, type Layout, type RunPiece } from '@/engine';
import { fmtIn } from '@/plan/format';

const inch = (x: number) => `${fmtIn(x, { mark: false })}″`;
const arrow = (a: string, b: string) => `${a} → ${b}`;
const MAX_ITEMS = 4;

const KIND: Record<RunPiece['kind'], string> = { armless: 'Seat', oneArm: 'Seat', table: 'Table', gap: 'Gap' };
const sizeOf = (p: RunPiece, A: number) => (p.kind === 'armless' || p.kind === 'oneArm' ? cushionOf(p, A) : p.length);

/** Sofa-wide fields, in reading order. */
function fieldChanges(a: Config, b: Config, items: string[]) {
  const legs = b.shape === 'U' ? ['L', 'R'] : b.shape === 'L-left' ? ['L'] : b.shape === 'L-right' ? ['R'] : [];
  if (a.W !== b.W) items.push(arrow(`Width ${inch(a.W)}`, inch(b.W)));
  if (legs.includes('L') && a.L !== b.L) items.push(arrow(`Left side ${inch(a.L)}`, inch(b.L)));
  if (legs.includes('R') && a.R !== b.R) items.push(arrow(`Right side ${inch(a.R)}`, inch(b.R)));
  if (a.D !== b.D) items.push(arrow(`Depth ${inch(a.D)}`, inch(b.D)));
  if (a.dims.A !== b.dims.A) items.push(arrow(`Arms ${inch(a.dims.A)}`, inch(b.dims.A)));
  if (a.lockOutside !== b.lockOutside) items.push(b.lockOutside ? 'Other seats adjust' : 'Sofa size changes');
  if (a.tableFinish !== b.tableFinish) items.push(`Wood: ${finishOf(b.tableFinish).name}`);
  if (a.tableStyle !== b.tableStyle) items.push(`Tables: ${b.tableStyle === 'standard' ? 'wood top' : 'all wood'}`);
}

/**
 * Pieces by id: a size change reads "Table 20″ → 24″"; a table's two seats,
 * when both change, read as one pair "Seats 26½″ | 26½″ → 24½″ | 24½″".
 */
function pieceChanges(a: Config, b: Config, items: string[]) {
  for (const run of ['back', 'left', 'right'] as const) {
    const before = new Map((a.runs[run] ?? []).map((p) => [p.id, p]));
    const after = b.runs[run] ?? [];
    const seen = new Set<string>();
    after.forEach((p, i) => {
      if (seen.has(p.id)) return;
      const q = before.get(p.id);
      if (!q) {
        if (p.kind === 'table' || !after.some((t) => t.kind === 'table' && p.joinedBy === t.id)) items.push(`Added ${KIND[p.kind].toLowerCase()} ${inch(sizeOf(p, b.dims.A))}`);
        return;
      }
      const s0 = sizeOf(q, a.dims.A);
      const s1 = sizeOf(p, b.dims.A);
      if (s0 === s1) return;
      // A table between two seats that both changed: one pair line.
      const next = after[i + 2];
      const mid = after[i + 1];
      const qn = next && before.get(next.id);
      // A seat just split around a new table: its two halves.
      if (p.kind !== 'table' && mid?.kind === 'table' && next && !qn && next.joinedBy === mid.id) {
        items.push(`Seats ${inch(s1)} | ${inch(sizeOf(next, b.dims.A))}`);
        seen.add(next.id);
        return;
      }
      if (p.kind !== 'table' && mid?.kind === 'table' && next && next.kind !== 'table' && next.kind !== 'gap' && qn && sizeOf(qn, a.dims.A) !== sizeOf(next, b.dims.A)) {
        items.push(arrow(`Seats ${inch(s0)} | ${inch(sizeOf(qn, a.dims.A))}`, `${inch(s1)} | ${inch(sizeOf(next, b.dims.A))}`));
        seen.add(next.id);
        return;
      }
      items.push(arrow(`${KIND[p.kind]} ${inch(s0)}`, inch(s1)));
    });
    const now = new Set(after.map((p) => p.id));
    for (const q of a.runs[run] ?? []) if (!now.has(q.id) && q.kind !== 'gap') items.push(`Removed ${KIND[q.kind].toLowerCase()}`);
  }
  const loose = new Set(b.loose.map((l) => l.id));
  const was = new Map(a.loose.map((l) => [l.id, l]));
  const name = (k: string) => (k === 'ottoman' ? 'ottoman' : 'coffee table');
  for (const l of b.loose) {
    const q = was.get(l.id);
    if (!q) items.push(`Added ${name(l.kind)}`);
    else if (q.w !== l.w || q.d !== l.d) items.push(arrow(`${name(l.kind)[0]!.toUpperCase()}${name(l.kind).slice(1)} ${inch(q.w)} x ${inch(q.d)}`, `${inch(l.w)} x ${inch(l.d)}`));
    else if (q.x !== l.x || q.y !== l.y) items.push(`Moved the ${name(l.kind)}`);
  }
  for (const q of a.loose) if (!loose.has(q.id)) items.push(`Removed the ${name(q.kind)}`);
}

function roomChanges(a: Layout, b: Layout, items: string[]) {
  const r0 = a.room;
  const r1 = b.room;
  if (!r0 && r1) return void items.push(`Room ${inch(r1.w)} x ${inch(r1.d)}`);
  if (r0 && !r1) return void items.push('Room removed');
  if (!r0 || !r1) return;
  if (r0.w !== r1.w) items.push(arrow(`Room width ${inch(r0.w)}`, inch(r1.w)));
  if (r0.d !== r1.d) items.push(arrow(`Room length ${inch(r0.d)}`, inch(r1.d)));
  if (JSON.stringify(r0.at) === JSON.stringify(r1.at)) return;
  if (r0.at.mode === 'free' && r1.at.mode === 'free') return void moved(r0.at.x - r1.at.x, r0.at.y - r1.at.y, items);
  items.push(r1.at.mode === 'center' ? 'Sofa centred in the room' : r1.at.mode === 'backWall' ? 'Sofa on the back wall' : 'Sofa placed in the room');
}

/** Phase 3b: the sofa moved in the room (the room moved the other way). */
function moved(dx: number, dy: number, items: string[]) {
  if (dx) items.push(`Sofa moved ${inch(Math.abs(dx))} ${dx > 0 ? 'right' : 'left'}`);
  if (dy) items.push(`Sofa moved ${inch(Math.abs(dy))} ${dy > 0 ? 'toward the front' : 'toward the back'}`);
}

/** What changed from `a` to `b`, in a line; null when nothing a client would see changed. */
export function describeChange(a: Layout, b: Layout): string | null {
  if (a === b) return null;
  const items: string[] = [];
  const multi = b.sections.length > 1;
  for (const s of b.sections) {
    const before = a.sections.find((x) => x.id === s.id);
    if (!before || before.config.shape !== s.config.shape) return null; // a new sofa: the toast says so
    const own: string[] = [];
    fieldChanges(before.config, s.config, own);
    pieceChanges(before.config, s.config, own);
    // Shared fields (depth, arms, look) are said once, for the first half.
    items.push(...(multi && s.id !== b.sections[0]!.id ? own.filter((x) => !items.includes(x)).map((x) => `${sectionLabel(b, s.id)}: ${x}`) : own));
  }
  roomChanges(a, b, items);
  const s0 = buildLayout(a).seats.label;
  const s1 = buildLayout(b).seats.label;
  if (s0 !== s1) items.push(arrow(s0, s1.replace(/^Seats /, '')));
  if (!items.length) return null;
  const shown = items.slice(0, MAX_ITEMS);
  return shown.join(' · ') + (items.length > MAX_ITEMS ? ` · +${items.length - MAX_ITEMS} more` : '');
}
