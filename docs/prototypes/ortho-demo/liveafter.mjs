import { launch, openPage, VIEWPORTS } from './pw.mjs'
const b = await launch()
const { page, ctx } = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=trimetric&ui=0')
const r = await page.evaluate(async () => {
  const load = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = u })
  const px = async (u) => { const im = await load(u); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data }
  const a = await px(window.__haven.capture())
  window.__haven.exportView('side', 4, { floor: false })
  await window.__haven.exportSheet(4)
  const b2 = await px(window.__haven.capture())
  let diff = 0, maxd = 0
  for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]); if (d > 6) diff++; maxd = Math.max(maxd, d) }
  return { changedPixels: diff, maxDelta: maxd }
})
console.log('live view before vs after exports:', JSON.stringify(r))
// shadow on vs off at the same view (how visible is it?)
await ctx.close()
const s1 = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=trimetric&ui=0&shadows=1'); await s1.page.screenshot({ path: 'shots/shadow-on-trimetric.png', clip: { x: 20, y: 350, width: 320, height: 220 } }); await s1.ctx.close()
const s0 = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=trimetric&ui=0&shadows=0'); await s0.page.screenshot({ path: 'shots/shadow-off-trimetric.png', clip: { x: 20, y: 350, width: 320, height: 220 } }); await s0.ctx.close()
await b.close()
