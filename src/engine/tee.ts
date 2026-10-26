// The T sectional (Andre's client, 2026-10-26): an L-right (left half) and an
// L-left (right half), their legs back to back down the stem. With a shared
// back the two leg frames are one, so the halves overlap by the back frame B:
// total = W_left + W_right − B. The left half gets the extra half inch when the
// width does not split evenly (§5.4 "the start end gets the extra 0.5").
import { DEFAULT_DIMS, standardL } from './defaults';
import { editSection, type LayoutResult } from './layoutOps';
import type { Layout } from './layoutTypes';
import { setMeasurements } from './ops';
import type { Config, Rejection } from './types';

export interface TeeSpec {
  total: number;
  stem: number;
  D?: number;
  sharedBack?: boolean;
}

/** Split a total width into the two halves' W on the half-inch grid (left gets the extra 0.5). */
export function teeHalves(total: number, sharedBack: boolean, B = DEFAULT_DIMS.B): [number, number] {
  const S = Math.round((total + (sharedBack ? B : 0)) * 2); // half-inches
  const left = Math.ceil(S / 2);
  return [left / 2, (S - left) / 2];
}

export function teeLayout({ total, stem, D = 44, sharedBack = true }: TeeSpec): Layout {
  const [WA, WB] = teeHalves(total, sharedBack);
  const a = standardL('right', { W: WA, L: stem, R: stem, D });
  const b = standardL('left', { W: WB, L: stem, R: stem, D });
  return {
    schema: 1,
    sections: [
      { id: 'a', config: a, join: null },
      { id: 'b', config: b, join: { to: 'a', kind: 'legs', sharedBack } },
    ],
  };
}

export interface TeeInfo {
  left: Config;
  right: Config;
  sharedBack: boolean;
  /** Overall width across the top. */
  total: number;
  /** Leg length on the left and right side of the stem. */
  stem: [number, number];
  /** Stem width across both sides. */
  stemWidth: number;
}

/** The T reading of a layout, or null when it is not a T. */
export function teeOf(l: Layout): TeeInfo | null {
  if (l.sections.length !== 2) return null;
  const [a, b] = l.sections as [Layout['sections'][0], Layout['sections'][0]];
  if (a.config.shape !== 'L-right' || b.config.shape !== 'L-left' || b.join?.kind !== 'legs' || b.join.to !== a.id) return null;
  const B = a.config.dims.B;
  const shared = b.join.sharedBack;
  return {
    left: a.config,
    right: b.config,
    sharedBack: shared,
    total: a.config.W + b.config.W - (shared ? B : 0),
    stem: [a.config.R, b.config.L],
    stemWidth: 2 * a.config.D - (shared ? B : 0),
  };
}

const notTee = (l: Layout): LayoutResult => ({ layout: l, rejected: { code: 'notAllowed', message: 'Not a T layout' } });

/** Apply W to both halves; on refusal, name the smallest total the even split can take. */
function setHalves(l: Layout, WA: number, WB: number, sharedBack: boolean, total: number): LayoutResult {
  const ra = editSection(l, 'a', (c) => setMeasurements(c, { W: WA }));
  if (ra.rejected) return { layout: l, rejected: minTotal(ra.rejected, sharedBack, l, total) };
  const rb = editSection(ra.layout, 'b', (c) => setMeasurements(c, { W: WB }));
  if (rb.rejected) return { layout: l, rejected: minTotal(rb.rejected, sharedBack, l, total) };
  return rb;
}

function minTotal(r: Rejection, sharedBack: boolean, l: Layout, total: number): Rejection {
  const minW = r.min?.W;
  if (minW === undefined) return r;
  const B = l.sections[0]!.config.dims.B;
  const min = 2 * minW - (sharedBack ? B : 0);
  return { code: r.code, message: total < min ? `min ${min}″` : r.message, min: { W: min } };
}

/** Type the T's total width: both halves change, split evenly. */
export function setTeeWidth(l: Layout, total: number): LayoutResult {
  const t = teeOf(l);
  if (!t) return notTee(l);
  const [WA, WB] = teeHalves(total, t.sharedBack, t.left.dims.B);
  if (WA === t.left.W && WB === t.right.W) return { layout: l, rejected: null };
  return setHalves(l, WA, WB, t.sharedBack, total);
}

/** Type the stem length: both sides of the stem take it. */
export function setTeeStem(l: Layout, len: number): LayoutResult {
  if (!teeOf(l)) return notTee(l);
  const ra = editSection(l, 'a', (c) => setMeasurements(c, { R: len }));
  if (ra.rejected) return { layout: l, rejected: ra.rejected };
  const rb = editSection(ra.layout, 'b', (c) => setMeasurements(c, { L: len }));
  return rb.rejected ? { layout: l, rejected: rb.rejected } : rb;
}

/** Shared back / Two backs, keeping the total width (each half gains or loses B/2). */
export function setTeeSharedBack(l: Layout, on: boolean): LayoutResult {
  const t = teeOf(l);
  if (!t) return notTee(l);
  if (t.sharedBack === on) return { layout: l, rejected: null };
  const joined: Layout = { ...l, sections: [l.sections[0]!, { ...l.sections[1]!, join: { ...l.sections[1]!.join!, sharedBack: on } }] };
  const [WA, WB] = teeHalves(t.total, on, t.left.dims.B);
  return setHalves(joined, WA, WB, on, t.total);
}

