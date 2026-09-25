import { useMemo, useRef } from 'react'
import { Box3, NeutralToneMapping, Vector3, type DirectionalLight } from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { allParts, buildStandardU, fitPoints, STANDARD_U } from '../haven/standardU'
import { aimKeyLight } from './keyLight'
import { FLOOR_SIZE, FLOOR_THICKNESS, makeMaterials } from './materials'
import { SofaModel, type RenderStyle } from './SofaModel'
import { CAMERA_DISTANCE, Rig } from './Rig'
import type { PresetName } from './orthoFit'

const q = new URLSearchParams(location.search)
const csq = q.get('csframes')
const csFrames = csq === 'inf' ? Infinity : Number(csq ?? 1)
const lightMode = q.get('light') ?? 'camera' // 'camera' | 'world'

/**
 * Key light that follows the camera: always from upper-left-front of the current view.
 * Every preset (and any orbit) then gets the same illustration shading — faces toward the
 * viewer lit, top/left brighter than right — instead of the side elevation going muddy
 * because it faces away from a fixed world light.
 */
function CameraKeyLight({ intensity = 1.6 }: { intensity?: number }) {
  const ref = useRef<DirectionalLight>(null)
  useFrame(({ camera }) => {
    if (ref.current) aimKeyLight(ref.current, camera)
  }, -2)
  // named so offscreen exports can re-aim it at THEIR camera (see Rig.exportView)
  return <directionalLight name="key-light" ref={ref} intensity={intensity} />
}

export function ThreeView({ preset, style, shadows }: { preset: PresetName; style: RenderStyle; shadows: boolean }) {
  const cfg = STANDARD_U
  // World = plan translated so the plan's centre sits at the origin (x ↔ plan x, z ↔ plan y).
  // Required by drei <ContactShadows>: its blur passes draw a plane at the WORLD ORIGIN through
  // the shadow camera, so the shadow group must sit at x = z = 0, just below y = 0.
  const { prisms, legs, points, bounds, offset } = useMemo(() => {
    const pieces = buildStandardU(cfg)
    const parts = allParts(cfg, pieces)
    const planPts = fitPoints(parts.prisms)
    const planBox = new Box3().setFromPoints(planPts.map(([x, y, z]) => new Vector3(x, y, z)))
    const c = planBox.getCenter(new Vector3())
    const offset = new Vector3(-c.x, 0, -c.z)
    const points = planPts.map(([x, y, z]) => [x + offset.x, y, z + offset.z] as const)
    const bounds = planBox.clone().translate(offset)
    return { ...parts, points, bounds, offset }
  }, [cfg])
  const mats = useMemo(() => makeMaterials(), [])
  const sizeV = bounds.getSize(new Vector3())
  const sil = style === 'silhouette'

  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 2]}
      // near/far only (no left/right/top/bottom) so R3F keeps managing the frustum on resize
      camera={{ near: 1, far: CAMERA_DISTANCE * 3, position: [0, 0, CAMERA_DISTANCE] }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping // ACES greys & yellows white bouclé
      }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[sil ? '#ffffff' : '#efe6d8']} />
      <hemisphereLight args={['#ffffff', '#b9ab97', 1.2]} />
      {lightMode === 'camera' ? (
        <CameraKeyLight intensity={1.7} />
      ) : (
        <directionalLight position={[-900, 1400, 1100]} intensity={1.7} />
      )}
      <directionalLight position={[1200, 500, 300]} intensity={0.3} />
      <group position={offset}>
        <SofaModel prisms={prisms} legs={legs} mats={mats} style={style} />
      </group>
      {!sil && (
        <mesh name="floor" position={[0, -0.2 - FLOOR_THICKNESS / 2, 0]} material={mats.floor}>
          <boxGeometry args={[FLOOR_SIZE, FLOOR_THICKNESS, FLOOR_SIZE]} />
        </mesh>
      )}
      {!sil && shadows && (
        <ContactShadows
          name="contact-shadows"
          position={[0, -0.1, 0]}
          scale={[sizeV.x + 60, sizeV.z + 60]}
          far={9} // below the 10" deck: only base parts (legs, bodies, arms, table) cast
          blur={2.5}
          opacity={0.85}
          resolution={1024}
          color="#2e2217"
          frames={csFrames}
        />
      )}
      <Rig preset={preset} points={points} bounds={bounds} offset={offset} />
    </Canvas>
  )
}
