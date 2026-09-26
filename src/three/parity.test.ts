// @vitest-environment jsdom
// V1 (plan §11): Ortho <-> SVG parity. Build the OrthographicCamera exactly as
// R3F does (±w/2, ±h/2 in CSS px), drive it with camera-controls through the
// production setTopAt sequence at the plan's scale and centre, and project every
// footprint vertex at 0″ and 27″: each must land on the SVG plan within 0.01 px.
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { describe, expect, it } from 'vitest';
import { buildHaven, moveTable, planCentre, setMeasurements, standardL, standardU } from '@/engine';
import { nearestAngle } from '@/ortho/orthoFit';
import { planFit } from '@/plan/planFit';
import { CAMERA_DISTANCE } from './Rig';

CameraControls.install({ THREE });

const u = standardU();
const CONFIGS = {
  T1: u,
  T2: setMeasurements(u, { D: 36 }).config,
  T4: standardL('right', { W: 120, R: 100 }),
  T5: setMeasurements(u, { W: 300 }).config,
  T3b: moveTable(u, u.runs.back![0]!.id, { run: 'left', at: 'split', pieceId: u.runs.left![0]!.id }).config,
};
const VIEWS: [number, number][] = [
  [828, 575],
  [820, 578],
  [390, 293],
];

describe('V1 ortho <-> SVG parity', () => {
  it('every footprint vertex at 0″ and 27″ lands within 0.01 px of the SVG plan (T1, T2, T4, T5, 3b × 3 viewports)', () => {
    for (const [name, c] of Object.entries(CONFIGS)) {
      const built = buildHaven(c);
      const centre = planCentre(built.bounds);
      for (const [w, h] of VIEWS) {
        const fit = planFit(built, w, h);
        const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, CAMERA_DISTANCE * 3);
        camera.position.set(0, 0, CAMERA_DISTANCE);
        const controls = new CameraControls(camera);
        // production setTopAt (Rig.tsx)
        controls.normalizeRotations();
        void controls.moveTo(fit.cx - centre.cx, 13.5, fit.cy - centre.cy, false);
        void controls.rotateTo(nearestAngle(controls.azimuthAngle, 0), 0, false);
        void controls.zoomTo(fit.S, false);
        controls.update(0);
        camera.updateMatrixWorld();
        let worst = 0;
        for (const p of built.pieces) {
          for (const [x, y] of p.polygon) {
            const svg = [(x - fit.cx) * fit.S + w / 2, (y - fit.cy) * fit.S + h / 2];
            for (const height of [0, 27]) {
              const v = new THREE.Vector3(x - centre.cx, height, y - centre.cy).project(camera);
              const px = [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
              worst = Math.max(worst, Math.hypot(px[0]! - svg[0]!, px[1]! - svg[1]!));
            }
          }
        }
        expect(worst, `${name} at ${w}×${h}`).toBeLessThan(0.01);
        controls.dispose();
      }
    }
  });
});
