// The Side view drawing (Andre, 2026-11-11, plan Q78): a cut through a seat
// with its measurements, in the style of the sketch he sent: rounded shapes,
// the back in a darker tan, the back pillow lighter, the one-piece seat with
// its stitch line, and heavy dimension lines. With the person on, a plain grey
// figure sits on it in profile. Drawn in display units (px on screen, pt on
// paper): `fs` is the text size, so nothing is ever under 14 px on screen.
// No three import: the 3D view shows it for the Side button and the PDF sheet
// draws the same thing.
import type { HavenDims } from '@/engine';
import { fmtIn } from '@/plan/format';
import { personFigure, type PersonPose, type Pt2 } from './person';
import { BACK_PILLOW_STITCH, sideSection, type Box } from './sideSection';

export interface SideSectionProps {
  width: number;
  height: number;
  dims: HavenDims;
  D: number;
  /** Text size in display units (14 on screen, 7 on paper). */
  fs?: number;
  /** Background behind labels that cross the drawing. */
  paper?: string;
  person?: { height: number; pose: PersonPose } | null;
}

const INK = '#1c1b19';
const LABEL = '#4a453e';
const COLORS = { back: '#c9bfae', pillow: '#ddd5c7', seat: '#f4f0e8', leg: '#3b332c', arm: '#8d867b', body: '#aaa69f', bodyLine: '#55524d', extra: '#b79f86' };
const FONT = 'helvetica, arial, sans-serif';

export function SideSection({ width, height, dims, D, fs = 14, paper = '#ffffff', person = null }: SideSectionProps) {
  const sec = sideSection(dims, D);
  const fig = person ? personFigure(person.height, person.pose, { seatHeight: dims.seatHeight, pillowFront: sec.pillow.t1, D }) : null;
  const compact = width < 46 * fs; // a phone: only the main measurements
  const u = fs / 14; // every fixed size scales with the text
  const textW = (s: string, bold = false) => s.length * fs * (bold ? 0.62 : 0.56);
  const col = fs * 2.1;
  const L = { arm: `${fmtIn(sec.heights.arm)} arm`, back: `${fmtIn(sec.heights.back)} back`, pillow: `${fmtIn(sec.heights.pillow)} back pillows`, leg: `${fmtIn(sec.heights.leg)} leg`, piece: `${fmtIn(sec.heights.seat - sec.heights.leg)} seat`, seat: `${fmtIn(sec.heights.seat)} seat height` };
  const ML = (compact ? 1 : 3) * col + 14 * u;
  const MR = 16 * u + (compact ? 0 : Math.max(textW(L.piece), textW(L.leg)) + 26 * u) + textW(L.seat, true) + 14 * u;
  const MT = 12 * u;
  const rowH = fs * 2.5;
  const MB = 2 * rowH + fs * 2.2 + 10 * u;
  const tMax = Math.max(D, fig ? Math.max(fig.toe[0], fig.ankle[0]) + fig.thick.foot : 0);
  const zMax = Math.max(sec.heights.pillow, fig ? fig.top : 0) + 2;
  const s = Math.max(0.5, Math.min((width - ML - MR) / tMax, (height - MT - MB) / zMax, 15 * u));
  const ox = ML + Math.max(0, (width - ML - MR - tMax * s) / 2);
  const oy = MT + (height - MT - MB + zMax * s) / 2; // the floor
  const X = (t: number) => +(ox + t * s).toFixed(2);
  const Y = (z: number) => +(oy - z * s).toFixed(2);
  const lw = 1.5 * u;

  const box = (b: Box, fill: string, r: number, extra: React.SVGProps<SVGRectElement> = {}) => (
    <rect x={X(b.t0)} y={Y(b.z1)} width={+((b.t1 - b.t0) * s).toFixed(2)} height={+((b.z1 - b.z0) * s).toFixed(2)} rx={+(r * s).toFixed(2)} fill={fill} stroke={INK} strokeWidth={lw} {...extra} />
  );
  const arrow = (x: number, y: number, dx: number, dy: number, k: number) => {
    const a = 8 * u;
    const h = 3 * u;
    return <polygon key={k} points={`${x},${y} ${x - dx * a - dy * h},${y - dy * a + dx * h} ${x - dx * a + dy * h},${y - dy * a - dx * h}`} fill={INK} />;
  };
  const label = (x: number, y: number, t: string, o: { bold?: boolean; anchor?: 'start' | 'middle' | 'end'; rotate?: boolean; bg?: boolean; fill?: string } = {}) => {
    const w = textW(t, o.bold) + 8 * u;
    return (
      <g>
        {o.bg && <rect x={x - w / 2} y={y - fs * 0.95} width={w} height={fs * 1.3} fill={paper} rx={3 * u} />}
        <text data-dim-text="" x={x} y={y} fontSize={fs} fontFamily={FONT} fontWeight={o.bold ? 700 : 600} fill={o.fill ?? INK} textAnchor={o.anchor ?? 'middle'} transform={o.rotate ? `rotate(-90 ${x} ${y})` : undefined}>
          {t}
        </text>
      </g>
    );
  };
  /** A horizontal dimension from t0 to t1 at screen y, its label above the line. */
  const hDim = (t0: number, t1: number, y: number, t: string, o: { bold?: boolean; bg?: boolean; ticks?: boolean } = {}) => (
    <g stroke={INK} strokeWidth={lw}>
      {o.ticks !== false && [t0, t1].map((t, i) => <line key={i} x1={X(t)} y1={y - 7 * u} x2={X(t)} y2={y + 7 * u} />)}
      <line x1={X(t0)} y1={y} x2={X(t1)} y2={y} />
      {arrow(X(t0), y, -1, 0, 1)}
      {arrow(X(t1), y, 1, 0, 2)}
      <g stroke="none">{label((X(t0) + X(t1)) / 2, y - 6 * u, t, { bold: o.bold, bg: o.bg })}</g>
    </g>
  );
  /** A vertical dimension from z0 to z1 at screen x; the label turned along it (left) or beside it (right). */
  const vDim = (x: number, z0: number, z1: number, t: string, side: 'turned' | 'right', bold = false) => (
    <g stroke={INK} strokeWidth={lw}>
      {[z0, z1].map((z, i) => <line key={i} x1={x - 7 * u} y1={Y(z)} x2={x + 7 * u} y2={Y(z)} />)}
      <line x1={x} y1={Y(z0)} x2={x} y2={Y(z1)} />
      {(z1 - z0) * s > 22 * u && arrow(x, Y(z0), 0, 1, 1)}
      {(z1 - z0) * s > 22 * u && arrow(x, Y(z1), 0, -1, 2)}
      <g stroke="none">
        {side === 'turned'
          ? label(x - 6 * u, (Y(z0) + Y(z1)) / 2, t, { rotate: true, bold })
          : label(x + 10 * u, Math.min((Y(z0) + Y(z1)) / 2 + fs * 0.35, oy - 4 * u), t, { anchor: 'start', bold })}
      </g>
    </g>
  );
  const limb = (a: Pt2, b: Pt2, w: number, stroke: string, grow = 0, k?: string) => (
    <line key={k} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke={stroke} strokeWidth={+(w * s + grow).toFixed(2)} strokeLinecap="round" />
  );
  const body = (stroke: string, grow: number) =>
    fig && (
      <g>
        {limb(fig.hip, fig.knee, fig.thick.thigh, stroke, grow)}
        {limb(fig.knee, fig.ankle, fig.thick.shin, stroke, grow)}
        {limb(fig.ankle, fig.toe, fig.thick.foot, stroke, grow)}
        {limb(fig.pelvis, fig.shoulder, fig.thick.torso, stroke, grow)}
        <circle cx={X(fig.head[0])} cy={Y(fig.head[1])} r={+(fig.thick.headR * s + grow / 2).toFixed(2)} fill={stroke} />
      </g>
    );
  const xr = X(tMax) + 16 * u; // the first height column on the right
  const xr2 = compact ? xr : xr + Math.max(textW(L.piece), textW(L.leg)) + 26 * u;
  // The usable seat is measured over the seat; with a person sitting there, inside the seat's top half.
  const yUse = fig ? Y(sec.stitch + (sec.seat.z1 - sec.stitch) * 0.3) : Y((sec.seat.z1 + sec.pillow.z1) / 2);
  const seatLabelY = Y(fig ? (sec.seat.z0 + sec.stitch) / 2 : (sec.stitch + sec.seat.z1) / 2) + fs * 0.35;
  const yb = oy + rowH;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} data-side-svg="" data-usable={sec.usableSeat} data-depth={D} data-scale={+s.toFixed(4)}>
      {/* The arm beyond the seat */}
      {!compact && <rect x={X(sec.arm.t0)} y={Y(sec.arm.z1)} width={D * s} height={(sec.arm.z1 - sec.arm.z0) * s} rx={2 * s} fill="none" stroke={COLORS.arm} strokeWidth={lw} strokeDasharray={`${6 * u} ${5 * u}`} data-part="arm" />}
      {sec.legs.map((l, i) => (
        <rect key={i} x={X(l.t0)} y={Y(l.z1)} width={(l.t1 - l.t0) * s} height={(l.z1 - l.z0) * s} fill={COLORS.leg} data-part="leg" />
      ))}
      {box(sec.back, COLORS.back, 2.2, { 'data-part': 'back' } as React.SVGProps<SVGRectElement>)}
      {box(sec.seat, COLORS.seat, 2.4, { 'data-part': 'seat' } as React.SVGProps<SVGRectElement>)}
      <line x1={X(sec.seat.t0) + 4 * u} y1={Y(sec.stitch)} x2={X(sec.seat.t1) - 4 * u} y2={Y(sec.stitch)} stroke={INK} strokeWidth={lw * 0.8} strokeDasharray={`${5 * u} ${4 * u}`} data-part="stitch" data-z={sec.stitch} />
      {box(sec.pillow, COLORS.pillow, 3, { 'data-part': 'pillow' } as React.SVGProps<SVGRectElement>)}
      <line x1={X(-3)} y1={oy} x2={xr - 9 * u} y2={oy} stroke={INK} strokeWidth={2.6 * u} />
      {label((X(sec.back.t0) + X(sec.back.t1)) / 2 + fs * 0.35, Y((sec.back.z0 + sec.back.z1) / 2), 'BACK', { rotate: true, bold: true, fill: LABEL })}
      {(sec.seat.t1 - sec.seat.t0) * s > textW('SEAT · one piece, stitch line in the middle', true) + 12 * u
        ? label((X(sec.seat.t0) + X(sec.seat.t1)) / 2, seatLabelY, 'SEAT · one piece, stitch line in the middle', { bold: true, fill: LABEL })
        : label((X(sec.seat.t0) + X(sec.seat.t1)) / 2, seatLabelY, 'SEAT', { bold: true, fill: LABEL })}

      {/* The person: the square pillow behind an upright back, then the figure as one silhouette */}
      {fig?.pillow && box(fig.pillow, COLORS.extra, Math.min(3, (fig.pillow.t1 - fig.pillow.t0) / 2.2), { 'data-part': 'upright-pillow' } as React.SVGProps<SVGRectElement>)}
      {fig && (
        <g data-person="" data-hip={fig.hip.map((v) => v.toFixed(2)).join(',')} data-top={fig.top.toFixed(2)} data-feet={fig.feetOnFloor ? 'floor' : 'up'} data-seat-back={fig.seatBack.toFixed(2)}>
          {body(COLORS.bodyLine, 3 * u)}
          {body(COLORS.body, 0)}
          {limb(fig.shoulder, fig.elbow, fig.thick.arm, COLORS.bodyLine, 3 * u)}
          {limb(fig.elbow, fig.hand, fig.thick.arm, COLORS.bodyLine, 3 * u)}
          {limb(fig.shoulder, fig.elbow, fig.thick.arm, COLORS.body)}
          {limb(fig.elbow, fig.hand, fig.thick.arm, COLORS.body)}
        </g>
      )}

      {/* Measurements */}
      <g data-side-dims="">
        {hDim(sec.pillow.t1, D, yUse, `${fmtIn(sec.usableSeat)} USABLE SEAT`, { bold: true, bg: true })}
        {hDim(0, sec.back.t1, yb, fmtIn(sec.back.t1))}
        {hDim(sec.back.t1, D, yb, `${fmtIn(D - sec.back.t1)} seat`)}
        {hDim(0, D, yb + rowH, `${fmtIn(D)} TOTAL DEPTH`, { bold: true })}
        {!compact && vDim(ox - col * 0.6 - 6 * u, 0, sec.heights.arm, L.arm, 'turned')}
        {vDim(ox - col * (compact ? 0.6 : 1.6) - 6 * u, 0, sec.heights.back, L.back, 'turned')}
        {!compact && vDim(ox - col * 2.6 - 6 * u, 0, sec.heights.pillow, L.pillow, 'turned')}
        {!compact && vDim(xr, sec.heights.leg, sec.heights.seat, L.piece, 'right')}
        {!compact && vDim(xr, 0, sec.heights.leg, L.leg, 'right')}
        {vDim(xr2, 0, sec.heights.seat, L.seat, 'right', true)}
        {label((X(0) + X(D)) / 2, yb + rowH + fs * 1.9, `Back pillow: ${fmtIn(BACK_PILLOW_STITCH)} at the stitching, fills to ${fmtIn(sec.pillow.t1 - sec.pillow.t0)}`, { fill: LABEL })}
      </g>
    </svg>
  );
}
