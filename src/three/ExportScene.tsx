// The scene for offscreen sheet renders (three/export.ts): the live view's
// model and pillows with its lights, on white, no floor slab.
import { useLayoutEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { useThree } from '@react-three/fiber';
import type { PillowAnchor } from '@/engine';
import { aimKeyLight } from './keyLight';
import type { MaterialSet } from './materials';
import type { Parts } from './parts';
import { Pillows } from './Pillows';
import { SofaModel } from './SofaModel';

function KeyLight() {
  const ref = useRef<DirectionalLight>(null);
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    if (ref.current) aimKeyLight(ref.current, camera);
  }, [camera]);
  return <directionalLight ref={ref} intensity={1.7} />;
}

export function ExportScene({ parts, pillows, mats, offset }: { parts: Parts; pillows: PillowAnchor[]; mats: MaterialSet; offset: [number, number] }) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#b9ab97', 1.2]} />
      <KeyLight />
      <directionalLight position={[1200, 500, 300]} intensity={0.3} />
      <group position={[offset[0], 0, offset[1]]}>
        <SofaModel parts={parts} mats={mats} showLoose />
        <Pillows anchors={pillows} mats={mats.pillow} />
      </group>
    </>
  );
}
