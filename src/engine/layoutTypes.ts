// Layouts (shapes milestone, Andre 2026-10-26): one sofa or several standard
// sofas joined together. A T sectional is an L-right (left half) and an
// L-left (right half) with their legs back to back. Every section is an
// unchanged engine Config in its own local coordinates; where it sits is
// derived from its join, never stored, so editing one half keeps the other
// attached. sections[0] is the root, at (0,0) (its coordinates are the
// world's). A one-section layout is exactly today's single sofa.
import type { Config, Pt, Rect } from './types';

/** `legs`: the parent's RIGHT leg back to back with this section's LEFT leg (the T's stem). */
export type JoinKind = 'legs';

export interface Join {
  /** The parent section's id. */
  to: string;
  kind: JoinKind;
  /** One back frame down the stem, cushions on both sides; else two backs pushed together. */
  sharedBack: boolean;
}

export interface Section {
  /** 'a', 'b', … in order (regenerated on decode). */
  id: string;
  config: Config;
  /** null only for the root. */
  join: Join | null;
}

/**
 * H6c (Andre, 2026-11-07): the client's room, a rectangle. Only its size and
 * how it sits are stored: Center (the sofa in the middle of the room) and
 * Back wall (the sofa's back on the back wall, centred across) follow the
 * sofa as it changes; Free keeps the room's top-left corner where it was put
 * (world plan inches, the root sofa at 0,0).
 */
export type RoomAt = { mode: 'center' } | { mode: 'backWall' } | { mode: 'free'; x: number; y: number };

export interface Room {
  /** Room width (left wall to right wall) and depth (back wall to front wall), inches. */
  w: number;
  d: number;
  at: RoomAt;
}

export interface Layout {
  schema: 1;
  sections: Section[];
  /** The client's room; absent when none is set (never an undefined-valued key). */
  room?: Room;
  /** Count the seats snug (24″) instead of comfortable (28″) (link v6, Andre 2026-11-09); absent when off. */
  snug?: true;
}

/** Fields every joined section shares (one depth, corner, look and seat count per sofa). */
export const SHARED_KEYS = ['D', 'wedgeC', 'lockOutside', 'seatWidth', 'snugWidth', 'fabric', 'tableFinish', 'tableStyle', 'dims'] as const;
export type SharedKey = (typeof SHARED_KEYS)[number];

export interface Joint {
  parent: string;
  child: string;
  kind: JoinKind;
  sharedBack: boolean;
  /** World x of the parent's right-leg outside edge. */
  x: number;
  /** The shared frame strip in world inches, or null with two backs. */
  strip: Rect | null;
  /** Leg lengths on each side of the stem and the stem's width. */
  stem: { parent: number; child: number; width: number };
}

export interface PlacedOffset {
  id: string;
  offset: Pt;
}
