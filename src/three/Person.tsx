// The person sitting on the sofa (Andre, 2026-11-11, plan Q79): a stick person
// in one dark matte colour (round head, slim body and limbs), built from the
// same joints as the Side drawing (ortho/person.ts), so the two always agree;
// the body is a tube along the curved spine. Drawn inside SofaModel's group
// (plan inches): x across the seat, y up, z = inches from the sofa's back.
import { useEffect, useMemo } from 'react';
import { Outlines } from '@react-three/drei';
import { CatmullRomCurve3, MeshStandardMaterial, TubeGeometry, Vector3, type Material } from 'three';
import type { PersonFigure, Pt2 } from '@/ortho/person';
import { PERSON_ACROSS, type PersonSeat } from '@/ortho/personSeat';
import { chopPillow } from './softGeometry';

const BODY = '#56514b';
const LINE = '#211f1c';

function Limb({ name, a, b, w, x = 0, mat }: { name: string; a: Pt2; b: Pt2; w: number; x?: number; mat: Material }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <mesh name={`person:${name}`} position={[x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2]} rotation={[Math.atan2(b[0] - a[0], b[1] - a[1]), 0, 0]} material={mat}>
      <capsuleGeometry args={[w / 2, len, 6, 12]} />
      <Outlines thickness={1} color={LINE} />
    </mesh>
  );
}

export function Person({ fig, seat, pillowMat }: { fig: PersonFigure; seat: PersonSeat; pillowMat: Material }) {
  const mat = useMemo(() => new MeshStandardMaterial({ color: BODY, roughness: 1, metalness: 0 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const t = fig.thick;
  const torso = useMemo(() => new TubeGeometry(new CatmullRomCurve3(fig.spine.map(([s, z]) => new Vector3(0, z, s))), 32, t.torso / 2, 14, false), [fig.spine, t.torso]);
  useEffect(() => () => torso.dispose(), [torso]);
  const pt = fig.pillow ? fig.pillow.t1 - fig.pillow.t0 : 0;
  const pillow = useMemo(() => (pt ? chopPillow(20, 20, pt) : null), [pt]);
  useEffect(() => () => pillow?.dispose(), [pillow]);
  const hip = PERSON_ACROSS.hip * fig.height;
  const arm = PERSON_ACROSS.arm * fig.height;
  const ends = [fig.spine[0]!, fig.spine[fig.spine.length - 1]!];
  return (
    <group name="person" position={[seat.x, 0, seat.back]}>
      <group scale={[PERSON_ACROSS.torso, 1, 1]}>
        <mesh name="person:torso" geometry={torso} material={mat}>
          <Outlines thickness={1} color={LINE} />
        </mesh>
        {ends.map(([s, z], i) => (
          <mesh key={i} name="person:torso-end" position={[0, z, s]} material={mat}>
            <sphereGeometry args={[t.torso / 2, 16, 12]} />
          </mesh>
        ))}
      </group>
      <Limb name="neck" a={fig.shoulder} b={fig.head} w={t.arm * 1.1} mat={mat} />
      <mesh name="person:head" position={[0, fig.head[1], fig.head[0]]} scale={[1, 1.08, 1]} material={mat}>
        <sphereGeometry args={[t.headR, 24, 16]} />
        <Outlines thickness={1} color={LINE} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Limb name="thigh" a={fig.hip} b={fig.knee} w={t.thigh} x={side * hip} mat={mat} />
          <Limb name="shin" a={fig.knee} b={fig.ankle} w={t.shin} x={side * hip} mat={mat} />
          <Limb name="foot" a={fig.ankle} b={fig.toe} w={t.foot} x={side * hip} mat={mat} />
          <Limb name="upper-arm" a={fig.shoulder} b={fig.elbow} w={t.arm} x={side * arm} mat={mat} />
          <Limb name="forearm" a={fig.elbow} b={fig.hand} w={t.arm} x={side * arm} mat={mat} />
        </group>
      ))}
      {fig.pillow && pillow && (
        <mesh name="person:pillow" geometry={pillow} position={[0, (fig.pillow.z0 + fig.pillow.z1) / 2, (fig.pillow.t0 + fig.pillow.t1) / 2]} material={pillowMat}>
          <Outlines thickness={1.25} color="#4a4038" />
        </mesh>
      )}
    </group>
  );
}
