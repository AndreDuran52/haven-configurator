// Where a tray piece can go (plan §8 "Add-piece tray"): every seam and seat
// split of every run where addPiece succeeds, with the new piece's centre as
// the pin / snap anchor. Pure; computed once per tray gesture.
import { addPiece, buildHaven, isSeat, openEnd, runIds, type Config, type Facing, type Placement, type Pt } from '@/engine';

export type TrayKind = 'armless' | 'oneArmL' | 'oneArmR' | 'table' | 'ottoman' | 'coffeeTable';
export type RunTrayKind = Exclude<TrayKind, 'ottoman' | 'coffeeTable'>;

export const isLooseTray = (k: TrayKind): k is 'ottoman' | 'coffeeTable' => k === 'ottoman' || k === 'coffeeTable';

export interface PlacementTarget {
  placement: Placement;
  /** The new piece's centre in plan inches. */
  anchor: Pt;
  /** The config with the piece added (committed as is on drop / pin tap). */
  config: Config;
}

const FACING: Partial<Record<RunTrayKind, Facing>> = { oneArmL: 'LAF', oneArmR: 'RAF' };

export function placementTargets(config: Config, kind: RunTrayKind): PlacementTarget[] {
  const engineKind = kind === 'oneArmL' || kind === 'oneArmR' ? 'oneArm' : kind;
  const out: PlacementTarget[] = [];
  const seen = new Set<string>();
  for (const run of runIds(config.shape)) {
    const ps = config.runs[run] ?? [];
    const arm = openEnd(config.shape, run);
    if (engineKind === 'oneArm' && !arm) continue; // arms only at an open end (G11)
    const candidates: Placement[] = [];
    for (let seam = 0; seam <= ps.length; seam++) candidates.push({ run, at: 'seam', seam });
    for (const p of ps) if (isSeat(p)) candidates.push({ run, at: 'split', pieceId: p.id });
    for (const placement of candidates) {
      const r = addPiece(config, engineKind, placement, arm ? { arm } : {});
      if (r.rejected) continue;
      const b = buildHaven(r.config);
      // addPiece allocates the new piece's id first (before any split halves).
      const added = b.pieces.find((p) => p.id === `p${config.nextId}`);
      if (!added) continue;
      const facing = FACING[kind];
      if (facing && added.arm?.facing !== facing) continue;
      const key = JSON.stringify(r.config.runs);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ placement, anchor: [added.bbox.x + added.bbox.w / 2, added.bbox.y + added.bbox.h / 2], config: r.config });
    }
  }
  return out;
}

/** The target nearest `pt`, kept while no other is `hysteresis` inches nearer. */
export function nearestTarget<T extends { anchor: Pt }>(targets: T[], pt: Pt, current: T | null, hysteresis: number, maxDist = Infinity): T | null {
  const dist = (t: T) => Math.hypot(t.anchor[0] - pt[0], t.anchor[1] - pt[1]);
  let best: T | null = null;
  for (const t of targets) if (dist(t) <= maxDist && (!best || dist(t) < dist(best))) best = t;
  if (current && best && current !== best && targets.includes(current) && dist(current) - dist(best) <= hysteresis && dist(current) <= maxDist) return current;
  return best;
}
