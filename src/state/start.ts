// "Start from" choices (plan §8 Start menu) and the preset Reset returns to.
import { blankConfig, solo, standardL, standardU, teeLayout, type Layout, type Shape } from '@/engine';

export type StartChoice =
  | { kind: 'standardU' }
  | { kind: 'standardL'; side: 'left' | 'right' }
  | { kind: 'blank'; shape: Shape; W: number; L: number; R: number; D: number }
  /** Shapes B1: the T sectional (two L's, legs back to back down the stem). */
  | { kind: 'tee'; total: number; stem: number; D: number; sharedBack: boolean };

export const DEFAULT_START: StartChoice = { kind: 'standardU' };

/** The preset layout for a start choice at its default size (Blank keeps its typed sizes). */
export function presetFor(s: StartChoice): Layout {
  if (s.kind === 'standardU') return solo(standardU());
  if (s.kind === 'standardL') return solo(standardL(s.side));
  if (s.kind === 'tee') return teeLayout(s);
  return solo(blankConfig(s.shape, { W: s.W, L: s.L, R: s.R, D: s.D }));
}

export function startLabel(s: StartChoice): string {
  if (s.kind === 'standardU') return 'Standard U';
  if (s.kind === 'standardL') return `Standard L (${s.side})`;
  if (s.kind === 'tee') return 'T shape';
  return `Blank ${s.shape}`;
}
