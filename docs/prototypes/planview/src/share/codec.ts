// Share-link codec, schema v1. Compact, versioned, URL-safe, human-inspectable.
//
//   1UW188L132R132D44_bt32s36_la72_ra72.k7
//   │└─ header ──────┘ └ runs ─────────┘ └ checksum (2 base36)
//   └ link version
//
// Alphabet: RFC 3986 "unreserved" only (A-Z a-z 0-9 - . _ ~) so nothing is ever
// percent-encoded, and the link always ENDS in an alphanumeric (the checksum), so
// iMessage / Mail linkifiers never drop a trailing punctuation mark.
//
// Header: shape (U | l = L-left | r = L-right), then letter+number fields
//   W L R D (inches, ".5" allowed) · C manual wedge · K lock OFF · S seat width
//   X<key><n> dims overrides (only when != default) · F fabric · T table finish
// Runs:  _b _l _r, then pieces: s armless · a one-arm (+ S|E arm end when not the
//   run's open end: S | E) · t table · g gap. "~" joins auto-split siblings (one splitGroup).
// Loose: _o ottoman / _c coffee table: x y w d.
// Ids are NOT encoded (they are React keys only); decode regenerates p1..pn / g1..gn.

import { DEFAULT_DIMS } from '../engine/defaults'
import type { Config, HavenDims, LoosePiece, RunId, RunPiece, Runs, Shape } from '../engine/types'

export const LINK_VERSION = 1

const SHAPE: Record<Shape, string> = { U: 'U', 'L-left': 'l', 'L-right': 'r' }
const SHAPE_INV: Record<string, Shape> = { U: 'U', l: 'L-left', r: 'L-right' }
const RUN_CODE: Record<RunId, string> = { back: 'b', left: 'l', right: 'r' }
const RUN_INV: Record<string, RunId> = { b: 'back', l: 'left', r: 'right' }
const DIM_KEYS: Record<string, keyof HavenDims> = { A: 'A', B: 'B', g: 'legHeight', s: 'seatHeight', c: 'cushionCrown', e: 'cushionEdge', a: 'armHeight', b: 'backHeight', t: 'tableHeight' }
const DIM_INV = Object.fromEntries(Object.entries(DIM_KEYS).map(([k, v]) => [v, k])) as Record<keyof HavenDims, string>

export interface Look {
  fabric: number
  finish: number
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 2) / 2))

function checksum(body: string): string {
  let h = 2166136261
  for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1296).toString(36).padStart(2, '0')
}

function openEnd(shape: Shape, run: RunId): 'start' | 'end' | null {
  if (run !== 'back') return 'end'
  if (shape === 'L-left') return 'end'
  if (shape === 'L-right') return 'start'
  return null
}

export function encodeConfig(c: Config, look: Look = { fabric: 0, finish: 0 }): string {
  let h = `${LINK_VERSION}${SHAPE[c.shape]}W${num(c.W)}`
  h += `L${num(c.L)}R${num(c.R)}` // both always: the unused leg matters if the shape is switched back
  h += `D${num(c.D)}`
  if (c.wedgeC !== null) h += `C${num(c.wedgeC)}`
  if (!c.lockOutside) h += 'K'
  if (c.seatWidth !== 28) h += `S${num(c.seatWidth)}`
  for (const k of Object.keys(DEFAULT_DIMS) as (keyof HavenDims)[]) {
    if (c.dims[k] !== DEFAULT_DIMS[k]) h += `X${DIM_INV[k]}${num(c.dims[k])}`
  }
  if (look.fabric) h += `F${look.fabric}`
  if (look.finish) h += `T${look.finish}`
  const parts = [h]
  for (const run of ['back', 'left', 'right'] as RunId[]) {
    const ps = c.runs[run]
    if (!ps) continue
    const oe = openEnd(c.shape, run)
    let s = RUN_CODE[run]
    ps.forEach((p, i) => {
      if (i > 0 && p.splitGroup && p.splitGroup === ps[i - 1]!.splitGroup) s += '~'
      const code = p.kind === 'armless' ? 's' : p.kind === 'oneArm' ? 'a' : p.kind === 'table' ? 't' : 'g'
      s += code + num(p.length)
      if (p.kind === 'oneArm' && p.arm !== oe) s += p.arm === 'start' ? 'S' : 'E'
    })
    parts.push(s)
  }
  for (const l of c.loose) parts.push(`${l.kind === 'ottoman' ? 'o' : 'c'}x${num(l.x)}y${num(l.y)}w${num(l.w)}d${num(l.d)}`)
  const body = parts.join('_')
  return `${body}.${checksum(body)}`
}

export type DecodeResult =
  | { ok: true; config: Config; look: Look; version: number }
  | { ok: false; reason: 'damaged' | 'newer' | 'unknown' }

const NUM = '(\\d+(?:\\.5)?)'
const SNUM = '(-?\\d+(?:\\.5)?)' // loose pieces may sit at negative coords

export function decodeConfig(link: string): DecodeResult {
  const m = /^(\d+)([A-Za-z].*)\.([0-9a-z]{2})$/.exec(link.trim())
  if (!m) return { ok: false, reason: 'damaged' }
  const version = Number(m[1])
  if (version > LINK_VERSION) return { ok: false, reason: 'newer' }
  const body = `${m[1]}${m[2]}`
  if (checksum(body) !== m[3]) return { ok: false, reason: 'damaged' }
  const decoders: Record<number, (b: string) => { config: Config; look: Look } | null> = { 1: decodeV1 }
  const d = decoders[version]
  if (!d) return { ok: false, reason: 'unknown' }
  const r = d(m[2]!)
  return r ? { ok: true, version, ...r } : { ok: false, reason: 'damaged' }
  // later: migrations[v](config) chain up to the current engine schema
}

function decodeV1(s: string): { config: Config; look: Look } | null {
  const [head, ...rest] = s.split('_')
  const hm = /^([Ulr])(.*)$/.exec(head!)
  if (!hm) return null
  const shape = SHAPE_INV[hm[1]!]!
  const fields = hm[2]!
  // strict tokenizer: any leftover character means a damaged link
  const vals: Record<string, number> = {}
  const dims: HavenDims = { ...DEFAULT_DIMS }
  let unlocked = false
  const rest0 = fields.replace(/(X[A-Za-z]|[WLRDCSFT])(\d+(?:\.5)?)|(K)/g, (_all, key: string | undefined, n: string | undefined, k: string | undefined) => {
    if (k) unlocked = true
    else if (key!.startsWith('X')) {
      const dk = DIM_KEYS[key![1]!]
      if (!dk) return '!'
      dims[dk] = Number(n)
    } else vals[key!] = Number(n)
    return ''
  })
  if (rest0 !== '') return null
  const get = (k: string): number | null => (k in vals ? vals[k]! : null)
  const W = get('W'), D = get('D')
  if (W === null || D === null) return null
  let nextId = 1
  let nextGroup = 1
  const runs: Runs = {}
  const loose: LoosePiece[] = []
  for (const tok of rest) {
    const run = RUN_INV[tok[0]!]
    if (run && /^[blr]([sagt~]|$)/.test(tok)) {
      const oe = openEnd(shape, run)
      const pieces: RunPiece[] = []
      let prevJoined = false
      const body = tok.slice(1)
      let consumed = 0
      for (const pm of body.matchAll(new RegExp(`(~?)([sagt])${NUM}([SE]?)`, 'g'))) {
        if (pm.index !== consumed) return null // strict: no skipped characters
        consumed += pm[0].length
        const kind = pm[2] === 's' ? 'armless' : pm[2] === 'a' ? 'oneArm' : pm[2] === 't' ? 'table' : 'gap'
        const p: RunPiece = { id: `p${nextId++}`, kind, length: Number(pm[3]) }
        if (pm[4] && kind !== 'oneArm') return null
        if (kind === 'oneArm') p.arm = pm[4] === 'S' ? 'start' : pm[4] === 'E' ? 'end' : (oe ?? 'end')
        if (pm[1] === '~') {
          const prev = pieces[pieces.length - 1]
          if (!prev) return null
          if (!prevJoined) prev.splitGroup = `g${nextGroup++}`
          p.splitGroup = prev.splitGroup
          prevJoined = true
        } else prevJoined = false
        pieces.push(p)
      }
      if (consumed !== body.length) return null
      runs[run] = pieces
    } else if (/^[oc]x-?\d/.test(tok)) {
      const lm = new RegExp(`^([oc])x${SNUM}y${SNUM}w${NUM}d${NUM}$`).exec(tok)
      if (!lm) return null
      loose.push({ id: `p${nextId++}`, kind: lm[1] === 'o' ? 'ottoman' : 'coffeeTable', x: +lm[2]!, y: +lm[3]!, w: +lm[4]!, d: +lm[5]! })
    } else return null
  }
  const config: Config = {
    schema: 1,
    shape,
    W,
    L: get('L') ?? 0,
    R: get('R') ?? 0,
    D,
    wedgeC: get('C'),
    lockOutside: !unlocked,
    runs,
    loose,
    seatWidth: get('S') ?? 28,
    dims,
    nextId,
  }
  return { config, look: { fabric: get('F') ?? 0, finish: get('T') ?? 0 } }
}
