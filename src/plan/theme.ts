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
  cushionSeams: true,
};
