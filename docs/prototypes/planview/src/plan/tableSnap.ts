// Table drag targets with ANCHORS (where the finger must be), not "where the table ends up".
// "In place of the arm" and "outside the arm" produce the same table position with the lock
// on, so they need different anchors: the arm itself vs. past the end of the run.
import { buildHaven } from '../engine/buildHaven'
import { moveTable, tableTargets } from '../engine/ops'
import type { Config, Placement, Pt } from '../engine/types'

export interface Target { placement: Placement; anchor: Pt; result: Config }

export function anchoredTargets(c: Config, id: string): Target[] {
  const b = buildHaven(c)
  const out: Target[] = []
  const place = (placement: Placement, anchor?: Pt) => {
    const result = moveTable(c, id, placement)
    if (result === c && !(placement.at === 'seam')) return
    const t = buildHaven(result).pieces.find((p) => p.id === id)
    if (!t) return
    out.push({ placement, anchor: anchor ?? [t.bbox.x + t.bbox.w / 2, t.bbox.y + t.bbox.h / 2], result })
  }
  for (const p of tableTargets(c, id)) {
    const run = b.runs.find((r) => r.id === p.run)!
    const isOpenEndSeam = p.at === 'seam' && run.openEnd && p.seam === (run.openEnd === 'end' ? c.runs[p.run]!.filter((q) => q.id !== id).length : 0)
    if (isOpenEndSeam) {
      // outside the arm: anchor half a table PAST the run's open end
      const tw = c.runs[b.pieces.find((q) => q.id === id)!.run!]!.find((q) => q.id === id)!.length
      const endPt: Pt = run.axis === 'x' ? [run.openEnd === 'end' ? b.W + tw / 2 : -tw / 2, b.D / 2] : [p.run === 'left' ? b.D / 2 : b.W - b.D / 2, (p.run === 'left' ? b.L : b.R) + tw / 2]
      place(p, endPt)
    } else place(p)
  }
  // in place of the arm: anchor = the arm's centre
  for (const piece of b.pieces) {
    if (piece.arm && piece.run && piece.run === b.runs.find((r) => r.id === piece.run && r.openEnd)?.id) {
      const r = piece.arm.rect
      place({ run: piece.run, at: 'replaceArm' }, [r.x + r.w / 2, r.y + r.h / 2])
    }
  }
  return out
}

/** nearest anchor, with hysteresis so the preview does not flicker between two targets */
export function pickTarget(targets: Target[], pointer: Pt, current: Target | null, hysteresisIn: number): Target | null {
  let best: Target | null = null
  let bd = Infinity
  for (const t of targets) {
    const d = Math.hypot(t.anchor[0] - pointer[0], t.anchor[1] - pointer[1])
    if (d < bd) (bd = d), (best = t)
  }
  if (current && best !== current) {
    const dc = Math.hypot(current.anchor[0] - pointer[0], current.anchor[1] - pointer[1])
    if (dc - bd < hysteresisIn) return current
  }
  return best
}
