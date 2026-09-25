// CAD dimension layout for the plan view. Pure: BuildResult + profile -> primitives
// in PLAN INCHES (y-down, origin = outside back-left corner, spec §8).
//
// Everything that must look the same size on screen/paper regardless of zoom
// (text, arrows, gaps, tier spacing) is specified in DISPLAY UNITS (CSS px on
// screen, pt on paper) and converted with k = plan-inches per display unit.
// One algorithm, two profiles: SCREEN (k = 1 / pxPerInch) and PRINT (k = 1 / (72 * paperScale)).

import type { BuildResult, Pt } from '../engine/types'
import { fmtFtIn, fmtIn } from './format'
import { CAP_HEIGHT, textWidth } from './textMetrics'

export type Side = 'top' | 'bottom' | 'left' | 'right'
type Role = 'chain' | 'callout' | 'overall'
const ROLE_ORDER: Record<Role, number> = { chain: 0, callout: 1, overall: 2 }

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

interface Seg {
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

function requests(b: BuildResult, p: DimProfile): Group[] {
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
  const overall = (side: Side, len: number, name: string): void => {
    const txt = p.feetInches && len >= 24 ? `${fmtIn(len)} (${fmtFtIn(len)})` : fmtIn(len)
    groups.push({ side, role: 'overall', edgeU: 0, segs: [{ s0: 0, s1: len, label: txt, weight: 600, dashed: false }] })
    void name
  }
  chain('top', spans.top)
  overall('top', W, 'W')
  if (hasLeft) {
    chain('left', spans.left)
    overall('left', L, 'L')
  } else {
    // L-right: the back's open end is on the left; call out the depth there.
    groups.push({ side: 'left', role: 'callout', edgeU: 0, segs: [{ s0: 0, s1: D, label: `${fmtIn(D)}D`, weight: 600, dashed: false }] })
  }
  if (hasRight) {
    chain('right', spans.right)
    overall('right', R, 'R')
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

// ---------------------------------------------------------------------------
// 3. Layout

interface Placed {
  group: Group
  tier: number
  rows: number
  /** per segment: row index, label centre (display units along axis), whether arrows fit */
  labels: { row: number; c: number; w: number; fitsArrows: boolean; displaced: boolean }[]
  /** along-axis occupied interval, display units */
  occ: [number, number]
}

function fitGroup(g: Group, p: DimProfile): Omit<Placed, 'tier'> {
  const size = g.role === 'overall' ? p.fontOverall : p.font
  const segs = g.segs
  const w = segs.map((s) => textWidth(s.label, size, p.widthScale))
  const mid = segs.map((s) => (s.s0 + s.s1) / 2 / p.k)
  const lenD = segs.map((s) => (s.s1 - s.s0) / p.k)
  const fitsArrows = lenD.map((l) => l >= 2 * p.arrowLen + 4)
  const fitsText = lenD.map((l, i) => w[i]! + 2 * p.labelPad <= l)
  const maxShift = (i: number) => Math.max(lenD[i]! / 2, w[i]!) // beyond this we'd rather use a second row
  let rowsOf = segs.map(() => 0)
  let c = relaxLabels(mid, w, p.labelPad)
  const bad = c.some((ci, i) => Math.abs(ci - mid[i]!) > maxShift(i))
  if (bad) {
    // Alternate the labels that do NOT fit between rows 0 and 1 and relax each row separately.
    let flip = 0
    rowsOf = segs.map((_, i) => (fitsText[i] ? 0 : flip++ % 2))
    c = new Array(segs.length).fill(0)
    for (const row of [0, 1]) {
      const idx = segs.map((_, i) => i).filter((i) => rowsOf[i] === row)
      const cr = relaxLabels(idx.map((i) => mid[i]!), idx.map((i) => w[i]!), p.labelPad)
      idx.forEach((i, j) => (c[i] = cr[j]!))
    }
  }
  const labels = segs.map((_, i) => ({
    row: rowsOf[i]!,
    c: c[i]!,
    w: w[i]!,
    fitsArrows: fitsArrows[i]!,
    displaced: Math.abs(c[i]! - mid[i]!) > lenD[i]! / 2 - 1,
  }))
  const lo = Math.min(segs[0]!.s0 / p.k, ...labels.map((l) => l.c - l.w / 2))
  const hi = Math.max(segs[segs.length - 1]!.s1 / p.k, ...labels.map((l) => l.c + l.w / 2))
  const rows = Math.max(...rowsOf) + 1
  return { group: g, rows, labels, occ: [lo - p.labelPad, hi + p.labelPad] }
}

function tierHeight(pl: Omit<Placed, 'tier'>, p: DimProfile): number {
  const size = pl.group.role === 'overall' ? p.fontOverall : p.font
  const fontH = size * CAP_HEIGHT
  return p.textGap + pl.rows * fontH + (pl.rows - 1) * p.textGap + p.rowGap
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

export function layoutDims(b: BuildResult, p: DimProfile): DimLayout {
  return layoutGroups(requests(b, p), planFrame(b), p)
}

export function layoutGroups(groups: Group[], f: Frame, p: DimProfile): DimLayout {
  const sides: Side[] = ['top', 'bottom', 'left', 'right']
  const out: DimLayout = { lines: [], arrows: [], dots: [], texts: [], bounds: { x: 0, y: 0, w: 0, h: 0 }, margin: { top: 0, bottom: 0, left: 0, right: 0 }, style: { arrowLen: p.arrowLen * p.k, arrowHalf: p.arrowHalf * p.k, dotR: p.dotR * p.k, lineW: p.lineW * p.k } }
  const k = p.k

  // side frame (s along, u outward from the frame edge, drawing units) -> drawing (x, y)
  const toPlan = (side: Side, s: number, u: number): Pt => {
    switch (side) {
      case 'top': return [s, f.y0 - u]
      case 'bottom': return [s, f.y1 + u]
      case 'left': return [f.x0 - u, s]
      case 'right': return [f.x1 + u, s]
    }
  }
  const outward: Record<Side, Pt> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }
  const along: Record<Side, Pt> = { top: [1, 0], bottom: [1, 0], left: [0, 1], right: [0, 1] }
  // does the glyph "up" direction point outward? (text rotated -90 has up = -x)
  const upIsOutward: Record<Side, boolean> = { top: true, bottom: false, left: true, right: false }

  for (const side of sides) {
    const gs = groups.filter((g) => g.side === side).sort((a, c) => ROLE_ORDER[a.role] - ROLE_ORDER[c.role])
    if (!gs.length) continue
    // --- tier assignment: interval packing, overall always outermost
    const placed: Placed[] = []
    for (const g of gs) {
      const f = fitGroup(g, p)
      const minTier = g.role === 'overall' ? Math.max(-1, ...placed.map((x) => x.tier)) + 1 : 0
      let tier = minTier
      while (placed.some((x) => x.tier === tier && x.occ[0] < f.occ[1] && f.occ[0] < x.occ[1])) tier++
      placed.push({ ...f, tier })
    }
    const nTiers = Math.max(...placed.map((x) => x.tier)) + 1
    const tierH: number[] = new Array(nTiers).fill(0)
    for (const pl of placed) tierH[pl.tier] = Math.max(tierH[pl.tier]!, tierHeight(pl, p))
    const tierOff: number[] = []
    let acc = p.firstOffset
    for (let t = 0; t < nTiers; t++) {
      tierOff.push(acc)
      acc += tierH[t]!
    }
    out.margin[side] = acc

    // --- extension lines: one per (edgeU, s) boundary, reaching the outermost line that uses it
    const ext = new Map<string, { s: number; edgeU: number; reach: number }>()
    for (const pl of placed) {
      const uLine = tierOff[pl.tier]! * k
      const bounds = [pl.group.segs[0]!.s0, ...pl.group.segs.map((s) => s.s1)]
      for (const s of bounds) {
        const key = `${pl.group.edgeU}|${s}`
        const cur = ext.get(key)
        if (!cur || cur.reach < uLine) ext.set(key, { s, edgeU: pl.group.edgeU, reach: uLine })
      }
    }
    for (const e of ext.values()) {
      out.lines.push({ a: toPlan(side, e.s, e.edgeU + p.extGap * k), b: toPlan(side, e.s, e.reach + p.extOver * k), kind: 'ext' })
    }

    // --- dimension lines, terminators, text
    for (const pl of placed) {
      const g = pl.group
      const uLine = tierOff[pl.tier]! * k
      const size = (g.role === 'overall' ? p.fontOverall : p.font) * k
      const fontH = size * CAP_HEIGHT
      // boundaries that need a dot (either neighbour too tight for arrows)
      const dotAt = new Set<number>()
      g.segs.forEach((s, i) => {
        if (!pl.labels[i]!.fitsArrows) {
          if (g.segs.length > 1) {
            dotAt.add(s.s0)
            dotAt.add(s.s1)
          }
        }
      })
      g.segs.forEach((s, i) => {
        const lab = pl.labels[i]!
        const a = toPlan(side, s.s0, uLine)
        const c = toPlan(side, s.s1, uLine)
        const ax = along[side]
        if (g.segs.length === 1 && !lab.fitsArrows) {
          // lone short dim: arrows outside pointing in, with stubs
          const stub = (p.arrowLen + 3) * k
          out.lines.push({ a: [a[0] - ax[0] * stub, a[1] - ax[1] * stub], b: [c[0] + ax[0] * stub, c[1] + ax[1] * stub], kind: 'dim', dashed: s.dashed })
          out.arrows.push({ tip: a, dir: ax }, { tip: c, dir: [-ax[0], -ax[1]] })
        } else {
          out.lines.push({ a, b: c, kind: 'dim', dashed: s.dashed })
          if (dotAt.has(s.s0)) out.dots.push(a)
          else out.arrows.push({ tip: a, dir: [-ax[0], -ax[1]] })
          if (dotAt.has(s.s1)) out.dots.push(c)
          else out.arrows.push({ tip: c, dir: ax })
        }
        // text
        const rowU = uLine + (p.textGap + lab.row * (fontH / k + p.textGap)) * k
        const baseU = upIsOutward[side] ? rowU : rowU + fontH
        const sC = lab.c * k
        const [tx, ty] = toPlan(side, sC, baseU)
        const rotate: 0 | -90 = side === 'left' || side === 'right' ? -90 : 0
        const wIn = lab.w * k
        const boxU0 = rowU
        const boxU1 = rowU + fontH
        const p0 = toPlan(side, sC - wIn / 2, boxU0)
        const p1 = toPlan(side, sC + wIn / 2, boxU1)
        const box = { x: Math.min(p0[0], p1[0]), y: Math.min(p0[1], p1[1]), w: Math.abs(p1[0] - p0[0]), h: Math.abs(p1[1] - p0[1]) }
        out.texts.push({ x: tx, y: ty, rotate, text: s.label, size, weight: s.weight, box })
        if (lab.displaced || lab.row > 0) {
          // leader from the label's near edge back to the segment midpoint on the dim line
          const mid = (s.s0 + s.s1) / 2
          const nearS = Math.min(Math.max(mid, sC - wIn / 2), sC + wIn / 2)
          out.lines.push({ a: toPlan(side, mid, uLine), b: toPlan(side, nearS, rowU - (p.textGap * 0.5) * k), kind: 'leader' })
        }
      })
      void outward
    }
  }

  // --- bounds: object ∪ every primitive
  let x0 = f.x0, y0 = f.y0, x1 = f.x1, y1 = f.y1
  const grow = (x: number, y: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  for (const l of out.lines) { grow(...l.a); grow(...l.b) }
  for (const t of out.texts) { grow(t.box.x, t.box.y); grow(t.box.x + t.box.w, t.box.y + t.box.h) }
  out.bounds = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  return out
}

/**
 * Screen fit: k depends on the dimension margins, which are in display units and
 * (through second label rows) weakly depend on k. Fixed-point, converges in 2–3 passes.
 */
export function fitScreen(b: BuildResult, viewW: number, viewH: number, pad = 12, base = SCREEN): { k: number; layout: DimLayout } {
  const maxLeg = Math.max(b.shape !== 'L-right' ? b.L : 0, b.shape !== 'L-left' ? b.R : 0, b.D)
  let k = Math.max(b.W / viewW, maxLeg / viewH) * 1.6
  let layout = layoutDims(b, { ...base, k })
  for (let i = 0; i < 12; i++) {
    const m = layout.margin
    // text may stick out past the ends of the object along the axis; use bounds overhang too
    const kW = layout.bounds.w / (viewW - 2 * pad)
    const kH = layout.bounds.h / (viewH - 2 * pad)
    const next = Math.max(kW, kH)
    void m
    if (Math.abs(next - k) / k < 0.002) break
    k = next
    layout = layoutDims(b, { ...base, k })
  }
  return { k, layout }
}
