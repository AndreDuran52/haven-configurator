// Pure presentational plan drawing. Input: buildHaven() output + a dimension layout.
// Never reads component or store state. Returns <g> content so the interactive
// <svg> (screen) and the export <svg> (PDF/PNG) wrap the exact same markup.
// Colours are literal values from `theme` (no CSS variables): svg2pdf cannot resolve var().

import type { BuildResult, BuiltPiece, Pt, Rect } from '../engine/types'
import type { DimLayout } from './dims'
import { fmtIn } from './format'
import { cushionSplits, hatch, woodGrain } from './geometry'

export interface PlanTheme {
  ink: string
  paper: string
  seat: string
  seatDetail: string
  table: string
  tableGrain: string
  dim: string
  gap: string
  warn: string
  select: string
  loose: string
  font: string
  /** 600 on screen; 700 for svg2pdf (it only maps 400/700 to jsPDF normal/bold) */
  bold: 600 | 700
}

export const LIGHT: PlanTheme = {
  ink: '#1c1b19', paper: '#ffffff', seat: '#efebe4', seatDetail: '#e2dccf', table: '#b9936b', tableGrain: '#8a6645',
  dim: '#3d3a35', gap: '#9a948a', warn: '#d99a00', select: '#2f6fed', loose: '#f6f4f0', font: 'Helvetica, Arial, sans-serif', bold: 600,
}
export const SKETCH: PlanTheme = {
  ...LIGHT, seat: '#ffffff', seatDetail: '#ffffff', table: '#ffffff', tableGrain: '#1c1b19', loose: '#ffffff',
}

export interface PlanDrawingProps {
  built: BuildResult
  dims: DimLayout | null
  /** plan inches per display unit (px or pt): converts stroke widths & fonts */
  k: number
  look: 'cad' | 'sketch'
  theme: PlanTheme
  showWarnings: boolean
  selectedId?: string | null
  seatWidth: number
  /** display units: 16 on screen (px), ~10 on paper (pt) */
  seatsSize?: number
  gapLabelSize?: number
}

const pts = (poly: Pt[]) => poly.map(([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`).join(' ')
const R = ({ box: r, ...rest }: { box: Rect } & Omit<React.SVGProps<SVGRectElement>, "r">) => <rect x={r.x} y={r.y} width={r.w} height={r.h} {...rest} />

function alongX(p: BuiltPiece): boolean {
  return p.run === 'back'
}

export function PlanDrawing({ built, dims, k, look, theme, showWarnings, selectedId, seatWidth, seatsSize = 16, gapLabelSize = 11 }: PlanDrawingProps) {
  const lw = (u: number) => +(u * k).toFixed(4) // display units -> plan inches
  const sketch = look === 'sketch'
  const warnIds = new Set(showWarnings ? built.warnings.map((w) => w.pieceId).filter(Boolean) : [])
  const runPieces = (run: string) => built.pieces.filter((p) => p.run === run)
  const wedges = built.pieces.filter((p) => p.kind === 'wedge')
  const loose = built.pieces.filter((p) => p.kind === 'ottoman' || p.kind === 'coffeeTable')

  const piece = (p: BuiltPiece) => {
    const isTable = p.kind === 'table'
    const fill = isTable ? theme.table : p.kind === 'ottoman' || p.kind === 'coffeeTable' ? theme.loose : theme.seat
    return (
      <g key={p.id} data-piece={p.id} data-kind={p.kind}>
        <polygon points={pts(p.polygon)} fill={fill} stroke="none" />
        {/* backs (frame + back cushion). Sketch splits frame 4" / cushion 6" (spec §14 open question) */}
        {p.backs.map((b, i) => (
          <R key={`b${i}`} box={b} fill={theme.seatDetail} stroke={theme.ink} strokeWidth={lw(sketch ? 0.7 : 0.5)} />
        ))}
        {sketch &&
          p.backs.map((b, i) => {
            const frame = 4
            const vertical = b.h > b.w
            const outsideLeft = b.x <= 0.001 || (vertical && b.x < built.W / 2)
            const line: [Pt, Pt] = vertical
              ? outsideLeft ? [[b.x + frame, b.y], [b.x + frame, b.y + b.h]] : [[b.x + b.w - frame, b.y], [b.x + b.w - frame, b.y + b.h]]
              : [[b.x, b.y + frame], [b.x + b.w, b.y + frame]]
            return <line key={`f${i}`} x1={line[0][0]} y1={line[0][1]} x2={line[1][0]} y2={line[1][1]} stroke={theme.ink} strokeWidth={lw(0.4)} />
          })}
        {p.arm && <R box={p.arm.rect} fill={theme.seatDetail} stroke={theme.ink} strokeWidth={lw(sketch ? 0.7 : 0.5)} rx={sketch ? 1.5 : 0} />}
        {p.cushionRect &&
          (sketch
            ? cushionSplits(p.cushionRect, alongX(p), seatWidth).map((c, i) => (
                <R key={`c${i}`} box={{ x: c.x + 0.4, y: c.y + 0.4, w: c.w - 0.8, h: c.h - 0.8 }} rx={1.6} fill="none" stroke={theme.ink} strokeWidth={lw(0.6)} />
              ))
            : null)}
        {p.kind === 'wedge' && sketch && (
          <polygon
            points={pts(wedgeCushion(p, built.D))}
            fill="none"
            stroke={theme.ink}
            strokeWidth={lw(0.6)}
            strokeLinejoin="round"
          />
        )}
        {isTable && (
          <g stroke={theme.tableGrain} strokeWidth={lw(sketch ? 0.35 : 0.3)} fill="none" opacity={sketch ? 1 : 0.55}>
            {woodGrain(p.id, inset(p.bbox, 0.8)).map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        )}
        <polygon points={pts(p.polygon)} fill="none" stroke={theme.ink} strokeWidth={lw(sketch ? 1.1 : 1)} strokeLinejoin="round" />
        {warnIds.has(p.id) && (
          <polygon points={pts(p.polygon)} fill={theme.warn} fillOpacity={0.18} stroke={theme.warn} strokeWidth={lw(2)} />
        )}
        {selectedId === p.id && <polygon points={pts(p.polygon)} fill="none" stroke={theme.select} strokeWidth={lw(2.5)} />}
      </g>
    )
  }

  const font = theme.font
  const text = (x: number, y: number, s: string, size: number, opts: { rotate?: number; weight?: number; fill?: string } = {}) => (
    <text
      x={+x.toFixed(3)}
      y={+y.toFixed(3)}
      fontSize={+size.toFixed(4)}
      fontFamily={font}
      fontWeight={(opts.weight ?? 400) >= 600 ? theme.bold : 400}
      fill={opts.fill ?? theme.dim}
      textAnchor="middle"
      transform={opts.rotate ? `rotate(${opts.rotate} ${+x.toFixed(3)} ${+y.toFixed(3)})` : undefined}
    >
      {s}
    </text>
  )

  // Seats label: centre of the U opening / inside corner of an L
  const seatsAt: Pt =
    built.shape === 'U'
      ? [built.W / 2, built.D + Math.max(built.opening?.depth ?? 0, 20) * 0.45]
      : built.shape === 'L-left'
        ? [built.D + (built.W - built.D) / 2, built.D + (built.L - built.D) / 2]
        : [(built.W - built.D) / 2, built.D + (built.R - built.D) / 2]

  return (
    <g data-plan="">
      {/* per-run groups, drawn from the engine output only */}
      <g data-corners="">{wedges.map(piece)}</g>
      {(['back', 'left', 'right'] as const).map((run) => (
        <g key={run} data-run={run}>
          {runPieces(run).map(piece)}
        </g>
      ))}
      <g data-gaps="">
        {built.gaps.map((g) => {
          const vertical = g.run !== 'back'
          const cx = g.rect.x + g.rect.w / 2
          const cy = g.rect.y + g.rect.h / 2
          return (
            <g key={`${g.run}${g.index}`} data-gap={g.run}>
              <R box={g.rect} fill={theme.paper} stroke="none" />
              <g stroke={theme.gap} strokeWidth={lw(0.6)}>
                {hatch(g.rect, lw(7)).map(([a, b], i) => (
                  <line key={i} x1={+a[0].toFixed(3)} y1={+a[1].toFixed(3)} x2={+b[0].toFixed(3)} y2={+b[1].toFixed(3)} />
                ))}
              </g>
              <R box={g.rect} fill="none" stroke={theme.gap} strokeWidth={lw(1)} strokeDasharray={`${lw(4)} ${lw(3)}`} />
              {/* label on a paper chip so it reads over the hatch */}
              <g>
                {(() => {
                  const label = `unfilled ${fmtIn(g.length)}`
                  const size = lw(gapLabelSize)
                  const w = label.length * size * 0.52 + lw(8)
                  const h = size * 1.35
                  return vertical ? (
                    <>
                      <rect x={cx - h / 2} y={cy - w / 2} width={h} height={w} fill={theme.paper} />
                      {text(cx + size * 0.36, cy, label, size, { rotate: -90, fill: theme.ink, weight: 600 })}
                    </>
                  ) : (
                    <>
                      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={theme.paper} />
                      {text(cx, cy + size * 0.36, label, size, { fill: theme.ink, weight: 600 })}
                    </>
                  )
                })()}
              </g>
            </g>
          )
        })}
      </g>
      <g data-loose="">{loose.map(piece)}</g>
      {dims && <DimsLayer dims={dims} theme={theme} />}
      <g data-seats="">{text(seatsAt[0], seatsAt[1], built.seats.label, lw(seatsSize), { weight: 600, fill: theme.ink })}</g>
    </g>
  )
}

function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d }
}

/** Wedge seat cushion: the wedge polygon minus the two back strips (B = 10). */
function wedgeCushion(p: BuiltPiece, D: number): Pt[] {
  const B = 10
  const [x0, y0] = [p.bbox.x, p.bbox.y]
  const C = p.bbox.w
  const right = p.corner === 'backRight'
  // local polygon for back-left: (B,B) (C,B) (C,D) (D,C) (B,C)
  const local: Pt[] = [[B, B], [C, B], [C, D], [D, C], [B, C]]
  return local.map(([x, y]) => (right ? [x0 + C - x, y0 + y] : [x0 + x, y0 + y]))
}

/** Dimension primitives -> SVG. Shared by the plan, elevations, screen and print. */
export function DimsLayer({ dims, theme }: { dims: DimLayout; theme: PlanTheme }) {
  const f = (n: number) => +n.toFixed(3)
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
        const len = dims.style.arrowLen
        const half = dims.style.arrowHalf
        const [tx, ty] = a.tip
        const [dx, dy] = a.dir
        const bx = tx - dx * len
        const by = ty - dy * len
        const p1: Pt = [bx - dy * half, by + dx * half]
        const p2: Pt = [bx + dy * half, by - dx * half]
        return <polygon key={i} points={pts([a.tip, p1, p2])} fill={theme.dim} stroke="none" />
      })}
      {dims.dots.map((d, i) => (
        <circle key={i} cx={f(d[0])} cy={f(d[1])} r={dims.style.dotR} fill={theme.dim} stroke="none" />
      ))}
      <g stroke="none">
        {dims.texts.map((t, i) => (
          <text
            key={i}
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
  )
}
