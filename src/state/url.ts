// URL hash <-> config (plan §8 "URL sync"). Pure helpers; useUrlSync wires them.
import { decode, encode, standardU, type Config, type DecodeResult } from '@/engine';

export const HASH_KEY = 'c';

/** The code in a `#c=…` hash, or null. */
export function codeFromHash(hash: string): string | null {
  const m = /^#?c=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return m[1]!; // a malformed %-escape: decode() then reports it as damaged
  }
}

export const hashFor = (c: Config): string => `#${HASH_KEY}=${encode(c)}`;

/** The URL to replaceState to: path + search (keeps ?view) + the layout hash. */
export const urlFor = (loc: Pick<Location, 'pathname' | 'search'>, c: Config): string =>
  `${loc.pathname}${loc.search}${hashFor(c)}`;

export const isViewMode = (search: string): boolean => new URLSearchParams(search).has('view');

export function decodeHash(hash: string): DecodeResult | null {
  const code = codeFromHash(hash);
  return code === null ? null : decode(code);
}

export const DAMAGED_MESSAGE = 'This link looks damaged';
export const NEWER_MESSAGE = 'This link was made with a newer version: reload the app';

/** Load order (plan §8): the hash, then the Standard U. The draft is never loaded automatically. */
export function initialConfig(hash: string): { config: Config; message: string | null } {
  const d = decodeHash(hash);
  if (d && 'config' in d) return { config: d.config, message: null };
  const message = d ? (d.error === 'newer' ? NEWER_MESSAGE : DAMAGED_MESSAGE) : null;
  return { config: standardU(), message };
}
