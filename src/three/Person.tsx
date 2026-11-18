// The person sitting on the sofa (Andre, 2026-11-11, plan Q79): a plain,
// faceless mannequin in one warm mid-grey, built from the same joints and
// sizes as the Side drawing (ortho/person.ts), so the two always agree.
// Drawn inside SofaModel's group (plan inches): x across the seat, y up,
// z = inches from the sofa's back.
import { useEffect, useMemo } from 'react';
import { Outlines } from '@react-three/drei';
import { MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';
import type { PersonFigure, Pt2 } from '@/ortho/person';
import type { PersonSeat } from '@/ortho/personSeat';
import { headGeometry, limbGeometry, torsoGeometry } from './personGeometry';
import type { SoftModels } from './models';
import { PILLOW_OUTLINE } from './materials';
import { chopPillow, pressPillow } from './softGeometry';

// A little lighter than the drawing's #9a948c: the 3D lights shade it down to about that.
const BODY = '#b0aaa2';
const LINE = '#6f6a63';
const UP = new Vector3(0, 1, 0);

/** A joint in the figure's frame: its side-plane place (t, z) and how far across. */
const at = (p: Pt2, x: number) => new Vector3(x, p[1], p[0]);

function useGeometry<T extends BufferGeometry | null>(make: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(make, deps);
  useEffect(() => () => g?.dispose(), [g]);
  return g;
}

function Limb({ name, a, b, ra, rb, mat }: { name: string; a: Vector3; b: Vector3; ra: number; rb: number; mat: Material }) {
  const len = a.distanceTo(b);
  const geo = useGeometry(() => limbGeometry(len, ra, rb), [len, ra, rb]);
  const q = useMemo(() => new Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()), [a, b]);
  return (
    <mesh name={`person:${name}`} geometry={geo} position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} material={mat}>
      <Outlines thickness={1} color={LINE} />
    </mesh>
  );
}

/**
 * The pillow behind an upright back: the same square pillow as the sofa's
 * (Andre's Blender model, or the procedural chop until it has loaded), pressed
 * where the back leans on it. Always its own copy: the shared model is never
 * disposed here.
 */
function backPillow(p: NonNullable<PersonFigure['pillow']>, model: BufferGeometry | null | undefined): BufferGeometry {
  const own = model ? null : chopPillow(p.w, p.h, p.t);
  const src = model ?? own!;
  const g = p.press ? pressPillow(src, p.w, p.h, p.t, p.press) : src.clone();
  own?.dispose();
  return g;
}

export function Person({ fig, seat, pillowMat, models }: { fig: PersonFigure; seat: PersonSeat; pillowMat: Material; models?: SoftModels | null }) {
  const mat = useMemo(() => new MeshStandardMaterial({ color: BODY, roughness: 1, metalness: 0 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const b = fig.build;
  const x = fig.across;
  const torso = useGeometry(() => torsoGeometry(fig.spine, b), [fig.spine, b]);
  const head = useGeometry(() => headGeometry(b.headW, b.headH, b.headD), [b.headW, b.headH, b.headD]);
  const p = fig.pillow;
  const model = models?.square;
  const pillow = useGeometry(() => (p ? backPillow(p, model) : null), [p?.w, p?.h, p?.t, p?.press?.depth, p?.press?.at, model]);
  return (
    <group name="person" position={[seat.x, 0, seat.back]}>
      <mesh name="person:torso" geometry={torso} material={mat}>
        <Outlines thickness={1} color={LINE} />
      </mesh>
      <Limb name="neck" a={at(fig.shoulder, 0)} b={at(fig.head, 0)} ra={b.neck / 2} rb={b.neck / 2} mat={mat} />
      <mesh name="person:head" geometry={head} position={[0, fig.head[1], fig.head[0]]} material={mat}>
        <Outlines thickness={1} color={LINE} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Limb name="thigh" a={at(fig.hip, side * x.hip)} b={at(fig.knee, side * x.knee)} ra={b.thighHip / 2} rb={b.thighKnee / 2} mat={mat} />
          <Limb name="shin" a={at(fig.knee, side * x.knee)} b={at(fig.ankle, side * x.ankle)} ra={b.shinKnee / 2} rb={b.shinAnkle / 2} mat={mat} />
          <Limb name="foot" a={at(fig.ankle, side * x.ankle)} b={at(fig.toe, side * x.toe)} ra={b.foot / 2} rb={b.foot / 2} mat={mat} />
          <Limb name="upper-arm" a={at(fig.armRoot, side * x.shoulder)} b={at(fig.elbow, side * x.elbow)} ra={b.upperArm / 2} rb={b.upperArm / 2} mat={mat} />
          <Limb name="forearm" a={at(fig.elbow, side * x.elbow)} b={at(fig.hand, side * x.hand)} ra={b.forearm / 2} rb={b.forearm / 2} mat={mat} />
        </group>
      ))}
      {p && pillow && (
        <mesh name="person:pillow" geometry={pillow} position={[0, p.c[1], p.c[0]]} rotation={[(-p.lean * Math.PI) / 180, 0, 0]} material={pillowMat}>
          <Outlines thickness={PILLOW_OUTLINE.thickness} color={PILLOW_OUTLINE.color} />
        </mesh>
      )}
    </group>
  );
}
