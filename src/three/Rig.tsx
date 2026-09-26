// Camera rig (plan §7.1, §7.2): drei <CameraControls> with the demand-safe
// subclass, presets via rotateTo/moveTo/zoomTo (never setLookAt or fitToBox),
// the custom fit, and Andre's SPRING-BACK orbit (Q1): orbit, pan or pinch
// freely, and on release the view returns to its preset. A mouse wheel zoom
// (no release) stays until the next drag or preset.
import { useCallback, useEffect, useRef } from 'react';
import { Box3, Vector3, type OrthographicCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls, type CameraControlsImpl } from '@react-three/drei';
import type { Shape } from '@/engine';
import { fitPreset, nearestAngle, PHONE_MAX_WIDTH } from '@/ortho/orthoFit';
import { presetFor, PRESET_ORDER, type PresetName } from '@/ortho/presets';
import { presetDirection, type Vec3 } from '@/ortho/screenBasis';
import type { PlanFit as Handoff } from '@/state/store';
import { DemandSafeCameraControls } from './controls';
import { installTestApi } from './testApi';
import type { ViewStore } from './viewStore';

export const CAMERA_DISTANCE = 2000; // inches; ortho: distance only matters for clipping
export const MAX_ZOOM = 40; // px per inch
const D2R = Math.PI / 180;


export function Rig({
  shape,
  preset,
  points,
  bounds,
  offset,
  handoff,
  onHandoff,
  view,
}: {
  shape: Shape;
  preset: PresetName;
  points: Vec3[];
  bounds: Box3;
  /** world = plan + offset: (x + ox, h, y + oz) */
  offset: [number, number];
  handoff: Handoff | null;
  onHandoff: () => void;
  view: ViewStore;
}) {
  const controls = useRef<CameraControlsImpl>(null);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const current = useRef<PresetName>(preset);
  const frames = useRef(0);
  const resting = useRef(true);
  const placed = useRef(false);

  useFrame(() => {
    frames.current++;
  });

  const phoneElevation = (name: PresetName) => size.width <= PHONE_MAX_WIDTH && (name === 'front' || name === 'side');

  const apply = useCallback(
    (name: PresetName, animate: boolean, angleOnly = false) => {
      const c = controls.current;
      if (!c) return;
      const def = presetFor(name, shape);
      const fit = fitPreset(points, def, size.width, size.height);
      c.minZoom = 0.5 * Math.min(...PRESET_ORDER.map((n) => fitPreset(points, presetFor(n, shape), size.width, size.height).zoom));
      c.maxZoom = MAX_ZOOM;
      c.normalizeRotations();
      void c.rotateTo(nearestAngle(c.azimuthAngle, def.azimuthDeg * D2R), (90 - def.elevationDeg) * D2R, animate);
      if (!angleOnly) {
        void c.moveTo(...fit.target, animate);
        void c.zoomTo(fit.zoom, animate);
      }
      current.current = name;
      if (animate) resting.current = false;
      invalidate();
    },
    [points, shape, size.width, size.height, invalidate],
  );

  const setTopAt = useCallback(
    (S: number, cx: number, cy: number) => {
      const c = controls.current!;
      c.normalizeRotations();
      void c.moveTo(cx + offset[0], 13.5, cy + offset[1], false);
      void c.rotateTo(nearestAngle(c.azimuthAngle, 0), 0, false);
      void c.zoomTo(S, false);
      c.update(0);
      invalidate();
    },
    [offset, invalidate],
  );

  // First mount: place the camera, then either the Plan -> 3D hand-off (Top at
  // the plan's exact scale and centre, then a tween to the preset) or the preset.
  useEffect(() => {
    const c = controls.current;
    if (!c || placed.current) return;
    placed.current = true;
    const dir = presetDirection(presetFor(preset, shape));
    const t = bounds.getCenter(new Vector3());
    void c.setLookAt(t.x + dir[0] * CAMERA_DISTANCE, t.y + dir[1] * CAMERA_DISTANCE, t.z + dir[2] * CAMERA_DISTANCE, t.x, t.y, t.z, false);
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI / 2; // never below the floor; elevations sit on the limit
    c.dollyToCursor = true; // zoom toward the pinch / wheel point
    c.smoothTime = 0.3;
    const onSleep = () => {
      resting.current = true;
      invalidate();
    };
    const onWake = () => {
      resting.current = false;
    };
    c.addEventListener('sleep', onSleep);
    c.addEventListener('wake', onWake);
    if (handoff) {
      setTopAt(handoff.S, handoff.cx, handoff.cy);
      onHandoff();
      window.setTimeout(() => apply(current.current, true), 350);
    } else apply(preset, false);
  }, [apply, setTopAt, preset, shape, bounds, handoff, onHandoff, invalidate]);

  // Spring-back (Q1): when the last finger / the mouse button is released.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onEnd = () => apply(current.current, true, phoneElevation(current.current));
    c.addEventListener('controlend', onEnd);
    return () => c.removeEventListener('controlend', onEnd);
  });

  // Preset buttons animate; size and layout changes refit at once.
  useEffect(() => {
    if (placed.current && preset !== current.current) apply(preset, true);
  }, [preset, apply]);
  // Only on a real change: on mount this effect runs right after placement and
  // would otherwise override the Plan -> 3D hand-off.
  const fitKey = useRef<unknown[] | null>(null);
  useEffect(() => {
    const key = [size.width, size.height, points];
    const changed = fitKey.current !== null && key.some((v, i) => v !== fitKey.current![i]);
    fitKey.current = key;
    if (placed.current && changed) apply(current.current, false);
  }, [size.width, size.height, points, apply]);

  useEffect(() => {
    const c = controls.current;
    c?.setBoundary(bounds.clone().expandByScalar(24)); // BuildResult.bounds + 24″
  }, [bounds]);

  // Publish the view for the HTML overlay (scale bar, height ticks), projected
  // through the live camera.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const v = new Vector3();
    const toScreen = (p: Vec3): [number, number] => {
      v.set(...p).project(camera);
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
    };
    const publish = () => {
      const t = c.getTarget(new Vector3());
      view.set({
        zoom: camera.zoom,
        heightY: (h) => toScreen([t.x, h, t.z])[1],
        leftX: Math.min(...points.map((p) => toScreen(p)[0])),
        resting: resting.current,
      });
    };
    publish();
    c.addEventListener('update', publish);
    c.addEventListener('sleep', publish);
    return () => {
      c.removeEventListener('update', publish);
      c.removeEventListener('sleep', publish);
    };
  }, [camera, points, size.width, size.height, view]);

  useEffect(
    () =>
      installTestApi({
        controls: () => controls.current!,
        apply,
        setTopAt,
        current: () => current.current,
        frames: () => frames.current,
        resting: () => resting.current,
        fit: (name) => fitPreset(points, presetFor(name, shape), size.width, size.height),
        size: () => [size.width, size.height],
        offset,
        points: () => points.map((p) => [...p] as [number, number, number]),
        gl,
        scene,
        camera,
      }),
    [apply, setTopAt, points, shape, size.width, size.height, offset, gl, scene, camera],
  );

  return <CameraControls ref={controls} impl={DemandSafeCameraControls} makeDefault />;
}
