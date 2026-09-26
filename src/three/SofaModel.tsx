// Parts -> meshes (plan §7.4). Geometry is rebuilt when the parts change and
// disposed with them. 1 px pixel-constant outlines (drei <Outlines>, default
// screenspace={false}, the pixel-constant mode) are a depth cue (§7.3).
import { useEffect, useMemo } from 'react';
import { CylinderGeometry, PlaneGeometry, type Material } from 'three';
import { Outlines } from '@react-three/drei';
import { GAP_DECAL_HEIGHT } from '@/ortho/fitPoints';
import { crownedCushion, roundedPrism } from './prism';
import { decalMaterial, type MaterialSet } from './materials';
import type { Parts } from './parts';

const LINE = '#4a4038';
const LEG_RADIUS = 0.75; // 1.5″ round legs (Q14)

export function SofaModel({ parts, mats, showLoose }: { parts: Parts; mats: MaterialSet; showLoose: boolean }) {
  const prisms = useMemo(() => parts.prisms.map((p) => ({ part: p, geo: roundedPrism(p.poly, p.z0, p.z1, p.r) })), [parts]);
  const crowns = useMemo(() => parts.crowns.map((c) => ({ part: c, geo: crownedCushion(c) })), [parts]);
  const decals = useMemo(
    () =>
      parts.decals.map((d) => {
        const geo = new PlaneGeometry(d.rect.w, d.rect.h);
        geo.rotateX(-Math.PI / 2);
        return { part: d, geo, mat: decalMaterial(d.label, d.rect.w, d.rect.h) as Material };
      }),
    [parts],
  );
  const legGeo = useMemo(() => new CylinderGeometry(LEG_RADIUS, LEG_RADIUS, 1, 12).translate(0, 0.5, 0), []);
  useEffect(
    () => () => {
      for (const g of [...prisms, ...crowns]) g.geo.dispose();
      for (const d of decals) {
        d.geo.dispose();
        d.mat.dispose();
      }
    },
    [prisms, crowns, decals],
  );
  useEffect(() => () => legGeo.dispose(), [legGeo]);

  return (
    <group name="sofa">
      {prisms.map(({ part, geo }) => (
        <mesh key={part.key} name={part.key} geometry={geo} material={mats.byId[part.mat]} visible={!part.loose || showLoose} userData={{ part: true }}>
          <Outlines thickness={1.25} color={LINE} />
        </mesh>
      ))}
      {crowns.map(({ part, geo }) => (
        <mesh key={part.key} name={part.key} geometry={geo} material={mats.byId.cushion} userData={{ part: true }}>
          <Outlines thickness={1.25} color={LINE} />
        </mesh>
      ))}
      {parts.legs.map((l) => (
        <mesh
          key={l.key}
          name={l.key}
          geometry={legGeo}
          material={mats.byId.leg}
          position={[l.x, 0, l.y]}
          scale={[1, l.h, 1]}
          visible={!l.loose || showLoose}
          userData={{ part: true }}
        />
      ))}
      {decals.map(({ part, geo, mat }) => (
        <mesh
          key={part.key}
          name={part.key}
          geometry={geo}
          material={mat}
          position={[part.rect.x + part.rect.w / 2, GAP_DECAL_HEIGHT, part.rect.y + part.rect.h / 2]}
          userData={{ decal: true }}
        />
      ))}
    </group>
  );
}
