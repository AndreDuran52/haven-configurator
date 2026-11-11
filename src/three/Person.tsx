// The person sitting on the sofa (Andre, 2026-11-11, plan Q79): plain rounded
// solids in one matte grey, built from the same joints as the Side drawing
// (ortho/person.ts), so the two always agree. Drawn inside SofaModel's group
// (plan inches): x across the seat, y up, z = inches from the sofa's back.
import { useEffect, useMemo } from 'react';
import { Outlines } from '@react-three/drei';
import { MeshStandardMaterial, type Material } from 'three';
import type { PersonFigure, Pt2 } from '@/ortho/person';
import { PERSON_ACROSS, type PersonSeat } from '@/ortho/personSeat';
import { chopPillow } from './softGeometry';

const LINE = '#4a4038';

function Limb({ name, a, b, w, x = 0, wide = 1, mat }: { name: string; a: Pt2; b: Pt2; w: number; x?: number; wide?: number; mat: Material }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <mesh name={`person:${name}`} position={[x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2]} rotation={[Math.atan2(b[0] - a[0], b[1] - a[1]), 0, 0]} scale={[wide, 1, 1]} material={mat}>
      <capsuleGeometry args={[w / 2, len, 6, 16]} />
      <Outlines thickness={1.25} color={LINE} />
    </mesh>
  );
}

export function Person({ fig, seat, pillowMat }: { fig: PersonFigure; seat: PersonSeat; pillowMat: Material }) {
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#aaa69f', roughness: 1, metalness: 0 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const pt = fig.pillow ? fig.pillow.t1 - fig.pillow.t0 : 0;
  const pillow = useMemo(() => (pt ? chopPillow(20, 20, pt) : null), [pt]);
  useEffect(() => () => pillow?.dispose(), [pillow]);
  const hip = PERSON_ACROSS.hip * fig.height;
  const arm = PERSON_ACROSS.arm * fig.height;
  const t = fig.thick;
  return (
    <group name="person" position={[seat.x, 0, seat.back]}>
      <Limb name="torso" a={fig.pelvis} b={fig.shoulder} w={t.torso} wide={PERSON_ACROSS.torso} mat={mat} />
      <mesh name="person:head" position={[0, fig.head[1], fig.head[0]]} material={mat}>
        <sphereGeometry args={[t.headR, 24, 16]} />
        <Outlines thickness={1.25} color={LINE} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Limb name="thigh" a={fig.hip} b={fig.knee} w={t.thigh} x={side * hip} mat={mat} />
          <Limb name="shin" a={fig.knee} b={fig.ankle} w={t.shin} x={side * hip} mat={mat} />
          <Limb name="foot" a={fig.ankle} b={fig.toe} w={t.foot} x={side * hip} mat={mat} />
          <Limb name="upper-arm" a={fig.shoulder} b={fig.elbow} w={t.arm} x={side * arm} mat={mat} />
          <Limb name="forearm" a={fig.elbow} b={fig.hand} w={t.arm} x={side * arm * 0.8} mat={mat} />
        </group>
      ))}
      {fig.pillow && pillow && (
        <mesh name="person:pillow" geometry={pillow} position={[0, (fig.pillow.z0 + fig.pillow.z1) / 2, (fig.pillow.t0 + fig.pillow.t1) / 2]} material={pillowMat}>
          <Outlines thickness={1.25} color={LINE} />
        </mesh>
      )}
    </group>
  );
}
