// A small static plan of a layout (Projects home cards, H6b): the same
// PlanDrawing as the editor and the sheet, no dimensions, drawn from the
// layout itself (nothing extra is stored). A T draws both halves in place.
import type { Layout } from '@/engine';
import { PlanDrawing } from '@/plan/PlanDrawing';
import { LIGHT } from '@/plan/theme';
import { layoutBuiltOf } from '@/state/store';

const PAD = 6; // inches

export function PlanThumb({ layout, width = 240, height = 150 }: { layout: Layout; width?: number; height?: number }) {
  const lb = layoutBuiltOf(layout);
  const pts = lb.sections.flatMap((s) => s.built.pieces.flatMap((p) => p.polygon.map((q) => [q[0] + s.offset[0], q[1] + s.offset[1]] as const)));
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x0 = Math.min(0, ...xs) - PAD;
  const y0 = Math.min(0, ...ys) - PAD;
  const w = Math.max(lb.overall.W, ...xs) + PAD - x0;
  const h = Math.max(...ys, 1) + PAD - y0;
  const k = Math.max(w / width, h / height);
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} width="100%" height="100%" className="block" aria-hidden data-thumb="">
      {[...lb.sections].reverse().map((s) => (
        <g key={s.id} transform={lb.solo ? undefined : `translate(${s.offset[0]} ${s.offset[1]})`}>
          <PlanDrawing built={s.built} dims={null} k={k} theme={LIGHT} showWarnings={false} seatsSize={0} gapLabelSize={0} />
        </g>
      ))}
    </svg>
  );
}
