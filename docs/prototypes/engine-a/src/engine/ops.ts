// Every edit is a pure op: (config, ...args) => config.
// - Input is never mutated (each op edits a JSON-cloned draft).
// - A rejected / no-op edit returns the SAME reference (`next === prev`).
// - Output always satisfies the run invariant (finalize() asserts it).
import { buildHaven } from './buildHaven';
import { ABSORB_FLOOR, LOOSE_DEFAULTS, MAX_PIECE, defaultLength, half, isSeat } from './pieces';
import {
  absorb,
  available,
  blockOf,
  clampWedge,
  defaultFill,
  dissolveGroup,
  endCapState,
  finalize,
  insertPiece,
  makeAlloc,
  openEnd,
  reshapeRuns,
  resizeSide,
  runIds,
  runSum,
  sideRange,
  wedgeC,
  type Alloc,
} from './layout';
import type { Config, EndCap, LooseKind, Placement, RunEnd, RunId, RunPiece, Runs, Shape } from './types';

/** Clone -> mutate draft -> normalise + assert. The JSON clone also enforces "config is plain data". */
export function edit(config: Config, fn: (draft: Config, alloc: Alloc) => boolean): Config {
  const draft = JSON.parse(JSON.stringify(config)) as Config;
  const alloc = makeAlloc(draft);
  if (!fn(draft, alloc)) return config;
  return finalize(draft, alloc);
}

export function findPiece(c: Config, id: string): { run: RunId; index: number; piece: RunPiece } | null {
  for (const run of runIds(c.shape)) {
    const index = c.runs[run]?.findIndex((p) => p.id === id) ?? -1;
    if (index >= 0) return { run, index, piece: c.runs[run]![index]! };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Measurements, wedge, lock, settings. These ALWAYS hold the typed outside
// sizes (regardless of the lock): the runs absorb the change.

export function setMeasurements(config: Config, patch: Partial<Pick<Config, 'W' | 'L' | 'R' | 'D'>>): Config {
  return edit(config, (d, alloc) => {
    const oldC = wedgeC(d);
    const next = {
      W: half(patch.W ?? d.W),
      L: half(patch.L ?? d.L),
      R: half(patch.R ?? d.R),
      D: half(patch.D ?? d.D),
    };
    if (!(next.D > d.dims.B)) return false;
    const dW = next.W - d.W;
    const dL = next.L - d.L;
    const dR = next.R - d.R;
    Object.assign(d, next);
    // §5: a manual wedge sticks when D changes, clamped into the new D..D+30 range.
    if (d.wedgeC !== null) d.wedgeC = clampWedge(d.wedgeC, d.D);
    const changed = dW || dL || dR || next.D !== config.D;
    return !!changed && reshapeRuns(d, alloc, wedgeC(d) - oldC, dW, dL, dR);
  });
}

/** §5 wedge slider: snaps to 1", clamps to D..D+30, becomes manual. Outside sizes held. */
export function setWedge(config: Config, C: number): Config {
  return edit(config, (d, alloc) => {
    const oldC = wedgeC(d);
    d.wedgeC = clampWedge(Math.round(C), d.D);
    if (config.wedgeC === d.wedgeC) return false;
    return reshapeRuns(d, alloc, d.wedgeC - oldC, 0, 0, 0);
  });
}

export function resetWedge(config: Config): Config {
  return edit(config, (d, alloc) => {
    if (d.wedgeC === null) return false;
    const oldC = wedgeC(d);
    d.wedgeC = null;
    return reshapeRuns(d, alloc, wedgeC(d) - oldC, 0, 0, 0);
  });
}

/** Turning the lock ON freezes the (already derived) W/L/R; OFF lets runs grow. */
export function setLock(config: Config, on: boolean): Config {
  return edit(config, (d) => {
    if (d.lockOutside === on) return false;
    d.lockOutside = on;
    return true;
  });
}

export function setSeatWidth(config: Config, width: number): Config {
  return edit(config, (d) => {
    const w = half(width);
    if (!(w > 0) || w === d.seatWidth) return false;
    d.seatWidth = w;
    return true;
  });
}

/**
 * Shape picker. A leg that survives keeps its pieces (its space L-C / R-C is
 * unchanged); the back and any new leg get the §8 default fill, because the
 * back's end kinds (wedge/open) change with the shape.
 */
export function setShape(config: Config, shape: Shape): Config {
  return edit(config, (d, alloc) => {
    if (d.shape === shape) return false;
    const old = d.runs;
    d.shape = shape;
    const runs: Runs = {};
    for (const run of runIds(shape)) {
      const len = available(d, run);
      if (len < 0) return false;
      runs[run] = run !== 'back' && old[run] ? old[run] : defaultFill(len, openEnd(shape, run), d.dims.A, alloc);
    }
    d.runs = runs;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Piece edits. Lock ON: the absorber rule keeps each run's total. Lock OFF:
// the run grows/shrinks and W/L/R are re-derived.

export function resizePiece(config: Config, id: string, length: number): Config {
  return edit(config, (d, alloc) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap') return false;
    const len = half(length);
    const A = d.dims.A;
    if (!(len > 0) || (isSeat(f.piece) && len - (f.piece.kind === 'oneArm' ? A : 0) < ABSORB_FLOOR)) return false;
    if (f.piece.kind === 'table' && len > MAX_PIECE) return false; // tables can't auto-split
    const delta = len - f.piece.length;
    if (delta === 0) return false;
    const pieces = d.runs[f.run]!;
    dissolveGroup(pieces, f.piece.splitGroup);
    f.piece.length = len;
    return !d.lockOutside || absorb(pieces, { piece: f.index }, -delta, A, alloc, new Set([id]));
  });
}

/**
 * §7 seam handle: the side before the seam grows by dx, the side after shrinks
 * by dx; their total never changes, so the lock is irrelevant. dx snaps to 0.5
 * and clamps so neither side leaves [min(rule, now), max(rule, now)] (seat
 * cushion >= 20, piece <= 108, table 16..40, gap >= 0). A "side" is a lone
 * piece or a whole split group (which stays equal and may re-split/merge);
 * dragging the seam INSIDE a split group dissolves it. Wedge seams are not handles.
 */
export function dragSeam(config: Config, run: RunId, seam: number, dx: number): Config {
  return edit(config, (d) => {
    const pieces = d.runs[run];
    if (!pieces || !Number.isInteger(seam) || seam < 1 || seam > pieces.length - 1) return false;
    const A = d.dims.A;
    const g = pieces[seam - 1]!.splitGroup;
    if (g && g === pieces[seam]!.splitGroup) dissolveGroup(pieces, g);
    const sa = blockOf(pieces, seam - 1);
    const sb = blockOf(pieces, seam);
    const ta = runSum(sa.map((i) => pieces[i]!));
    const tb = runSum(sb.map((i) => pieces[i]!));
    const [loA, hiA] = sideRange(pieces, sa, A);
    const [loB, hiB] = sideRange(pieces, sb, A);
    const lo = Math.max(loA - ta, tb - hiB);
    const hi = Math.min(hiA - ta, tb - loB);
    const step = Math.min(hi, Math.max(lo, half(dx)));
    if (step === 0) return false;
    resizeSide(pieces, sa, ta + step, A);
    resizeSide(pieces, sb, tb - step, A);
    return true;
  });
}

export interface AddOptions {
  /** Footprint along the run (oneArm: including the arm). */
  length?: number;
  /** oneArm: arm side; default = toward the run's open end, else 'end'. */
  arm?: RunEnd;
}

export function addPiece(
  config: Config,
  kind: 'armless' | 'oneArm' | 'table',
  placement: Placement,
  opts: AddOptions = {},
): Config {
  return edit(config, (d, alloc) => {
    const A = d.dims.A;
    const length = half(opts.length ?? defaultLength(kind, A));
    const piece: RunPiece = { id: alloc('p'), kind, length };
    if (kind === 'oneArm') piece.arm = opts.arm ?? openEnd(d.shape, placement.run) ?? 'end';
    if (!(length > 0) || (kind !== 'table' && length - (kind === 'oneArm' ? A : 0) < ABSORB_FLOOR)) return false;
    if (kind === 'table' && length > MAX_PIECE) return false; // tables can't auto-split
    return insertPiece(d, alloc, piece, placement);
  });
}

/**
 * Delete: lock ON gives the freed length to the absorber rule (a partially
 * filled run keeps a gap in place instead); lock OFF shrinks the run.
 */
export function deletePiece(config: Config, id: string): Config {
  return edit(config, (d, alloc) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap') return false;
    const pieces = d.runs[f.run]!;
    dissolveGroup(pieces, f.piece.splitGroup);
    pieces.splice(f.index, 1);
    return !d.lockOutside || absorb(pieces, { seam: f.index }, f.piece.length, d.dims.A, alloc);
  });
}

/** armless <-> oneArm. The footprint is unchanged: the arm's 14" moves between cushion and arm. */
export function convertPiece(config: Config, id: string, arm?: RunEnd): Config {
  return edit(config, (d) => {
    const f = findPiece(d, id);
    if (!f || !isSeat(f.piece)) return false;
    dissolveGroup(d.runs[f.run]!, f.piece.splitGroup);
    if (f.piece.kind === 'oneArm') {
      f.piece.kind = 'armless';
      delete f.piece.arm;
      return true;
    }
    if (f.piece.length - d.dims.A < ABSORB_FLOOR) return false;
    f.piece.kind = 'oneArm';
    f.piece.arm = arm ?? openEnd(d.shape, f.run) ?? 'end';
    return true;
  });
}

/** Tap menu: end cap of a run's open end (arm / table in place of the arm / open). */
export function setEndCap(config: Config, run: RunId, cap: EndCap): Config {
  return edit(config, (d, alloc) => {
    const pieces = d.runs[run];
    const open = openEnd(d.shape, run);
    if (!pieces || !open) return false;
    const A = d.dims.A;
    const state = endCapState(pieces, open);
    if (state === cap || state === 'unfilled') return false;
    const endIdx = () => (open === 'end' ? pieces.length - 1 : 0);
    const removeEndTable = (): boolean => {
      const i = endIdx();
      const [t] = pieces.splice(i, 1);
      return !d.lockOutside || absorb(pieces, { seam: i }, t!.length, A, alloc);
    };
    const setArm = (idx: number, on: boolean): boolean => {
      const p = pieces[idx];
      if (!p || !isSeat(p)) return false;
      dissolveGroup(pieces, p.splitGroup);
      if (!on) {
        p.kind = 'armless';
        delete p.arm;
        return true;
      }
      if (p.kind === 'armless' && p.length - A < ABSORB_FLOOR) return false;
      p.kind = 'oneArm';
      p.arm = open;
      return true;
    };
    if (cap === 'arm') {
      if (state === 'open') return setArm(endIdx(), true);
      if (state === 'armTable') return removeEndTable();
      return removeEndTable() && setArm(endIdx(), true); // 'table'
    }
    if (cap === 'open') {
      if (state === 'arm') return setArm(endIdx(), false);
      if (state === 'table') return removeEndTable();
      return removeEndTable() && setArm(endIdx(), false); // 'armTable'
    }
    // cap === 'table'
    if (state === 'armTable') return setArm(open === 'end' ? pieces.length - 2 : 1, false);
    const table: RunPiece = { id: alloc('p'), kind: 'table', length: defaultLength('table', A) };
    return insertPiece(d, alloc, table, { run, at: 'replaceArm' });
  });
}

/**
 * §6 tables go anywhere. Same run + seam = pure reorder (no lengths change;
 * `seam` indexes the run WITHOUT the table). Otherwise: take it out (the
 * source run absorbs), then place it (the target run absorbs).
 */
export function moveTable(config: Config, id: string, placement: Placement): Config {
  return edit(config, (d, alloc) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind !== 'table') return false;
    const src = d.runs[f.run]!;
    src.splice(f.index, 1);
    if (placement.run === f.run && placement.at === 'seam') {
      if (placement.seam === f.index || placement.seam < 0 || placement.seam > src.length) return false;
      src.splice(placement.seam, 0, f.piece);
      return true;
    }
    if (d.lockOutside && !absorb(src, { seam: f.index }, f.piece.length, d.dims.A, alloc)) return false;
    return insertPiece(d, alloc, f.piece, placement);
  });
}

/** §7 reorder: drag a piece along its run. Pure permutation, lengths untouched. */
export function reorderPiece(config: Config, id: string, toIndex: number): Config {
  return edit(config, (d) => {
    const f = findPiece(d, id);
    if (!f || f.piece.kind === 'gap' || toIndex === f.index) return false;
    const pieces = d.runs[f.run]!;
    pieces.splice(f.index, 1);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > pieces.length) return false;
    pieces.splice(toIndex, 0, f.piece);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Loose pieces (ottoman, coffee table): free rectangles, never in a run.

export function addLoose(
  config: Config,
  kind: LooseKind,
  at: Partial<{ x: number; y: number; w: number; d: number }> = {},
): Config {
  return edit(config, (d, alloc) => {
    const w = half(at.w ?? LOOSE_DEFAULTS[kind].w);
    const dd = half(at.d ?? LOOSE_DEFAULTS[kind].d);
    // Default spot: centred in the U opening; for an L, centred in front of the back.
    const openDepth = d.shape === 'U' ? Math.min(d.L, d.R) - d.D : 2 * dd;
    const x = half(at.x ?? (d.W - w) / 2);
    const y = half(at.y ?? d.D + (openDepth - dd) / 2);
    d.loose.push({ id: alloc('p'), kind, x, y, w, d: dd });
    return true;
  });
}

export function moveLoose(config: Config, id: string, x: number, y: number): Config {
  return edit(config, (d) => {
    const p = d.loose.find((q) => q.id === id);
    if (!p || (p.x === half(x) && p.y === half(y))) return false;
    p.x = half(x);
    p.y = half(y);
    return true;
  });
}

export function resizeLoose(config: Config, id: string, w: number, depth: number): Config {
  return edit(config, (d) => {
    const p = d.loose.find((q) => q.id === id);
    if (!p || !(half(w) > 0) || !(half(depth) > 0)) return false;
    p.w = half(w);
    p.d = half(depth);
    return true;
  });
}

export function deleteLoose(config: Config, id: string): Config {
  return edit(config, (d) => {
    const i = d.loose.findIndex((q) => q.id === id);
    if (i < 0) return false;
    d.loose.splice(i, 1);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Table dragging (§6): discrete snap targets, previewed with the pure ops.

/**
 * Every place a table can snap to by position: each seam of each run (seams of
 * the run WITHOUT this table) and the middle of each seat. 'replaceArm' is not
 * a drag target: it lands on the same spot as "outside the arm", so the UI
 * offers it through the end-cap menu instead.
 */
export function tableTargets(config: Config, id: string): Placement[] {
  const out: Placement[] = [];
  for (const run of runIds(config.shape)) {
    const ps = config.runs[run]!.filter((p) => p.id !== id);
    for (let seam = 0; seam <= ps.length; seam++) out.push({ run, at: 'seam', seam });
    for (const p of ps) if (isSeat(p)) out.push({ run, at: 'split', pieceId: p.id });
  }
  return out;
}

/**
 * Drag preview / drop: the feasible target whose resulting table centre is
 * nearest the pointer. Always call it with the DRAG-START config, so hovering
 * over targets on the way never leaves a trace.
 */
export function snapTable(config: Config, id: string, pointer: [number, number]): Config {
  let best = config;
  let bestDist = Infinity;
  for (const t of tableTargets(config, id)) {
    const next = moveTable(config, id, t);
    const p = buildHaven(next).pieces.find((q) => q.id === id);
    if (!p) continue;
    const cx = p.bbox.x + p.bbox.w / 2;
    const cy = p.bbox.y + p.bbox.h / 2;
    const dist = Math.hypot(cx - pointer[0], cy - pointer[1]);
    if (dist < bestDist) {
      best = next;
      bestDist = dist;
    }
  }
  return best;
}
