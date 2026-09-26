// Live coffee-table clearances (plan §8 "Loose pieces"): a dashed dimension to
// each sofa region, amber under 14″. Editor only (never on the sheets).
import type { BuildResult } from '@/engine';
import { clearanceLines } from './clearanceLines';
import { fmtIn } from './format';
import { LIGHT } from './theme';

export function ClearanceLayer({ built, id, k }: { built: BuildResult; id: string; k: number }) {
  const lines = clearanceLines(built, id);
  const size = 12 * k;
  return (
    <g data-clearance={id} pointerEvents="none">
      {lines.map((l) => {
        const color = l.short ? LIGHT.warn : LIGHT.select;
        const mx = (l.a[0] + l.b[0]) / 2;
        const my = (l.a[1] + l.b[1]) / 2;
        const label = fmtIn(l.dist);
        const w = label.length * size * 0.6 + 8 * k;
        return (
          <g key={l.region} data-region={l.region} data-dist={l.dist} data-short={l.short || undefined}>
            <line x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke={color} strokeWidth={1.5 * k} strokeDasharray={`${4 * k} ${3 * k}`} />
            <circle cx={l.a[0]} cy={l.a[1]} r={2.5 * k} fill={color} />
            <circle cx={l.b[0]} cy={l.b[1]} r={2.5 * k} fill={color} />
            <rect x={mx - w / 2} y={my - size * 0.75} width={w} height={size * 1.5} rx={3 * k} fill={color} />
            <text x={mx} y={my + size * 0.36} fontSize={size} fontFamily={LIGHT.font} fontWeight={700} fill="#fff" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
