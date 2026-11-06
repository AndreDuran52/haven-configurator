// Share link v4: freeform pieces (stage 3, 2026-11-06). Same alphabet,
// version digit and checksum as v1–v3 (codec.ts):
//
//   4fD44_w x0y0r0 _a72E pa1… (spaces only for reading)
//   │└ header: f, then codec.ts's fields from D on (no W/L/R, no lock)
//   └ version
//
// One token per piece, parents first, numbered from 1:
//   kind  s armless · a one-arm (+ S|E: the arm at its start or end) · t table · w wedge
//   size  the length (none for a wedge: its size is the shared corner C)
//   then  x<n>y<n>r<0-3> a sofa's first piece (r × 90° clockwise), or
//         p<i><face>[o<n>][H] attached to piece i's face: s start · e end ·
//         a / b a wedge's faces · k its back (o = offset along it, H = one shared frame)
// Loose pieces after them as in v1 (_o… / _c…). Ids are not encoded.
import { checksum, decodeHeader, fieldTokens, FABRIC_CODES, FINISH_CODES, looseToken, num, NUM, SNUM, TABLE_STYLE_CODES } from './codec';
import { decodeLayout, type LayoutDecode } from './codecLayout';
import { SEAT_WIDTH_DEFAULT, SNUG_SEAT_WIDTH } from './defaults';
import { buildFree } from './freeBuild';
import { isRoot } from './freePose';
import type { FaceId, FreeLayout, FreePiece, Rot } from './freeTypes';
import type { LoosePiece } from './types';

export const FREE_VERSION = 4;
const KIND: Record<FreePiece['kind'], string> = { armless: 's', oneArm: 'a', table: 't', wedge: 'w' };
const KIND_INV: Record<string, FreePiece['kind']> = { s: 'armless', a: 'oneArm', t: 'table', w: 'wedge' };
const FACE: Record<FaceId, string> = { start: 's', end: 'e', back: 'k', a: 'a', b: 'b' };
const FACE_INV: Record<string, FaceId> = { s: 'start', e: 'end', k: 'back', a: 'a', b: 'b' };

export function encodeFree(f: FreeLayout): string {
  const index = new Map(f.pieces.map((p, i) => [p.id, i + 1]));
  const tokens = f.pieces.map((p, i) => {
    let t = KIND[p.kind] + (p.kind === 'wedge' ? '' : num(p.length ?? 0));
    if (p.kind === 'oneArm') t += p.arm === 'start' ? 'S' : 'E';
    if (isRoot(p.at)) return `${t}x${num(p.at.x)}y${num(p.at.y)}r${p.at.rot / 90}`;
    const to = index.get(p.at.to);
    if (!to || to > i) throw new Error('codec: pieces must come after the piece they attach to');
    t += `p${to}${FACE[p.at.face]}`;
    if (p.at.face === 'back') t += `${p.at.offset ? `o${num(p.at.offset)}` : ''}${p.at.sharedBack ? 'H' : ''}`;
    return t;
  });
  const body = `${FREE_VERSION}f${fieldTokens(f.shared).fields}_${[...tokens, ...f.loose.map(looseToken)].join('_')}`;
  return `${body}.${checksum(body)}`;
}

export type FreeDecode = { free: FreeLayout } | { error: 'damaged' | 'newer' };

const PIECE = new RegExp(`^([satw])${NUM}?([SE])?(?:x${SNUM}y${SNUM}r([0-3])|p(\\d+)([sekab])(?:o${SNUM})?(H)?)$`);
const LOOSE = new RegExp(`^([oc])x${SNUM}y${SNUM}w${NUM}d${NUM}$`);

/** Strict decode of a v4 link. */
export function decodeFree(link: string): FreeDecode {
  const m = /^(\d+)([A-Za-z].*)\.([0-9a-z]{2})$/.exec(link.trim());
  if (!m) return { error: 'damaged' };
  const version = Number(m[1]);
  if (version > FREE_VERSION) return { error: 'newer' };
  if (version !== FREE_VERSION || checksum(`${m[1]}${m[2]}`) !== m[3]) return { error: 'damaged' };
  const [head, ...rest] = m[2]!.split('_');
  if (!head!.startsWith('f')) return { error: 'damaged' };
  const h = decodeHeader(head!.slice(1), version);
  if (!h || h.unlocked || ['W', 'L', 'R'].some((k) => k in h.vals) || !('D' in h.vals)) return { error: 'damaged' };
  const get = (k: string): number | null => (k in h.vals ? h.vals[k]! : null);
  const fabric = FABRIC_CODES[get('F') ?? 0];
  const tableFinish = FINISH_CODES[get('T') ?? 0];
  const tableStyle = TABLE_STYLE_CODES[get('Y') ?? 0];
  if (!fabric || !tableFinish || !tableStyle) return { error: 'damaged' };
  const pieces: FreePiece[] = [];
  const loose: LoosePiece[] = [];
  let n = 0;
  for (const tok of rest) {
    const pm = PIECE.exec(tok);
    if (pm && !loose.length) {
      const [, k, len, arm, x, y, r, to, face, off, shared] = pm;
      const kind = KIND_INV[k!]!;
      if ((kind === 'wedge') !== (len === undefined) || (kind === 'oneArm') !== (arm !== undefined)) return { error: 'damaged' };
      const id = `p${++n}`;
      let at: FreePiece['at'];
      if (r !== undefined) at = { x: +x!, y: +y!, rot: (+r * 90) as Rot };
      else {
        const parent = Number(to);
        const f = FACE_INV[face!]!;
        if (!(parent >= 1 && parent < n) || ((off !== undefined || shared) && f !== 'back')) return { error: 'damaged' };
        at = { to: `p${parent}`, face: f, ...(f === 'back' ? { offset: off === undefined ? 0 : +off, sharedBack: !!shared } : {}) };
      }
      pieces.push({ id, kind, ...(len !== undefined ? { length: +len } : {}), ...(arm ? { arm: arm === 'S' ? 'start' : 'end' } : {}), at });
      continue;
    }
    const lm = LOOSE.exec(tok);
    if (!lm) return { error: 'damaged' };
    loose.push({ id: `p${++n}`, kind: lm[1] === 'o' ? 'ottoman' : 'coffeeTable', x: +lm[2]!, y: +lm[3]!, w: +lm[4]!, d: +lm[5]! });
  }
  if (!pieces.length) return { error: 'damaged' };
  const free: FreeLayout = {
    schema: 1,
    kind: 'free',
    shared: {
      D: get('D')!,
      wedgeC: get('C'),
      seatWidth: get('S') ?? SEAT_WIDTH_DEFAULT,
      snugWidth: get('N') ?? SNUG_SEAT_WIDTH,
      fabric,
      tableFinish,
      tableStyle,
      dims: h.dims,
    },
    pieces,
    loose,
    nextId: n + 1,
  };
  return buildFree(free).errors.length ? { error: 'damaged' } : { free };
}

export type ProjectDecode = LayoutDecode | { free: FreeLayout };

/** Any link: a standard shape or a T as a Layout, freeform pieces as a FreeLayout. */
export function decodeProject(link: string): ProjectDecode {
  const v = /^(\d+)/.exec(link.trim());
  return v && Number(v[1]) === FREE_VERSION ? decodeFree(link) : decodeLayout(link);
}
