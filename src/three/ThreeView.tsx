// The read-only orthographic 3D view (plan §7), loaded only through lazy().
// <Canvas orthographic> gets ONLY near/far/position (left/right/top/bottom would
// set camera.manual and R3F would stop resizing the frustum); zoom = px/in.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Box3, NeutralToneMapping, Vector3, type DirectionalLight, type Texture } from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { planCentre, type BuildResult } from '@/engine';
import { fitPoints, FLOOR_THICKNESS, FLOOR_TOP } from '@/ortho/fitPoints';
import { isElevation } from '@/ortho/presets';
import { builtOf, useHaven, useHavenStore, useLive } from '@/state/store';
import { aimKeyLight } from './keyLight';
import { FLOOR_MARGIN, makeMaterials } from './materials';
import { Overlay } from './Overlay';
import { buildParts } from './parts';
import { CAMERA_DISTANCE, Rig } from './Rig';
import { SofaModel } from './SofaModel';
import { createViewStore } from './viewStore';

/** Key light from the camera's upper-left-front, re-aimed on every frame (plan §7.3). */
function CameraKeyLight() {
  const ref = useRef<DirectionalLight>(null);
  useFrame(({ camera }) => {
    if (ref.current) aimKeyLight(ref.current, camera);
  }, -2);
  return <directionalLight name="key-light" ref={ref} intensity={1.7} />;
}

function worldBounds(built: BuildResult): { box: Box3; offset: [number, number]; size: [number, number] } {
  const c = planCentre(built.bounds);
  const b = built.bounds;
  const box = new Box3(new Vector3(b.minX - c.cx, 0, b.minY - c.cy), new Vector3(b.maxX - c.cx, built.heights.backHeight, b.maxY - c.cy));
  return { box, offset: [-c.cx, -c.cy], size: [b.maxX - b.minX, b.maxY - b.minY] };
}

export default function ThreeView() {
  const store = useHavenStore();
  const live = useLive();
  const preset = useHaven((s) => s.ui.preset);
  const handoff = useHaven((s) => s.ui.handoff);
  const showLooseUi = useHaven((s) => s.ui.showLoose);
  const built = builtOf(live);
  // Loose pieces are hidden in the elevations by default (a centred coffee table hides the back run).
  const showLoose = showLooseUi || !isElevation(preset);
  const parts = useMemo(() => buildParts(built, live.tableStyle), [built, live.tableStyle]);
  const points = useMemo(() => fitPoints(built, { loose: showLoose }), [built, showLoose]);
  const world = useMemo(() => worldBounds(built), [built]);
  const mats = useMemo(() => makeMaterials(live.fabric, live.tableFinish), [live.fabric, live.tableFinish]);
  useEffect(() => () => mats.dispose(), [mats]);
  const view = useMemo(() => createViewStore(), []);
  const wrap = useRef<HTMLDivElement>(null);
  // The canvas gets the same whole-pixel box as the plan SVG (parity hand-off).
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const floorW = world.size[0] + FLOOR_MARGIN;
  const floorD = world.size[1] + FLOOR_MARGIN;
  useEffect(() => {
    (mats.floor as unknown as { map: Texture }).map.repeat.set(floorW / 24, floorD / 24);
  }, [mats, floorW, floorD]);

  // iOS Safari: block page pinch-zoom that starts on the 3D view (plan §7.5).
  useEffect(() => {
    const el = wrap.current!;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('gesturestart', stop);
    el.addEventListener('gesturechange', stop);
    return () => {
      el.removeEventListener('gesturestart', stop);
      el.removeEventListener('gesturechange', stop);
    };
  }, []);

  return (
    <div ref={wrap} className="three-view relative h-full w-full" data-testid="three-view" style={{ touchAction: 'none' } as CSSProperties}>
      {box && (
      <div className="absolute top-0 left-0" style={{ width: box.w, height: box.h }}>
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ near: 1, far: CAMERA_DISTANCE * 3, position: [0, 0, CAMERA_DISTANCE] }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping; // ACES turns white bouclé grey and yellow
        }}
      >
        <color attach="background" args={['#efe6d8']} />
        <hemisphereLight args={['#ffffff', '#b9ab97', 1.2]} />
        <CameraKeyLight />
        <directionalLight position={[1200, 500, 300]} intensity={0.3} />
        <group position={[world.offset[0], 0, world.offset[1]]}>
          <SofaModel parts={parts} mats={mats} showLoose={showLoose} />
        </group>
        <mesh name="floor" position={[0, FLOOR_TOP - FLOOR_THICKNESS / 2, 0]} material={mats.floor}>
          <boxGeometry args={[floorW, FLOOR_THICKNESS, floorD]} />
        </mesh>
        <ContactShadows
          key={JSON.stringify(parts.prisms.length) + built.W + built.L + built.R + built.D}
          name="contact-shadows"
          position={[0, -0.1, 0]}
          scale={[floorW, floorD]}
          far={9} // under the 10″ deck: only base parts cast
          blur={2.5}
          opacity={0.85}
          resolution={1024}
          color="#2e2217"
          frames={1}
        />
        <Rig
          shape={built.shape}
          preset={preset}
          points={points}
          bounds={world.box}
          offset={world.offset}
          handoff={handoff}
          onHandoff={() => store.getState().setUi({ handoff: null })}
          view={view}
        />
      </Canvas>
      </div>
      )}
      <Overlay view={view} preset={preset} heights={built.heights} />
    </div>
  );
}
