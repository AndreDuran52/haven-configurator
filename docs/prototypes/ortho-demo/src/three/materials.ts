import { CanvasTexture, Color, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Material } from 'three'
import type { MatId } from '../haven/standardU'

// Procedural textures only (no network, no asset files) — the real app swaps in the
// Blender-exported maps from public/models/ (spec §9). ExtrudeGeometry's UVs are in
// shape units = inches, so `repeat = 1/tileInches` gives true-scale texture.

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, tileInches: number, srgb: boolean) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  draw(g, size)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(1 / tileInches, 1 / tileInches)
  t.anisotropy = 4
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Bouclé: dense small loops → a bump map of random dots. */
function boucleBump() {
  return canvasTex(
    256,
    (g, s) => {
      g.fillStyle = '#808080'
      g.fillRect(0, 0, s, s)
      const r = rng(7)
      for (let i = 0; i < 2600; i++) {
        const x = r() * s
        const y = r() * s
        const rad = 1.2 + r() * 2.4
        const v = 150 + Math.floor(r() * 90)
        g.fillStyle = `rgb(${v},${v},${v})`
        g.beginPath()
        g.arc(x, y, rad, 0, Math.PI * 2)
        g.fill()
      }
    },
    6,
    false,
  )
}

function walnutMap() {
  return canvasTex(
    512,
    (g, s) => {
      const r = rng(11)
      g.fillStyle = '#5a3a24'
      g.fillRect(0, 0, s, s)
      for (let i = 0; i < 140; i++) {
        const y = r() * s
        const w = 0.5 + r() * 2.5
        const shade = r() < 0.5 ? 'rgba(40,24,14,0.35)' : 'rgba(120,80,50,0.25)'
        g.strokeStyle = shade
        g.lineWidth = w
        g.beginPath()
        g.moveTo(0, y)
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin((x / s) * Math.PI * 2 + i) * 3)
        g.stroke()
      }
    },
    24,
    true,
  )
}

function floorMap() {
  return canvasTex(
    512,
    (g, s) => {
      const r = rng(3)
      const plank = s / 4 // 4 planks per tile
      for (let i = 0; i < 4; i++) {
        const v = 246 + Math.floor(r() * 5)
        g.fillStyle = `rgb(${v},${v - 9},${v - 24})`
        g.fillRect(0, i * plank, s, plank)
        g.fillStyle = 'rgba(120,95,60,0.10)'
        g.fillRect(0, i * plank, s, 1.5)
        const cut = r() * s
        g.fillRect(cut, i * plank, 1.5, plank)
      }
      for (let i = 0; i < 300; i++) {
        g.strokeStyle = 'rgba(150,120,80,0.06)'
        const y = r() * s
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(s, y + (r() - 0.5) * 6)
        g.stroke()
      }
    },
    24, // 4 planks of 6" per 24" tile
    true,
  )
}

export interface MaterialSet {
  byId: Record<MatId, Material>
  floor: Material
  silhouette: Material
}

export const FLOOR_SIZE = 2400 // inches
export const FLOOR_THICKNESS = 1.5 // a slab, so true elevations show a ground band

export function makeMaterials(fabric = '#efebe3', wood: 'walnut' | 'dark' = 'walnut'): MaterialSet {
  const bump = boucleBump()
  const body = new MeshStandardMaterial({ color: new Color(fabric).multiplyScalar(0.96), roughness: 0.95, bumpMap: bump, bumpScale: 0.35 })
  const cushion = new MeshStandardMaterial({ color: new Color(fabric), roughness: 0.95, bumpMap: bump, bumpScale: 0.35 })
  const woodMat = new MeshStandardMaterial({ map: walnutMap(), color: wood === 'dark' ? '#6e6e6e' : '#ffffff', roughness: 0.5, metalness: 0 })
  const leg = new MeshStandardMaterial({ color: '#2a221c', roughness: 0.6 })
  // PlaneGeometry/BoxGeometry UVs are 0..1 per face (NOT inches like ExtrudeGeometry's), so the
  // floor needs repeat = size / tile or one plank gets stretched across the whole room.
  const fm = floorMap()
  fm.repeat.set(FLOOR_SIZE / 24, FLOOR_SIZE / 24)
  const floor = new MeshStandardMaterial({ map: fm, roughness: 0.85 })
  const silhouette = new MeshBasicMaterial({ color: '#000000' })
  return { byId: { body, cushion, wood: woodMat, leg }, floor, silhouette }
}
