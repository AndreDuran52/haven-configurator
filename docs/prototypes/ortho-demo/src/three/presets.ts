// Pure data, NO three.js import: the UI shell can import this without pulling the 3D bundle
// into the entry chunk (a single value import from a three-importing module defeats lazy()).

export type PresetName = 'iso' | 'dimetric' | 'trimetric' | 'front' | 'side' | 'top'

export interface PresetDef {
  name: PresetName
  label: string
  azimuthDeg: number
  elevationDeg: number
}

export const ISO_ELEVATION = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI // 35.2644°

export const PRESETS: Record<PresetName, PresetDef> = {
  iso: { name: 'iso', label: 'Iso', azimuthDeg: 45, elevationDeg: ISO_ELEVATION },
  dimetric: { name: 'dimetric', label: '3/4 dimetric', azimuthDeg: 45, elevationDeg: 30 },
  trimetric: { name: 'trimetric', label: '3/4 trimetric', azimuthDeg: 30, elevationDeg: 30 },
  front: { name: 'front', label: 'Front', azimuthDeg: 0, elevationDeg: 0 },
  side: { name: 'side', label: 'Side', azimuthDeg: 90, elevationDeg: 0 },
  top: { name: 'top', label: 'Top', azimuthDeg: 0, elevationDeg: 90 },
}

