// Share-link codec, text format v1 (§9). Compact, versioned, URL-safe.
//
//   1UW188L132R132D44_bt32s36_la72_ra72.k7
//   │└─ header ──────┘ └ runs ─────────┘ └ checksum (2 base36)
//   └ link version
//
// Alphabet: RFC 3986 "unreserved" only (A-Z a-z 0-9 - . _ ~), so nothing is
// percent-encoded, and the link always ENDS in an alphanumeric (the checksum).
//
// Header: shape (U | l = L-left | r = L-right), then letter+number fields:
//   W L R D (always) · C manual wedge · K lock off · S seat width (≠ 28)
//   N snug width (≠ 24) · X<key><n> dims overrides · F fabric · T table finish
// Runs:  _b _l _r, then pieces: s armless · a one-arm (+ S|E when the arm is not
//   at the run's open end) · t table · g gap; "~" joins auto-split siblings;
//   "j" marks a seat half split around the adjacent table (G1).
// Loose: _o ottoman / _c coffee table: x y w d.
// Ids are NOT encoded; decode regenerates them. Links carry geometry, fabric and
// finish only: never names, project numbers or prices. Golden links per version
// are kept forever (codec.golden.test.ts); a format change bumps LINK_VERSION
// and adds a decoder/migration.
import { buildHaven } from './buildHaven';
import { DEFAULT_DIMS, DEFAULT_FABRIC, DEFAULT_FINISH, SEAT_WIDTH_DEFAULT, SNUG_SEAT_WIDTH } from './defaults';
import { openEnd, runIds } from './layout';
import type { Config, HavenDims, LoosePiece, RunId, RunPiece, Runs, Shape, TableFinish } from './types';

export const LINK_VERSION = 1;

/** Append-only: a fabric's index is its link code. */
export const FABRIC_CODES: readonly string[] = [DEFAULT_FABRIC];
/** Append-only: a finish's index is its link code. */
export const FINISH_CODES: readonly TableFinish[] = [DEFAULT_FINISH, 'darkWood'];

const SHAPE: Record<Shape, string> = { U: 'U', 'L-left': 'l', 'L-right': 'r' };
const SHAPE_INV: Record<string, Shape> = { U: 'U', l: 'L-left', r: 'L-right' };
const RUN_CODE: Record<RunId, string> = { back: 'b', left: 'l', right: 'r' };
const RUN_INV: Record<string, RunId> = { b: 'back', l: 'left', r: 'right' };
const DIM_KEYS: Record<string, keyof HavenDims> = {
  A: 'A',
  B: 'B',
  f: 'backFrame',
  g: 'legHeight',
  k: 'deckHeight',
  s: 'seatHeight',
  c: 'cushionCrown',
  e: 'cushionEdge',
  a: 'armHeight',
  b: 'backHeight',
  t: 'tableHeight',
  o: 'ottomanHeight',
  q: 'coffeeTableHeight',
};
const DIM_INV = Object.fromEntries(Object.entries(DIM_KEYS).map(([k, v]) => [v, k])) as Record<keyof HavenDims, string>;

const num = (n: number): string => String(Math.round(n * 2) / 2 + 0);

function checksum(body: string): string {
  let h = 2166136261;
  for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1296).toString(36).padStart(2, '0');
}

function code(list: readonly string[], value: string, what: string): number {
  const i = list.indexOf(value);
  if (i < 0) throw new Error(`codec: unknown ${what} "${value}"`);
  return i;
}

export function encode(c: Config): string {
  let h = `${LINK_VERSION}${SHAPE[c.shape]}W${num(c.W)}L${num(c.L)}R${num(c.R)}D${num(c.D)}`;
  if (c.wedgeC !== null) h += `C${num(c.wedgeC)}`;
  if (!c.lockOutside) h += 'K';
  if (c.seatWidth !== SEAT_WIDTH_DEFAULT) h += `S${num(c.seatWidth)}`;
  if (c.snugWidth !== SNUG_SEAT_WIDTH) h += `N${num(c.snugWidth)}`;
  for (const k of Object.keys(DEFAULT_DIMS) as (keyof HavenDims)[]) {
    if (c.dims[k] !== DEFAULT_DIMS[k]) h += `X${DIM_INV[k]}${num(c.dims[k])}`;
  }
  const fabric = code(FABRIC_CODES, c.fabric, 'fabric');
  const finish = code(FINISH_CODES, c.tableFinish, 'table finish');
  if (fabric) h += `F${fabric}`;
  if (finish) h += `T${finish}`;
  const parts = [h];
  for (const run of ['back', 'left', 'right'] as RunId[]) {
    const ps = c.runs[run];
    if (!ps) continue;
    const oe = openEnd(c.shape, run);
    let s = RUN_CODE[run];
    ps.forEach((p, i) => {
      if (i > 0 && p.splitGroup && p.splitGroup === ps[i - 1]!.splitGroup) s += '~';
      s += { armless: 's', oneArm: 'a', table: 't', gap: 'g' }[p.kind] + num(p.length);
      if (p.kind === 'oneArm' && p.arm !== oe) s += p.arm === 'start' ? 'S' : 'E';
      if (p.joinedBy) s += 'j';
    });
    parts.push(s);
  }
  for (const l of c.loose) parts.push(`${l.kind === 'ottoman' ? 'o' : 'c'}x${num(l.x)}y${num(l.y)}w${num(l.w)}d${num(l.d)}`);
  const body = parts.join('_');
  return `${body}.${checksum(body)}`;
}

export type DecodeResult = { config: Config } | { error: 'damaged' | 'newer' };

/** Strict decode: a damaged link reads "damaged"; a higher version reads "newer". */
export function decode(link: string): DecodeResult {
  const m = /^(\d+)([A-Za-z].*)\.([0-9a-z]{2})$/.exec(link.trim());
  if (!m) return { error: 'damaged' };
  const version = Number(m[1]);
  if (version > LINK_VERSION) return { error: 'newer' };
  if (checksum(`${m[1]}${m[2]}`) !== m[3]) return { error: 'damaged' };
  const decoders: Record<number, (b: string) => Config | null> = { 1: decodeV1 };
  const config = decoders[version]?.(m[2]!) ?? null;
  // Later versions: migrations[v](config), chained up to the current schema.
  if (!config || buildHaven(config).errors.length > 0) return { error: 'damaged' };
  return { config };
}

const NUM = '(\\d+(?:\\.5)?)';
const SNUM = '(-?\\d+(?:\\.5)?)'; // loose pieces may sit at negative coordinates

function decodeHeader(fields: string) {
  const vals: Record<string, number> = {};
  const dims: HavenDims = { ...DEFAULT_DIMS };
  let unlocked = false;
  let ok = true;
  const left = fields.replace(/(X[A-Za-z]|[WLRDCSNFT])(\d+(?:\.5)?)|(K)/g, (_all, key?: string, n?: string, k?: string) => {
    if (k) {
      if (unlocked) ok = false;
      unlocked = true;
    } else if (key!.startsWith('X')) {
      const dk = DIM_KEYS[key![1]!];
      if (!dk) ok = false;
      else dims[dk] = Number(n);
    } else {
      if (key! in vals) ok = false;
      vals[key!] = Number(n);
    }
    return '';
  });
  return ok && left === '' ? { vals, dims, unlocked } : null;
}

function decodeRun(body: string, oe: 'start' | 'end' | null, id: () => string): RunPiece[] | null {
  const pieces: RunPiece[] = [];
  const joins: boolean[] = [];
  let consumed = 0;
  for (const pm of body.matchAll(new RegExp(`(~?)([sagt])${NUM}([SE]?)(j?)`, 'g'))) {
    if (pm.index !== consumed) return null; // strict: no skipped characters
    consumed += pm[0].length;
    const kind = ({ s: 'armless', a: 'oneArm', t: 'table', g: 'gap' } as const)[pm[2] as 's' | 'a' | 't' | 'g'];
    const p: RunPiece = { id: id(), kind, length: Number(pm[3]) };
    if (pm[4] && kind !== 'oneArm') return null;
    if (kind === 'oneArm') p.arm = pm[4] === 'S' ? 'start' : pm[4] === 'E' ? 'end' : (oe ?? 'end');
    if (pm[1] === '~') {
      const prev = pieces[pieces.length - 1];
      if (!prev) return null;
      prev.splitGroup ??= id().replace('p', 'g');
      p.splitGroup = prev.splitGroup;
    }
    pieces.push(p);
    joins.push(pm[5] === 'j');
  }
  if (consumed !== body.length) return null;
  // G1: pair each table with the marked halves on either side of it.
  pieces.forEach((t, i) => {
    if (t.kind === 'table' && joins[i - 1] && joins[i + 1] && !pieces[i - 1]!.joinedBy) {
      pieces[i - 1]!.joinedBy = t.id;
      pieces[i + 1]!.joinedBy = t.id;
    }
  });
  const unpaired = pieces.some((p, i) => joins[i] && !p.joinedBy);
  return unpaired ? null : pieces;
}

function decodeV1(s: string): Config | null {
  const [head, ...rest] = s.split('_');
  const hm = /^([Ulr])(.*)$/.exec(head!);
  if (!hm) return null;
  const shape = SHAPE_INV[hm[1]!]!;
  const h = decodeHeader(hm[2]!);
  if (!h) return null;
  const get = (k: string): number | null => (k in h.vals ? h.vals[k]! : null);
  const [W, L, R, D] = [get('W'), get('L'), get('R'), get('D')];
  if (W === null || L === null || R === null || D === null) return null;
  const fabric = FABRIC_CODES[get('F') ?? 0];
  const tableFinish = FINISH_CODES[get('T') ?? 0];
  if (!fabric || !tableFinish) return null;
  let nextId = 1;
  const id = () => `p${nextId++}`;
  const runs: Runs = {};
  const loose: LoosePiece[] = [];
  for (const tok of rest) {
    const run = RUN_INV[tok[0]!];
    if (run && /^[blr]([sagt~]|$)/.test(tok)) {
      if (runs[run]) return null;
      const pieces = decodeRun(tok.slice(1), openEnd(shape, run), id);
      if (!pieces) return null;
      runs[run] = pieces;
    } else {
      const lm = new RegExp(`^([oc])x${SNUM}y${SNUM}w${NUM}d${NUM}$`).exec(tok);
      if (!lm) return null;
      const kind = lm[1] === 'o' ? 'ottoman' : 'coffeeTable';
      loose.push({ id: id(), kind, x: +lm[2]!, y: +lm[3]!, w: +lm[4]!, d: +lm[5]! });
    }
  }
  if (Object.keys(runs).some((r) => !runIds(shape).includes(r as RunId))) return null;
  return {
    schema: 1,
    shape,
    W,
    L,
    R,
    D,
    wedgeC: get('C'),
    lockOutside: !h.unlocked,
    runs,
    loose,
    seatWidth: get('S') ?? SEAT_WIDTH_DEFAULT,
    snugWidth: get('N') ?? SNUG_SEAT_WIDTH,
    fabric,
    tableFinish,
    dims: h.dims,
    nextId,
  };
}
