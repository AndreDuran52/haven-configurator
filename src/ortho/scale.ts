// The on-screen scale bar (plan §7.2 "Scale overlay"): exact because it is
// driven by camera.zoom (CSS px per inch). Iso measures × 0.8165 along the three
// axes only; the 3/4 view has no bar.

const NICE_INCHES = [6, 12, 24, 36, 48, 72, 96, 120, 144, 192, 240];
export const ISO_AXIS_SCALE = Math.sqrt(2 / 3); // 0.8165

export interface ScaleBar {
  inches: number;
  px: number;
  label: string;
}

const feet = (inches: number): string => (inches % 12 === 0 ? `${inches / 12}′` : `${inches}″`);

/** The longest nice length whose bar is at most `maxPx` wide (and at least one step). */
export function scaleBar(zoom: number, axisScale = 1, maxPx = 160): ScaleBar {
  const pxPerIn = zoom * axisScale;
  let inches = NICE_INCHES[0]!;
  for (const n of NICE_INCHES) if (n * pxPerIn <= maxPx) inches = n;
  return { inches, px: inches * pxPerIn, label: feet(inches) };
}
