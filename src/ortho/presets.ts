// Orthographic presets (plan §7.2). Pure data, NO three import: the preset
// buttons live in the entry chunk, and a single value import from a module
// that imports three would pull all of three.js into it (plan §4).
//
// Angles use camera-controls' spherical convention: azimuth θ = atan2(x, z)
// (0 = camera on +z, the OPEN END of the U, looking at the back); elevation
// above the floor, polar φ = 90° − elevation. Camera up is always world +y.
import type { Shape } from '@/engine';

export type PresetName = 'top' | 'front' | 'side' | 'threeQuarter' | 'iso';

export interface PresetDef {
  name: PresetName;
  label: string;
  azimuthDeg: number;
  elevationDeg: number;
}

export const ISO_ELEVATION = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI; // 35.2644°

export const PRESET_ORDER: PresetName[] = ['top', 'front', 'side', 'threeQuarter', 'iso'];
export const PRESET_LABELS: Record<PresetName, string> = {
  top: 'Top',
  front: 'Front',
  side: 'Side',
  threeQuarter: '3/4',
  iso: 'Iso',
};

/** The default 3D view (Andre: "like looking at it from the top right"). */
export const DEFAULT_PRESET: PresetName = 'threeQuarter';

/**
 * The preset for a shape. Side is the right elevation (U, L-right) or the left
 * one (L-left); 3/4 and Iso turn to −θ for L-right so the leg's inside shows.
 */
export function presetFor(name: PresetName, shape: Shape): PresetDef {
  const sign = shape === 'L-right' ? -1 : 1;
  const label = PRESET_LABELS[name];
  switch (name) {
    case 'top':
      return { name, label, azimuthDeg: 0, elevationDeg: 90 };
    case 'front':
      return { name, label, azimuthDeg: 0, elevationDeg: 0 };
    case 'side':
      return { name, label, azimuthDeg: shape === 'L-left' ? -90 : 90, elevationDeg: 0 };
    case 'threeQuarter':
      return { name, label, azimuthDeg: 30 * sign, elevationDeg: 30 };
    case 'iso':
      return { name, label, azimuthDeg: 45 * sign, elevationDeg: ISO_ELEVATION };
  }
}

/** Front and Side are true elevations (to scale, height ticks shown). */
export const isElevation = (name: PresetName): boolean => name === 'front' || name === 'side';
