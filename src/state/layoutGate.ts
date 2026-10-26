// Stage A of the shapes milestone (2026-10-26): everything stores and links
// layouts, but the editor cannot show joined sections yet (that is Stage B1).
// Until then a layout with more than one section is treated like a link from a
// newer version: never opened, never overwritten, never deleted.
import { isSolo, type Layout } from '@/engine';

export const SHAPES_ENABLED = false;

/** Can this build open the layout in the editor? */
export const canOpen = (l: Layout): boolean => SHAPES_ENABLED || isSolo(l);
