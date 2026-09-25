import { useEffect, useMemo } from 'react'
import { CylinderGeometry } from 'three'
import { Edges, Outlines } from '@react-three/drei'
import type { LegPart, PrismPart } from '../haven/standardU'
import { roundedPrism, sharpPrism } from './prism'
import type { MaterialSet } from './materials'

export type RenderStyle = 'soft' | 'outline' | 'edges' | 'silhouette'

const LINE = '#4a4038'

export function SofaModel({ prisms, legs, mats, style }: { prisms: PrismPart[]; legs: LegPart[]; mats: MaterialSet; style: RenderStyle }) {
  const geos = useMemo(() => prisms.map((p) => ({ part: p, geo: roundedPrism(p.poly, p.z0, p.z1, p.r), sharp: sharpPrism(p.poly, p.z0, p.z1) })), [prisms])
  const legGeo = useMemo(() => {
    const g = new CylinderGeometry(0.75, 0.75, 1, 12)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  useEffect(
    () => () => {
      geos.forEach((g) => {
        g.geo.dispose()
        g.sharp.dispose()
      })
    },
    [geos],
  )
  useEffect(() => () => legGeo.dispose(), [legGeo])

  const sil = style === 'silhouette'
  return (
    <group name="sofa">
      {geos.map(({ part, geo, sharp }) => (
        <mesh key={part.key} name={part.key} geometry={geo} material={sil ? mats.silhouette : mats.byId[part.mat]}>
          {style === 'outline' && <Outlines thickness={1.25} color={LINE} />}
          {style === 'edges' && <Edges geometry={sharp} threshold={20} color={LINE} lineWidth={1} />}
        </mesh>
      ))}
      {legs.map((l) => (
        <mesh key={l.key} geometry={legGeo} material={sil ? mats.silhouette : mats.byId.leg} position={[l.x, 0, l.y]} />
      ))}
    </group>
  )
}
