// Letter-landscape sheets as ONE SVG in points (792 x 612). The plan (plan inches) is
// placed with transform="translate() scale(S)" where S = paperScale * 72 pt per inch,
// so the printed drawing is exactly to scale at 100%. The same SVG feeds jsPDF+svg2pdf
// (vector PDF) and <canvas> (PNG).

import type { BuildResult, Config } from '../engine/types'
import { layoutDims, layoutGroups, PRINT, type DimLayout } from '../plan/dims'
import { elevation, type Elevation } from '../plan/elevation'
import { fmtFtIn, fmtIn } from '../plan/format'
import { DimsLayer, PlanDrawing, SKETCH, LIGHT, type PlanTheme } from '../plan/PlanDrawing'

export const PAGE = { w: 792, h: 612, margin: 30, titleH: 58 }

export const SCALES = [
  { s: 1 / 12, label: '1" = 1\'-0"' },
  { s: 1 / 16, label: '3/4" = 1\'-0"' },
  { s: 1 / 24, label: '1/2" = 1\'-0"' },
  { s: 1 / 32, label: '3/8" = 1\'-0"' },
  { s: 1 / 48, label: '1/4" = 1\'-0"' },
  { s: 1 / 64, label: '3/16" = 1\'-0"' },
  { s: 1 / 96, label: '1/8" = 1\'-0"' },
] as const

/** Raster from the ORTHO camera: known px-per-inch and the world rect it covers. */
export interface OrthoRender {
  url: string
  pxW: number
  pxH: number
  pxPerInch: number
  /** world inches covered: horizontal u0..u1 (plan x for front), vertical z0..z1 */
  u0: number
  z0: number
}

export interface SheetProps {
  kind: 'client' | 'shop'
  built: BuildResult
  config: Config
  meta: { client: string; project: string; date: string; link: string }
  look: 'cad' | 'sketch'
  /** client sheet: shaded ortho front elevation, placed to scale under the plan */
  frontRender?: OrthoRender
  /** client sheet: 3/4 axonometric render (not to scale) */
  isoRender?: { url: string; pxW: number; pxH: number }
}

interface Fit {
  S: number
  label: string
  plan: DimLayout
  elev: { e: Elevation; dims: DimLayout } | null
  ox: number
  planOy: number
  elevOy: number
}

function fitSheet(p: SheetProps, area: { x: number; y: number; w: number; h: number }): Fit {
  const labelH = 14
  const gap = 16
  for (const sc of SCALES) {
    const S = sc.s * 72
    const k = 1 / S
    const plan = layoutDims(p.built, { ...PRINT, k })
    let elev: Fit['elev'] = null
    let ex0 = plan.bounds.x, ex1 = plan.bounds.x + plan.bounds.w, eh = 0, ey0 = 0
    if (p.kind === 'shop') {
      const e = elevation(p.built, p.config.dims, 'front')
      const dims = layoutGroups(e.groups, e.frame, { ...PRINT, k })
      elev = { e, dims }
      ex0 = Math.min(ex0, dims.bounds.x)
      ex1 = Math.max(ex1, dims.bounds.x + dims.bounds.w)
      eh = dims.bounds.h
      ey0 = dims.bounds.y
    } else if (p.frontRender) {
      const r = p.frontRender
      const u1 = r.u0 + r.pxW / r.pxPerInch
      ex0 = Math.min(ex0, r.u0)
      ex1 = Math.max(ex1, u1)
      eh = r.pxH / r.pxPerInch
      ey0 = -(r.z0 + eh) // top of the render in drawing coords (y = -z)
    }
    const wPt = (ex1 - ex0) * S
    const hPt = labelH + plan.bounds.h * S + (eh ? gap + labelH + eh * S : 0)
    if (wPt <= area.w && hPt <= area.h) {
      const ox = area.x + (area.w - wPt) / 2 - ex0 * S
      const planTop = area.y + (area.h - hPt) / 2 + labelH
      const planOy = planTop - plan.bounds.y * S
      const elevTop = planTop + plan.bounds.h * S + gap + labelH
      const elevOy = elevTop - ey0 * S
      return { S, label: sc.label, plan, elev, ox, planOy, elevOy }
    }
  }
  throw new Error('drawing does not fit at 1/8" = 1\'-0"')
}

function ScaleBar({ x, y, S, font }: { x: number; y: number; S: number; font: string }) {
  // choose a bar length (feet) that is 90–170pt long
  const ft = [2, 4, 5, 8, 10, 16, 20, 40].find((f) => f * 12 * S >= 90) ?? 40
  const step = ft <= 8 ? 1 : ft <= 20 ? 2 : 5
  const segs = []
  for (let i = 0; i < ft; i += step) {
    segs.push(<rect key={i} x={x + i * 12 * S} y={y} width={step * 12 * S} height={4} fill={(i / step) % 2 ? '#fff' : '#1c1b19'} stroke="#1c1b19" strokeWidth={0.4} />)
  }
  return (
    <g>
      {segs}
      {[0, ft / 2, ft].map((f) => (
        <text key={f} x={x + f * 12 * S} y={y + 12} fontSize={6} fontFamily={font} textAnchor="middle" fill="#1c1b19">
          {`${f}'`}
        </text>
      ))}
    </g>
  )
}

export function Sheet(p: SheetProps) {
  const theme: PlanTheme = { ...(p.look === 'sketch' ? SKETCH : LIGHT), bold: 700, font: 'Helvetica, sans-serif' }
  const font = 'Helvetica, sans-serif'
  const m = PAGE.margin
  const rightCol = p.kind === 'client' && p.isoRender ? 190 : 0
  const area = { x: m, y: m, w: PAGE.w - 2 * m - rightCol, h: PAGE.h - 2 * m - PAGE.titleH - 8 }
  const fit = fitSheet(p, area)
  const { S } = fit
  const b = p.built
  const tb = { x: m, y: PAGE.h - m - PAGE.titleH, w: PAGE.w - 2 * m, h: PAGE.titleH }
  const shape = b.shape === 'U' ? 'Haven U' : b.shape === 'L-left' ? 'Haven L (left)' : 'Haven L (right)'
  const sizes = b.shape === 'U' ? `${fmtIn(b.W)} W × ${fmtIn(b.L)} L × ${fmtIn(b.R)} R` : b.shape === 'L-left' ? `${fmtIn(b.W)} W × ${fmtIn(b.L)} L` : `${fmtIn(b.W)} W × ${fmtIn(b.R)} R`
  const T = (x: number, y: number, s: string, size: number, o: { w?: number; a?: 'start' | 'middle' | 'end'; fill?: string } = {}) => (
    <text x={x} y={y} fontSize={size} fontFamily={font} fontWeight={(o.w ?? 400) >= 600 ? 700 : 400} textAnchor={o.a ?? 'start'} fill={o.fill ?? '#1c1b19'}>
      {s}
    </text>
  )
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={PAGE.w} height={PAGE.h} viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}>
      <rect x={0} y={0} width={PAGE.w} height={PAGE.h} fill="#ffffff" />
      {/* PLAN */}
      {T(fit.ox + fit.plan.bounds.x * S, fit.planOy + fit.plan.bounds.y * S - 5, 'PLAN', 7, { w: 600 })}
      <g transform={`translate(${fit.ox.toFixed(3)} ${fit.planOy.toFixed(3)}) scale(${S})`}>
        <PlanDrawing built={b} dims={fit.plan} k={1 / S} look={p.look} theme={theme} showWarnings={p.kind === 'shop'} seatWidth={p.config.seatWidth} seatsSize={10} gapLabelSize={7} />
      </g>
      {/* FRONT ELEVATION: vector (shop) or ortho raster (client), x-aligned with the plan (third-angle) */}
      {fit.elev && (
        <>
          {T(fit.ox + fit.elev.dims.bounds.x * S, fit.elevOy + fit.elev.dims.bounds.y * S - 5, 'FRONT ELEVATION (from the open end)', 7, { w: 600 })}
          <g transform={`translate(${fit.ox.toFixed(3)} ${fit.elevOy.toFixed(3)}) scale(${S})`}>
            <ElevationDrawing elev={fit.elev.e} k={1 / S} theme={theme} />
            <DimsLayer dims={fit.elev.dims} theme={theme} />
          </g>
        </>
      )}
      {!fit.elev && p.frontRender && (() => {
        const r = p.frontRender
        const wIn = r.pxW / r.pxPerInch
        const hIn = r.pxH / r.pxPerInch
        const x = fit.ox + r.u0 * S
        const y = fit.elevOy - (r.z0 + hIn) * S
        return (
          <>
            {T(x, y - 5, 'FRONT ELEVATION', 7, { w: 600 })}
            <image href={r.url} x={x.toFixed(3)} y={y.toFixed(3)} width={(wIn * S).toFixed(3)} height={(hIn * S).toFixed(3)} preserveAspectRatio="none" />
          </>
        )
      })()}
      {/* 3/4 view column (client) */}
      {rightCol > 0 && p.isoRender && (() => {
        const r = p.isoRender
        const w = rightCol - 10
        const h = (w * r.pxH) / r.pxW
        const x = PAGE.w - m - rightCol + 10
        return (
          <g>
            {T(x, m + 8, '3/4 VIEW (axonometric, not to scale)', 7, { w: 600 })}
            <image href={r.url} x={x} y={m + 14} width={w} height={h.toFixed(3)} preserveAspectRatio="xMidYMid meet" />
            {T(x, m + 14 + h + 22, b.seats.label, 16, { w: 600 })}
            {T(x, m + 14 + h + 40, `Depth ${fmtIn(b.D)} · seat depth ${fmtIn(b.seatDepth)}`, 8)}
            {b.opening && T(x, m + 14 + h + 52, `Opening ${fmtIn(b.opening.width)} × ${fmtIn(b.opening.depth)}`, 8)}
            {T(x, m + 14 + h + 64, 'Fabric: white bouclé · Table: walnut', 8)}
          </g>
        )
      })()}
      {/* TITLE BLOCK */}
      <rect x={tb.x} y={tb.y} width={tb.w} height={tb.h} fill="none" stroke="#1c1b19" strokeWidth={0.6} />
      <line x1={tb.x + 200} y1={tb.y} x2={tb.x + 200} y2={tb.y + tb.h} stroke="#1c1b19" strokeWidth={0.4} />
      <line x1={tb.x + 470} y1={tb.y} x2={tb.x + 470} y2={tb.y + tb.h} stroke="#1c1b19" strokeWidth={0.4} />
      {T(tb.x + 8, tb.y + 18, 'VENEGAS DESIGNS', 11, { w: 600 })}
      {T(tb.x + 8, tb.y + 32, p.kind === 'client' ? 'Client sheet' : 'Shop sheet', 8)}
      {T(tb.x + 8, tb.y + 46, `${p.meta.date} · ${p.meta.link}`, 6, { fill: '#555' })}
      {T(tb.x + 208, tb.y + 18, `${shape} · ${sizes} · ${fmtIn(b.D)}D`, 9, { w: 600 })}
      {T(tb.x + 208, tb.y + 32, `${p.meta.client} — ${p.meta.project}`, 8)}
      {T(tb.x + 208, tb.y + 46, `${b.seats.label} · overall ${fmtFtIn(b.W)} wide · wedge ${b.wedge.C} × ${b.wedge.C}`, 7)}
      {T(tb.x + 478, tb.y + 14, `SCALE ${fit.label}  (Letter, print at 100%)`, 7, { w: 600 })}
      <ScaleBar x={tb.x + 478} y={tb.y + 22} S={S} font={font} />
      {b.exportBlocked && T(PAGE.w / 2, PAGE.h / 2, 'DRAFT — UNFILLED GAPS', 36, { a: 'middle', w: 600, fill: '#c0392b' })}
    </svg>
  )
}

function ElevationDrawing({ elev, k, theme }: { elev: Elevation; k: number; theme: PlanTheme }) {
  const lw = (u: number) => +(u * k).toFixed(4)
  return (
    <g data-elevation={elev.view}>
      <line x1={elev.frame.x0 - 6} y1={0} x2={elev.frame.x1 + 6} y2={0} stroke={theme.ink} strokeWidth={lw(0.8)} />
      {elev.parts.map((q, i) => {
        const fill = q.kind === 'table' ? theme.table : q.kind === 'leg' ? theme.ink : theme.seat
        if (q.kind === 'cushion' && q.crown) {
          const mx = (q.x0 + q.x1) / 2
          const top = -(q.z1 + q.crown)
          const d = `M${q.x0} ${-q.z0}L${q.x0} ${-q.z1 + 1}Q${q.x0} ${-q.z1} ${q.x0 + 2} ${-q.z1}Q${mx} ${top - 0.5 * q.crown} ${q.x1 - 2} ${-q.z1}Q${q.x1} ${-q.z1} ${q.x1} ${-q.z1 + 1}L${q.x1} ${-q.z0}Z`
          return <path key={i} d={d} fill={fill} stroke={theme.ink} strokeWidth={lw(0.5)} strokeLinejoin="round" />
        }
        return <rect key={i} x={q.x0} y={-q.z1} width={q.x1 - q.x0} height={q.z1 - q.z0} rx={q.kind === 'arm' || q.kind === 'back' ? 1.5 : 0} fill={fill} stroke={theme.ink} strokeWidth={lw(0.5)} />
      })}
    </g>
  )
}

/** Shop sheet page 2: grouped piece list. */
export function pieceList(b: BuildResult, c: Config): { qty: number; piece: string; size: string; detail: string; arm: string; heights: string }[] {
  const d = c.dims
  const rows = new Map<string, { qty: number; piece: string; size: string; detail: string; arm: string; heights: string }>()
  for (const p of b.pieces) {
    let key = ''
    let row: { qty: number; piece: string; size: string; detail: string; arm: string; heights: string }
    if (p.kind === 'wedge') {
      key = `w${p.length}`
      row = { qty: 0, piece: 'Wedge (corner)', size: `${fmtIn(p.length)} × ${fmtIn(p.length)}`, detail: `angled face ${b.wedge.face.toFixed(1)}", backs both outside edges`, arm: '—', heights: `seat ${d.seatHeight} / back ${d.backHeight}` }
    } else if (p.kind === 'armless' || p.kind === 'oneArm') {
      const arm = p.arm ? p.arm.facing : '—'
      key = `${p.kind}${p.length}${arm}`
      row = { qty: 0, piece: p.kind === 'oneArm' ? 'One-arm seat' : 'Armless seat', size: `${fmtIn(p.length)} × ${fmtIn(p.depth)}`, detail: p.kind === 'oneArm' ? `${fmtIn(p.cushion ?? 0)} seat + ${fmtIn(d.A)} arm` : `${fmtIn(p.cushion ?? 0)} seat`, arm, heights: `seat ${d.seatHeight} / ${p.arm ? `arm ${d.armHeight} / ` : ''}back ${d.backHeight}` }
    } else if (p.kind === 'table') {
      key = `t${p.length}`
      row = { qty: 0, piece: 'Table insert', size: `${fmtIn(p.length)} × ${fmtIn(p.depth)}`, detail: 'wood top (walnut)', arm: '—', heights: `top ${d.tableHeight} (confirm, §14)` }
    } else {
      key = `${p.kind}${p.length}x${p.depth}`
      row = { qty: 0, piece: p.kind === 'ottoman' ? 'Ottoman (loose)' : 'Coffee table (loose)', size: `${fmtIn(p.length)} × ${fmtIn(p.depth)}`, detail: '', arm: '—', heights: '' }
    }
    const cur = rows.get(key) ?? row
    cur.qty++
    rows.set(key, cur)
  }
  return [...rows.values()]
}

export function PieceListPage({ built, config, meta }: { built: BuildResult; config: Config; meta: SheetProps['meta'] }) {
  const rows = pieceList(built, config)
  const font = 'helvetica, sans-serif'
  const cols = [
    { k: 'qty', x: 40, h: 'Qty' },
    { k: 'piece', x: 72, h: 'Piece' },
    { k: 'size', x: 190, h: 'Length × depth' },
    { k: 'detail', x: 290, h: 'Seat / arm' },
    { k: 'arm', x: 470, h: 'Arm side' },
    { k: 'heights', x: 530, h: 'Heights (in, floor to top)' },
  ] as const
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={PAGE.w} height={PAGE.h} viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}>
      <rect width={PAGE.w} height={PAGE.h} fill="#fff" />
      <text x={40} y={50} fontSize={14} fontFamily={font} fontWeight={700}>Piece list — {meta.client}</text>
      <text x={40} y={66} fontSize={8} fontFamily={font}>{`${built.seats.label} · D ${built.D} · seat depth ${built.seatDepth} · wedge ${built.wedge.C} (face ${built.wedge.face.toFixed(1)}")`}</text>
      {cols.map((c) => (
        <text key={c.k} x={c.x} y={96} fontSize={8} fontFamily={font} fontWeight={700}>{c.h}</text>
      ))}
      <line x1={36} y1={101} x2={756} y2={101} stroke="#1c1b19" strokeWidth={0.6} />
      {rows.map((r, i) => (
        <g key={i}>
          {cols.map((c) => (
            <text key={c.k} x={c.x} y={116 + i * 16} fontSize={8} fontFamily={font}>{String(r[c.k])}</text>
          ))}
          <line x1={36} y1={121 + i * 16} x2={756} y2={121 + i * 16} stroke="#bbb" strokeWidth={0.3} />
        </g>
      ))}
      {built.warnings.length > 0 && (
        <g>
          <text x={40} y={150 + rows.length * 16} fontSize={9} fontFamily={font} fontWeight={700} fill="#9a6b00">Warnings</text>
          {built.warnings.map((w, i) => (
            <text key={i} x={40} y={164 + rows.length * 16 + i * 12} fontSize={8} fontFamily={font} fill="#9a6b00">{`• ${w.message}`}</text>
          ))}
        </g>
      )}
    </svg>
  )
}
