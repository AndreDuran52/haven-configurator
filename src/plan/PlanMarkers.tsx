// The plan's numbered seat markers, loaded only when the View menu switches
// them on (they stay out of the entry chunk): the layout's markers
// (engine/seatMarkers.ts) drawn by SeatMarkersLayer in world plan inches.
import { useMemo } from 'react';
import { layoutSeatMarkers, type LayoutBuild, type SeatCountMode } from '@/engine';
import { SeatMarkersLayer } from './SeatMarkersLayer';
import type { PlanTheme } from './theme';

export default function PlanMarkers({ lb, mode, k, theme }: { lb: LayoutBuild; mode: SeatCountMode; k: number; theme: PlanTheme }) {
  const { snug, seatWidth, snugWidth } = mode;
  const points = useMemo(() => layoutSeatMarkers(lb.sections, { snug, seatWidth, snugWidth }), [lb, snug, seatWidth, snugWidth]);
  return <SeatMarkersLayer points={points} k={k} theme={theme} />;
}
