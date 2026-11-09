// Camera rig (plan §7.1, §7.2): drei <CameraControls> with the demand-safe
// subclass, presets via rotateTo/moveTo/zoomTo (never setLookAt or fitToBox)
// and the custom fit. Orbit, pan or pinch freely: the camera STAYS where it is
// released (Phase 3b, Andre 2026-11-08; the Q1 spring-back is gone). A camera
// button (even the one already on) or a double-click / double-tap on the view
// returns to the exact preset.
import { useCallback, useEffect, useRef } from 'react';
import { Box3, Vector3, type OrthographicCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls, type CameraControlsImpl } from '@react-three/drei';
import type { Shape } from '@/engine';
import { fitPreset, nearestAngle } from '@/ortho/orthoFit';
import { presetFor, PRESET_ORDER, type PresetName } from '@/ortho/presets';
import { presetDirection, type Vec3 } from '@/ortho/screenBasis';
import type { PlanFit as Handoff } from '@/state/store';
import { DemandSafeCameraControls } from './controls';
import { installTestApi } from './testApi';
import type { ViewStore } from './viewStore';

export const CAMERA_DISTANCE = 2000; // inches; ortho: distance only matters for clipping
export const MAX_ZOOM = 40; // px per inch
const D2R = Math.PI / 180;
/** A double tap: two still taps (each under TAP_MS, moving under TAP_PX), the second going down within GAP_MS of the first lifting, near it. */
const TAP_MS = 500;
const TAP_PX = 10;
const GAP_MS = 350;
const DOUBLE_PX = 30;

export function Rig({
  shape,
  preset,
  points,
  bounds,
  offset,
  handoff,
  onHandoff,
  view,
  reset,
}: {
  shape: Shape;
  preset: PresetName;
  /** Bumped by a camera button press: return to the preset even when it's already on. */
  reset: number;
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

  // A double-click or double-tap returns to the preset (mouse and touch alike:
  // two short, still taps with one pointer down). Listened for on the window:
  // camera-controls captures the pointer on its own element, so a pointerup may
  // never reach the canvas; only pointers that went down on the 3D view count.
  useEffect(() => {
    const host = gl.domElement.parentElement ?? gl.domElement;
    const down = new Map<number, { x: number; y: number; t: number }>();
    let lastTap: { x: number; y: number; t: number } | null = null;
    let multi = false;
    const onDown = (e: PointerEvent) => {
      if (!host.contains(e.target as Node)) return;
      down.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (down.size > 1) multi = true;
    };
    const onUp = (e: PointerEvent) => {
      const d = down.get(e.pointerId);
      if (!d) return;
      down.delete(e.pointerId);
      const wasMulti = multi;
      if (down.size === 0) multi = false;
      if (wasMulti) return void (lastTap = null);
      const tap = e.timeStamp - d.t < TAP_MS && Math.hypot(e.clientX - d.x, e.clientY - d.y) < TAP_PX;
      if (!tap) return void (lastTap = null);
      const now = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (lastTap && d.t - lastTap.t < GAP_MS && Math.hypot(now.x - lastTap.x, now.y - lastTap.y) < DOUBLE_PX) {
        lastTap = null;
        apply(current.current, true);
      } else lastTap = now;
    };
    const onCancel = (e: PointerEvent) => {
      down.delete(e.pointerId);
      lastTap = null;
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
    };
  }, [gl, apply]);

  // Preset buttons animate (a press on the one already on resets it); size and layout changes refit at once.
  const lastReset = useRef(reset);
  useEffect(() => {
    const again = reset !== lastReset.current;
    lastReset.current = reset;
    if (placed.current && (preset !== current.current || again)) apply(preset, true);
  }, [preset, reset, apply]);
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
        project: toScreen,
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
