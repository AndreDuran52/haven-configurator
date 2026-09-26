// Procedural materials (plan §7.3, §7.4): canvas textures only, no network and
// no asset files (real bouclé / wood maps arrive in H5). ExtrudeGeometry UVs are
// in shape units = inches, so repeat = 1 / tileInches gives true-scale texture.
import { CanvasTexture, Color, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Material } from 'three';
import { fabricOf, finishOf, type PillowTone, type TableFinish } from '@/engine';
import type { MatId } from './parts';

/** Pillow fabrics from the showroom photo: a taupe velvet and a cream bouclé. */
const PILLOW_COLOR: Record<PillowTone, string> = { taupe: '#a08f82', cream: '#ece6dc' };

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, tileInches: number, srgb: boolean) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / tileInches, 1 / tileInches);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Bouclé: dense small loops, as a bump map of random dots. */
function boucleBump() {
  return canvasTex(
    256,
    (g, s) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, s, s);
      const r = rng(7);
      for (let i = 0; i < 2600; i++) {
        const v = 150 + Math.floor(r() * 90);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.beginPath();
        g.arc(r() * s, r() * s, 1.2 + r() * 2.4, 0, Math.PI * 2);
        g.fill();
      }
    },
    6,
    false,
  );
}

function woodMap(base: string, grain: string) {
  return canvasTex(
    512,
    (g, s) => {
      const r = rng(11);
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 140; i++) {
        const y = r() * s;
        const dark = r() < 0.5;
        g.strokeStyle = dark ? grain : 'rgba(255,235,210,0.12)';
        g.globalAlpha = dark ? 0.35 : 1;
        g.lineWidth = 0.5 + r() * 2.5;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin((x / s) * Math.PI * 2 + i) * 3);
        g.stroke();
      }
    },
    24,
    true,
  );
}

/** Light oak floor: 6″ planks, 24″ tiles. */
function floorMap() {
  return canvasTex(
    512,
    (g, s) => {
      const r = rng(3);
      const plank = s / 4;
      for (let i = 0; i < 4; i++) {
        const v = 246 + Math.floor(r() * 5);
        g.fillStyle = `rgb(${v},${v - 9},${v - 24})`;
        g.fillRect(0, i * plank, s, plank);
        g.fillStyle = 'rgba(120,95,60,0.10)';
        g.fillRect(0, i * plank, s, 1.5);
        g.fillRect(r() * s, i * plank, 1.5, plank);
      }
      for (let i = 0; i < 300; i++) {
        g.strokeStyle = 'rgba(150,120,80,0.06)';
        const y = r() * s;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(s, y + (r() - 0.5) * 6);
        g.stroke();
      }
    },
    24,
    true,
  );
}

/** Blank-mode gap decal: the plan's 45° hatch plus its "unfilled 68″" label. */
export function decalMaterial(label: string, w: number, h: number): Material {
  const px = 8; // texture px per inch
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(w * px));
  c.height = Math.max(8, Math.round(h * px));
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#9a948a';
  g.lineWidth = 0.6 * px;
  for (let x = -c.height; x < c.width; x += 7 * px) {
    g.beginPath();
    g.moveTo(x, c.height);
    g.lineTo(x + c.height, 0);
    g.stroke();
  }
  const size = Math.min(4, Math.min(w, h) / 3) * px;
  g.font = `700 ${size}px helvetica, arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const tw = g.measureText(label).width + size;
  g.fillStyle = '#ffffff';
  g.fillRect(c.width / 2 - tw / 2, c.height / 2 - size * 0.7, tw, size * 1.4);
  g.fillStyle = '#1c1b19';
  g.fillText(label, c.width / 2, c.height / 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new MeshBasicMaterial({ map: t });
}

export interface MaterialSet {
  byId: Record<MatId, Material>;
  pillow: Record<PillowTone, Material>;
  floor: Material;
  silhouette: Material;
  dispose: () => void;
}

export const FLOOR_MARGIN = 60;

export function makeMaterials(fabric: string, finish: TableFinish): MaterialSet {
  const f = fabricOf(fabric);
  const bump = boucleBump();
  const weave = f.weave === 'boucle' ? { bumpMap: bump, bumpScale: 0.35 } : {};
  const body = new MeshStandardMaterial({ color: new Color(f.color).multiplyScalar(0.96), roughness: 0.95, ...weave });
  const cushion = new MeshStandardMaterial({ color: new Color(f.color), roughness: 0.95, ...weave });
  const fin = finishOf(finish);
  const wMap = woodMap(fin.color, fin.grain);
  const wood = new MeshStandardMaterial({ map: wMap, roughness: 0.5 });
  const taupe = new MeshStandardMaterial({ color: PILLOW_COLOR.taupe, roughness: 0.8 });
  const cream = new MeshStandardMaterial({ color: PILLOW_COLOR.cream, roughness: 0.95, bumpMap: bump, bumpScale: 0.35 });
  const leg = new MeshStandardMaterial({ color: '#2a221c', roughness: 0.6 });
  const fm = floorMap();
  const floor = new MeshStandardMaterial({ map: fm, roughness: 0.85 });
  const silhouette = new MeshBasicMaterial({ color: '#000000' });
  const all = [body, cushion, wood, leg, floor, silhouette, taupe, cream];
  return {
    byId: { body, cushion, wood, leg },
    pillow: { taupe, cream },
    floor,
    silhouette,
    dispose: () => {
      for (const m of all) m.dispose();
      for (const t of [bump, wMap, fm]) t.dispose();
    },
  };
}
