// The plan's paper scale (plan §9 "Scale"): the largest architectural scale
// whose plan, with its dimensions, fits the box. Pure.
import type { BuildResult } from '@/engine';
import { layoutDims } from '@/plan/dimLayout';
import { PRINT, type DimLayout } from '@/plan/dims';
import { fmtFtIn, fmtIn } from '@/plan/format';
import type { Box } from './layout';

const LABEL_H = 14;

export const SCALES = [
  { s: 1 / 12, label: '1" = 1\'-0"' },
  { s: 1 / 16, label: '3/4" = 1\'-0"' },
  { s: 1 / 24, label: '1/2" = 1\'-0"' },
  { s: 1 / 32, label: '3/8" = 1\'-0"' },
  { s: 1 / 48, label: '1/4" = 1\'-0"' },
  { s: 1 / 64, label: '3/16" = 1\'-0"' },
  { s: 1 / 96, label: '1/8" = 1\'-0"' },
] as const;

export interface PlanFit {
  S: number;
  label: string;
  dims: DimLayout;
  ox: number;
  oy: number;
}

/** The largest architectural scale whose plan (with its dimensions) fits the box. */
export function fitPlan(b: BuildResult, box: Box): PlanFit {
  const area = { ...box, y: box.y + LABEL_H, h: box.h - LABEL_H };
  const place = (S: number, label: string): PlanFit | null => {
    const dims = layoutDims(b, { ...PRINT, k: 1 / S });
    const w = dims.bounds.w * S;
    const h = dims.bounds.h * S;
    if (w > area.w || h > area.h) return null;
    return { S, label, dims, ox: area.x + (area.w - w) / 2 - dims.bounds.x * S, oy: area.y + (area.h - h) / 2 - dims.bounds.y * S };
  };
  for (const sc of SCALES) {
    const f = place(sc.s * 72, `SCALE ${sc.label}`);
    if (f) return f;
  }
  // Larger than 1/8" = 1'-0" allows: fit the page, and say so.
  let S = (SCALES[SCALES.length - 1]!.s * 72) / 2;
  for (let i = 0; i < 8; i++) {
    const f = place(S, 'NOT TO SCALE (fit to page)');
    if (f) return f;
    S /= 1.5;
  }
  return place(S, 'NOT TO SCALE (fit to page)')!;
}


export function sizesLine(b: BuildResult): string {
  const legs = b.shape === 'U' ? ` x ${fmtIn(b.L)} L x ${fmtIn(b.R)} R` : b.shape === 'L-left' ? ` x ${fmtIn(b.L)} L` : ` x ${fmtIn(b.R)} R`;
  return `${fmtIn(b.W)} W${legs} · ${fmtIn(b.D)} deep · ${fmtFtIn(b.W)} wide`;
}

