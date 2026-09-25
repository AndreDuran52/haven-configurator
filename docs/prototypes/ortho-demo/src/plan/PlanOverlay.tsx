import { buildStandardU, STANDARD_U } from '../haven/standardU'

/**
 * The 2D SVG plan drawn from the SAME pieces[] at a known px-per-inch, positioned so plan
 * point (cx, cy) sits at the centre of a W×H box. The parity test lays this over the ortho
 * top view (camera zoom = pxPerInch, target = (cx, ·, cy)) and diffs the two.
 */
export function PlanOverlay({ width, height, pxPerInch, cx, cy, mode }: { width: number; height: number; pxPerInch: number; cx: number; cy: number; mode: 'outline' | 'fill' }) {
  const pieces = buildStandardU(STANDARD_U)
  const tx = width / 2 - cx * pxPerInch
  const ty = height / 2 - cy * pxPerInch
  return (
    <svg
      id="plan-overlay"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform={`translate(${tx} ${ty}) scale(${pxPerInch})`}>
        {pieces.map((p) => (
          <polygon
            key={p.id}
            data-piece={p.id}
            points={p.footprint.map(([x, y]) => `${x},${y}`).join(' ')}
            fill={mode === 'fill' ? '#000' : 'none'}
            stroke={mode === 'fill' ? 'none' : '#e0162b'}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            shapeRendering={mode === 'fill' ? 'crispEdges' : undefined}
          />
        ))}
      </g>
    </svg>
  )
}
