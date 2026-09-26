// Saved layouts (plan §8 "Saved layouts", H6): a localStorage list per device
// and browser context, newest first, capped at 200. Each entry stores the share
// code (links are forever, so saved layouts are too). Every read/write goes
// through storage.ts; a throwing storage reads as an empty list and a failed
// write returns false ("Can't save on this device").
import { decode, encode, type Config } from '@/engine';
import { KEYS, readJson, writeItem } from './storage';

export interface SavedLayout {
  id: string;
  name: string;
  code: string;
  savedAt: number;
}

export const SAVED_CAP = 200;

const valid = (x: unknown): x is SavedLayout =>
  !!x && typeof x === 'object' && typeof (x as SavedLayout).id === 'string' && typeof (x as SavedLayout).name === 'string' && typeof (x as SavedLayout).code === 'string';

export function listSaved(): SavedLayout[] {
  const raw = readJson<unknown>(KEYS.saved);
  return Array.isArray(raw) ? raw.filter(valid) : [];
}

function write(list: SavedLayout[]): boolean {
  return writeItem(KEYS.saved, JSON.stringify(list.slice(0, SAVED_CAP)));
}

let counter = 0;
const newId = (now: number) => `s${now.toString(36)}${(counter++).toString(36)}`;

/** Ask the browser not to evict the list (feature-detected, result ignored). */
function persist(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // ignore
  }
}

export function saveLayout(name: string, config: Config, now = Date.now()): SavedLayout | null {
  const entry: SavedLayout = { id: newId(now), name: name.trim() || 'Untitled layout', code: encode(config), savedAt: now };
  const list = listSaved();
  if (!write([entry, ...list])) return null;
  if (list.length === 0) persist();
  return entry;
}

export function renameSaved(id: string, name: string): boolean {
  const list = listSaved();
  const e = list.find((x) => x.id === id);
  if (!e) return false;
  e.name = name.trim() || e.name;
  return write(list);
}

export function duplicateSaved(id: string, now = Date.now()): SavedLayout | null {
  const list = listSaved();
  const e = list.find((x) => x.id === id);
  if (!e) return null;
  const copy = { ...e, id: newId(now), name: `${e.name} (copy)`, savedAt: now };
  return write([copy, ...list]) ? copy : null;
}

export function deleteSaved(id: string): boolean {
  const list = listSaved();
  return write(list.filter((x) => x.id !== id));
}

/** The layout of a saved entry, or null when its code no longer decodes. */
export function openSaved(e: SavedLayout): Config | null {
  const d = decode(e.code);
  return 'config' in d ? d.config : null;
}
