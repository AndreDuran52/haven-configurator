// Evidence page: does drei <Bounds> cooperate with <CameraControls> on an ortho camera?
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Bounds, CameraControls, OrbitControls, useBounds } from '@react-three/drei'
import type { OrthographicCamera } from 'three'

const mode = new URLSearchParams(location.search).get('controls') ?? 'cc'

function Probe() {
  const bounds = useBounds()
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const controls = useThree((s) => s.controls) as unknown as Record<string, unknown> | null
  useEffect(() => {
    ;(window as unknown as { __b: unknown }).__b = {
      refit: () => bounds.refresh().to({ position: [300, 300, 300], target: [0, 0, 0] }).fit(),
      state: () => ({ zoom: camera.zoom, pos: camera.position.toArray(), hasTarget: !!controls && 'target' in controls, controlsType: controls?.constructor?.name }),
    }
  }, [bounds, camera, controls])
  return null
}

createRoot(document.getElementById('root')!).render(
  <Canvas orthographic camera={{ position: [0, 0, 500], near: 1, far: 3000 }}>
    <ambientLight />
    {mode === 'cc' ? <CameraControls makeDefault /> : <OrbitControls makeDefault />}
    <Bounds fit clip observe margin={1.1} maxDuration={0.3}>
      <mesh>
        <boxGeometry args={[188, 27, 132]} />
        <meshNormalMaterial />
      </mesh>
      <Probe />
    </Bounds>
  </Canvas>,
)
