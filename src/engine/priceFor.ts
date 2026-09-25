// Price stub (§9). Pure and never rendered until Andre asks for pricing; nothing
// in ui/ or plan/ may import it (priceFor.test.ts), and prices never enter links.
import type { Config } from './types';

export function priceFor(_config: Config): number | null {
  return null;
}
