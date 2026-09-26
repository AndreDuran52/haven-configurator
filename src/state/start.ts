// "Start from" choices (plan §8 Start menu) and the preset Reset returns to.
import { blankConfig, standardL, standardU, type Config, type Shape } from '@/engine';

export type StartChoice =
  | { kind: 'standardU' }
  | { kind: 'standardL'; side: 'left' | 'right' }
  | { kind: 'blank'; shape: Shape; W: number; L: number; R: number; D: number };

export const DEFAULT_START: StartChoice = { kind: 'standardU' };

/** The preset for a start choice at its default size (Blank keeps its typed sizes). */
export function presetFor(s: StartChoice): Config {
  if (s.kind === 'standardU') return standardU();
  if (s.kind === 'standardL') return standardL(s.side);
  return blankConfig(s.shape, { W: s.W, L: s.L, R: s.R, D: s.D });
}

export function startLabel(s: StartChoice): string {
  if (s.kind === 'standardU') return 'Standard U';
  if (s.kind === 'standardL') return `Standard L (${s.side})`;
  return `Blank ${s.shape}`;
}
