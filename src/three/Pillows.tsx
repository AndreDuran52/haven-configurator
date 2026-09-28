// Throw pillows at the engine's anchors (plan §7.4, 3D-07; pillowAnchors), in
// plan inches inside SofaModel's group: down-feather "karate chop" squares
// leaning on the back cushions, and ball pillows. Andre's Blender models
// (three/models.ts) replace the procedural shapes when they are there.
import { useEffect, useMemo } from 'react';
import { Outlines } from '@react-three/drei';
import type { Material } from 'three';
import { BALL_PILLOW, SQUARE_PILLOW, type PillowAnchor, type PillowTone } from '@/engine';
import type { SoftModels } from './models';
import { ballPillow, boxTransform, chopPillow } from './softGeometry';

export function Pillows({ anchors, mats, models }: { anchors: PillowAnchor[]; mats: Record<PillowTone, Material>; models?: SoftModels | null }) {
  // One geometry per size (the sizes are constants: SQUARE_PILLOW, BALL_PILLOW).
  const chop = useMemo(() => chopPillow(SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t), []);
  const round = useMemo(() => ballPillow(BALL_PILLOW), []);
  useEffect(() => () => chop.dispose(), [chop]);
  useEffect(() => () => round.dispose(), [round]);
  // The models are shared and cached for the session: never disposed here.
  const sqGeo = models?.square ?? chop;
  const ballGeo = models?.ball ?? round;
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
