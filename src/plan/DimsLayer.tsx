// Dimension primitives -> SVG. Shared by the plan, elevations, screen and print.
import type { Pt } from '@/engine';
import type { DimLayout } from './dims';
import { pts } from './geometry';
import type { PlanTheme } from './theme';

const f = (n: number) => +n.toFixed(3);

export function DimsLayer({ dims, theme }: { dims: DimLayout; theme: PlanTheme }) {
  return (
    <g data-dims="" stroke={theme.dim} fill="none">
      {dims.lines.map((l, i) => (
        <line
          key={i}
          x1={f(l.a[0])}
          y1={f(l.a[1])}
          x2={f(l.b[0])}
          y2={f(l.b[1])}
          strokeWidth={+(dims.style.lineW * (l.kind === 'dim' ? 1 : 0.8)).toFixed(4)}
          strokeDasharray={l.dashed ? `${f(dims.style.lineW * 4)} ${f(dims.style.lineW * 2.7)}` : undefined}
        />
      ))}
      {dims.arrows.map((a, i) => {
        const len = dims.style.arrowLen;
        const half = dims.style.arrowHalf;
        const [tx, ty] = a.tip;
        const [dx, dy] = a.dir;
        const bx = tx - dx * len;
        const by = ty - dy * len;
        const p1: Pt = [bx - dy * half, by + dx * half];
        const p2: Pt = [bx + dy * half, by - dx * half];
        return <polygon key={i} points={pts([a.tip, p1, p2])} fill={theme.dim} stroke="none" />;
      })}
      {dims.dots.map((d, i) => (
        <circle key={i} cx={f(d[0])} cy={f(d[1])} r={dims.style.dotR} fill={theme.dim} stroke="none" />
      ))}
      <g stroke="none">
        {dims.texts.map((t, i) => (
          <text
            key={i}
            data-dim-text=""
            x={f(t.x)}
            y={f(t.y)}
            fontSize={+t.size.toFixed(4)}
            fontFamily={theme.font}
            fontWeight={t.weight >= 600 ? theme.bold : 400}
            fill={theme.dim}
            textAnchor="middle"
            transform={t.rotate ? `rotate(${t.rotate} ${f(t.x)} ${f(t.y)})` : undefined}
          >
            {t.text}
          </text>
        ))}
      </g>
    </g>
  );
}
