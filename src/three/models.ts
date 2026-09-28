// Andre's Blender models (plan Q16; H5c): `.glb` files dropped into
// src/three/models/ replace the procedural pillow of the same name. Vite lists
// only the files that exist (no 404 probing) and hashes them; the service
// worker precaches them, so they work offline. GLTFLoader without Draco (never
// drei useGLTF: it fetches the Draco decoder from gstatic, rule 7). Each model
// is refitted into the engine's box, so anchors, clearances and the ortho fit
// are unchanged; the app's pillow materials replace the file's.
import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BALL_PILLOW, SQUARE_PILLOW } from '@/engine';

export interface SoftModels {
  square: BufferGeometry | null;
  ball: BufferGeometry | null;
}

/** File name -> the box it is fitted into (w, h, t; front = +z, up = +y). */
const SLOTS = {
  square: { file: 'pillow-square.glb', box: [SQUARE_PILLOW.w, SQUARE_PILLOW.h, SQUARE_PILLOW.t], flip: false },
  ball: { file: 'pillow-ball.glb', box: [BALL_PILLOW, BALL_PILLOW, BALL_PILLOW], flip: false },
} as const;

const urls = import.meta.glob<string>('./models/*.glb', { query: '?url', import: 'default', eager: true });
const urlOf = (file: string): string | undefined => urls[`./models/${file}`];

/**
 * Centre a geometry on its bounds and scale each axis onto w × h × t (normals
 * follow the non-uniform scale); UVs are re-projected in inches like the
 * procedural pillows, so the linen and bouclé bumps stay to scale.
 */
export function fitToBox(g: BufferGeometry, w: number, h: number, t: number): BufferGeometry {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const s = [w / (b.max.x - b.min.x || 1), h / (b.max.y - b.min.y || 1), t / (b.max.z - b.min.z || 1)] as const;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  g.scale(s[0], s[1], s[2]);
  const n = g.getAttribute('normal');
  if (n) {
    for (let i = 0; i < n.count; i++) {
      const x = n.getX(i) / s[0];
      const y = n.getY(i) / s[1];
      const z = n.getZ(i) / s[2];
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(i, x / l, y / l, z / l);
    }
    n.needsUpdate = true;
  } else g.computeVertexNormals();
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) + p.getZ(i);
    uv[i * 2 + 1] = p.getY(i);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Every mesh in a glTF scene, world transforms baked, merged into one geometry (position + normal). */
export function mergeScene(root: Object3D): BufferGeometry | null {
  root.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const src = (o as Mesh).geometry;
    const g = new BufferGeometry();
    g.setAttribute('position', src.getAttribute('position').clone());
    if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
    if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(o.matrixWorld);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  if (!parts.length) return null;
  if (parts.some((g) => !g.getAttribute('normal'))) for (const g of parts) g.deleteAttribute('normal');
  const merged = parts.length === 1 ? parts[0]! : mergeGeometries(parts);
  if (parts.length > 1) for (const g of parts) g.dispose();
  return merged;
}

/**
 * Stand a baked model square to the box: up stays +y (Blender's Z), and it is
 * turned about the vertical so its thinner horizontal extent is the depth (z).
 * A pillow left turned in the Blender scene still faces the room; `flip`
 * turns it round when its front is on the far side.
 */
export function squareUp(g: BufferGeometry, flip = false): BufferGeometry {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  if (b.max.x - b.min.x < b.max.z - b.min.z) g.rotateY(Math.PI / 2);
  if (flip) g.rotateY(Math.PI);
  return g;
}

async function load(slot: keyof typeof SLOTS): Promise<BufferGeometry | null> {
  const { file, box } = SLOTS[slot];
  const url = urlOf(file);
  if (!url) return null;
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const g = mergeScene(gltf.scene);
    return g && fitToBox(squareUp(g, SLOTS[slot].flip), box[0], box[1], box[2]);
  } catch {
    return null; // a broken file falls back to the procedural shape
  }
}

let cache: Promise<SoftModels> | null = null;
let loaded: SoftModels | null = null;

/** The models, loaded once per session and shared by the live view and the sheet renders (never disposed). */
export function loadSoftModels(): Promise<SoftModels> {
  cache ??= Promise.all([load('square'), load('ball')]).then(([square, ball]) => (loaded = { square, ball }));
  return cache;
}

/** Which models are in use (for the e2e checks). */
export const softModelsInUse = () => ({ square: !!loaded?.square, ball: !!loaded?.ball });
