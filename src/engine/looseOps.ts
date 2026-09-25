// Loose pieces (ottoman, coffee table): free rectangles, never in a run.
import { LOOSE_DEFAULTS, half } from './pieces';
import { edit } from './ops';
import type { Config, LooseKind } from './types';

// ---------------------------------------------------------------------------
// Loose pieces (ottoman, coffee table): free rectangles, never in a run.

export function addLoose(
  config: Config,
  kind: LooseKind,
  at: Partial<{ x: number; y: number; w: number; d: number }> = {},
): Config {
  return edit(config, (d, alloc) => {
    const w = half(at.w ?? LOOSE_DEFAULTS[kind].w);
    const dd = half(at.d ?? LOOSE_DEFAULTS[kind].d);
    // Default spot: centred in the U opening; for an L, centred in front of the back.
    const openDepth = d.shape === 'U' ? Math.min(d.L, d.R) - d.D : 2 * dd;
    const x = half(at.x ?? (d.W - w) / 2);
    const y = half(at.y ?? d.D + (openDepth - dd) / 2);
    d.loose.push({ id: alloc('p'), kind, x, y, w, d: dd });
    return true;
  });
}

export function moveLoose(config: Config, id: string, x: number, y: number): Config {
  return edit(config, (d) => {
    const p = d.loose.find((q) => q.id === id);
    if (!p || (p.x === half(x) && p.y === half(y))) return false;
    p.x = half(x);
    p.y = half(y);
    return true;
  });
}

export function resizeLoose(config: Config, id: string, w: number, depth: number): Config {
  return edit(config, (d) => {
    const p = d.loose.find((q) => q.id === id);
    if (!p || !(half(w) > 0) || !(half(depth) > 0)) return false;
    p.w = half(w);
    p.d = half(depth);
    return true;
  });
}

export function deleteLoose(config: Config, id: string): Config {
  return edit(config, (d) => {
    const i = d.loose.findIndex((q) => q.id === id);
    if (i < 0) return false;
    d.loose.splice(i, 1);
    return true;
  });
}
