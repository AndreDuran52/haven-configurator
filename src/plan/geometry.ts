// Small pure helpers used by the plan drawing: hatch lines and wood grain.
import type { Pt, Rect } from '@/engine';

/** SVG `points` for a polygon, rounded to 0.001". */
export const pts = (poly: Pt[]): string => poly.map(([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`).join(' ');

/** 45° hatch as explicit segments clipped to a rect (no <pattern>, so every SVG->PDF path handles it). */
export function hatch(r: Rect, spacing: number): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  const start = r.x + r.y + spacing / 2;
  for (let c = start; c < r.x + r.w + r.y + r.h; c += spacing) {
    const lo = Math.max(r.x, c - (r.y + r.h));
    const hi = Math.min(r.x + r.w, c - r.y);
    if (hi - lo > 1e-6) out.push([[lo, c - lo], [hi, c - hi]]);
  }
  return out;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic wood grain for a table top, seeded by piece id so it is identical
 * on screen, in every re-render and in the PDF. Grain runs along the longer side.
 * Returns SVG path "d" strings in plan inches.
 */
export function woodGrain(id: string, r: Rect, inset = 1.2, spacing = 2.4): string[] {
  const rand = rng(hashSeed(id));
  const alongX = r.w >= r.h;
  const len = alongX ? r.w : r.h;
  const across = alongX ? r.h : r.w;
  const n = Math.max(3, Math.floor((across - 2 * inset) / spacing));
  const paths: string[] = [];
  for (let i = 0; i <= n; i++) {
    const base = inset + ((across - 2 * inset) * i) / n + (rand() - 0.5) * spacing * 0.35;
    const amp = 0.25 + rand() * 0.45;
    const freq = (Math.PI * 2 * (0.6 + rand() * 0.9)) / len;
    const phase = rand() * Math.PI * 2;
    const pts: string[] = [];
    const steps = 16;
    for (let j = 0; j <= steps; j++) {
      const t = inset + ((len - 2 * inset) * j) / steps;
      const off = base + amp * Math.sin(freq * t + phase);
      const [x, y] = alongX ? [r.x + t, r.y + off] : [r.x + off, r.y + t];
      pts.push(`${j === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    paths.push(pts.join(''));
  }
  // one "cathedral" figure for character
  const cx = 0.35 + rand() * 0.3;
  const cy = 0.4 + rand() * 0.2;
  const a = len * 0.18;
  const bb = across * 0.12;
  const [ex, ey, rx, ry] = alongX ? [r.x + r.w * cx, r.y + r.h * cy, a, bb] : [r.x + r.w * cy, r.y + r.h * cx, bb, a];
  paths.push(
    `M${(ex - rx).toFixed(2)} ${ey.toFixed(2)}a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(2 * rx).toFixed(2)} 0a${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${(-2 * rx).toFixed(2)} 0`,
  );
  return paths;
}
