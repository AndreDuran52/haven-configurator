import { expect, it } from 'vitest'
import { standardU } from '../engine/defaults'
import { anchoredTargets, pickTarget } from './tableSnap'
const u = standardU()
const tid = u.runs.back!.find((p) => p.kind === 'table')!.id
const desc = (c: typeof u, run: 'left' | 'back') => c.runs[run]!.map((p) => `${p.kind} ${p.length}`)
it('finger ON the arm = in place of the arm (spec 3a); finger PAST the leg end = outside the arm', () => {
  const ts = anchoredTargets(u, tid)
  const onArm = pickTarget(ts, [22, 125], null, 0)!
  expect(desc(onArm.result, 'left')).toEqual(['armless 40', 'table 32'])
  expect(desc(onArm.result, 'back')).toEqual(['armless 68'])
  const past = pickTarget(ts, [22, 146], null, 0)!
  expect(desc(past.result, 'left')).toEqual(['oneArm 40', 'table 32'])
  const mid = pickTarget(ts, [22, 96], null, 0)! // spec 3b split case
  expect(desc(mid.result, 'left')).toEqual(['armless 13', 'table 32', 'oneArm 27'])
  console.log('targets for the standard U table:', ts.length)
})
it('hysteresis keeps the current target near a boundary', () => {
  const ts = anchoredTargets(u, tid)
  const a = pickTarget(ts, [22, 125], null, 0)!
  expect(pickTarget(ts, [22, 134], a, 6)).toBe(a) // 9" from arm anchor, 12" from past-end: stays
  expect(pickTarget(ts, [22, 145], a, 6)).not.toBe(a)
})
