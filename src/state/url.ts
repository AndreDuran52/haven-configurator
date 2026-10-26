// URL hash <-> layout (plan §8 "URL sync"). Pure helpers; useUrlSync wires them.
import { decodeLayout, solo, standardU, type Layout, type LayoutDecode } from '@/engine';
import { canOpen } from './layoutGate';
import { codeOf } from './store';

export const HASH_KEY = 'c';

/** The code in a `#c=…` hash, or null. */
export function codeFromHash(hash: string): string | null {
  const m = /^#?c=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return m[1]!; // a malformed %-escape: decode then reports it as damaged
  }
}

export const hashFor = (l: Layout): string => `#${HASH_KEY}=${codeOf(l)}`;

/** The URL to replaceState to: path + search (keeps ?view) + the layout hash. */
export const urlFor = (loc: Pick<Location, 'pathname' | 'search'>, l: Layout): string =>
  `${loc.pathname}${loc.search}${hashFor(l)}`;

export const isViewMode = (search: string): boolean => new URLSearchParams(search).has('view');

/** The hash's layout; one this build cannot show yet reads as "newer". */
export function decodeHash(hash: string): LayoutDecode | null {
  const code = codeFromHash(hash);
  if (code === null) return null;
  const d = decodeLayout(code);
  return 'layout' in d && !canOpen(d.layout) ? { error: 'newer' } : d;
}

export const DAMAGED_MESSAGE = 'This link looks damaged';
export const NEWER_MESSAGE = 'This link was made with a newer version: reload the app';

/** Load order (plan §8): the hash, then the Standard U. The draft is never loaded automatically. */
export function initialLayout(hash: string): { layout: Layout; message: string | null } {
  const d = decodeHash(hash);
  if (d && 'layout' in d) return { layout: d.layout, message: null };
  const message = d ? (d.error === 'newer' ? NEWER_MESSAGE : DAMAGED_MESSAGE) : null;
  return { layout: solo(standardU()), message };
}

/** The two links the Share dialog offers (plan §9): the working link, and the read-only client link. */
export function shareLinks(l: Layout, loc: Pick<Location, 'origin' | 'pathname'> = window.location): { edit: string; view: string } {
  const code = codeOf(l);
  return { edit: `${loc.origin}${loc.pathname}#${HASH_KEY}=${code}`, view: `${loc.origin}${loc.pathname}?view#${HASH_KEY}=${code}` };
}

/** "Edit a copy": the same URL without ?view. */
export const editUrl = (loc: Pick<Location, 'pathname' | 'hash'>): string => `${loc.pathname}${loc.hash}`;
