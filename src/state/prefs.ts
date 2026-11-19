// Per-device view preferences (UX Phase 3). Never in links or projects; every
// read and write goes through storage.ts (storage can throw).
import { PERSON_HEIGHT, PERSON_MAX, PERSON_MIN, type PersonPose } from '@/ortho/personLimits';
import { KEYS, readItem, readJson, writeItem } from './storage';

export type DimsModePref = 'overall' | 'detailed';

/** Plan dimensions: Detailed (every piece) unless this device chose Overall. */
export const readDimsMode = (): DimsModePref => (readItem(KEYS.dims) === 'overall' ? 'overall' : 'detailed');
export const writeDimsMode = (m: DimsModePref): boolean => writeItem(KEYS.dims, m);

/** UX Phase 5 (Andre, 2026-11-11): the side panel hidden, so the plan or 3D fills the screen. Shown unless this device hid it. */
export const readPanelHidden = (): boolean => readItem(KEYS.panel) === 'hidden';
export const writePanelHidden = (hidden: boolean): boolean => writeItem(KEYS.panel, hidden ? 'hidden' : 'shown');

/** The person (Andre, 2026-11-11): the average US man, 5'9″, lounging, unless this device chose otherwise. */
export interface PersonPref {
  height: number;
  pose: PersonPose;
}
export function readPerson(): PersonPref {
  const p = readJson<Partial<PersonPref>>(KEYS.person);
  const h = Number(p?.height);
  return { height: h >= PERSON_MIN && h <= PERSON_MAX ? Math.round(h) : PERSON_HEIGHT, pose: p?.pose === 'upright' ? 'upright' : 'lounge' };
}
export const writePerson = (p: PersonPref): boolean => writeItem(KEYS.person, JSON.stringify(p));
