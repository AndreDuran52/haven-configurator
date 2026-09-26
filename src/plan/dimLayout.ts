// Dimension layout (plan §8): tiers, arrows vs dots, label rows, and the
// screen fit. Pure: requests (dims.ts) + profile -> primitives in plan inches.
import type { BuildResult, Pt } from '@/engine'
import { CAP_HEIGHT, textWidth } from './textMetrics'
import { ROLE_ORDER, SCREEN, planFrame, relaxLabels, requests, type DimLayout, type DimProfile, type Frame, type Group, type Side } from './dims'

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
    // text may stick out past the ends of the object along the axis; use bounds overhang too
    const kW = layout.bounds.w / (viewW - 2 * pad)
    const kH = layout.bounds.h / (viewH - 2 * pad)
    const next = Math.max(kW, kH)
    if (Math.abs(next - k) / k < 0.002) break
    k = next
    layout = layoutDims(b, { ...base, k })
  }
  return { k, layout }
}
