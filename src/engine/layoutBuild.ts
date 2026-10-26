// Composition of a Layout (shapes milestone): each section is built by the
// unchanged engine in its own coordinates, then placed. Pure.
import { buildHaven } from './buildHaven';
import type { Joint, Layout, Section, SharedKey } from './layoutTypes';
import { SHARED_KEYS } from './layoutTypes';
import { formatSeats } from './seating';
import type { BuildResult, Bounds, Config, Pt, Rect, SeatCount, Warning } from './types';

export interface PlacedSection {
  id: string;
  config: Config;
  built: BuildResult;
  /** World position of the section's local origin. */
  offset: Pt;
  join: Section['join'];
}

export interface LayoutBuild {
  solo: boolean;
  sections: PlacedSection[];
  joints: Joint[];
  /** World bounds of every polygon and gap (same shape as BuildResult.bounds). */
  bounds: Bounds;
  /** Overall outside size: total width and the deepest leg (or D). */
  overall: { W: number; depth: number };
  seats: SeatCount;
  warnings: (Warning & { section: string | null })[];
  errors: string[];
  exportBlocked: boolean;
}

const hasRightLeg = (c: Config) => c.shape === 'U' || c.shape === 'L-right';
const hasLeftLeg = (c: Config) => c.shape === 'U' || c.shape === 'L-left';

const same = (a: Config, b: Config, k: SharedKey) => JSON.stringify(a[k]) === JSON.stringify(b[k]);

/** Shared fields that differ between two sections (empty when they agree). */
export const sharedDiff = (a: Config, b: Config): SharedKey[] => SHARED_KEYS.filter((k) => !same(a, b, k));

/** Section names for messages: "Left half" / "Right half" for a two-section layout. */
export function sectionLabel(l: Layout, id: string): string {
  if (l.sections.length === 1) return 'Sofa';
  if (l.sections.length === 2) return id === l.sections[0]!.id ? 'Left half' : 'Right half';
  return `Section ${l.sections.findIndex((s) => s.id === id) + 1}`;
}

/** Structural problems (no building needed): joins, shared fields, loose pieces. */
export function layoutErrors(l: Layout): string[] {
  const errs: string[] = [];
  if (l.schema !== 1 || l.sections.length === 0) return ['Empty layout'];
  const root = l.sections[0]!;
  if (root.join) errs.push('The first section cannot be joined');
  const ids = new Set<string>();
  const usedLegs = new Set<string>();
  l.sections.forEach((s, i) => {
    if (ids.has(s.id)) errs.push(`Duplicate section ${s.id}`);
    ids.add(s.id);
    if (i === 0) return;
    if (s.config.loose.length) errs.push(`${sectionLabel(l, s.id)}: loose pieces belong to the first section`);
    if (!s.join) return void errs.push(`${sectionLabel(l, s.id)} is not joined`);
    const parent = l.sections.slice(0, i).find((p) => p.id === s.join!.to);
    if (!parent) return void errs.push(`${sectionLabel(l, s.id)} joins a missing section`);
    if (!hasRightLeg(parent.config)) errs.push(`${sectionLabel(l, parent.id)} has no right leg to join`);
    if (!hasLeftLeg(s.config)) errs.push(`${sectionLabel(l, s.id)} has no left leg to join`);
    if (usedLegs.has(parent.id)) errs.push(`${sectionLabel(l, parent.id)} already has a section on its right leg`);
    usedLegs.add(parent.id);
    const diff = sharedDiff(root.config, s.config);
    if (diff.length) errs.push(`${sectionLabel(l, s.id)} differs from the first section in ${diff.join(', ')}`);
  });
  return errs;
}

/** World offsets, derived from the joins. */
export function offsets(l: Layout): Map<string, Pt> {
  const out = new Map<string, Pt>();
  for (const s of l.sections) {
    if (!s.join) {
      out.set(s.id, [0, 0]);
      continue;
    }
    const parent = l.sections.find((p) => p.id === s.join!.to);
    const po = parent && out.get(parent.id);
    if (!parent || !po) {
      out.set(s.id, [0, 0]);
      continue;
    }
    out.set(s.id, [po[0] + parent.config.W - (s.join.sharedBack ? parent.config.dims.B : 0), po[1]]);
  }
  return out;
}

const shiftBounds = (b: Bounds, [x, y]: Pt): Bounds => ({ minX: b.minX + x, minY: b.minY + y, maxX: b.maxX + x, maxY: b.maxY + y });

function union(rects: Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Build a layout. `build` defaults to buildHaven; the app passes its per-config
 * cache so an unchanged section is never rebuilt.
 */
export function buildLayout(l: Layout, build: (c: Config) => BuildResult = buildHaven): LayoutBuild {
  const at = offsets(l);
  const sections: PlacedSection[] = l.sections.map((s) => ({ id: s.id, config: s.config, built: build(s.config), offset: at.get(s.id)!, join: s.join }));
  const solo = sections.length === 1;
  const joints: Joint[] = [];
  for (const s of sections) {
    if (!s.join) continue;
    const p = sections.find((q) => q.id === s.join!.to);
    if (!p) continue;
    const x = p.offset[0] + p.config.W;
    const B = p.config.dims.B;
    const stem = { parent: p.config.R, child: s.config.L, width: p.config.D + s.config.D - (s.join.sharedBack ? B : 0) };
    const strip = s.join.sharedBack ? { x: x - B, y: p.offset[1], w: B, h: Math.min(stem.parent, stem.child) } : null;
    joints.push({ parent: p.id, child: s.id, kind: s.join.kind, sharedBack: s.join.sharedBack, x, strip, stem });
  }
  const outer = sections.map((s) => ({ x: s.offset[0], y: s.offset[1], w: s.config.W, h: Math.max(s.config.D, s.config.shape === 'L-left' ? s.config.L : s.config.shape === 'L-right' ? s.config.R : Math.max(s.config.L, s.config.R)) }));
  const box = union(outer);
  let comfortable = 0;
  let snug = 0;
  for (const s of sections) {
    comfortable += s.built.seats.comfortable;
    snug += s.built.seats.snug;
  }
  const warnings: LayoutBuild['warnings'] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    for (const w of s.built.warnings) {
      if (!solo && !w.pieceId) {
        // The same sofa-wide warning (e.g. shallow seats) is said once.
        if (seen.has(w.message)) continue;
        seen.add(w.message);
        warnings.push({ ...w, section: null });
      } else warnings.push({ ...w, section: solo ? null : s.id });
    }
  }
  const errors = [...layoutErrors(l), ...sections.flatMap((s) => s.built.errors.map((e) => (solo ? e : `${sectionLabel(l, s.id)}: ${e}`)))];
  return {
    solo,
    sections,
    joints,
    bounds: solo
      ? sections[0]!.built.bounds
      : sections
          .map((s) => shiftBounds(s.built.bounds, s.offset))
          .reduce((a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) })),
    overall: { W: box.w, depth: box.h },
    seats: solo ? sections[0]!.built.seats : { comfortable, snug, label: formatSeats(comfortable, snug) },
    warnings,
    errors,
    exportBlocked: errors.length > 0 || sections.some((s) => s.built.exportBlocked),
  };
}
