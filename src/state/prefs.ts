// Per-device view preferences (UX Phase 3). Never in links or projects; every
// read and write goes through storage.ts (storage can throw).
import { KEYS, readItem, writeItem } from './storage';

export type DimsModePref = 'overall' | 'detailed';

/** Plan dimensions: Detailed (every piece) unless this device chose Overall. */
export const readDimsMode = (): DimsModePref => (readItem(KEYS.dims) === 'overall' ? 'overall' : 'detailed');
export const writeDimsMode = (m: DimsModePref): boolean => writeItem(KEYS.dims, m);
