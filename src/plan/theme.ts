// Plan colours as LITERAL values (plan §8): svg2pdf cannot resolve CSS var().
// Font family is lowercase `helvetica` with weights 400/700 only: capitalised
// "Helvetica" silently falls back to Times in the PDF, and 600 doesn't map to bold.

export interface PlanTheme {
  ink: string;
  paper: string;
  seat: string;
  seatDetail: string;
  table: string;
  tableGrain: string;
  dim: string;
  gap: string;
  warn: string;
  select: string;
  loose: string;
  font: string;
  bold: 700;
  /** H6c: the room's floor fill and walls; a gap past a wall. */
  floor: string;
  wall: string;
  bad: string;
  /** Outline weight multiplier (the screen draws heavier lines so they survive a shared screen; print is 1). */
  line: number;
  /** Sketch: outline each seat cushion (the seams between cushion, back and arm). */
  cushionSeams: boolean;
}

export const LIGHT: PlanTheme = {
  ink: '#1c1b19',
  paper: '#ffffff',
  seat: '#efebe4',
  seatDetail: '#e2dccf',
  table: '#b9936b',
  tableGrain: '#8a6645',
  dim: '#3d3a35',
  gap: '#9a948a',
  warn: '#d99a00',
  select: '#2f6fed',
  loose: '#f6f4f0',
  floor: '#f6f2ea',
  wall: '#1c1b19',
  bad: '#c0392b',
  line: 1,
  font: 'helvetica, arial, sans-serif',
  bold: 700,
  cushionSeams: false,
};

/** Sketch (plan §10 H5): white fill, black lines, cushion seams, the same deterministic wood grain in black. */
export const SKETCH: PlanTheme = {
  ...LIGHT,
  ink: '#000000',
  seat: '#ffffff',
  seatDetail: '#ffffff',
  table: '#ffffff',
  tableGrain: '#000000',
  dim: '#000000',
  gap: '#555555',
  loose: '#ffffff',
  floor: '#ffffff',
  wall: '#000000',
  cushionSeams: true,
};

/**
 * UX Phase 3 (Andre, 2026-11-08: the app is shared over Zoom): one background
 * for the plan, the room floor and the 3D view, heavier outlines and darker
 * dimensions on screen. The sheets keep LIGHT / SKETCH (white paper).
 */
export const SCREEN_BG = '#faf8f4';
export const LIGHT_SCREEN: PlanTheme = { ...LIGHT, paper: SCREEN_BG, floor: SCREEN_BG, dim: '#1c1b19', gap: '#6f695f', line: 1.4 };
export const SKETCH_SCREEN: PlanTheme = { ...SKETCH, paper: SCREEN_BG, floor: SCREEN_BG, gap: '#555555', line: 1.4 };
