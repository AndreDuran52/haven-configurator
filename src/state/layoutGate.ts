// Shapes gate. Stage A (2026-10-26) stored and linked layouts while the editor
// could only show one section; a layout it could not show was treated like a
// link from a newer version (never opened, overwritten or deleted). Stage B1
// opens joined sections (the T) in the plan, so the gate is on.
import { isSolo, type Layout } from '@/engine';

export const SHAPES_ENABLED = true;

/** Can this build open the layout in the editor? */
export const canOpen = (l: Layout): boolean => SHAPES_ENABLED || isSolo(l);
