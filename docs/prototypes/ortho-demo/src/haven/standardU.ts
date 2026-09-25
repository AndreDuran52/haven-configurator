// Minimal stand-in for spec §1 `buildHaven(config) → pieces[]`, hard-wired to the
// Standard Haven U of spec §2 / §12 test 1. The real engine is phase 1; this file only
// exists so the ortho 3D view has the exact same inch-accurate pieces to draw.
//
// Plan coordinates (spec §8): origin = outside back-left corner, x across the back,
// y toward the open end, inches. 3D mapping used everywhere in this demo:
//   plan (x, y)  →  three (x, z);  height above floor → three y.  1 unit = 1 inch.

export type Vec2 = [number, number]
export type RunId = 'back' | 'left' | 'right'
export type PieceKind = 'wedge' | 'armless' | 'oneArm' | 'table'

export interface HavenConfig {
  W: number // back, outside
  L: number // left leg, outside
  R: number // right leg, outside
  D: number // overall depth
  C: number // wedge size
  A: number // arm width
  B: number // back zone (frame + back cushion)
}

// §3 heights (inches above floor)
export const H = {
  leg: 1, // 1" legs, no base
  deck: 10, // top of the body = bottom of the seat cushion
  seatTop: 18, // top of the crowned seat cushion (8" crown; 6" at the stitch line)
  arm: 23,
  back: 27, // 1" leg + 26" body
  table: 23, // open question §14: assumed flush with the arm
  backFrame: 4, // assumed 4" frame + 6" back cushion (§14 open question)
} as const

export interface Piece {
  id: string
  kind: PieceKind
  run: RunId
  /** plan polygon, inches, the piece's full footprint */
  footprint: Vec2[]
  /** along-run extent (for run pieces) */
  s0: number
  s1: number
  armAt?: 'start' | 'end'
  corner?: 'left' | 'right'
}

export const STANDARD_U: HavenConfig = { W: 188, L: 132, R: 132, D: 44, C: 60, A: 14, B: 10 }

/** Map run-local (s along the run, t depth from the back edge) → plan (x, y). */
export function runToPlan(cfg: HavenConfig, run: RunId, s: number, t: number): Vec2 {
  switch (run) {
    case 'back':
      return [s, t]
    case 'left':
      return [t, s]
    case 'right':
      return [cfg.W - t, s]
  }
}

export function rectST(cfg: HavenConfig, run: RunId, s0: number, s1: number, t0: number, t1: number): Vec2[] {
  const pts = [runToPlan(cfg, run, s0, t0), runToPlan(cfg, run, s1, t0), runToPlan(cfg, run, s1, t1), runToPlan(cfg, run, s0, t1)]
  return pts
}

const mirrorX = (cfg: HavenConfig, poly: Vec2[]): Vec2[] => poly.map(([x, y]) => [cfg.W - x, y] as Vec2).reverse()

/** Spec §8 wedge polygon for the back-left corner: (0,0)(C,0)(C,D)(D,C)(0,C). */
export function wedgePolygon(cfg: HavenConfig, corner: 'left' | 'right'): Vec2[] {
  const { C, D } = cfg
  const left: Vec2[] = [[0, 0], [C, 0], [C, D], [D, C], [0, C]]
  return corner === 'left' ? left : mirrorX(cfg, left)
}

/** Standard U, §2: back = [wedge C][table 32][armless][wedge C]; legs = one-arm (L−C) with the arm at the open end. */
export function buildStandardU(cfg: HavenConfig = STANDARD_U, tableWidth = 32): Piece[] {
  const { W, L, R, C } = cfg
  const armless = W - 2 * C - tableWidth
  const pieces: Piece[] = [
    { id: 'wedge-L', kind: 'wedge', run: 'back', corner: 'left', footprint: wedgePolygon(cfg, 'left'), s0: 0, s1: C },
    { id: 'table-1', kind: 'table', run: 'back', footprint: rectST(cfg, 'back', C, C + tableWidth, 0, cfg.D), s0: C, s1: C + tableWidth },
    { id: 'armless-1', kind: 'armless', run: 'back', footprint: rectST(cfg, 'back', C + tableWidth, C + tableWidth + armless, 0, cfg.D), s0: C + tableWidth, s1: C + tableWidth + armless },
    { id: 'wedge-R', kind: 'wedge', run: 'back', corner: 'right', footprint: wedgePolygon(cfg, 'right'), s0: W - C, s1: W },
    { id: 'onearm-L', kind: 'oneArm', run: 'left', armAt: 'end', footprint: rectST(cfg, 'left', C, L, 0, cfg.D), s0: C, s1: L },
    { id: 'onearm-R', kind: 'oneArm', run: 'right', armAt: 'end', footprint: rectST(cfg, 'right', C, R, 0, cfg.D), s0: C, s1: R },
  ]
  return pieces
}

// ---------------------------------------------------------------------------------------
// Parts: each piece → rounded prisms (+ legs). This is the procedural 3D breakdown of §9.

export type MatId = 'body' | 'cushion' | 'wood' | 'leg'
export interface PrismPart {
  key: string
  pieceId: string
  poly: Vec2[] // plan polygon (exact outer footprint; bevels stay inside it)
  z0: number
  z1: number
  r: number // edge radius
  mat: MatId
}
export interface LegPart {
  key: string
  pieceId: string
  x: number
  y: number
}

const GAP = 0.25 // visual seam between adjacent cushions

function insetToward(p: Vec2, c: Vec2, d: number): Vec2 {
  const dx = c[0] - p[0]
  const dy = c[1] - p[1]
  const len = Math.hypot(dx, dy) || 1
  return [p[0] + (dx / len) * d, p[1] + (dy / len) * d]
}
function centroid(poly: Vec2[]): Vec2 {
  const n = poly.length
  return [poly.reduce((a, p) => a + p[0], 0) / n, poly.reduce((a, p) => a + p[1], 0) / n]
}

export function pieceParts(cfg: HavenConfig, piece: Piece): { prisms: PrismPart[]; legs: LegPart[] } {
  const prisms: PrismPart[] = []
  const legs: LegPart[] = []
  const { D, A, B } = cfg
  const F = H.backFrame
  const add = (key: string, poly: Vec2[], z0: number, z1: number, r: number, mat: MatId) =>
    prisms.push({ key: `${piece.id}:${key}`, pieceId: piece.id, poly, z0, z1, r, mat })
  const c = centroid(piece.footprint)
  piece.footprint.forEach((p, i) => {
    const q = insetToward(p, c, 3)
    legs.push({ key: `${piece.id}:leg${i}`, pieceId: piece.id, x: q[0], y: q[1] })
  })

  if (piece.kind === 'wedge') {
    const { C } = cfg
    const corner = piece.corner ?? 'left'
    const m = (poly: Vec2[]): Vec2[] => (corner === 'left' ? poly : mirrorX(cfg, poly))
    const R = (x0: number, y0: number, x1: number, y1: number): Vec2[] => m([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    // body stops at the back frames (no coplanar faces → no z-fighting in elevations)
    add('body', m([[F, F], [C, F], [C, D], [D, C], [F, C]]), H.leg, H.deck, 1, 'body')
    // back frame on both outside edges (L shape as two boxes)
    add('frameA', R(0, 0, C, F), H.leg, H.back, 1.5, 'body')
    add('frameB', R(0, F, F, C), H.leg, H.back, 1.5, 'body')
    // back cushions
    add('backA', R(F + GAP, F, C - GAP, B), H.deck, H.back - 1, 2.5, 'cushion')
    add('backB', R(F, B + GAP, B, C - GAP), H.deck, H.back - 1, 2.5, 'cushion')
    // seat cushion = wedge polygon inset by B on the two back edges
    add('seat', m([[B + GAP, B + GAP], [C - GAP, B + GAP], [C - GAP, D], [D, C - GAP], [B + GAP, C - GAP]]), H.deck, H.seatTop, 2.5, 'cushion')
    return { prisms, legs }
  }

  const run = piece.run
  const ST = (s0: number, s1: number, t0: number, t1: number) => rectST(cfg, run, s0, s1, t0, t1)

  if (piece.kind === 'table') {
    add('top', ST(piece.s0, piece.s1, 0, D), H.leg, H.table, 0.5, 'wood')
    return { prisms, legs }
  }

  let a0 = piece.s0
  let a1 = piece.s1
  if (piece.kind === 'oneArm') {
    if (piece.armAt === 'end') {
      add('arm', ST(piece.s1 - A, piece.s1, 0, D), H.leg, H.arm, 2, 'body')
      a1 = piece.s1 - A
    } else {
      add('arm', ST(piece.s0, piece.s0 + A, 0, D), H.leg, H.arm, 2, 'body')
      a0 = piece.s0 + A
    }
  }
  add('body', ST(a0, a1, F, D), H.leg, H.deck, 1, 'body') // behind-the-frame start: no coplanar faces
  add('frame', ST(a0, a1, 0, F), H.leg, H.back, 1.5, 'body')
  add('back', ST(a0 + GAP, a1 - GAP, F, B), H.deck, H.back - 1, 2.5, 'cushion')
  add('seat', ST(a0 + GAP, a1 - GAP, B + GAP, D), H.deck, H.seatTop, 2.5, 'cushion')
  return { prisms, legs }
}

export function allParts(cfg: HavenConfig, pieces: Piece[]) {
  const prisms: PrismPart[] = []
  const legs: LegPart[] = []
  for (const p of pieces) {
    const r = pieceParts(cfg, p)
    prisms.push(...r.prisms)
    legs.push(...r.legs)
  }
  return { prisms, legs }
}

/** Every silhouette-relevant 3D point (plan x, height, plan y) – used for tight ortho fitting. */
export function fitPoints(prisms: PrismPart[]): [number, number, number][] {
  const out: [number, number, number][] = []
  for (const p of prisms) for (const [x, y] of p.poly) out.push([x, p.z0, y], [x, p.z1, y])
  // legs sit inside the footprints; floor-level footprint corners are covered by z0 = 1 → add floor
  for (const p of prisms) for (const [x, y] of p.poly) out.push([x, 0, y])
  return out
}
