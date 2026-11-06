// Freeform pieces (plan §10 "Freeform pieces", stage 3; Andre 2026-11-06).
// A free layout is a forest of standard Haven pieces attached to each other
// edge to edge: each sofa (group) has ONE root with a stored pose, and every
// other piece is attached to a face of another piece. Positions are DERIVED,
// never stored (as the T's halves in Stage A), so pulling a seat out of a row
// closes it up, growing one pushes the rest along, and a depth change re-lays
// every sofa. Turns are 90° only, so every rectangle stays axis-aligned.
//
// Local frame of a piece (the back run's, plan §8): s runs along the piece from
// 0 to its length, t from the back (0) to the front (D). A wedge's local frame
// is the back-left corner: polygon (0,0) (C,0) (C,D) (D,C) (0,C).
import type { BuiltPiece, Config, LoosePiece, Pt, Rejection, RunEnd, SeatCount, Warning, Clearance, Bounds } from './types';

export type Rot = 0 | 90 | 180 | 270;
export type FreeKind = 'armless' | 'oneArm' | 'table' | 'wedge';
/** start / end: a seat's or table's ends; back: a seat's back (back to back); a / b: a wedge's two faces. */
export type FaceId = 'start' | 'end' | 'back' | 'a' | 'b';

/** A sofa's first piece: where its local origin sits in the world, and its turn (clockwise on screen). */
export interface RootAt {
  x: number;
  y: number;
  rot: Rot;
}

/** Attached to face `face` of piece `to`. A back attachment also has its offset along the parent and the frame option. */
export interface AttachAt {
  to: string;
  face: FaceId;
  /** Back to back only: the child spans [offset, offset + length] in the parent's s. */
  offset?: number;
  /** Back to back only: one shared frame (the frames overlap by B), else two backs. */
  sharedBack?: boolean;
}

export interface FreePiece {
  id: string;
  kind: FreeKind;
  /** Seats and tables (a one-arm seat's length includes its arm); a wedge's size is the shared C. */
  length?: number;
  /** One-arm seats: the end of the piece (local s) that carries the arm. start = LAF. */
  arm?: RunEnd;
  at: RootAt | AttachAt;
}

/** What every piece shares (the T's shared fields, minus the lock: free sizes are read off the pieces). */
export type FreeShared = Pick<Config, 'D' | 'wedgeC' | 'seatWidth' | 'snugWidth' | 'fabric' | 'tableFinish' | 'tableStyle' | 'dims'>;

export interface FreeLayout {
  schema: 1;
  kind: 'free';
  shared: FreeShared;
  /** Parents before children (encode relies on it; ops keep it). */
  pieces: FreePiece[];
  /** World inches. */
  loose: LoosePiece[];
  nextId: number;
}

/** A piece's derived world pose: its local origin and turn. */
export type Pose = RootAt;

/** What to add: a kind, its length (default per kind) and a one-arm seat's arm. */
export interface FreeSpec {
  kind: FreeKind;
  length?: number;
  arm?: RunEnd;
}

/** Where a piece can snap: a face of another piece (or its back), with the pose it would take. */
export interface Target {
  to: string;
  face: FaceId;
  offset?: number;
  sharedBack?: boolean;
  pose: Pose;
  /** A world point for the UI to measure the finger against (the middle of the face). */
  anchor: Pt;
}

export interface FreeResult {
  free: FreeLayout;
  rejected: Rejection | null;
}

export interface FreeBuild {
  /** Sofa pieces (world), then loose pieces. */
  pieces: BuiltPiece[];
  poses: Map<string, Pose>;
  /** Connected sofas (by attachment), each a list of piece ids. */
  groups: string[][];
  /** Straight rows of seats and tables (between wedges and open ends), each in order along its back. */
  chains: string[][];
  seats: SeatCount;
  wedge: { C: number; auto: boolean; face: number; readout: string };
  seatDepth: number;
  clearances: Clearance[];
  warnings: Warning[];
  errors: string[];
  bounds: Bounds;
  exportBlocked: boolean;
}
