import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildHaven } from '../src/engine/buildHaven'
import { fixtures } from '../src/fixtures'
import { fitScreen, layoutDims, PRINT, SCREEN } from '../src/plan/dims'
import { LIGHT, PlanDrawing, SKETCH } from '../src/plan/PlanDrawing'

const views = { ipadLandscape: [880, 680], ipadPortrait: [820, 700], phone: [390, 460] } as const
const out: string[] = []
const summary: Record<string, unknown> = {}
for (const [name, cfg] of Object.entries(fixtures())) {
  const built = buildHaven(cfg)
  for (const [vname, [vw, vh]] of Object.entries(views)) {
    for (const look of ['cad', 'sketch'] as const) {
      if (look === 'sketch' && vname !== 'ipadLandscape') continue
      const { k, layout } = fitScreen(built, vw, vh)
      const b = layout.bounds
      const pad = 12 * k
      const svg = renderToStaticMarkup(
        <svg xmlns="http://www.w3.org/2000/svg" width={vw} height={vh} viewBox={`${b.x - pad} ${b.y - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}`} style={{ background: '#fff' }}>
          <PlanDrawing built={built} dims={layout} k={k} look={look} theme={look === 'sketch' ? SKETCH : LIGHT} showWarnings={look === 'cad'} seatWidth={cfg.seatWidth} />
        </svg>,
      )
      const file = `out/${name}-${vname}-${look}.svg`
      fs.writeFileSync(file, svg)
      out.push(`<figure data-name="${name}-${vname}-${look}"><figcaption>${name} · ${vname} ${vw}×${vh} · ${look} · ${(1 / k).toFixed(2)} px/in</figcaption>${svg}</figure>`)
      summary[`${name}-${vname}-${look}`] = { pxPerIn: +(1 / k).toFixed(3), texts: layout.texts.length, margin: layout.margin }
    }
  }
  // print profile at 1/2" = 1'-0"
  const kp = 24 / 72
  const lp = layoutDims(built, { ...PRINT, k: kp })
  fs.writeFileSync(`out/${name}-print.json`, JSON.stringify({ bounds: lp.bounds, margin: lp.margin }))
}
fs.writeFileSync('out/gallery.html', `<!doctype html><meta charset=utf-8><style>body{margin:0;font:12px system-ui;background:#ddd}figure{margin:8px;display:inline-block;background:#fff}figcaption{padding:4px}</style>${out.join('\n')}`)
console.log(JSON.stringify(summary, null, 0))
