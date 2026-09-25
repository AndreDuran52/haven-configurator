// Vector orthographic elevations (front = looking from the open end toward the back,
// right = looking from +x toward -x), drawn from the SAME buildHaven() pieces plus the
// §3 heights. Hidden lines are removed by painter's algorithm: parts are opaque boxes,
// drawn farthest-first. Drawing coords: horizontal = plan x (front) or plan y (right);
// vertical = -z (SVG y-down), so the floor is y = 0 and the back top is y = -27.

import type { BuildResult, HavenDims, Rect } from '../engine/types'
import type { Frame, Group } from './dims'
import { fmtIn } from './format'

export interface ElevPart {
  kind: 'leg' | 'body' | 'cushion' | 'back' | 'arm' | 'table'
  x0: number
  x1: number
  z0: number
  z1: number
  /** crown for cushions (extra height at the middle) */
  crown?: number
  near: number
}

export interface Elevation {
  view: 'front' | 'right'
  parts: ElevPart[]
  frame: Frame
  groups: Group[]
}

export function elevation(b: BuildResult, dims: HavenDims, view: 'front' | 'right'): Elevation {
  const deck = dims.seatHeight - dims.cushionCrown // 10
  const leg = dims.legHeight
  const parts: ElevPart[] = []
  // project a plan rect to (horizontal range, nearness) for this view
  const proj = (r: Rect) =>
    view === 'front' ? { x0: r.x, x1: r.x + r.w, near: r.y + r.h } : { x0: r.y, x1: r.y + r.h, near: r.x + r.w }

  for (const p of b.pieces) {
    if (p.kind === 'ottoman' || p.kind === 'coffeeTable') continue
    const bb = proj(p.bbox)
    if (p.kind === 'table') {
      parts.push({ kind: 'table', ...bb, z0: 0, z1: dims.tableHeight })
      continue
    }
    parts.push({ kind: 'body', ...bb, z0: leg, z1: deck })
    for (const lx of [bb.x0 + 1.5, bb.x1 - 2.5]) parts.push({ kind: 'leg', x0: lx, x1: lx + 1, z0: 0, z1: leg, near: bb.near - 1.5 })
    for (const r of p.backs) parts.push({ kind: 'back', ...proj(r), z0: leg, z1: dims.backHeight })
    if (p.arm) parts.push({ kind: 'arm', ...proj(p.arm.rect), z0: leg, z1: dims.armHeight })
    const cush = p.cushionRect ?? (p.kind === 'wedge' ? wedgeCushionRect(p.bbox, p.corner === 'backRight', dims.B) : null)
    if (cush) {
      parts.push({ kind: 'cushion', ...proj(cush), z0: deck, z1: deck + dims.cushionEdge, crown: dims.cushionCrown - dims.cushionEdge })
    }
  }
  // painter: farthest first; ties -> lower top first so a taller part in the same plane covers the shorter one's edge
  parts.sort((a, c) => a.near - c.near || a.z1 + (a.crown ?? 0) - (c.z1 + (c.crown ?? 0)))

  const x1 = view === 'front' ? b.W : Math.max(b.shape !== 'L-right' ? b.L : 0, b.shape !== 'L-left' ? b.R : 0, b.D)
  const top = dims.backHeight
  const frame: Frame = { x0: 0, y0: -top, x1, y1: 0 }
  // stacked height dims from the floor on the left side: 1, 18, 23, 27 (s = drawing y = -z)
  const heights = [
    { h: dims.legHeight, label: `${fmtIn(dims.legHeight)} leg` },
    { h: dims.seatHeight, label: `${fmtIn(dims.seatHeight)} seat` },
    { h: dims.armHeight, label: `${fmtIn(dims.armHeight)} arm` },
    { h: dims.backHeight, label: `${fmtIn(dims.backHeight)} back` },
  ]
  const groups: Group[] = heights.map((t) => ({
    side: 'left',
    role: 'callout',
    edgeU: 0,
    segs: [{ s0: -t.h, s1: 0, label: t.label, weight: 400, dashed: false }],
  }))
  return { view, parts, frame, groups }
}

function wedgeCushionRect(bb: Rect, right: boolean, B: number): Rect {
  // bounding rect of the wedge seat (polygon minus both back strips)
  return right ? { x: bb.x, y: bb.y + B, w: bb.w - B, h: bb.h - B } : { x: bb.x + B, y: bb.y + B, w: bb.w - B, h: bb.h - B }
}
