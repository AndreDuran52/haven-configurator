// Pillows at the engine's anchors (plan §7.4, 3D-07; pillowAnchors), in plan
// inches inside SofaModel's group. Each faces into the seat; squares lean on
// the back cushion.
import { useEffect, useMemo } from 'react';
import { Outlines } from '@react-three/drei';
import type { Material } from 'three';
import { BALL_PILLOW, SQUARE_PILLOW, type PillowAnchor, type PillowTone } from '@/engine';
import { ballPillow, squarePillow } from './pillowGeometry';

const D2R = Math.PI / 180;

export function Pillows({ anchors, mats }: { anchors: PillowAnchor[]; mats: Record<PillowTone, Material> }) {
  // One geometry per size (the sizes are constants: SQUARE_PILLOW, BALL_PILLOW).
  const sqGeo = useMemo(() => squarePillow(SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t), []);
  const ballGeo = useMemo(() => ballPillow(BALL_PILLOW), []);
  useEffect(() => () => sqGeo.dispose(), [sqGeo]);
  useEffect(() => () => ballGeo.dispose(), [ballGeo]);
  return (
    <group name="pillows">
      {anchors.map((a) => (
        <mesh
          key={a.key}
          name={`pillow:${a.key}`}
          geometry={a.kind === 'square' ? sqGeo : ballGeo}
          material={mats[a.tone]}
          position={[a.x, a.z, a.y]}
          rotation={[-a.lean * D2R, Math.atan2(a.facing[0], a.facing[1]), 0, 'YXZ']}
          userData={{ part: true }}
        >
          <Outlines thickness={1.25} color="#4a4038" />
        </mesh>
      ))}
    </group>
  );
}
