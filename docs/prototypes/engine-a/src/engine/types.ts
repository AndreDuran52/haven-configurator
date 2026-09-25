// Haven configurator engine — model A: "explicit lengths + rebalancing ops".
//
// The Config stores every run piece with an explicit length. buildHaven() only
// lays out and validates; every edit is a pure op (config, ...args) => config
// (see ops.ts) that rebalances so each run still sums exactly to its space.
// Config is plain JSON data: no classes, no Maps, no undefined-valued keys.

export type Shape = 'U' | 'L-left' | 'L-right';
export type RunId = 'back' | 'left' | 'right';
export type CornerId = 'backLeft' | 'backRight';
/** Run-local direction. Runs are ordered by increasing x (back) or y (legs). */
export type RunEnd = 'start' | 'end';
export type EndKind = 'wedge' | 'open';

export type SeatKind = 'armless' | 'oneArm';
export type RunPieceKind = SeatKind | 'table' | 'gap';

export interface RunPiece {
  /** Stable id (allocated from Config.nextId), used for React keys / tap menus. */
  id: string;
  kind: RunPieceKind;
  /** Footprint along the run in inches, a multiple of 0.5. oneArm INCLUDES its arm. */
  length: number;
  /** oneArm only: the end of the piece (in run order) that carries the arm. */
  arm?: RunEnd;
  /**
   * Seats produced by auto-split share a group id. A group is one logical seat:
   * it absorbs as a unit, stays equally split, and re-merges when it fits in
   * 108". Any manual edit of a member dissolves the group.
   */
  splitGroup?: string;
}

export type LooseKind = 'ottoman' | 'coffeeTable';

export interface LoosePiece {
  id: string;
  kind: LooseKind;
  /** Min corner, plan inches. */
  x: number;
  y: number;
  w: number;
  d: number;
}

/** §3 dimensions. Kept in the config so open questions (§14) are data, not code. */
export interface HavenDims {
  /** Arm width (runs the full depth). */
  A: number;
  /** Back = frame + back cushion. Seat depth = D - B. */
  B: number;
  legHeight: number;
  seatHeight: number;
  cushionCrown: number;
  cushionEdge: number;
  armHeight: number;
  backHeight: number;
  tableHeight: number;
}

export type Runs = Partial<Record<RunId, RunPiece[]>>;

export interface Config {
  schema: 1;
  shape: Shape;
  /** Outside sizes. When lockOutside is false they are re-derived from the pieces after every op. */
  W: number;
  L: number;
  R: number;
  /** Overall depth. */
  D: number;
  /** null = auto (C = D + 16). A number = manually dragged; sticks until resetWedge. */
  wedgeC: number | null;
  lockOutside: boolean;
  runs: Runs;
  loose: LoosePiece[];
  /** Comfortable seat width for seat counting (§8, default 28). */
  seatWidth: number;
  dims: HavenDims;
  /** Deterministic id counter so ops stay pure. */
  nextId: number;
}

/** Where a run piece is inserted by addPiece / moveTable. */
export type Placement =
  /** Between piece seam-1 and piece seam (0 = run start, n = run end). */
  | { run: RunId; at: 'seam'; seam: number }
  /** Into the middle of a seat piece; its cushion is shared equally around the new piece. */
  | { run: RunId; at: 'split'; pieceId: string }
  /** Tables only: at the run's open end, in place of its arm. */
  | { run: RunId; at: 'replaceArm' };

export type EndCap = 'arm' | 'table' | 'open';
/** Derived from the pieces; 'armTable' = table outside the arm. */
export type EndCapState = EndCap | 'armTable' | 'unfilled';

// ---------------------------------------------------------------------------
// buildHaven output

export type Pt = [number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Furniture convention: arm side as seen when FACING the piece. */
export type Facing = 'LAF' | 'RAF';

export type BuiltKind = 'wedge' | SeatKind | 'table' | LooseKind;

export interface BuiltPiece {
  id: string;
  kind: BuiltKind;
  run: RunId | null;
  corner: CornerId | null;
  /** Index in the run's stored piece list (gaps included). */
  index: number | null;
  /** Distance from the run start along the run. */
  offset: number | null;
  /** Along-run footprint (wedge: C; loose: w). */
  length: number;
  /** Across-run size (run pieces and wedges: D; loose: d). */
  depth: number;
  /** Seat cushion length along the run (armless: length; oneArm: length - A). */
  cushion: number | null;
  bbox: Rect;
  /** Exact plan outline, same winding for every piece (clockwise on screen). */
  polygon: Pt[];
  arm: { at: RunEnd; facing: Facing; rect: Rect } | null;
  /** Back frame + back cushion strips (wedge: both outside edges). */
  backs: Rect[];
  /** Seat cushion area in plan (seats only). */
  cushionRect: Rect | null;
  /** Top of the piece from the floor, inches (null = not specified). */
  height: number | null;
  splitGroup: string | null;
}

export interface BuiltGap {
  run: RunId;
  index: number;
  offset: number;
  length: number;
  rect: Rect;
  label: string;
}

export interface BuiltSeam {
  /** Seam between stored pieces index-1 and index. */
  index: number;
  offset: number;
  point: Pt;
}

export interface BuiltRun {
  id: RunId;
  available: number;
  /** Sum of all stored pieces including gaps (must equal available). */
  sum: number;
  filled: number;
  unfilled: number;
  ends: { start: EndKind; end: EndKind };
  openEnd: RunEnd | null;
  endCap: EndCapState | null;
  axis: 'x' | 'y';
  /** Run start on the outside edge (plan inches). */
  origin: Pt;
  pieceIds: string[];
  seams: BuiltSeam[];
}

export type WarningCode =
  | 'pieceOver108'
  | 'seatUnder20'
  | 'tableOutOfRange'
  | 'wedgeFaceUnder8'
  | 'openingUnder60'
  | 'seatDepthUnder24'
  | 'coffeeClearanceUnder14';

export interface Warning {
  code: WarningCode;
  message: string;
  pieceId?: string;
  run?: RunId;
}

export interface SeatCount {
  comfortable: number;
  snug: number;
  label: string;
}

export interface Clearance {
  pieceId: string;
  back: number | null;
  left: number | null;
  right: number | null;
  front: number | null;
  min: number | null;
}

export interface BuildResult {
  shape: Shape;
  W: number;
  L: number;
  R: number;
  D: number;
  seatDepth: number;
  wedge: { C: number; auto: boolean; face: number; readout: string };
  runs: BuiltRun[];
  /** Wedges, run pieces (no gaps) and loose pieces. */
  pieces: BuiltPiece[];
  gaps: BuiltGap[];
  seats: SeatCount;
  opening: { width: number; depth: number } | null;
  clearances: Clearance[];
  warnings: Warning[];
  /** Invariant violations (a hand-edited or corrupt config). Ops never produce these. */
  errors: string[];
  exportBlocked: boolean;
}
