// Saved layouts (plan §8 "Saved layouts", H6): a localStorage list per device
// and browser context, newest first, capped at 200 (a full list refuses a new
// project, never drops one). Each entry stores the share code (links are
// forever, so saved layouts are too). Every read/write goes through storage.ts;
// a throwing storage reads as an empty list and a failed write returns false
// ("Can't save on this device"). An unreadable list is copied aside before
// anything replaces it (savedRecovery.ts).
import { decode, encode, type Config } from '@/engine';
import { secureRaw } from './savedRecovery';
import { KEYS, readItem, writeItem } from './storage';

export interface SavedLayout {
  id: string;
  name: string;
  code: string;
  savedAt: number;
}

export const SAVED_CAP = 200;

/** "Oct 2, 2026, 5:47 PM": saved projects and the last layout. */
export const savedDate = (t: number) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const valid = (x: unknown): x is SavedLayout =>
  !!x && typeof x === 'object' && typeof (x as SavedLayout).id === 'string' && typeof (x as SavedLayout).name === 'string' && typeof (x as SavedLayout).code === 'string';

/** The stored list; `clean` is false when the text is not exactly a list of valid entries. */
function load(): { list: SavedLayout[]; clean: boolean; raw: string | null } {
  const raw = readItem(KEYS.saved);
  if (raw === null) return { list: [], clean: true, raw };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // unreadable: handled below
  }
  const list = Array.isArray(parsed) ? parsed.filter(valid) : [];
  return { list, clean: Array.isArray(parsed) && list.length === parsed.length, raw };
}

export function listSaved(): SavedLayout[] {
  const l = load();
  if (!l.clean) secureRaw(l.raw!);
  return l.list;
}

function write(list: SavedLayout[]): boolean {
  const l = load();
  // Never replace text we could not read until an exact copy of it is kept.
  if (!l.clean && !secureRaw(l.raw!)) return false;
  return writeItem(KEYS.saved, JSON.stringify(list));
}

export const isFull = (): boolean => listSaved().length >= SAVED_CAP;

/** Why a save failed, in Andre's words for the dialog. */
export const saveFailure = (): string =>
  isFull()
    ? `This device already holds ${SAVED_CAP} projects. Delete one (or back up and remove old ones) to save a new one.`
    : "Can't save on this device (storage is off or full). Share a link instead.";

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
  if (list.length >= SAVED_CAP || !write([entry, ...list])) return null;
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
  if (!e || list.length >= SAVED_CAP) return null;
  const copy = { ...e, id: newId(now), name: `${e.name} (copy)`, savedAt: now };
  return write([copy, ...list]) ? copy : null;
}

export function deleteSaved(id: string): boolean {
  const list = listSaved();
  return write(list.filter((x) => x.id !== id));
}

/** Overwrite a project with the current layout (Save on an open project) and move it to the top. Null when it no longer exists or the write fails. */
export function updateSaved(id: string, config: Config, now = Date.now()): SavedLayout | null {
  const list = listSaved();
  const e = list.find((x) => x.id === id);
  if (!e) return null;
  const next = { ...e, code: encode(config), savedAt: now };
  return write([next, ...list.filter((x) => x.id !== id)]) ? next : null;
}

/** The backup file (H6b): every project on this device, names included (the file stays with Andre; links never carry names). */
export interface Backup {
  app: 'haven-configurator';
  kind: 'projects';
  version: 1;
  exportedAt: number;
  projects: SavedLayout[];
}

export function exportSaved(now = Date.now()): string {
  const b: Backup = { app: 'haven-configurator', kind: 'projects', version: 1, exportedAt: now, projects: listSaved() };
  return JSON.stringify(b, null, 1);
}

export type ImportResult = { added: number; updated: number; skipped: number; full: boolean } | { error: 'notBackup' | 'storage' };

/**
 * Merge a backup into this device's projects: new ids are added, an id already
 * here takes the backup's copy only when that one is newer, and entries whose
 * code no longer decodes are skipped. Accepts the backup object or a bare list.
 */
export function importSaved(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'notBackup' };
  }
  const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as Backup).projects) ? (raw as Backup).projects : null;
  if (!items) return { error: 'notBackup' };
  const list = listSaved();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let full = false;
  for (const x of items) {
    if (!valid(x) || !('config' in decode(x.code))) {
      skipped++;
      continue;
    }
    const entry: SavedLayout = { id: x.id, name: x.name, code: x.code, savedAt: Number(x.savedAt) || 0 };
    const i = list.findIndex((y) => y.id === entry.id);
    if (i < 0 && list.length >= SAVED_CAP) {
      full = true;
      skipped++;
    } else if (i < 0) {
      list.push(entry);
      added++;
    } else if (entry.savedAt > list[i]!.savedAt) {
      list[i] = entry;
      updated++;
    } else skipped++;
  }
  if (added + updated === 0) return { added, updated, skipped, full };
  list.sort((a, b) => b.savedAt - a.savedAt);
  if (!write(list)) return { error: 'storage' };
  persist();
  return { added, updated, skipped, full };
}

/** The layout of a saved entry, or null when its code no longer decodes. */
export function openSaved(e: SavedLayout): Config | null {
  const d = decode(e.code);
  return 'config' in d ? d.config : null;
}
