// G2 shape picker: the back run keeps its pieces. W and the kept leg are held
// under both lock states (like a measurement change).
import { ABSORB_FLOOR, cushionOf } from './pieces';
import { absorb } from './absorb';
import { available, defaultFill, endIndex, openEnd, wedgeC } from './layout';
import { edit, refuse, type Outcome } from './edit';
import { minMessage, shortfall } from './limits';
import type { Config, EditResult, RunPiece, Shape } from './types';

/** L-left <-> L-right: the back reverses (arms flip), the leg is copied, L and R swap. */
function mirror(d: Config, shape: Shape): Outcome {
  const back = d.runs.back!.slice().reverse();
  for (const p of back) if (p.arm) p.arm = p.arm === 'start' ? 'end' : 'start';
  const leg = shape === 'L-right' ? d.runs.left! : d.runs.right!;
  d.runs = shape === 'L-right' ? { back, right: leg } : { back, left: leg };
  [d.L, d.R] = [d.R, d.L];
  d.shape = shape;
  return true;
}

/** U -> L: the end that becomes open absorbs +C; its edge seat takes an arm (footprint kept). */
function uToL(d: Config, shape: Shape, alloc: (p: 'p' | 'g') => string): Outcome {
  const C = wedgeC(d);
  d.shape = shape;
  d.runs = shape === 'L-left' ? { back: d.runs.back!, left: d.runs.left! } : { back: d.runs.back!, right: d.runs.right! };
  const back = d.runs.back!;
  const open = openEnd(shape, 'back')!;
  const anchor = open === 'end' ? { seam: back.length } : { seam: 0 };
  absorb(back, anchor, C, d.dims.A, alloc, { mode: 'measure', open });
  const edge = back[endIndex(back, open)];
  if (edge?.kind === 'armless' && cushionOf(edge, d.dims.A) - d.dims.A >= ABSORB_FLOOR) {
    edge.kind = 'oneArm';
    edge.arm = open;
  }
  return true;
}

/**
 * L -> U: the back end that becomes a wedge end absorbs -C by the needed-space
 * rule (its arm is removed first, footprint kept; a table there stays). The new
 * leg gets the default fill.
 */
function lToU(d: Config, alloc: (p: 'p' | 'g') => string, config: Config): Outcome {
  const C = wedgeC(d);
  const back = d.runs.back!;
  const wasOpen = openEnd(d.shape, 'back')!;
  for (const p of back) {
    if (p.kind === 'oneArm') {
      p.kind = 'armless';
      delete p.arm;
    }
  }
  const newLeg = d.shape === 'L-left' ? 'right' : 'left';
  d.shape = 'U';
  const anchor = wasOpen === 'end' ? { seam: back.length } : { seam: 0 };
  const legLen = available(d, newLeg);
  if (!absorb(back, anchor, -C, d.dims.A, alloc, { mode: 'measure', open: null }) || legLen < 0) {
    const runs = { back, left: [] as RunPiece[], right: [] as RunPiece[], ...config.runs, [newLeg]: [] as RunPiece[] };
    runs.back = back;
    const min = shortfall({ ...config, shape: 'U', runs });
    return refuse('infeasible', minMessage(min), min);
  }
  d.runs = { back, left: d.runs.left, right: d.runs.right };
  d.runs[newLeg] = defaultFill(legLen, 'end', d.dims.A, alloc);
  return true;
}

export function setShape(config: Config, shape: Shape): EditResult {
  return edit(config, (d, alloc) => {
    if (d.shape === shape) return null;
    if (d.shape === 'U') return uToL(d, shape, alloc);
    if (shape === 'U') return lToU(d, alloc, config);
    return mirror(d, shape);
  });
}
