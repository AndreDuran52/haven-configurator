// Pure presentational plan drawing (plan §8). Input: buildHaven() output + a
// dimension layout. Never reads component or store state. Returns <g> content so
// the interactive <svg> (screen) and the export <svg> (PDF/PNG, H6) wrap the
// exact same markup. Colours are literal values from `theme` (no CSS variables).
// Group order: wedges, runs, gaps, loose pieces, dimensions, seats.
import type { BuildResult, BuiltPiece, Pt, Rect } from '@/engine';
import type { DimLayout } from './dims';
import { DimsLayer } from './DimsLayer';
import { fmtIn } from './format';
import { hatch, pts, woodGrain } from './geometry';
import type { PlanTheme } from './theme';

export interface PlanDrawingProps {
  built: BuildResult;
  dims: DimLayout | null;
  /** plan inches per display unit (px or pt): converts stroke widths & fonts */
  k: number;
  theme: PlanTheme;
  showWarnings: boolean;
  selectedId?: string | null;
  /** display units: 16 on screen (px), ~10 on paper (pt) */
  seatsSize?: number;
  gapLabelSize?: number;
}

const Box = ({ box: r, ...rest }: { box: Rect } & Omit<React.SVGProps<SVGRectElement>, 'r'>) => (
  <rect x={r.x} y={r.y} width={r.w} height={r.h} {...rest} />
);

const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

export function PlanDrawing({ built, dims, k, theme, showWarnings, selectedId, seatsSize = 16, gapLabelSize = 11 }: PlanDrawingProps) {
  const lw = (u: number) => +(u * k).toFixed(4); // display units -> plan inches
  const warnIds = new Set(showWarnings ? built.warnings.map((w) => w.pieceId).filter(Boolean) : []);
  const runPieces = (run: string) => built.pieces.filter((p) => p.run === run);
  const wedges = built.pieces.filter((p) => p.kind === 'wedge');
  const loose = built.pieces.filter((p) => p.kind === 'ottoman' || p.kind === 'coffeeTable');

  const text = (x: number, y: number, s: string, size: number, opts: { rotate?: number; bold?: boolean; fill?: string } = {}) => (
    <text
      x={+x.toFixed(3)}
      y={+y.toFixed(3)}
      fontSize={+size.toFixed(4)}
      fontFamily={theme.font}
      fontWeight={opts.bold ? theme.bold : 400}
      fill={opts.fill ?? theme.dim}
      textAnchor="middle"
      transform={opts.rotate ? `rotate(${opts.rotate} ${+x.toFixed(3)} ${+y.toFixed(3)})` : undefined}
    >
      {s}
    </text>
  );

  const piece = (p: BuiltPiece) => {
    const isTable = p.kind === 'table';
    const fill = isTable ? theme.table : p.kind === 'ottoman' || p.kind === 'coffeeTable' ? theme.loose : theme.seat;
    return (
      <g key={p.id} data-piece={p.id} data-kind={p.kind}>
        <polygon points={pts(p.polygon)} fill={fill} stroke="none" />
        {p.backs.map((b, i) => (
          <Box key={`b${i}`} box={b} fill={theme.seatDetail} stroke={theme.ink} strokeWidth={lw(0.5)} />
        ))}
        {p.arm && <Box box={p.arm.rect} fill={theme.seatDetail} stroke={theme.ink} strokeWidth={lw(0.5)} />}
        {theme.cushionSeams && p.cushionRect && (
          <Box data-seam="" box={inset(p.cushionRect, 0.75)} fill="none" stroke={theme.ink} strokeWidth={lw(0.5)} rx={1.5} />
        )}
        {isTable && (
          <g stroke={theme.tableGrain} strokeWidth={lw(0.3)} fill="none" opacity={0.55}>
            {woodGrain(p.id, inset(p.bbox, 0.8)).map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        )}
        <polygon points={pts(p.polygon)} fill="none" stroke={theme.ink} strokeWidth={lw(1)} strokeLinejoin="round" />
        {warnIds.has(p.id) && (
          <polygon data-warn="" points={pts(p.polygon)} fill={theme.warn} fillOpacity={0.18} stroke={theme.warn} strokeWidth={lw(2)} />
        )}
        {selectedId === p.id && <polygon points={pts(p.polygon)} fill="none" stroke={theme.select} strokeWidth={lw(2.5)} />}
      </g>
    );
  };

  // Seats label: centre of the U opening / inside corner of an L
  const seatsAt: Pt =
    built.shape === 'U'
      ? [built.W / 2, built.D + Math.max(built.opening?.depth ?? 0, 20) * 0.45]
      : built.shape === 'L-left'
        ? [built.D + (built.W - built.D) / 2, built.D + (built.L - built.D) / 2]
        : [(built.W - built.D) / 2, built.D + (built.R - built.D) / 2];

  return (
    <g data-plan="">
      <g data-corners="">{wedges.map(piece)}</g>
      {(['back', 'left', 'right'] as const).map((run) => (
        <g key={run} data-run={run}>
          {runPieces(run).map(piece)}
        </g>
      ))}
      <g data-gaps="">
        {built.gaps.map((g) => {
          const vertical = g.run !== 'back';
          const cx = g.rect.x + g.rect.w / 2;
          const cy = g.rect.y + g.rect.h / 2;
          const label = `unfilled ${fmtIn(g.length)}`;
          const size = lw(gapLabelSize);
          const w = label.length * size * 0.52 + lw(8);
          const h = size * 1.35;
          return (
            <g key={`${g.run}${g.index}`} data-gap={g.run}>
              <Box box={g.rect} fill={theme.paper} stroke="none" />
              <g stroke={theme.gap} strokeWidth={lw(0.6)}>
                {hatch(g.rect, lw(7)).map(([a, b], i) => (
                  <line key={i} x1={+a[0].toFixed(3)} y1={+a[1].toFixed(3)} x2={+b[0].toFixed(3)} y2={+b[1].toFixed(3)} />
                ))}
              </g>
              <Box box={g.rect} fill="none" stroke={theme.gap} strokeWidth={lw(1)} strokeDasharray={`${lw(4)} ${lw(3)}`} />
              {vertical ? (
                <>
                  <rect x={cx - h / 2} y={cy - w / 2} width={h} height={w} fill={theme.paper} />
                  {text(cx + size * 0.36, cy, label, size, { rotate: -90, fill: theme.ink, bold: true })}
                </>
              ) : (
                <>
                  <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={theme.paper} />
                  {text(cx, cy + size * 0.36, label, size, { fill: theme.ink, bold: true })}
                </>
              )}
            </g>
          );
        })}
      </g>
      <g data-loose="">{loose.map(piece)}</g>
      {dims && <DimsLayer dims={dims} theme={theme} />}
      <g data-seats="">{text(seatsAt[0], seatsAt[1], built.seats.label, lw(seatsSize), { bold: true, fill: theme.ink })}</g>
    </g>
  );
}
