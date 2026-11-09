// Switching a layout's shape in place (UX Phase 3c). Kept out of the engine
// index (like shape.ts, sides.ts and tableSize.ts) so it loads with the UI
// that uses it, not in the entry chunk: import it by its own path.
import { half, isSolo, replaceSection, rootConfig, type Layout, type LayoutResult, type Shape } from './index';
import { backShift, setShape } from './shape';

/**
 * Switch the sofa's shape in place (UX Phase 3c, Andre 2026-11-09): the seats
 * stay, the room and Snug stay, and a placed (Custom) room moves with the seats
 * so they stay where they were in it. A T is custom work: it starts fresh.
 */
export function setLayoutShape(l: Layout, shape: Shape): LayoutResult {
  if (!isSolo(l)) return { layout: l, rejected: { code: 'notAllowed', message: 'A T starts fresh' } };
  const c = rootConfig(l);
  const r = setShape(c, shape);
  if (r.rejected) return { layout: l, rejected: r.rejected };
  const out = replaceSection(l, l.sections[0]!.id, r.config);
  const room = l.room;
  if (out.rejected || out.layout === l || room?.at.mode !== 'free') return out;
  const isL = (s: Shape) => s === 'L-left' || s === 'L-right';
  const x = isL(c.shape) && isL(shape) ? half(c.W - room.at.x - room.w) : half(room.at.x + backShift(c, r.config));
  return { layout: { ...out.layout, room: { ...room, at: { ...room.at, x } } }, rejected: null };
}
