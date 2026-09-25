// Interactive plan editor prototype: proves the gesture architecture under real
// (CDP-emulated) touch in Chromium. One delegated handler on the <svg> root, pure
// hit-testing, pointer capture on the root (never on a handle that React may re-key),
// frozen CTM/viewBox for the gesture, drafts from the DRAG-START config, one commit.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useStore } from 'zustand'
import { buildHaven } from '../src/engine/buildHaven'
import { standardU } from '../src/engine/defaults'
import * as op from '../src/engine/ops'
import type { BuildResult, Config, Pt, RunId } from '../src/engine/types'
import { fitScreen, type DimLayout } from '../src/plan/dims'
import { fmtIn } from '../src/plan/format'
import { gripPoints, hitTest, type Grip } from '../src/plan/hitTest'
import { LIGHT, PlanDrawing } from '../src/plan/PlanDrawing'
import { decodeConfig, encodeConfig } from '../src/share/codec'
import { createHavenStore } from '../src/store/store'

// memoise buildHaven per config object: any component can ask, it is computed once
const builtCache = new WeakMap<Config, BuildResult>()
const builtOf = (c: Config) => {
  let b = builtCache.get(c)
  if (!b) builtCache.set(c, (b = buildHaven(c)))
  return b
}

const fromUrl = decodeConfig(new URLSearchParams(location.search).get('c') ?? '')
const store = createHavenStore(fromUrl.ok ? fromUrl.config : standardU())
const perf = { moves: 0, computeMs: 0, builds: 0 }

type Gesture =
  | { kind: 'seam'; pointerId: number; run: RunId; seam: number; axis: 'x' | 'y'; start: Pt; startConfig: Config }
  | { kind: 'pending'; pointerId: number; id: string; pieceKind: string; start: Pt; startClient: Pt; startConfig: Config; t0: number }
  | { kind: 'table'; pointerId: number; id: string; startConfig: Config }

function PlanEditor() {
  const config = useStore(store, (s) => s.config)
  const draft = useStore(store, (s) => s.draft)
  const selected = useStore(store, (s) => s.ui.selectedId)
  const live = draft ?? config
  const built = builtOf(live)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const gesture = useRef<Gesture | null>(null)
  const frozen = useRef<{ k: number; layoutBounds: DimLayout['bounds']; inv: DOMMatrix } | null>(null)
  const raf = useRef(0)
  const latest = useRef<{ pt: Pt; client: Pt } | null>(null)
  const [readout, setReadout] = useState<{ x: number; y: number; text: string } | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fit from the COMMITTED config; while a gesture runs the viewBox is frozen (no jitter when lock is off)
  const fit = useMemo(() => fitScreen(builtOf(config), size.w, size.h), [config, size])
  const k = gesture.current && frozen.current ? frozen.current.k : fit.k
  const bounds = gesture.current && frozen.current ? frozen.current.layoutBounds : fit.layout.bounds
  const dims = useMemo(() => fitScreen(built, size.w, size.h).layout, [built, size]) // live dims (same k when lock on)
  const grips = useMemo(() => gripPoints(built, k), [built, k])
  const pad = 12 * k
  const viewBox = `${bounds.x - pad} ${bounds.y - pad} ${bounds.w + 2 * pad} ${bounds.h + 2 * pad}`

  const toPlan = (clientX: number, clientY: number, inv?: DOMMatrix): Pt => {
    const m = inv ?? svgRef.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(clientX, clientY).matrixTransform(m)
    return [p.x, p.y]
  }

  const runFrame = () => {
    raf.current = 0
    const g = gesture.current
    const l = latest.current
    if (!g || !l) return
    const t0 = performance.now()
    if (g.kind === 'seam') {
      const along = g.axis === 'x' ? l.pt[0] - g.start[0] : l.pt[1] - g.start[1]
      const next = op.dragSeam(g.startConfig, g.run, g.seam, along) // always from the drag-start config: no drift
      store.getState().setDraft(next)
      const b = builtOf(next)
      const run = b.runs.find((r) => r.id === g.run)!
      const a = b.pieces.find((p) => p.id === run.pieceIds[g.seam - 1])
      const c = b.pieces.find((p) => p.id === run.pieceIds[g.seam])
      setReadout({ x: l.client[0], y: l.client[1] - 72, text: `${fmtIn(a?.length ?? 0)}  |  ${fmtIn(c?.length ?? 0)}` })
    } else if (g.kind === 'table') {
      const next = op.snapTable(g.startConfig, g.id, l.pt)
      perf.builds += op.tableTargets(g.startConfig, g.id).length
      store.getState().setDraft(next)
      setReadout({ x: l.client[0], y: l.client[1] - 72, text: 'table' })
    }
    perf.moves++
    perf.computeMs += performance.now() - t0
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (gesture.current) return // second finger during a drag: ignored
    const inv = svgRef.current!.getScreenCTM()!.inverse()
    frozen.current = { k: fit.k, layoutBounds: fit.layout.bounds, inv }
    const pt = toPlan(e.clientX, e.clientY, inv)
    const hit = hitTest(built, grips, pt, { k, lineTolPx: e.pointerType === 'touch' ? 0 : 7 })
    if (!hit) {
      store.getState().setUi({ selectedId: null })
      return
    }
    svgRef.current!.setPointerCapture(e.pointerId) // capture on the stable root
    const startConfig = store.getState().config
    if (hit.type === 'seam') {
      gesture.current = { kind: 'seam', pointerId: e.pointerId, run: hit.run, seam: hit.seam, axis: hit.axis, start: pt, startConfig }
    } else if (hit.type === 'piece') {
      gesture.current = { kind: 'pending', pointerId: e.pointerId, id: hit.id, pieceKind: hit.kind, start: pt, startClient: [e.clientX, e.clientY], startConfig, t0: e.timeStamp }
    }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    const pt = toPlan(e.clientX, e.clientY, frozen.current!.inv)
    latest.current = { pt, client: [e.clientX, e.clientY] }
    if (g.kind === 'pending') {
      const moved = Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1])
      if (moved > 6 && g.pieceKind === 'table') gesture.current = { kind: 'table', pointerId: g.pointerId, id: g.id, startConfig: g.startConfig }
      else return
    }
    if (!raf.current) raf.current = requestAnimationFrame(runFrame) // at most one engine run per frame
  }
  const end = (commit: boolean) => {
    const g = gesture.current
    if (!g) return
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      if (commit && g.kind !== 'pending') runFrame() // flush the last position before committing
    }
    gesture.current = null
    latest.current = null
    setReadout(null)
    if (g.kind === 'pending') {
      if (commit) store.getState().setUi({ selectedId: g.id }) // tap -> select (tap menu)
      return
    }
    if (commit) store.getState().commit()
    else store.getState().cancelDraft()
  }
  const onKeyDown = (grip: Grip) => (e: React.KeyboardEvent) => {
    const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]
    if (!dir) return
    e.preventDefault()
    const c = store.getState().config
    store.getState().commit(op.dragSeam(c, grip.run, grip.seam, dir * (e.shiftKey ? 6 : 0.5)), { key: `seam:${grip.run}:${grip.seam}` })
  }

  useEffect(() => {
    // URL sync: replaceState on commit only (never on drafts), debounced
    const t = setTimeout(() => history.replaceState(null, '', `?c=${encodeConfig(config)}`), 300)
    return () => clearTimeout(t)
  }, [config])

  ;(window as any).__plan = {
    k,
    grips: () =>
      grips.map((g) => {
        const m = svgRef.current!.getScreenCTM()!
        const p = new DOMPoint(g.pt[0], g.pt[1]).matrixTransform(m)
        return { run: g.run, seam: g.seam, row: g.row, x: p.x, y: p.y }
      }),
    toClient: (x: number, y: number) => {
      const p = new DOMPoint(x, y).matrixTransform(svgRef.current!.getScreenCTM()!)
      return [p.x, p.y]
    },
  }

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: '56px 0 0 0' }}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={viewBox}
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', display: 'block' } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => gesture.current?.pointerId === e.pointerId && end(true)}
        onPointerCancel={(e) => gesture.current?.pointerId === e.pointerId && end(false)}
        onLostPointerCapture={(e) => gesture.current?.pointerId === e.pointerId && end(false)}
      >
        <PlanDrawing built={built} dims={dims} k={k} look="cad" theme={LIGHT} showWarnings selectedId={selected} seatWidth={live.seatWidth} />
        <g data-grips="">
          {grips.map((g) => (
            <g key={`${g.run}:${g.seam}`} tabIndex={0} role="slider" aria-label={`Seam ${g.seam} on the ${g.run} run`} onKeyDown={onKeyDown(g)}>
              <line x1={g.axis === 'x' ? g.at : g.pt[0]} y1={g.axis === 'x' ? g.pt[1] : g.at} x2={g.axis === 'x' ? g.at : g.run === 'left' ? built.D : built.W - built.D} y2={g.axis === 'x' ? built.D : g.at} stroke="#2f6fed" strokeWidth={1.5 * k} />
              <circle cx={g.pt[0]} cy={g.pt[1]} r={11 * k} fill="#fff" stroke="#2f6fed" strokeWidth={2 * k} />
              <path d={g.axis === 'x' ? `M${g.pt[0] - 5 * k} ${g.pt[1]}h${10 * k}` : `M${g.pt[0]} ${g.pt[1] - 5 * k}v${10 * k}`} stroke="#2f6fed" strokeWidth={2 * k} />
            </g>
          ))}
        </g>
      </svg>
      {readout && (
        <div data-readout="" style={{ position: 'fixed', left: readout.x, top: readout.y, transform: 'translateX(-50%)', background: '#1c1b19', color: '#fff', padding: '6px 10px', borderRadius: 8, font: '600 15px system-ui', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
          {readout.text}
        </div>
      )}
    </div>
  )
}

function Toolbar() {
  const past = useStore(store, (s) => s.past.length)
  const future = useStore(store, (s) => s.future.length)
  const seats = builtOf(useStore(store, (s) => s.config)).seats.label
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, display: 'flex', gap: 8, alignItems: 'center', padding: '0 12px', borderBottom: '1px solid #ddd', font: '14px system-ui', touchAction: 'manipulation' }}>
      <button data-undo="" disabled={!past} onClick={() => store.getState().undo()} style={{ minWidth: 44, minHeight: 44 }}>Undo</button>
      <button data-redo="" disabled={!future} onClick={() => store.getState().redo()} style={{ minWidth: 44, minHeight: 44 }}>Redo</button>
      <span>{seats}</span>
    </div>
  )
}

;(window as any).__store = store
;(window as any).__perf = perf
createRoot(document.getElementById('root')!).render(
  <>
    <Toolbar />
    <PlanEditor />
  </>,
)
