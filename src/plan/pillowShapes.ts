// Pillows in the plan (Phase 3b, Andre 2026-11-08: one Pillows switch draws
// them in the plan and in 3D, and the PDF follows). Pure: the same engine
// anchors the 3D uses (pillowAnchors), seen from above. A square pillow is the
// top-down extent of its leaning box (a rounded rectangle turned to face the
// seat); a ball is a circle. Loaded lazily by the screen plan (it stays out of
// the entry chunk); the PDF sheet imports it directly.
import { boxCorners, PILLOW_COLOR, pillowAnchors, type BuildResult, type PillowKind, type PillowTone } from '@/engine';

export interface PlanPillow {
  key: string;
  kind: PillowKind;
  tone: PillowTone;
  /** Its fabric colour. */
  fill: string;
  /** Centre, plan inches. */
  cx: number;
  cy: number;
  /** Across the facing direction, and along it (a ball: its diameter both ways). */
  w: number;
  d: number;
  /** SVG rotation, degrees: local +y points along the pillow's facing. */
  angle: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0;

export function planPillows(b: BuildResult): PlanPillow[] {
  return pillowAnchors(b).map((a) => {
    const [fx, fy] = a.facing;
    const fill = PILLOW_COLOR[a.tone];
    if (a.kind === 'ball') return { key: a.key, kind: a.kind, tone: a.tone, fill, cx: r3(a.x), cy: r3(a.y), w: a.w, d: a.w, angle: 0 };
    let f0 = Infinity;
    let f1 = -Infinity;
    let s0 = Infinity;
    let s1 = -Infinity;
    for (const [x, y] of boxCorners(a)) {
      const dx = x - a.x;
      const dy = y - a.y;
      const f = dx * fx + dy * fy;
      const s = -dx * fy + dy * fx;
      f0 = Math.min(f0, f);
      f1 = Math.max(f1, f);
      s0 = Math.min(s0, s);
      s1 = Math.max(s1, s);
    }
    const fm = (f0 + f1) / 2;
    const sm = (s0 + s1) / 2;
    return {
      key: a.key,
      kind: a.kind,
      tone: a.tone,
      fill,
      cx: r3(a.x + fx * fm - fy * sm),
      cy: r3(a.y + fy * fm + fx * sm),
      w: r3(s1 - s0),
      d: r3(f1 - f0),
      angle: r3((Math.atan2(-fx, fy) * 180) / Math.PI),
    };
  });
}
