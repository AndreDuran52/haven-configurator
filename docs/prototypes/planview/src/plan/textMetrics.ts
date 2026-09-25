// Deterministic text widths so dimension layout is pure (no DOM getBBox /
// canvas.measureText), identical in vitest, on screen and in the PDF.
// Advance widths per 1000 em from the Helvetica AFM (what jsPDF's standard
// "helvetica" font uses). Unknown glyphs fall back to a conservative 667.

const HELVETICA: Record<string, number> = {
  ' ': 278, '"': 355, "'": 191, '(': 333, ')': 333, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  '×': 584, '½': 834, '–': 556, '·': 278,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, L: 556, R: 722, S: 667, W: 944, U: 722,
  a: 556, d: 556, e: 556, f: 278, h: 556, i: 222, l: 222, n: 556, o: 556, p: 556, r: 333, s: 500, t: 278, u: 556, w: 722,
}

export const CAP_HEIGHT = 0.718 // Helvetica cap height, em

/**
 * Width in the same units as `size`. `scale` > 1 pads for the screen font
 * (Geist / system-ui digits run ~5–8% wider than Helvetica).
 */
export function textWidth(s: string, size: number, scale = 1): number {
  let w = 0
  for (const ch of s) w += HELVETICA[ch] ?? 667
  return (w / 1000) * size * scale
}
