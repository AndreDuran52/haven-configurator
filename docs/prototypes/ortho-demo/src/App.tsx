import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
// the whole 3D stack (three + R3F + drei) loads only when the 3D view mounts
const ThreeView = lazy(() => import('./three/ThreeView').then((m) => ({ default: m.ThreeView })))
import { PRESETS, type PresetName } from './three/presets'
import type { RenderStyle } from './three/SofaModel'
import { PlanOverlay } from './plan/PlanOverlay'

const q = new URLSearchParams(location.search)
const UI_PRESETS: PresetName[] = ['dimetric', 'front', 'side', 'top']

export function App() {
  const [preset, setPreset] = useState<PresetName>((q.get('preset') as PresetName) || 'dimetric')
  const [style, setStyle] = useState<RenderStyle>((q.get('style') as RenderStyle) || 'outline')
  const shadows = q.get('shadows') !== '0'
  const showUi = q.get('ui') !== '0'
  const parity = q.get('parity') // e.g. "4.25,94,66,outline"
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    // iOS Safari: block page pinch-zoom that starts on the 3D view (touch-action covers pointer
    // gestures, but Safari still fires proprietary gesture* events for page zoom)
    const stop = (e: Event) => e.preventDefault()
    el.addEventListener('gesturestart', stop)
    return () => {
      ro.disconnect()
      el.removeEventListener('gesturestart', stop)
    }
  }, [])

  const [pp, pcx, pcy, pmode] = (parity ?? '').split(',')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showUi && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e5ded3', alignItems: 'center' }}>
          {UI_PRESETS.map((p) => (
            <button
              key={p}
              data-preset={p}
              onClick={() => setPreset(p)}
              style={{
                minHeight: 44,
                minWidth: 64,
                padding: '0 14px',
                borderRadius: 10,
                border: '1px solid #d6cdbf',
                background: preset === p ? '#2b2420' : '#fff',
                color: preset === p ? '#fff' : '#2b2420',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {p === 'dimetric' ? '3/4' : PRESETS[p].label}
            </button>
          ))}
          <select value={style} onChange={(e) => setStyle(e.target.value as RenderStyle)} style={{ minHeight: 44, borderRadius: 10, fontSize: 15, marginLeft: 'auto' }}>
            <option value="soft">Soft</option>
            <option value="outline">Outline</option>
            <option value="edges">Edges</option>
            <option value="silhouette">Silhouette</option>
          </select>
        </div>
      )}
      <div
        ref={boxRef}
        id="view3d"
        style={{ flex: 1, position: 'relative', minHeight: 0, touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties}
      >
        <Suspense fallback={null}>
          <ThreeView preset={preset} style={style} shadows={shadows} />
        </Suspense>
        {parity && box.w > 0 && <PlanOverlay width={box.w} height={box.h} pxPerInch={Number(pp)} cx={Number(pcx)} cy={Number(pcy)} mode={(pmode as 'outline' | 'fill') || 'outline'} />}
      </div>
    </div>
  )
}
