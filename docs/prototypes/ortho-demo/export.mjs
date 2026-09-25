import fs from 'node:fs'
import { launch, openPage, VIEWPORTS } from './pw.mjs'
const save = (path, url) => fs.writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'))
const b = await launch()
const { page, ctx } = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=trimetric&ui=0')
// on-screen capture (default preserveDrawingBuffer:false) — must not be blank
const cap = await page.evaluate(() => window.__haven.capture())
save('shots/export-onscreen-capture.png', cap)
const S = 6
const res = {}
for (const v of ['top', 'front', 'side', 'trimetric']) {
  const r = await page.evaluate(([v, S]) => window.__haven.exportView(v, S, { floor: false, padIn: 4 }), [v, S])
  save(`shots/export-${v}-${S}ppi.png`, r.url)
  // measure the object's pixel extents in the exported image (non-white pixels)
  const ext = await page.evaluate(async (url) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url })
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
    const g = c.getContext('2d'); g.drawImage(im, 0, 0)
    const d = g.getImageData(0, 0, im.width, im.height).data
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) { const i = (y * im.width + x) * 4; if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } }
    return { w: im.width, h: im.height, objW: x1 - x0 + 1, objH: y1 - y0 + 1 }
  }, r.url)
  res[v] = ext
}
console.log(`scale ${S} px/in → expected object: top 188×132 in = ${188 * S}×${132 * S} px, front 188×27 in = ${188 * S}×${27 * S} px, side 132×27 in = ${132 * S}×${27 * S} px`)
console.log(JSON.stringify(res, null, 0))
const sheet = await page.evaluate((S) => window.__haven.exportSheet(S), 4)
save('shots/export-sheet-third-angle-4ppi.png', sheet.url)
console.log('sheet', sheet.w, 'x', sheet.h)
// live view must be intact after export (same size, still renders)
console.log('live size after export', JSON.stringify(await page.evaluate(() => { const c = document.querySelector('canvas'); return [c.width, c.height, c.clientWidth, c.clientHeight] })))
await page.screenshot({ path: 'shots/export-live-after.png' })
await ctx.close(); await b.close()
