import { useCallback, useEffect, useRef } from 'react'
import { Box3, Color, OrthographicCamera, Vector2, Vector3, type DirectionalLight } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { DemandSafeCameraControls } from './controls'
import { aimKeyLight } from './keyLight'
import { PRESETS, defaultPadding, fitOrtho, nearestAngle, presetDirection, screenBasis, type PresetName } from './orthoFit'

export const CAMERA_DISTANCE = 2000 // inches from target; ortho ⇒ distance only matters for clipping
const D2R = Math.PI / 180
const MAX_ZOOM = 40 // px per inch: a 1" leg = 40 px. Plenty for a seam close-up.

type Pt = readonly [number, number, number]

export interface HavenTestApi {
  apply: (name: PresetName, animate: boolean) => void
  state: () => { azimuthDeg: number; polarDeg: number; zoom: number; target: number[]; position: number[]; frames: number; resting: boolean; minZoom: number; maxZoom: number; size: number[] }
  fit: (name: PresetName) => { zoom: number; target: number[]; spanU: number; spanV: number }
  capture: () => string
  project: (pts: [number, number, number][]) => [number, number][]
  /** top view at an exact px/in, centred on PLAN point (cx, cy) */
  setTopAt: (pxPerInch: number, cx: number, cy: number) => void
  /** world = plan + offset (x, 0, y) */
  offset: number[]
  exportView: (name: PresetName, pxPerInch: number, opts?: { floor?: boolean; shadows?: boolean; padIn?: number }) => { url: string; w: number; h: number }
  exportSheet: (pxPerInch: number) => Promise<{ url: string; w: number; h: number }>
  setClamp: (on: boolean) => void
  zoomTo: (z: number) => void
  autoFit: () => boolean
}

declare global {
  interface Window {
    __haven?: HavenTestApi
  }
}

export function Rig({ preset, points, bounds, offset }: { preset: PresetName; points: Pt[]; bounds: Box3; offset: Vector3 }) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const autoFit = useRef(true)
  const current = useRef<PresetName>(preset)
  const frames = useRef(0)
  const resting = useRef(true)

  useFrame(() => {
    frames.current++
  })

  const apply = useCallback(
    (name: PresetName, animate: boolean) => {
      const c = controlsRef.current
      if (!c) return
      const def = PRESETS[name]
      const fit = fitOrtho(points, def, size.width, size.height, defaultPadding(size.width, size.height))
      c.normalizeRotations()
      const theta = nearestAngle(c.azimuthAngle, def.azimuthDeg * D2R)
      const phi = (90 - def.elevationDeg) * D2R
      // zoom floor: never let the user lose the sofa — half of the smallest preset fit zoom
      const pad = defaultPadding(size.width, size.height)
      c.minZoom = 0.5 * Math.min(...(Object.keys(PRESETS) as PresetName[]).map((n) => fitOrtho(points, PRESETS[n], size.width, size.height, pad).zoom))
      c.maxZoom = MAX_ZOOM
      void c.moveTo(fit.target.x, fit.target.y, fit.target.z, animate)
      void c.rotateTo(theta, phi, animate)
      void c.zoomTo(fit.zoom, animate)
      current.current = name
      autoFit.current = true
      if (animate) resting.current = false // cleared by camera-controls' 'sleep'
      invalidate()
    },
    [points, size.width, size.height, invalidate],
  )

  // first mount: place the camera at a fixed distance, then snap to the preset
  const placed = useRef(false)
  useEffect(() => {
    const c = controlsRef.current
    if (!c || placed.current) return
    placed.current = true
    const def = PRESETS[preset]
    const dir = presetDirection(def)
    const t = bounds.getCenter(new Vector3())
    void c.setLookAt(t.x + dir.x * CAMERA_DISTANCE, t.y + dir.y * CAMERA_DISTANCE, t.z + dir.z * CAMERA_DISTANCE, t.x, t.y, t.z, false)
    c.minPolarAngle = 0
    c.maxPolarAngle = Math.PI / 2 // never below the floor; elevations sit exactly on the limit
    c.setBoundary(bounds.clone().expandByScalar(24)) // target can't be panned away from the sofa
    c.dollyToCursor = true // ortho: zoom toward the pinch/wheel point
    c.smoothTime = 0.3
    const onStart = () => {
      autoFit.current = false
    }
    const onSleepOrRest = () => {
      resting.current = true
    }
    const onWake = () => {
      resting.current = false
    }
    c.addEventListener('controlstart', onStart)
    c.addEventListener('sleep', onSleepOrRest)
    c.addEventListener('wake', onWake)
    apply(preset, false)
  }, [apply, preset, bounds])

  // preset changes from the UI animate
  useEffect(() => {
    if (placed.current && preset !== current.current) apply(preset, true)
  }, [preset, apply])

  // resize / rotation: refit if the user hasn't taken over the camera since the last preset
  useEffect(() => {
    if (!placed.current) return
    if (autoFit.current) apply(current.current, false)
  }, [size.width, size.height, apply])

  // -------------------------------------------------------------------------------------
  // Test + export hooks
  useEffect(() => {
    const capture = () => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png') // same task as render ⇒ no preserveDrawingBuffer needed
    }
    const project = (pts: [number, number, number][]) =>
      pts.map(([x, y, z]) => {
        const v = new Vector3(x, y, z).project(camera)
        return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height] as [number, number]
      })
    const setTopAt = (pxPerInch: number, cx: number, cy: number) => {
      const c = controlsRef.current!
      c.normalizeRotations()
      void c.moveTo(cx + offset.x, 13.5, cy + offset.z, false)
      void c.rotateTo(nearestAngle(c.azimuthAngle, 0), 0, false)
      void c.zoomTo(pxPerInch, false)
      c.update(0)
      autoFit.current = false
      invalidate()
    }
    const exportView = (name: PresetName, pxPerInch: number, opts: { floor?: boolean; shadows?: boolean; padIn?: number } = {}) => {
      const padIn = opts.padIn ?? 4
      const def = PRESETS[name]
      const fit = fitOrtho(points, def, 1000, 1000, { top: 0, right: 0, bottom: 0, left: 0 })
      const w = Math.round((fit.spanU + 2 * padIn) * pxPerInch)
      const h = Math.round((fit.spanV + 2 * padIn) * pxPerInch)
      const hw = w / pxPerInch / 2
      const hh = h / pxPerInch / 2
      const cam = new OrthographicCamera(-hw, hw, hh, -hh, 1, CAMERA_DISTANCE * 3)
      const dir = presetDirection(def)
      const basis = screenBasis(dir, def.azimuthDeg)
      cam.up.copy(basis.up)
      cam.position.copy(fit.target).addScaledVector(dir, CAMERA_DISTANCE)
      cam.lookAt(fit.target)
      cam.updateMatrixWorld()
      cam.updateProjectionMatrix()
      const floor = scene.getObjectByName('floor')
      const shadowsObj = scene.getObjectByName('contact-shadows')
      const key = scene.getObjectByName('key-light') as DirectionalLight | undefined
      const prevFloor = floor?.visible ?? true
      const prevShadows = shadowsObj?.visible ?? true
      const prevBg = scene.background
      if (floor && opts.floor === false) {
        floor.visible = false
        scene.background = new Color('#ffffff')
      }
      // a contact shadow wider than the export frame gets hard-clipped at the edges → off for sheets
      if (shadowsObj && (opts.shadows ?? opts.floor !== false) === false) shadowsObj.visible = false
      if (key) aimKeyLight(key, cam) // camera-relative light must follow the EXPORT camera
      const prevPR = gl.getPixelRatio()
      const prevSize = gl.getSize(new Vector2())
      gl.setPixelRatio(1)
      gl.setSize(w, h, false) // drawing buffer only; CSS size untouched
      gl.render(scene, cam)
      const url = gl.domElement.toDataURL('image/png')
      gl.setPixelRatio(prevPR)
      gl.setSize(prevSize.x, prevSize.y, false)
      if (floor) floor.visible = prevFloor
      if (shadowsObj) shadowsObj.visible = prevShadows
      if (key) aimKeyLight(key, camera)
      scene.background = prevBg
      gl.render(scene, camera) // repaint the live view in the same task: no visible flash
      return { url, w, h }
    }
    const exportSheet = (pxPerInch: number) => {
      // third-angle multiview: plan on top, front elevation below it (x aligned),
      // right elevation to the right of the front (heights aligned). One common scale.
      const plan = exportView('top', pxPerInch, { floor: false })
      const front = exportView('front', pxPerInch, { floor: false })
      const side = exportView('side', pxPerInch, { floor: false })
      const gap = Math.round(18 * pxPerInch)
      const label = 28
      const W = plan.w + gap + side.w
      const Hh = label + plan.h + gap + label + front.h + label
      const cv = document.createElement('canvas')
      cv.width = W
      cv.height = Hh
      const g = cv.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, W, Hh)
      g.fillStyle = '#222'
      g.font = '600 16px system-ui, sans-serif'
      const imgs = [plan, front, side].map((v) => {
        const im = new Image()
        im.src = v.url
        return im
      })
      return new Promise<{ url: string; w: number; h: number }>((resolve) => {
        let n = 0
        imgs.forEach((im) =>
          im.addEventListener('load', () => {
            if (++n < 3) return
            g.fillText('PLAN', 0, 20)
            g.drawImage(imgs[0], 0, label)
            const fy = label + plan.h + gap
            g.fillText('FRONT ELEVATION (from open end)', 0, fy + 20)
            g.drawImage(imgs[1], 0, fy + label)
            g.fillText('RIGHT ELEVATION', plan.w + gap, fy + 20)
            g.drawImage(imgs[2], plan.w + gap, fy + label)
            g.font = '14px system-ui, sans-serif'
            g.fillText(`Scale ${pxPerInch} px = 1 in  ·  third-angle projection`, 0, Hh - 8)
            resolve({ url: cv.toDataURL('image/png'), w: W, h: Hh })
          }),
        )
      })
    }
    const api: HavenTestApi = {
      apply,
      state: () => {
        const c = controlsRef.current!
        const t = c.getTarget(new Vector3())
        const p = c.getPosition(new Vector3())
        return {
          azimuthDeg: c.azimuthAngle / D2R,
          polarDeg: c.polarAngle / D2R,
          zoom: camera.zoom,
          target: t.toArray(),
          position: p.toArray(),
          frames: frames.current,
          resting: resting.current,
          minZoom: c.minZoom,
          maxZoom: c.maxZoom,
          size: [size.width, size.height],
        }
      },
      fit: (name) => {
        const f = fitOrtho(points, PRESETS[name], size.width, size.height, defaultPadding(size.width, size.height))
        return { zoom: f.zoom, target: f.target.toArray(), spanU: f.spanU, spanV: f.spanV }
      },
      capture,
      project,
      setTopAt,
      exportView,
      exportSheet,
      offset: offset.toArray(),
      zoomTo: (z) => {
        void controlsRef.current!.zoomTo(z, false)
        invalidate()
      },
      autoFit: () => autoFit.current,
      setClamp: (on) => {
        DemandSafeCameraControls.clampEnabled = on
      },
    }
    window.__haven = api
    ;(window as unknown as { __r3f: unknown }).__r3f = { gl, scene, camera }
  }, [apply, camera, gl, scene, size.width, size.height, points, invalidate, offset])

  return <CameraControls ref={controlsRef} impl={DemandSafeCameraControls} makeDefault />
}
