// Share-link codec for layouts (shapes milestone, link v3, 2026-10-26).
//
//   3rW119.5L110R110D44_ba59.5_ra50_PglW119.5L110R110H_ba59.5_la50.xx
//   └ root sofa, exactly as v1/v2 ┘ └ joined section ───────────┘
//
// One section: the link is exactly the one-sofa link (v1/v2), so every layout
// that could be shared before keeps its link byte for byte. Two or more:
// version 3, the root written as before (it carries every shared field and the
// loose pieces), then per further section a `_P` token and its run tokens:
//   P <join kind: g = legs> <shape U|l|r> W L R [H = shared back]
// A section joins the one before it. Shared fields (D, corner, lock, seat
// widths, dims, look) are never repeated: a later app that lets them differ
// writes a newer version, which an older app reads as "newer", not "damaged".
import { buildHaven } from './buildHaven';
import { checksum, decodeBody, decodeRun, encode, encodeParts, inRange, LINK_VERSION, num, NUM, runTokens, SHAPE_CODE, shapeFromCode } from './codec';
import { openEnd, runIds } from './layout';
import { layoutErrors } from './layoutBuild';
import type { Layout, Section } from './layoutTypes';
import type { Config, RunId, Runs } from './types';

export type LayoutDecode = { layout: Layout } | { error: 'damaged' | 'newer' };

const JOIN_CODE = { legs: 'g' } as const;

export function encodeLayout(l: Layout): string {
  const [root, ...rest] = l.sections;
  if (!root) throw new Error('codec: empty layout');
  if (!rest.length) return encode(root.config);
  const parts = [...encodeParts(root.config).parts];
  rest.forEach((s, i) => {
    const prev = l.sections[i]!;
    if (!s.join || s.join.to !== prev.id) throw new Error('codec: a section must join the one before it');
    if (s.config.loose.length) throw new Error('codec: loose pieces belong to the first section');
    const c = s.config;
    parts.push(`P${JOIN_CODE[s.join.kind]}${SHAPE_CODE(c.shape)}W${num(c.W)}L${num(c.L)}R${num(c.R)}${s.join.sharedBack ? 'H' : ''}`, ...runTokens(c));
  });
  const body = `3${parts.join('_')}`;
  return `${body}.${checksum(body)}`;
}

const RUN_INV: Record<string, RunId> = { b: 'back', l: 'left', r: 'right' };

function decodeSection(tokens: string[], root: Config, nextId: number): { config: Config; join: Section['join'] extends infer J ? J : never; nextId: number } | null {
  const pm = new RegExp(`^Pg([Ulr])W${NUM}L${NUM}R${NUM}(H?)$`).exec(tokens[0]!);
  if (!pm) return null;
  const shape = shapeFromCode(pm[1]!)!;
  let n = nextId;
  const id = () => `p${n++}`;
  const runs: Runs = {};
  for (const tok of tokens.slice(1)) {
    const run = RUN_INV[tok[0]!];
    if (!run || !/^[blr]([sagt~]|$)/.test(tok) || runs[run]) return null;
    const pieces = decodeRun(tok.slice(1), openEnd(shape, run), id);
    if (!pieces) return null;
    runs[run] = pieces;
  }
  if (Object.keys(runs).some((r) => !runIds(shape).includes(r as RunId))) return null;
  const config: Config = { ...root, dims: { ...root.dims }, shape, W: +pm[2]!, L: +pm[3]!, R: +pm[4]!, runs, loose: [], nextId: n };
  return { config, join: { to: '', kind: 'legs', sharedBack: pm[5] === 'H' }, nextId: n };
}

/** Strict decode of any link into a layout (v1/v2 become a one-section layout). */
export function decodeLayout(link: string): LayoutDecode {
  const m = /^(\d+)([A-Za-z].*)\.([0-9a-z]{2})$/.exec(link.trim());
  if (!m) return { error: 'damaged' };
  const version = Number(m[1]);
  if (version > LINK_VERSION) return { error: 'newer' };
  if (checksum(`${m[1]}${m[2]}`) !== m[3]) return { error: 'damaged' };
  const tokens = m[2]!.split('_');
  const starts = tokens.map((t, i) => (t.startsWith('P') && i > 0 ? i : -1)).filter((i) => i >= 0);
  if (starts.length && version < 3) return { error: 'damaged' };
  const rootEnd = starts[0] ?? tokens.length;
  const root = decodeBody(tokens.slice(0, rootEnd).join('_'), version);
  if (!root) return { error: 'damaged' };
  const sections: Section[] = [{ id: 'a', config: root, join: null }];
  let nextId = root.nextId;
  for (let k = 0; k < starts.length; k++) {
    const block = tokens.slice(starts[k], starts[k + 1] ?? tokens.length);
    const s = decodeSection(block, root, nextId);
    if (!s) return { error: 'damaged' };
    nextId = s.nextId;
    const id = String.fromCharCode(98 + k); // 'b', 'c', …
    sections.push({ id, config: s.config, join: { ...s.join!, to: sections[sections.length - 1]!.id } });
  }
  const layout: Layout = { schema: 1, sections };
  if (sections.some((s) => !inRange(s.config) || buildHaven(s.config).errors.length > 0)) return { error: 'damaged' };
  if (layoutErrors(layout).length) return { error: 'damaged' };
  return { layout };
}
