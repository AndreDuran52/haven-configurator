// The look data tables (plan §10 H5): fabrics and table finishes, as plain
// data. Keys are link codes forever (codec FABRIC_CODES / FINISH_CODES are
// append-only), so add entries at the END and never rename a key.
// Q16: Andre supplies the fabric list; until then only the showroom bouclé.
import type { TableFinish } from './types';

export interface Fabric {
  key: string;
  name: string;
  /** Base colour (sRGB hex) for 3D and the swatch. */
  color: string;
  /** Surface: bouclé loops (bump) or a flat weave. */
  weave: 'boucle' | 'flat';
}

export interface Finish {
  key: TableFinish;
  name: string;
  /** Base colour of the wood (sRGB hex) and its grain lines. */
  color: string;
  grain: string;
}

export const FABRICS: readonly Fabric[] = [{ key: 'boucle-white', name: 'White bouclé', color: '#efebe3', weave: 'boucle' }];

export const FINISHES: readonly Finish[] = [
  { key: 'walnut', name: 'Walnut', color: '#7b5538', grain: '#4a2f1c' },
  { key: 'darkWood', name: 'Dark wood', color: '#3b2a20', grain: '#1f1510' },
];

export const fabricOf = (key: string): Fabric => FABRICS.find((f) => f.key === key) ?? FABRICS[0]!;
export const finishOf = (key: TableFinish): Finish => FINISHES.find((f) => f.key === key) ?? FINISHES[0]!;
