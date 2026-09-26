// Offscreen orthographic renders for the PDF sheet (plan §7.6, §9): the same
// parts, pillows and materials as the live view, on a detached canvas with its
// own R3F root (frameloop 'never', advanced by hand), so the sheet works from
// the Plan view on a fresh load and never touches the live camera. Loaded only
// through import() from src/export.
import { createElement } from 'react';
import * as THREE from 'three';
import { Color, NeutralToneMapping, OrthographicCamera, type Vector3Tuple } from 'three';
import { advance, createRoot, extend } from '@react-three/fiber';
import { buildHaven, pillowAnchors, planCentre, type Config } from '@/engine';
import { fitPoints } from '@/ortho/fitPoints';
import { fitOrtho } from '@/ortho/orthoFit';
import { presetFor, type PresetName } from '@/ortho/presets';
import { presetDirection, screenBasis } from '@/ortho/screenBasis';
import { ExportScene } from './ExportScene';
import { makeMaterials } from './materials';
import { buildParts } from './parts';

export interface ViewRender {
  url: string;
  pxW: number;
  pxH: number;
}

const DISTANCE = 2000;

// <Canvas> registers three's classes with R3F; a bare createRoot must do it itself.
extend(THREE as unknown as Parameters<typeof extend>[0]);

/** One JPEG of `preset`, framed to fill pxW × pxH (4 % padding), on white. */
export async function exportView(config: Config, preset: PresetName, pxW: number, pxH: number, opts: { pillows: boolean }): Promise<ViewRender> {
  const built = buildHaven(config);
  const def = presetFor(preset, built.shape);
  const points = fitPoints(built, { loose: true, pillows: opts.pillows });
  const p = Math.round(Math.min(pxW, pxH) * 0.04);
  const fit = fitOrtho(points, def, pxW, pxH, { top: p, right: p, bottom: p, left: p });
  const dir = presetDirection(def);
  const { up } = screenBasis(dir, def.azimuthDeg);
  const cam = new OrthographicCamera(-pxW / 2, pxW / 2, pxH / 2, -pxH / 2, 1, DISTANCE * 3);
  const t = fit.target;
  cam.position.set(t[0] + dir[0] * DISTANCE, t[1] + dir[1] * DISTANCE, t[2] + dir[2] * DISTANCE);
  cam.up.set(...(up as Vector3Tuple));
  cam.lookAt(t[0], t[1], t[2]);
  cam.zoom = fit.zoom;
  cam.updateProjectionMatrix();
  (cam as OrthographicCamera & { manual?: boolean }).manual = true;

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const root = createRoot(canvas);
  const mats = makeMaterials(config.fabric, config.tableFinish);
  try {
    await root.configure({
      gl: { antialias: true, preserveDrawingBuffer: true },
      size: { width: pxW, height: pxH, top: 0, left: 0 },
      dpr: 1,
      frameloop: 'never',
      orthographic: true,
      camera: cam,
      onCreated: ({ gl, scene }) => {
        gl.toneMapping = NeutralToneMapping;
        scene.background = new Color('#ffffff');
      },
    });
    const c = planCentre(built.bounds);
    root.render(
      createElement(ExportScene, {
        parts: buildParts(built, config.tableStyle),
        pillows: opts.pillows ? pillowAnchors(built) : [],
        mats,
        offset: [-c.cx, -c.cy] as [number, number],
      }),
    );
    // Let React commit, then draw twice (contact shadows render on their first frame).
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 30));
      advance(performance.now(), true);
    }
    return { url: canvas.toDataURL('image/jpeg', 0.9), pxW, pxH };
  } finally {
    root.unmount();
    mats.dispose();
  }
}
