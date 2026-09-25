import { describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { temporal } from 'zundo'
import { standardU } from '../engine/defaults'
import * as op from '../engine/ops'
import type { Config } from '../engine/types'
import { createHavenStore } from './store'

const u = standardU()
const seam = (c: Config, dx: number) => op.dragSeam(c, 'back', 1, dx)

describe('hand-rolled history + draft', () => {
  it('one drag = one undo step, no matter how many pointermoves', () => {
    const s = createHavenStore(u)
    const start = s.getState().config
    for (let dx = 0.5; dx <= 6; dx += 0.5) s.getState().setDraft(seam(start, dx)) // always from drag-start config
    expect(s.getState().past).toHaveLength(0)
    s.getState().commit()
    expect(s.getState().past).toHaveLength(1)
    expect(s.getState().config.runs.back!.map((p) => p.length)).toEqual([38, 30])
    s.getState().undo()
    expect(s.getState().config).toBe(start)
  })
  it('cancel (pointercancel / Escape) leaves no trace; UI changes never enter history', () => {
    const s = createHavenStore(u)
    s.getState().setDraft(seam(u, 4))
    s.getState().cancelDraft()
    s.getState().setUi({ selectedId: 'p1', look: 'sketch' })
    expect(s.getState().past).toHaveLength(0)
    expect(s.getState().config).toBe(u)
  })
  it('rejected edits (engine returns same ref) do not create steps', () => {
    const s = createHavenStore(u)
    s.getState().commit(op.setLock(u, true)) // already locked -> same ref
    expect(s.getState().past).toHaveLength(0)
  })
  it('keyboard nudges on the same seam coalesce inside 800 ms', () => {
    const s = createHavenStore(u)
    let t = 1000
    for (let i = 0; i < 6; i++) s.getState().commit(seam(s.getState().config, 0.5), { key: 'seam:back:1', now: (t += 150) })
    s.getState().commit(seam(s.getState().config, 0.5), { key: 'seam:back:1', now: (t += 2000) })
    expect(s.getState().past).toHaveLength(2)
  })
})

describe('zundo 2.3.0 behaviour (verified)', () => {
  type S = { config: Config; ui: { sel: string | null }; set: (p: Partial<{ config: Config; ui: { sel: string | null } }>) => void }
  const make = (withEquality: boolean) =>
    createStore<S>()(
      temporal((set) => ({ config: u, ui: { sel: null }, set: (p) => set(p) }), {
        partialize: (st) => ({ config: st.config }),
        limit: 100,
        ...(withEquality ? { equality: (a: { config: Config }, b: { config: Config }) => a.config === b.config } : {}),
      }),
    )
  it('WITHOUT equality, a UI-only set still pushes a (duplicate) history entry', () => {
    const s = make(false)
    s.getState().set({ ui: { sel: 'p1' } })
    expect(s.temporal.getState().pastStates).toHaveLength(1)
  })
  it('WITH reference equality on config, UI-only sets are ignored', () => {
    const s = make(true)
    s.getState().set({ ui: { sel: 'p1' } })
    expect(s.temporal.getState().pastStates).toHaveLength(0)
  })
  it('pause() during a drag + resume() then final set: the past entry is the LAST PREVIEW, not the drag start', () => {
    const s = make(true)
    s.temporal.getState().pause()
    for (let dx = 0.5; dx <= 6; dx += 0.5) s.getState().set({ config: seam(u, dx) })
    s.temporal.getState().resume()
    s.getState().set({ config: seam(u, 7) })
    s.temporal.getState().undo()
    expect(s.getState().config.runs.back!.map((p) => p.length)).toEqual([38, 30]) // the last preview, NOT the drag start [32, 36]
  })
  it('correct zundo drag pattern: restore start while paused, resume, then set the final value once', () => {
    const s = make(true)
    const start = s.getState().config
    s.temporal.getState().pause()
    for (let dx = 0.5; dx <= 10; dx += 0.5) s.getState().set({ config: seam(start, dx) })
    const final = s.getState().config
    s.getState().set({ config: start })
    s.temporal.getState().resume()
    s.getState().set({ config: final })
    expect(s.temporal.getState().pastStates).toHaveLength(1)
    s.temporal.getState().undo()
    expect(s.getState().config).toBe(start)
  })
})
