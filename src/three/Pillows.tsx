// Throw pillows at the engine's anchors (plan §7.4, 3D-07; pillowAnchors), in
// plan inches inside SofaModel's group: down-feather "karate chop" squares
// leaning on the back cushions, and ball pillows.
import { useEffect, useMemo } from 'react';
import { Outlines } from '@react-three/drei';
import type { Material } from 'three';
import { BALL_PILLOW, SQUARE_PILLOW, type PillowAnchor, type PillowTone } from '@/engine';
import { ballPillow, boxTransform, chopPillow } from './softGeometry';

export function Pillows({ anchors, mats }: { anchors: PillowAnchor[]; mats: Record<PillowTone, Material> }) {
  // One geometry per size (the sizes are constants: SQUARE_PILLOW, BALL_PILLOW).
  const sqGeo = useMemo(() => chopPillow(SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t), []);
  const ballGeo = useMemo(() => ballPillow(BALL_PILLOW), []);
  useEffect(() => () => sqGeo.dispose(), [sqGeo]);
  useEffect(() => () => ballGeo.dispose(), [ballGeo]);
  return (
    <group name="pillows">
      {anchors.map((a) => (
        <mesh key={a.key} name={`pillow:${a.key}`} geometry={a.kind === 'square' ? sqGeo : ballGeo} material={mats[a.tone]} {...boxTransform(a)} userData={{ part: true }}>
          <Outlines thickness={1.25} color="#4a4038" />
        </mesh>
      ))}
    </group>
  );
}
