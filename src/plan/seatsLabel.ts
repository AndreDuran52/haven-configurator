// The seat label sits in the sofa's opening; a loose piece (ottoman, coffee
// table) may sit there too (QA 2026-11-06: "Seats 6" was printed over both).
// Pure: the label keeps its usual spot unless it would cover a loose piece,
// then takes the nearest clear spot up or down the same column.
import type { Pt } from '@/engine';

export interface LooseBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 2; // inches around a loose piece

/** The label's box: centred on x, baseline at y (bold sans: ~0.6 em per character). */
function labelBox([x, y]: Pt, size: number, chars: number): LooseBox {
  const w = chars * size * 0.6;
  return { x: x - w / 2, y: y - size * 0.8, w, h: size };
}

const hits = (a: LooseBox, b: LooseBox) => a.x < b.x + b.w + PAD && b.x - PAD < a.x + a.w && a.y < b.y + b.h + PAD && b.y - PAD < a.y + a.h;

/** `at` if clear of every loose box, else the nearest clear point with y in [minY + size, maxY]. */
export function clearSeatsAt(at: Pt, loose: LooseBox[], size: number, chars: number, minY: number, maxY: number): Pt {
  const clear = (p: Pt) => !loose.some((b) => hits(labelBox(p, size, chars), b));
  if (!loose.length || clear(at)) return at;
  const step = size / 2;
  for (let i = 1; i < 400; i++) {
    const dy = Math.ceil(i / 2) * step * (i % 2 ? -1 : 1);
    const p: Pt = [at[0], at[1] + dy];
    if (p[1] < minY + size || p[1] > maxY) continue;
    if (clear(p)) return p;
  }
  return at;
}
