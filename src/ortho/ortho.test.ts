import { describe, expect, it } from 'vitest';
import { buildHaven, setMeasurements, standardL, standardU } from '@/engine';
import { fitPoints } from './fitPoints';
import { defaultPadding, fitOrtho, fitPreset, nearestAngle, overlayInsets, PHONE_ELEVATION_ZOOM } from './orthoFit';
import { ISO_ELEVATION, PRESET_ORDER, presetFor } from './presets';
import { ISO_AXIS_SCALE, scaleBar } from './scale';
import { presetDirection, projectPoint, screenBasis, type Vec3 } from './screenBasis';

const D2R = Math.PI / 180;
const VIEWS: [number, number][] = [
  [828, 700],
  [820, 600],
  [390, 390],
];

describe('ortho presets (plan §7.2)', () => {
  it('V9 angles: Front polar 90° / azimuth 0°, Side ±90°, Iso 45° / 35.264°', () => {
    const polar = (e: number) => (90 - e) * D2R;
    const f = presetFor('front', 'U');
    expect([polar(f.elevationDeg), f.azimuthDeg * D2R]).toEqual([Math.PI / 2, 0]);
    expect(presetFor('side', 'U').azimuthDeg).toBe(90);
    expect(presetFor('side', 'L-left').azimuthDeg).toBe(-90);
    const iso = presetFor('iso', 'U');
    expect(Math.abs(iso.azimuthDeg * D2R - Math.PI / 4)).toBeLessThan(1e-6);
    expect(Math.abs(iso.elevationDeg - 35.264389682754654)).toBeLessThan(1e-6);
    expect(ISO_ELEVATION).toBeCloseTo(35.2644, 4);
    // 3/4 trimetric: (±0.4330, 0.5, 0.75), −θ for L-right
    const d = presetDirection(presetFor('threeQuarter', 'U'));
    expect(d.map((x) => +x.toFixed(4))).toEqual([0.433, 0.5, 0.75]);
    expect(presetFor('threeQuarter', 'L-right').azimuthDeg).toBe(-30);
  });

  it('E20b topPresetOrientation: Top at azimuth 0 puts the back at the top of the screen, x to the right', () => {
    const top = presetFor('top', 'U');
    const basis = screenBasis(presetDirection(top), top.azimuthDeg);
    const view = { target: [0, 0, 0] as Vec3, zoom: 2, basis };
    const back = projectPoint([0, 0, -66], view, 400, 400); // plan y = 0 (back)
    const front = projectPoint([0, 0, 66], view, 400, 400); // plan y = 132 (open end)
    expect(back[1]).toBeLessThan(front[1]);
    expect(projectPoint([10, 0, 0], view, 400, 400)[0]).toBeGreaterThan(200);
  });

  it('Iso: an axis-aligned 188" edge measures 0.8165 × 188 × zoom', () => {
    const iso = presetFor('iso', 'U');
    const basis = screenBasis(presetDirection(iso), iso.azimuthDeg);
    const view = { target: [0, 0, 0] as Vec3, zoom: 4, basis };
    const a = projectPoint([-94, 0, 0], view, 800, 800);
    const b = projectPoint([94, 0, 0], view, 800, 800);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(ISO_AXIS_SCALE * 188 * 4, 6);
    const h = projectPoint([0, 27, 0], view, 800, 800);
    expect(Math.abs(h[1] - 400)).toBeCloseTo(ISO_AXIS_SCALE * 27 * 4, 6);
  });

  it('V3 (pure): every preset frames every silhouette point inside the view minus padding', () => {
    const configs = [standardU(), setMeasurements(standardU(), { D: 36 }).config, standardL('right', { W: 120, R: 100 }), standardU({ W: 300 })];
    for (const c of configs) {
      const pts = fitPoints(buildHaven(c), { loose: true });
      for (const [w, h] of VIEWS) {
        for (const name of PRESET_ORDER) {
          const def = presetFor(name, c.shape);
          const base = defaultPadding(w, h);
          const extra = overlayInsets(def);
          const pad = { ...base, bottom: base.bottom + (extra.bottom ?? 0), left: base.left + (extra.left ?? 0) };
          const fit = fitPreset(pts, def, w, h);
          const phoneElevation = w <= 480 && def.elevationDeg === 0 && fit.zoom === PHONE_ELEVATION_ZOOM;
          const view = { target: fit.target, zoom: fit.zoom, basis: screenBasis(presetDirection(def), def.azimuthDeg) };
          for (const p of pts) {
            const [x, y] = projectPoint(p, view, w, h);
            expect(y).toBeGreaterThanOrEqual(pad.top - 1e-6);
            expect(y).toBeLessThanOrEqual(h - pad.bottom + 1e-6);
            expect(x).toBeGreaterThanOrEqual(pad.left - 1e-6);
            if (!phoneElevation) expect(x).toBeLessThanOrEqual(w - pad.right + 1e-6);
          }
        }
      }
    }
  });

  it('phones: Front opens at 3 px/in anchored to the left end; tablets fit the whole elevation', () => {
    const pts = fitPoints(buildHaven(standardU()), { loose: false });
    const def = presetFor('front', 'U');
    expect(fitPreset(pts, def, 390, 390).zoom).toBe(3);
    const pad = defaultPadding(828, 700);
    expect(fitPreset(pts, def, 828, 700).zoom).toBe(fitOrtho(pts, def, 828, 700, { ...pad, bottom: pad.bottom + 44, left: pad.left + 64 }).zoom);
  });

  it('nearestAngle takes the short way round; the scale bar picks a nice length', () => {
    expect(nearestAngle(0, (350 * Math.PI) / 180)).toBeCloseTo((-10 * Math.PI) / 180, 12);
    expect(scaleBar(4)).toEqual({ inches: 36, px: 144, label: '3′' });
    expect(scaleBar(4, ISO_AXIS_SCALE).inches).toBe(48);
    expect(scaleBar(1).label).toBe('12′');
  });
});
