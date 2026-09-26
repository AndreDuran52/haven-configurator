// The on-screen plan's viewBox and its exact scale and centre (with the SVG's
// default preserveAspectRatio "xMidYMid meet"). Shared by PlanView and the
// Plan -> 3D parity hand-off, so both use the same numbers.
import type { BuildResult } from '@/engine';
import { fitScreen } from './dimLayout';
import type { DimLayout } from './dims';

export const PLAN_PAD_PX = 12;

export interface PlanFitResult {
  k: number;
  layout: DimLayout;
  viewBox: { x: number; y: number; w: number; h: number };
  /** CSS px per inch as drawn, and the plan point at the view centre */
  S: number;
  cx: number;
  cy: number;
}

export function planFit(built: BuildResult, w: number, h: number): PlanFitResult {
  const { k, layout } = fitScreen(built, w, h, PLAN_PAD_PX);
  const pad = PLAN_PAD_PX * k;
  const b = layout.bounds;
  const viewBox = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
  return { k, layout, viewBox, S: Math.min(w / viewBox.w, h / viewBox.h), cx: viewBox.x + viewBox.w / 2, cy: viewBox.y + viewBox.h / 2 };
}
