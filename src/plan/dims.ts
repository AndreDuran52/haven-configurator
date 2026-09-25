// CAD dimension layout for the plan view. Pure: BuildResult + profile -> primitives
// in PLAN INCHES (y-down, origin = outside back-left corner, spec §8).
//
// Everything that must look the same size on screen/paper regardless of zoom
// (text, arrows, gaps, tier spacing) is specified in DISPLAY UNITS (CSS px on
// screen, pt on paper) and converted with k = plan-inches per display unit.
// One algorithm, two profiles: SCREEN (k = 1 / pxPerInch) and PRINT (k = 1 / (72 * paperScale)).


import type { BuildResult, Pt } from '@/engine'
import { fmtFtIn, fmtIn } from './format'

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Role = 'chain' | 'callout' | 'overall'
export const ROLE_ORDER: Record<Role, number> = { chain: 0, callout: 1, overall: 2 }

export interface DimProfile {
  /** plan inches per display unit */
  k: number
  font: number
  fontOverall: number
  /** >1 pads widths for a screen font wider than Helvetica */
  widthScale: number
  arrowLen: number
  arrowHalf: number
  extGap: number
  extOver: number
  firstOffset: number
  textGap: number
  rowGap: number
  labelPad: number
  dotR: number
  /** dimension/extension line weight */
  lineW: number
  feetInches: boolean
}

/** CSS px. Legible on an iPad at arm's length; 12px is the floor. */
export const SCREEN: Omit<DimProfile, 'k'> = {
  font: 12, fontOverall: 13, widthScale: 1.08, arrowLen: 8, arrowHalf: 2.6, extGap: 4, extOver: 5,
  firstOffset: 14, textGap: 3, rowGap: 7, labelPad: 3, dotR: 1.8, lineW: 0.75, feetInches: true,
}
/** Points on paper. 7pt ≈ 2.5 mm CAD text; 5.5pt arrows ≈ 2 mm "small arrowheads". */
export const PRINT: Omit<DimProfile, 'k'> = {
  font: 7, fontOverall: 8, widthScale: 1, arrowLen: 5.5, arrowHalf: 1.4, extGap: 2.5, extOver: 3,
  firstOffset: 12, textGap: 2, rowGap: 5, labelPad: 2, dotR: 1.1, lineW: 0.35, feetInches: true,
}

export interface DimLine { a: Pt; b: Pt; kind: 'dim' | 'ext' | 'leader'; dashed?: boolean }
export interface DimArrow { tip: Pt; dir: Pt /* unit, pointing at the tip */ }
export interface DimText {
  x: number
  y: number
  rotate: 0 | -90
  text: string
  /** plan inches */
  size: number
  weight: 400 | 600
  /** along-axis box half width + perpendicular extent, plan inches (for overlap tests) */
  box: { x: number; y: number; w: number; h: number }
}
export interface DimLayout {
  lines: DimLine[]
  arrows: DimArrow[]
  dots: Pt[]
  texts: DimText[]
  /** plan-inch bounds of object + all dimensions */
  bounds: { x: number; y: number; w: number; h: number }
  /** display units consumed outside the object on each side */
  margin: Record<Side, number>
  /** terminator sizes in plan inches */
  style: { arrowLen: number; arrowHalf: number; dotR: number; lineW: number }
}

export interface Seg {
  s0: number
  s1: number
  label: string
  weight: 400 | 600
  dashed: boolean
}
export interface Group {
  side: Side
  role: Role
  /** perpendicular coordinate of the object edge this group measures from (plan inches, outward-positive in side frame) */
  edgeU: number
  segs: Seg[]
}

// ---------------------------------------------------------------------------
// 1. Requests from the engine output (never from component state)

export function requests(b: BuildResult, p: DimProfile): Group[] {
  const { W, L, R, D, shape } = b
  const groups: Group[] = []
  const hasLeft = shape !== 'L-right'
  const hasRight = shape !== 'L-left'

  type Span = { a: number; b: number; label: string; weight: 400 | 600; dashed: boolean }
  const spans: Record<'top' | 'left' | 'right', Span[]> = { top: [], left: [], right: [] }
  for (const pc of b.pieces) {
    if (pc.kind === 'ottoman' || pc.kind === 'coffeeTable') continue
    const bb = pc.bbox
    const weight = pc.kind === 'table' ? 600 : 400
    const lab = fmtIn(pc.length)
    if (pc.corner === 'backLeft' || pc.corner === 'backRight' || pc.run === 'back') {
      spans.top.push({ a: bb.x, b: bb.x + bb.w, label: lab, weight, dashed: false })
    }
    if (pc.corner === 'backLeft' || pc.run === 'left') spans.left.push({ a: bb.y, b: bb.y + bb.h, label: lab, weight, dashed: false })
    if (pc.corner === 'backRight' || pc.run === 'right') spans.right.push({ a: bb.y, b: bb.y + bb.h, label: lab, weight, dashed: false })
  }
  for (const g of b.gaps) {
    const r = g.rect
    const sp: Span = g.run === 'back'
      ? { a: r.x, b: r.x + r.w, label: fmtIn(g.length), weight: 400, dashed: true }
      : { a: r.y, b: r.y + r.h, label: fmtIn(g.length), weight: 400, dashed: true }
    spans[g.run === 'back' ? 'top' : g.run].push(sp)
  }
  const chain = (side: Side, list: Span[]): void => {
    if (list.length < 2) return // a single segment would just repeat the overall
    list.sort((x, y) => x.a - y.a)
    groups.push({ side, role: 'chain', edgeU: 0, segs: list.map((s) => ({ s0: s.a, s1: s.b, label: s.label, weight: s.weight, dashed: s.dashed })) })
  }
  const overall = (side: Side, len: number): void => {
    const txt = p.feetInches && len >= 24 ? `${fmtIn(len)} (${fmtFtIn(len)})` : fmtIn(len)
    groups.push({ side, role: 'overall', edgeU: 0, segs: [{ s0: 0, s1: len, label: txt, weight: 600, dashed: false }] })
  }
  chain('top', spans.top)
  overall('top', W)
  if (hasLeft) {
    chain('left', spans.left)
    overall('left', L)
  } else {
    // L-right: the back's open end is on the left; call out the depth there.
    groups.push({ side: 'left', role: 'callout', edgeU: 0, segs: [{ s0: 0, s1: D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] })
  }
  if (hasRight) {
    chain('right', spans.right)
    overall('right', R)
  } else {
    groups.push({ side: 'right', role: 'callout', edgeU: 0, segs: [{ s0: 0, s1: D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] })
  }
  // The 44"D callout across the end of a leg (left leg if there is one).
  if (hasLeft || hasRight) {
    const legLen = hasLeft ? L : R
    const s0 = hasLeft ? 0 : W - D
    const maxLeg = Math.max(hasLeft ? L : 0, hasRight ? R : 0)
    groups.push({ side: 'bottom', role: 'callout', edgeU: legLen - maxLeg, segs: [{ s0, s1: s0 + D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] })
  }
  return groups
}

// ---------------------------------------------------------------------------
// 2. 1-D label relaxation (exact least-squares via PAVA / isotonic regression):
//    minimise Σ(cᵢ − dᵢ)² s.t. c_{i+1} − cᵢ ≥ (wᵢ + w_{i+1})/2 + pad.

export function relaxLabels(desired: number[], widths: number[], pad: number): number[] {
  const n = desired.length
  const off: number[] = new Array(n).fill(0)
  for (let i = 1; i < n; i++) off[i] = off[i - 1]! + (widths[i - 1]! + widths[i]!) / 2 + pad
  const e = desired.map((d, i) => d - off[i]!)
  // PAVA for a non-decreasing fit of e
  const val: number[] = []
  const cnt: number[] = []
  for (const x of e) {
    val.push(x)
    cnt.push(1)
    while (val.length > 1 && val[val.length - 2]! > val[val.length - 1]!) {
      const v2 = val.pop()!
      const c2 = cnt.pop()!
      const v1 = val.pop()!
      const c1 = cnt.pop()!
      val.push((v1 * c1 + v2 * c2) / (c1 + c2))
      cnt.push(c1 + c2)
    }
  }
  const z: number[] = []
  val.forEach((v, i) => {
    for (let j = 0; j < cnt[i]!; j++) z.push(v)
  })
  return z.map((v, i) => v + off[i]!)
}

/** The object's bounding box in drawing coordinates; dims are placed outside it. */
export interface Frame {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function planFrame(b: BuildResult): Frame {
  const maxLeg = Math.max(b.shape !== 'L-right' ? b.L : 0, b.shape !== 'L-left' ? b.R : 0, b.D)
  return { x0: 0, y0: 0, x1: b.W, y1: maxLeg }
}
