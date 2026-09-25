// Loose pieces (ottoman, coffee table): free rectangles that never touch runs,
// the lock, W/L/R or the seat count.
import { buildHaven } from './buildHaven';
import { CLEARANCE_MIN } from './defaults';
import { LOOSE_DEFAULTS, half } from './pieces';
import { clearanceFor } from './clearance';
import { edit, notAllowed, type Outcome } from './edit';
import type { Config, EditResult, LooseKind, Pt, Rect } from './types';

/** The inside region a loose piece starts in (§5.4). */
function insideRegion(c: Config): Rect {
  const { W, L, R, D } = c;
  if (c.shape === 'U') return { x: D, y: D, w: W - 2 * D, h: Math.min(L, R) - D };
  if (c.shape === 'L-right') return { x: 0, y: D, w: W - D, h: R - D };
  return { x: D, y: D, w: W - D, h: L - D };
}

/** Away from the sofa: out of the U's opening, or away from an L's corner. */
const AWAY: Record<Config['shape'], Pt> = { U: [0, 1], 'L-right': [-1, 1], 'L-left': [1, 1] };
const MAX_PUSH_STEPS = 240;

/**
 * Default position: centred in the inside region; a coffee table is then pushed
 * away from the sofa in 0.5" steps until every clearance is >= 14 (when
 * possible; otherwise the step with the largest clearance, never overlapping).
 */
export function defaultLoosePosition(c: Config, kind: LooseKind, w: number, d: number): Pt {
  const r = insideRegion(c);
  const x0 = half(r.x + (r.w - w) / 2);
  const y0 = half(r.y + (r.h - d) / 2);
  if (kind !== 'coffeeTable') return [x0, y0];
  const sofa = buildHaven(c).pieces.filter((p) => p.run !== null || p.corner !== null);
  const [ax, ay] = AWAY[c.shape];
  let best: { at: Pt; score: number } | null = null;
  for (let k = 0; k <= MAX_PUSH_STEPS; k++) {
    const at: Pt = [x0 + (ax * k) / 2, y0 + (ay * k) / 2];
    const cl = clearanceFor('', { x: at[0], y: at[1], w, h: d }, sofa);
    if (cl.overlap) continue;
    if (cl.min === null || cl.min >= CLEARANCE_MIN) return at;
    if (!best || cl.min > best.score) best = { at, score: cl.min };
  }
  return best?.at ?? [x0, y0];
}

export function addLoose(
  config: Config,
  kind: LooseKind,
  at: Partial<{ x: number; y: number; w: number; d: number }> = {},
): EditResult {
  return edit(config, (d, alloc): Outcome => {
    const w = half(at.w ?? LOOSE_DEFAULTS[kind].w);
    // §4: the coffee table is a free square.
    const dd = kind === 'coffeeTable' ? w : half(at.d ?? LOOSE_DEFAULTS[kind].d);
    if (!(w > 0) || !(dd > 0)) return notAllowed('Size must be positive');
    const [x, y] = at.x !== undefined && at.y !== undefined ? [at.x, at.y] : defaultLoosePosition(config, kind, w, dd);
    d.loose.push({ id: alloc('p'), kind, x: half(at.x ?? x), y: half(at.y ?? y), w, d: dd });
    return true;
  });
}

export function moveLoose(config: Config, id: string, x: number, y: number): EditResult {
  return edit(config, (d): Outcome => {
    const p = d.loose.find((q) => q.id === id);
    if (!p) return notAllowed('No such piece');
    if (p.x === half(x) && p.y === half(y)) return null;
    p.x = half(x);
    p.y = half(y);
    return true;
  });
}

/** The coffee table keeps w = d (one "size" field); the ottoman is a free rectangle. */
export function resizeLoose(config: Config, id: string, w: number, depth: number): EditResult {
  return edit(config, (d): Outcome => {
    const p = d.loose.find((q) => q.id === id);
    if (!p) return notAllowed('No such piece');
    const nw = half(w);
    const nd = p.kind === 'coffeeTable' ? nw : half(depth);
    if (!(nw > 0) || !(nd > 0)) return notAllowed('Size must be positive');
    if (p.w === nw && p.d === nd) return null;
    p.w = nw;
    p.d = nd;
    return true;
  });
}

export function deleteLoose(config: Config, id: string): EditResult {
  return edit(config, (d): Outcome => {
    const i = d.loose.findIndex((q) => q.id === id);
    if (i < 0) return notAllowed('No such piece');
    d.loose.splice(i, 1);
    return true;
  });
}
