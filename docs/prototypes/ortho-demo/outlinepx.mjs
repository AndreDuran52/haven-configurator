import { launch, openPage, settle, VIEWPORTS } from './pw.mjs'
const b = await launch()
const { page, ctx } = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=front&ui=0&shadows=0')
// In the front elevation, measure the dark outline run length along a vertical scanline that
// crosses the table's top edge (walnut vs background) at two zooms.
const measure = async () => page.evaluate(async () => {
  const url = window.__haven.capture()
  const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = url })
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
  const g = c.getContext('2d'); g.drawImage(im, 0, 0)
  // scan the vertical line through the canvas centre (the U is symmetric; x=W/2 hits the armless back)
  const x = Math.round(im.width * 0.5)
  const d = g.getImageData(x, 0, 1, im.height).data
  const runs = []; let run = 0
  for (let y = 0; y < im.height; y++) { const lum = (d[y * 4] + d[y * 4 + 1] + d[y * 4 + 2]) / 3; if (lum < 110) run++; else if (run) { runs.push(run); run = 0 } }
  return { zoom: window.__haven.state().zoom, darkRuns: runs.slice(0, 8) }
})
console.log('fit   ', JSON.stringify(await measure()))
await page.evaluate(() => window.__haven.zoomTo(20)); await page.waitForTimeout(300)
console.log('zoom20', JSON.stringify(await measure()))
await page.screenshot({ path: 'shots/outline-zoom20-front.png', clip: { x: 440, y: 200, width: 300, height: 420 } })
await ctx.close(); await b.close()
