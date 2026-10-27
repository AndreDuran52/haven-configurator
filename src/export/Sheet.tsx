// The PDF sheet (plan §9, simplified by Andre 2026-09-26: "simple, only the
// sofa with the measurements as seen, the top CAD view and the 3D views I tick").
// One SVG in points, Letter landscape. The plan is placed with
// translate() scale(S), S = 72 × paper scale, so it prints exactly to scale at
// 100 %; the 3D views are JPEG renders (illustrations, not to scale).
// Text is WinAnsi-safe (straight quotes): jsPDF's Helvetica has no ″ or ′.
import type { BuildResult, Config, LayoutBuild } from '@/engine';
import { fabricOf, finishOf, type Layout } from '@/engine';
import { DimsLayer } from '@/plan/DimsLayer';
import { soloSource } from '@/plan/dims';
import { fmtIn } from '@/plan/format';
import { layoutDimSource, layoutSeatsAt } from '@/plan/layoutDims';
import { PlanDrawing } from '@/plan/PlanDrawing';
import { LIGHT, SKETCH } from '@/plan/theme';
import { PRESET_LABELS, type PresetName } from '@/ortho/presets';
import { fitPlan, headerLine } from './fit';
import { LINK_LINE, linkLines, SheetLayout, type SheetViews } from './layout';

const INK = '#1c1b19';
const MUTED = '#6b665e';
const FONT = LIGHT.font;

export interface SheetRender {
  preset: PresetName;
  url: string;
}

export interface SheetProps {
  /** The root section's build (one sofa: the whole sofa). */
  built: BuildResult;
  /** The root section's config (shared fields: fabric, tables). */
  config: Config;
  /** Shapes B1: the whole layout (a T draws both halves). */
  layout: Layout;
  layoutBuild: LayoutBuild;
  views: SheetViews;
  renders: SheetRender[];
  look: 'cad' | 'sketch';
  meta: { title: string; date: string; link: string };
}

function T({ x, y, s, size, bold, anchor = 'start', fill = INK }: { x: number; y: number; s: string; size: number; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; fill?: string }) {
  return (
    <text x={+x.toFixed(2)} y={+y.toFixed(2)} fontSize={size} fontFamily={FONT} fontWeight={bold ? 700 : 400} textAnchor={anchor} fill={fill}>
      {s}
    </text>
  );
}

/** Graphic scale: stays true even when a printer rescales the page. */
function ScaleBar({ x, y, S }: { x: number; y: number; S: number }) {
  const ft = [2, 4, 5, 8, 10, 16, 20, 40].find((f) => f * 12 * S >= 90) ?? 40;
  const step = ft <= 8 ? 1 : ft <= 20 ? 2 : 5;
  const segs = [];
  for (let i = 0; i < ft; i += step) {
    segs.push(<rect key={i} x={x + i * 12 * S} y={y} width={step * 12 * S} height={4} fill={(i / step) % 2 ? '#ffffff' : INK} stroke={INK} strokeWidth={0.4} />);
  }
  return (
    <g data-scalebar={ft} data-scalebar-len={ft * 12 * S}>
      {segs}
      {[0, ft].map((f) => (
        <T key={f} x={x + f * 12 * S} y={y + 12} s={`${f}'`} size={6} anchor="middle" />
      ))}
    </g>
  );
}

export function Sheet(p: SheetProps) {
  const b = p.built;
  const L = new SheetLayout(p.views);
  const theme = p.look === 'sketch' ? SKETCH : LIGHT;
  const lb = p.layoutBuild;
  const plan = L.plan ? fitPlan(lb.solo ? soloSource(b) : layoutDimSource(lb), L.plan) : null;
  const hasTable = p.layout.sections.some((s) => Object.values(s.config.runs).some((ps) => ps?.some((q) => q.kind === 'table')));
  const style = p.config.tableStyle === 'standard' ? '2" wood top on a fabric base' : 'all wood';
  const spec = [
    lb.seats.label,
    `Seat depth ${fmtIn(b.seatDepth)}`,
    `Fabric: ${fabricOf(p.config.fabric).name}`,
    hasTable ? `Tables: ${style}, ${finishOf(p.config.tableFinish).name.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const { page, header, footer } = L;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={page.w} height={page.h} viewBox={`0 0 ${page.w} ${page.h}`} data-sheet="">
      <rect x={0} y={0} width={page.w} height={page.h} fill="#ffffff" />
      {/* Header */}
      <T x={header.x} y={header.y + 16} s="HAVEN SECTIONAL" size={15} bold />
      <T x={header.x} y={header.y + 32} s={headerLine(p.layout, b)} size={9} />
      {p.meta.title && <T x={header.x + header.w} y={header.y + 16} s={p.meta.title} size={11} bold anchor="end" />}
      <T x={header.x + header.w} y={header.y + 32} s={p.meta.date} size={8} anchor="end" fill={MUTED} />
      <line x1={header.x} y1={header.y + header.h} x2={header.x + header.w} y2={header.y + header.h} stroke={INK} strokeWidth={0.6} />

      {/* Plan, to scale */}
      {plan && L.plan && (
        <g data-plan-view="">
          <T x={L.plan.x} y={L.plan.y + 9} s={`PLAN  ·  ${plan.label}`} size={7} bold />
          <g transform={`translate(${plan.ox.toFixed(3)} ${plan.oy.toFixed(3)}) scale(${plan.S})`} data-plan-scale={plan.S}>
            {lb.solo ? (
              <PlanDrawing built={b} dims={plan.dims} k={1 / plan.S} theme={theme} showWarnings={false} seatsSize={10} gapLabelSize={7} />
            ) : (
              <>
                {/* The root last: with a shared back it owns the frame down the stem (as on screen). */}
                {[...lb.sections].reverse().map((s) => (
                  <g key={s.id} data-section={s.id} transform={`translate(${s.offset[0]} ${s.offset[1]})`}>
                    <PlanDrawing built={s.built} dims={null} k={1 / plan.S} theme={theme} showWarnings={false} showSeats={false} gapLabelSize={7} />
                  </g>
                ))}
                <DimsLayer dims={plan.dims} theme={theme} />
                <text x={layoutSeatsAt(lb)[0]} y={layoutSeatsAt(lb)[1]} fontSize={+(10 / plan.S).toFixed(4)} fontFamily={theme.font} fontWeight={theme.bold} fill={theme.ink} textAnchor="middle">
                  {lb.seats.label}
                </text>
              </>
            )}
          </g>
        </g>
      )}

      {/* The chosen 3D views: illustrations */}
      {L.cells.map((cell) => {
        const r = p.renders.find((q) => q.preset === cell.preset);
        const img = L.image(cell);
        return (
          <g key={cell.preset} data-view={cell.preset}>
            <T x={cell.x} y={cell.y + 9} s={`${PRESET_LABELS[cell.preset].toUpperCase()} VIEW  ·  illustration, not to scale`} size={7} bold />
            {r && <image href={r.url} x={img.x} y={img.y} width={img.w} height={img.h} preserveAspectRatio="xMidYMid meet" />}
          </g>
        );
      })}

      {/* Footer */}
      <line x1={footer.x} y1={footer.y} x2={footer.x + footer.w} y2={footer.y} stroke={INK} strokeWidth={0.6} />
      {plan && (
        <g data-scale={plan.label}>
          <T x={footer.x} y={footer.y + 12} s={`${plan.label}  (Letter, print at 100%)`} size={7} bold />
          <ScaleBar x={footer.x} y={footer.y + 18} S={plan.S} />
        </g>
      )}
      <T x={footer.x + footer.w / 2} y={footer.y + 12} s={spec} size={7} anchor="middle" />
      <T x={footer.x + footer.w} y={footer.y + 12} s="Open this layout:" size={6} anchor="end" fill={MUTED} />
      {linkLines(p.meta.link).map((line, i) => (
        <T key={i} x={footer.x + footer.w} y={footer.y + 22 + i * LINK_LINE} s={line} size={6} anchor="end" fill="#2f6fed" />
      ))}
    </svg>
  );
}
