import { describe, expect, it } from 'vitest'
import { compressToEncodedURIComponent } from 'lz-string'
import { deflateSync, strToU8 } from 'fflate'
import { buildHaven } from '../engine/buildHaven'
import { blankConfig, standardL, standardU } from '../engine/defaults'
import * as op from '../engine/ops'
import type { Config } from '../engine/types'
import { fixtures } from '../fixtures'
import { decodeConfig, encodeConfig } from './codec'

/** ids are regenerated on decode; compare everything else (incl. split-group structure). */
function canon(c: Config) {
  const gmap = new Map<string, number>()
  const runs = Object.fromEntries(
    Object.entries(c.runs).map(([k, ps]) => [k, ps!.map((p) => ({ kind: p.kind, length: p.length, arm: p.arm ?? null, g: p.splitGroup ? (gmap.get(p.splitGroup) ?? (gmap.set(p.splitGroup, gmap.size), gmap.size - 1)) : null }))]),
  )
  return { ...c, runs, nextId: 0, loose: c.loose.map(({ id: _id, ...l }) => l) }
}
const b64url = (u: Uint8Array) => Buffer.from(u).toString('base64url')

function randomConfig(seed: number): Config {
  let s = seed
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const starts = [standardU(), standardL('left'), standardL('right', { W: 150, R: 110 }), blankConfig('U'), standardU({ W: 300 })]
  let c = starts[Math.floor(r() * starts.length)]!
  for (let i = 0; i < 12; i++) {
    const all = Object.entries(c.runs).flatMap(([run, ps]) => ps!.map((p) => ({ run, p })))
    const pick = all[Math.floor(r() * all.length)]
    const k = Math.floor(r() * 7)
    if (k === 0) c = op.setWedge(c, 44 + Math.floor(r() * 30))
    else if (k === 1 && pick) c = op.dragSeam(c, pick.run as any, 1, Math.round((r() - 0.5) * 30) / 2)
    else if (k === 2) c = op.setMeasurements(c, { W: 160 + Math.floor(r() * 180) * 1 + (r() > 0.5 ? 0.5 : 0) })
    else if (k === 3 && pick) c = op.addPiece(c, 'table', { run: pick.run as any, at: 'seam', seam: 0 })
    else if (k === 4) c = op.setLock(c, r() > 0.5)
    else if (k === 5) c = op.addLoose(c, r() > 0.5 ? 'ottoman' : 'coffeeTable')
    else if (k === 6 && pick && pick.p.kind !== 'gap') c = op.deletePiece(c, pick.p.id)
  }
  return c
}

describe('share link v1', () => {
  it('Standard U is short and exact', () => {
    const link = encodeConfig(standardU())
    expect(link).toMatch(/^[A-Za-z0-9._~-]+$/)
    expect(link).toMatch(/[a-z0-9]$/)
    console.log('standardU link:', link, link.length, 'chars')
    const d = decodeConfig(link)
    expect(d.ok).toBe(true)
    if (d.ok) expect(canon(d.config)).toEqual(canon(standardU()))
  })

  it('round-trips every fixture and 400 random edit sequences (geometry identical)', () => {
    const cases: Config[] = [...Object.values(fixtures())]
    for (let i = 0; i < 400; i++) cases.push(randomConfig(i + 1))
    let maxLen = 0
    for (const c of cases) {
      const link = encodeConfig(c)
      maxLen = Math.max(maxLen, link.length)
      const d = decodeConfig(link)
      if (!d.ok) console.log('FAIL', link, JSON.stringify(c.loose), d)
      expect(d.ok).toBe(true)
      if (!d.ok) continue
      expect(canon(d.config)).toEqual(canon(c))
      const a = buildHaven(c), b = buildHaven(d.config)
      expect(b.pieces.map((p) => [p.kind, p.bbox])).toEqual(a.pieces.map((p) => [p.kind, p.bbox]))
      expect(b.errors).toEqual([])
    }
    console.log('max link length over', cases.length, 'configs:', maxLen)
  })

  it('size vs JSON + lz-string and JSON + deflate-raw/base64url', () => {
    const rows: string[] = []
    for (const [name, c] of Object.entries(fixtures())) {
      const json = JSON.stringify(c)
      rows.push(`${name.padEnd(10)} v1=${encodeConfig(c).length} json=${json.length} lz=${compressToEncodedURIComponent(json).length} deflate=${b64url(deflateSync(strToU8(json), { level: 9 })).length}`)
    }
    console.log(rows.join('\n'))
  })

  it('detects damage, truncation and newer versions', () => {
    const link = encodeConfig(fixtures().test3b!)
    expect(decodeConfig(link.slice(0, -5)).ok).toBe(false) // truncated by a mail client
    expect(decodeConfig(link.replace('t32', 't38'))).toEqual({ ok: false, reason: 'damaged' }) // edited by hand
    expect(decodeConfig('9' + link.slice(1))).toEqual({ ok: false, reason: 'newer' })
    expect(decodeConfig('hello')).toEqual({ ok: false, reason: 'damaged' })
  })
})
