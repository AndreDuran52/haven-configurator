// Pillows in the plan (Phase 3b; Andre, 2026-11-09: "same position, angle and
// size as in the 3D Top view"). Pure: the same engine anchors the 3D uses
// (pillowAnchors). A square pillow is the 3D pillow's own top-down outline
// (Andre's Blender karate-chop pillow, baked by scripts/pillow-outline.mjs
// into ortho/pillowBaked, leaning as the 3D leans it), turned to the way it
// faces and placed at its box centre; a
// ball is a circle at its true size. Loaded lazily by the
// screen plan (it stays out of the entry chunk); the PDF sheet imports it.
import { PILLOW_COLOR, pillowAnchors, type BuildResult, type PillowKind, type PillowTone, type Pt } from '@/engine';
import { pillowOutline } from '@/ortho/pillowShape';

/** The square pillow from above, [across, forward] from its box centre. */
export const PILLOW_OUTLINE: Pt[] = pillowOutline();

export interface PlanPillow {
  key: string;
  kind: PillowKind;
  tone: PillowTone;
  /** Its fabric colour. */
  fill: string;
  /** A square: its outline in plan inches. */
  points: Pt[];
  /** A ball: centre and radius in plan inches. */
  cx: number;
  cy: number;
  r: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0;

export function planPillows(b: BuildResult): PlanPillow[] {
  return pillowAnchors(b).map((a) => {
    const [fx, fy] = a.facing;
    const base = { key: a.key, kind: a.kind, tone: a.tone, fill: PILLOW_COLOR[a.tone], cx: r3(a.x), cy: r3(a.y) };
    if (a.kind === 'ball') return { ...base, points: [], r: a.w / 2 };
    // Across = the model's +x after the yaw (boxFrame's first axis); forward = facing.
    const points = PILLOW_OUTLINE.map(([s, f]): Pt => [r3(a.x + fy * s + fx * f), r3(a.y - fx * s + fy * f)]);
    return { ...base, points, r: 0 };
  });
}
