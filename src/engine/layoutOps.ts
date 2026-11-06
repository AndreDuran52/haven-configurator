// Editing a layout (shapes milestone). Every existing op still edits one
// section's Config; replaceSection lifts the result into the layout and keeps
// the shared fields (depth, corner, lock, seat widths, look, dims) equal in
// every section by running the sibling's own engine op. A refusal anywhere
// returns the SAME layout reference with the reason, naming the half (G6).
import { wedgeRange } from './limits';
import { layoutErrors, offsets, sectionLabel, sharedDiff } from './layoutBuild';
import { addLoose, defaultLoosePosition, insideRegion } from './looseOps';
import { half, LOOSE_DEFAULTS } from './pieces';
import type { Layout, Section } from './layoutTypes';
import { resetWedge, setArmWidth, setFabric, setLock, setMeasurements, setSeatWidth, setTableFinish, setTableStyle, setWedge } from './ops';
import type { Config, EditResult, LooseKind, Rejection } from './types';

export interface LayoutResult {
  layout: Layout;
  rejected: Rejection | null;
}

/** A one-section layout: exactly today's single sofa. */
export const solo = (config: Config): Layout => ({ schema: 1, sections: [{ id: 'a', config, join: null }] });

export const isSolo = (l: Layout): boolean => l.sections.length === 1;

export const rootConfig = (l: Layout): Config => l.sections[0]!.config;

export const sectionOf = (l: Layout, id: string): Section | undefined => l.sections.find((s) => s.id === id);

/** The section's config, or the root's when the id is unknown (e.g. after an undo removed it). */
export const sectionConfig = (l: Layout, id: string): Config => (sectionOf(l, id) ?? l.sections[0]!).config;

const refused = (layout: Layout, rejected: Rejection): LayoutResult => ({ layout, rejected });

/** Bring `sib` to the shared values of `src` through its own ops (each one validated by the engine). */
function syncShared(src: Config, sib: Config): EditResult {
  let c = sib;
  const step = (f: (x: Config) => EditResult): Rejection | null => {
    const r = f(c);
    if (r.rejected) return r.rejected;
    c = r.config;
    return null;
  };
  const keys = sharedDiff(src, c);
  if (!keys.length) return { config: sib, rejected: null };
  const order: [boolean, (x: Config) => EditResult][] = [
    [keys.includes('D'), (x) => setMeasurements(x, { D: src.D })],
    [keys.includes('dims') && src.dims.A !== c.dims.A, (x) => setArmWidth(x, src.dims.A)],
    [keys.includes('lockOutside'), (x) => setLock(x, src.lockOutside)],
    [keys.includes('seatWidth'), (x) => setSeatWidth(x, src.seatWidth)],
    [keys.includes('fabric'), (x) => setFabric(x, src.fabric)],
    [keys.includes('tableFinish'), (x) => setTableFinish(x, src.tableFinish)],
    [keys.includes('tableStyle'), (x) => setTableStyle(x, src.tableStyle)],
  ];
  for (const [needed, f] of order) {
    if (!needed) continue;
    const r = step(f);
    if (r) return { config: sib, rejected: r };
  }
  // The corner goes after the depth (a depth change re-clamps a manual corner).
  if (src.wedgeC !== c.wedgeC) {
    const r = step((x) => (src.wedgeC === null ? resetWedge(x) : setWedge(x, src.wedgeC)));
    if (r) return { config: sib, rejected: r };
    if (c.wedgeC !== src.wedgeC) return { config: sib, rejected: { code: 'noRoom', message: `Not enough room for a ${src.wedgeC}″ corner` } };
  }
  // What has no op of its own is copied (snug width, the other dims).
  const rest = sharedDiff(src, c);
  if (rest.some((k) => k !== 'snugWidth' && k !== 'dims')) return { config: sib, rejected: { code: 'notAllowed', message: 'The halves could not be matched' } };
  if (rest.length) c = { ...c, snugWidth: src.snugWidth, dims: { ...src.dims } };
  return { config: c, rejected: null };
}

/** Put a new config into a section; siblings follow the shared fields; same reference when refused or unchanged. */
export function replaceSection(l: Layout, id: string, next: Config): LayoutResult {
  const i = l.sections.findIndex((s) => s.id === id);
  if (i < 0) return refused(l, { code: 'notAllowed', message: 'That section is gone' });
  const old = l.sections[i]!;
  if (next === old.config) return { layout: l, rejected: null };
  const sections = l.sections.slice();
  sections[i] = { ...old, config: next };
  if (sharedDiff(old.config, next).length) {
    for (let j = 0; j < sections.length; j++) {
      if (j === i) continue;
      const r = syncShared(next, sections[j]!.config);
      if (r.rejected) return refused(l, { ...r.rejected, message: `${sectionLabel(l, sections[j]!.id)}: ${r.rejected.message}` });
      if (r.config !== sections[j]!.config) sections[j] = { ...sections[j]!, config: r.config };
    }
  }
  const out: Layout = { ...l, sections };
  const errs = layoutErrors(out);
  if (errs.length) return refused(l, { code: 'notAllowed', message: errs[0]! });
  return { layout: out, rejected: null };
}

/** Run one engine op on one section and lift it. */
export function editSection(l: Layout, id: string, op: (c: Config) => EditResult): LayoutResult {
  const s = sectionOf(l, id);
  if (!s) return refused(l, { code: 'notAllowed', message: 'That section is gone' });
  const r = op(s.config);
  if (r.rejected) return refused(l, r.rejected);
  return replaceSection(l, id, r.config);
}

/** The corner range every section can take (the most restrictive wins). */
export function layoutWedgeRange(l: Layout): { min: number; max: number } {
  const ranges = l.sections.map((s) => wedgeRange(s.config));
  return { min: Math.max(...ranges.map((r) => r.min)), max: Math.min(...ranges.map((r) => r.max)) };
}

/** Set the corner of every section, clamped to the range all of them can take. */
export function setLayoutWedge(l: Layout, C: number): LayoutResult {
  const { min, max } = layoutWedgeRange(l);
  return editSection(l, l.sections[0]!.id, (c) => setWedge(c, Math.min(max, Math.max(min, C))));
}

/**
 * Add an ottoman or coffee table from any section. Loose pieces live in the
 * root, whose coordinates are the world's; by default the piece starts in the
 * edited section's own inside region (a T's right bay for the right half),
 * clear of the loose pieces already there. `at` is a world min corner. A
 * one-section layout gives exactly addLoose on its config.
 */
export function addLooseInLayout(l: Layout, sectionId: string, kind: LooseKind, at?: { x: number; y: number }): LayoutResult {
  const root = l.sections[0]!;
  let pos = at;
  if (!pos) {
    const w = half(LOOSE_DEFAULTS[kind].w);
    const d = kind === 'coffeeTable' ? w : half(LOOSE_DEFAULTS[kind].d);
    const off = offsets(l);
    /** The default spot in section `s` (world), and whether it is inside that section's region. */
    const spotIn = (s: Section) => {
      const [ox, oy] = off.get(s.id) ?? [0, 0];
      const here: Config = { ...s.config, loose: root.config.loose.map((p) => ({ ...p, x: p.x - ox, y: p.y - oy })) };
      const [x, y] = defaultLoosePosition(here, kind, w, d);
      const r = insideRegion(s.config);
      return { x: x + ox, y: y + oy, inside: x >= r.x && y >= r.y && x + w <= r.x + r.w && y + d <= r.y + r.h };
    };
    const first = sectionOf(l, sectionId) ?? root;
    // The edited section first; when its region is full, another section's (a T's other bay).
    const spots = [first, ...l.sections.filter((s) => s.id !== first.id)].map(spotIn);
    const { x, y } = spots.find((p) => p.inside) ?? spots[0]!;
    pos = { x, y };
  }
  const r = addLoose(root.config, kind, pos);
  if (r.rejected) return refused(l, r.rejected);
  return replaceSection(l, root.id, r.config);
}
