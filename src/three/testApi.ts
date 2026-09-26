// window.__haven3d: hooks the e2e checks use to judge the 3D view by outcome
// (camera state, projections, silhouette captures). Tiny; lives in the lazy chunk.
import { Color, MeshBasicMaterial, Vector3, type Mesh, type Object3D, type OrthographicCamera, type Scene, type WebGLRenderer } from 'three';
import type { CameraControlsImpl } from '@react-three/drei';
import type { OrthoFit } from '@/ortho/orthoFit';
import type { PresetName } from '@/ortho/presets';

const D2R = Math.PI / 180;
const BLACK = new MeshBasicMaterial({ color: 0x000000 });

export interface TestApiContext {
  controls: () => CameraControlsImpl;
  apply: (name: PresetName, animate: boolean) => void;
  setTopAt: (S: number, cx: number, cy: number) => void;
  current: () => PresetName;
  frames: () => number;
  resting: () => boolean;
  fit: (name: PresetName) => OrthoFit;
  size: () => [number, number];
  offset: [number, number];
  points: () => [number, number, number][];
  gl: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
}

export interface Haven3dApi {
  state: () => { preset: PresetName; azimuthDeg: number; polarDeg: number; zoom: number; target: number[]; frames: number; resting: boolean; minZoom: number; maxZoom: number; size: number[] };
  apply: (name: PresetName, animate: boolean) => void;
  setTopAt: (S: number, cx: number, cy: number) => void;
  fit: (name: PresetName) => { zoom: number; target: number[]; spanU: number; spanV: number };
  /** world points -> CSS px in the canvas */
  project: (pts: [number, number, number][]) => [number, number][];
  /** world = plan + (ox, 0, oz) */
  offset: [number, number];
  /** the silhouette points the fit uses (world) */
  points: () => [number, number, number][];
  /** PNG data URL of the live view; `silhouette` = black parts on white; `only` = mesh names containing it */
  capture: (opts?: { silhouette?: boolean; only?: string }) => string;
  /** names of the visible meshes that start with `prefix` */
  meshNames: (prefix: string) => string[];
}

declare global {
  interface Window {
    __haven3d?: Haven3dApi;
  }
}

export function installTestApi(ctx: TestApiContext): () => void {
  const { gl, scene, camera } = ctx;
  const api: Haven3dApi = {
    state: () => {
      const c = ctx.controls();
      return {
        preset: ctx.current(),
        azimuthDeg: c.azimuthAngle / D2R,
        polarDeg: c.polarAngle / D2R,
        zoom: camera.zoom,
        target: c.getTarget(new Vector3()).toArray(),
        frames: ctx.frames(),
        resting: ctx.resting(),
        minZoom: c.minZoom,
        maxZoom: c.maxZoom,
        size: ctx.size(),
      };
    },
    apply: ctx.apply,
    setTopAt: ctx.setTopAt,
    fit: (name) => {
      const f = ctx.fit(name);
      return { zoom: f.zoom, target: [...f.target], spanU: f.spanU, spanV: f.spanV };
    },
    project: (pts) => {
      const [w, h] = ctx.size();
      return pts.map(([x, y, z]) => {
        const v = new Vector3(x, y, z).project(camera);
        return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
      });
    },
    offset: ctx.offset,
    points: ctx.points,
    meshNames: (prefix) => {
      const out: string[] = [];
      scene.traverseVisible((o) => {
        if ((o as { isMesh?: boolean }).isMesh && o.name.startsWith(prefix)) out.push(o.name);
      });
      return out;
    },
    capture: (opts = {}) => {
      const restore: (() => void)[] = [];
      if (opts.silhouette) {
        const prevBg = scene.background;
        scene.background = new Color('#ffffff');
        restore.push(() => (scene.background = prevBg));
        scene.traverse((o: Object3D) => {
          const isPart = o.userData.part === true;
          const hide = o.userData.decal || o.name === 'floor' || o.name === 'contact-shadows' || (!isPart && o.parent?.userData.part);
          const filtered = isPart && opts.only !== undefined && !o.name.includes(opts.only);
          if (hide || filtered) {
            const was = o.visible;
            o.visible = false;
            restore.push(() => (o.visible = was));
          } else if (isPart) {
            const m = o as Mesh;
            const was = m.material;
            m.material = BLACK;
            restore.push(() => (m.material = was));
          }
        });
      }
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png'); // same task as the render: no preserveDrawingBuffer
      for (const r of restore.reverse()) r();
      gl.render(scene, camera);
      return url;
    },
  };
  window.__haven3d = api;
  return () => {
    if (window.__haven3d === api) delete window.__haven3d;
  };
}
