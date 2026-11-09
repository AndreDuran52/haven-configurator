// The numbered seat markers (Andre, 2026-11-09): a circle per seat the count
// gives, numbered round the sofa (engine/seatMarkers.ts), so the markers and
// "Seats N" always agree. Ink on white, sized in display units (screen px or
// paper pt) so they read over Zoom; they take no clicks. Shared by the plan
// and the PDF.
import type { Pt } from '@/engine';
import type { PlanTheme } from './theme';

export function SeatMarkersLayer({ points, k, theme, r = 13, size = 14 }: { points: Pt[]; k: number; theme: PlanTheme; r?: number; size?: number }) {
  const R = +(r * k).toFixed(4);
  const fs = +(size * k).toFixed(4);
  return (
    <g data-markers="" pointerEvents="none">
      {points.map(([x, y], i) => (
        <g key={i} data-marker={i + 1}>
          <circle cx={+x.toFixed(3)} cy={+y.toFixed(3)} r={R} fill={theme.paper} stroke={theme.ink} strokeWidth={+(1.5 * k).toFixed(4)} />
          <text x={+x.toFixed(3)} y={+(y + fs * 0.36).toFixed(3)} fontSize={fs} fontFamily={theme.font} fontWeight={theme.bold} fill={theme.ink} textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}
