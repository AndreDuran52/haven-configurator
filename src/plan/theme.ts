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
};
