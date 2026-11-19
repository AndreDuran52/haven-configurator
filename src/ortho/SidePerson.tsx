// The person in the Side drawing (Andre, 2026-11-11): a plain mannequin in
// profile, drawn from the same joints and sizes as the 3D figure
// (ortho/person.ts): the body along its curved back with its real depth,
// tapered limbs, an upright egg of a head. Drawn twice, an outline pass under a
// fill pass, so the parts read as one silhouette; the near arm keeps its own
// outline over the body. No three import.
import { PILLOW_COLOR } from '@/engine';
import type { PersonFigure, Pt2 } from './person';
import { pillowProfile } from './pillowShape';

const BODY = '#9a948c';
const LINE = '#6f6a63';
const PILLOW = PILLOW_COLOR.taupe;
const INK = '#1c1b19';

interface Draw {
  X: (t: number) => number;
  Y: (z: number) => number;
  /** Display units per inch. */
  s: number;
  /** Line weight scale (1 on screen). */
  u: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A limb that tapers from radius ra at a to rb at b, as shapes that fill or stroke alike. */
function Taper({ a, b, ra, rb, d, paint }: { a: Pt2; b: Pt2; ra: number; rb: number; d: Draw; paint: React.SVGProps<SVGElement> }) {
  const [ax, ay, bx, by] = [d.X(a[0]), d.Y(a[1]), d.X(b[0]), d.Y(b[1])];
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const [nx, ny] = [-(by - ay) / l, (bx - ax) / l];
  const [A, B] = [ra * d.s, rb * d.s];
  const pts = `${ax + nx * A},${ay + ny * A} ${bx + nx * B},${by + ny * B} ${bx - nx * B},${by - ny * B} ${ax - nx * A},${ay - ny * A}`;
  return (
    <>
      <circle cx={ax} cy={ay} r={A} {...(paint as React.SVGProps<SVGCircleElement>)} />
      <circle cx={bx} cy={by} r={B} {...(paint as React.SVGProps<SVGCircleElement>)} />
      <polygon points={pts} {...(paint as React.SVGProps<SVGPolygonElement>)} />
    </>
  );
}

/** The throw pillow behind an upright back: the knife-edge pillow's own profile, leaning with the space, pressed where the back leans. */
export function SidePillow({ fig, d }: { fig: PersonFigure; d: Draw }) {
  const p = fig.pillow;
  if (!p) return null;
  const a = rad(p.lean);
  const path = pillowProfile(p.h, p.t, p.press ?? undefined)
    .map(([z, y], i) => `${i ? 'L' : 'M'}${d.X(p.c[0] + z * Math.cos(a) - y * Math.sin(a)).toFixed(2)} ${d.Y(p.c[1] + y * Math.cos(a) + z * Math.sin(a)).toFixed(2)}`)
    .join(' ');
  return <path d={`${path} Z`} fill={PILLOW} stroke={INK} strokeWidth={1.5 * d.u} strokeLinejoin="round" data-part="upright-pillow" data-lean={p.lean.toFixed(1)} />;
}

export function SidePerson({ fig, d }: { fig: PersonFigure; d: Draw }) {
  const b = fig.build;
  const grow = 2.2 * d.u;
  const torso = [...fig.spine.map((q): Pt2 => [q.p[0] - (q.n[0] * q.depth) / 2, q.p[1] - (q.n[1] * q.depth) / 2]), ...[...fig.spine].reverse().map((q): Pt2 => [q.p[0] + (q.n[0] * q.depth) / 2, q.p[1] + (q.n[1] * q.depth) / 2])]
    .map((q) => `${d.X(q[0]).toFixed(2)},${d.Y(q[1]).toFixed(2)}`)
    .join(' ');
  const body = (paint: React.SVGProps<SVGElement>) => (
    <g>
      <Taper a={fig.hip} b={fig.knee} ra={b.thighHip / 2} rb={b.thighKnee / 2} d={d} paint={paint} />
      <Taper a={fig.knee} b={fig.ankle} ra={b.shinKnee / 2} rb={b.shinAnkle / 2} d={d} paint={paint} />
      <Taper a={fig.ankle} b={fig.toe} ra={b.foot / 2} rb={b.foot / 2} d={d} paint={paint} />
      <polygon points={torso} {...(paint as React.SVGProps<SVGPolygonElement>)} />
      <circle cx={d.X(fig.hip[0])} cy={d.Y(fig.hip[1])} r={(b.hipsD / 2) * d.s} {...(paint as React.SVGProps<SVGCircleElement>)} />
      <circle cx={d.X(fig.shoulder[0])} cy={d.Y(fig.shoulder[1])} r={(b.shoulderD / 2) * d.s} {...(paint as React.SVGProps<SVGCircleElement>)} />
      <Taper a={fig.shoulder} b={fig.head} ra={b.neck / 2} rb={b.neck * 0.45} d={d} paint={paint} />
      <ellipse cx={d.X(fig.head[0])} cy={d.Y(fig.head[1])} rx={(b.headD / 2) * d.s} ry={(b.headH / 2) * d.s} {...(paint as React.SVGProps<SVGEllipseElement>)} />
    </g>
  );
  const arm = (paint: React.SVGProps<SVGElement>) => (
    <g>
      <Taper a={fig.armRoot} b={fig.elbow} ra={b.upperArm / 2} rb={b.upperArm * 0.42} d={d} paint={paint} />
      <Taper a={fig.elbow} b={fig.hand} ra={b.forearm / 2} rb={b.forearm / 2} d={d} paint={paint} />
    </g>
  );
  const line = { fill: LINE, stroke: LINE, strokeWidth: grow, strokeLinejoin: 'round' } as React.SVGProps<SVGElement>;
  const fill = { fill: BODY } as React.SVGProps<SVGElement>;
  return (
    <g
      data-person=""
      data-hip={fig.hip.map((v) => v.toFixed(2)).join(',')}
      data-shoulder={fig.shoulder.map((v) => v.toFixed(2)).join(',')}
      data-top={fig.top.toFixed(2)}
      data-feet={fig.feetOnFloor ? 'floor' : 'up'}
      data-seat-back={fig.seatBack.toFixed(2)}
      data-lean={fig.lean.toFixed(1)}
      data-knee-past={fig.measures.kneePast.toFixed(2)}
    >
      {body(line)}
      {body(fill)}
      {arm(line)}
      {arm(fill)}
    </g>
  );
}
