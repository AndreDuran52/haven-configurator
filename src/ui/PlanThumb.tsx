// A small static plan of a layout (Projects home cards, H6b): the same
// PlanDrawing as the editor and the sheet, no dimensions, drawn from the
// layout itself (nothing extra is stored).
import type { Config } from '@/engine';
import { PlanDrawing } from '@/plan/PlanDrawing';
import { LIGHT } from '@/plan/theme';
import { builtOf } from '@/state/store';

const PAD = 6; // inches

export function PlanThumb({ config, width = 240, height = 150 }: { config: Config; width?: number; height?: number }) {
  const built = builtOf(config);
  const xs = built.pieces.flatMap((p) => p.polygon.map((q) => q[0]));
  const ys = built.pieces.flatMap((p) => p.polygon.map((q) => q[1]));
  const x0 = Math.min(0, ...xs) - PAD;
  const y0 = Math.min(0, ...ys) - PAD;
  const w = Math.max(built.W, ...xs) + PAD - x0;
  const h = Math.max(...ys, 1) + PAD - y0;
  const k = Math.max(w / width, h / height);
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} width="100%" height="100%" className="block" aria-hidden data-thumb="">
      <PlanDrawing built={built} dims={null} k={k} theme={LIGHT} showWarnings={false} seatsSize={0} gapLabelSize={0} />
    </svg>
  );
}
