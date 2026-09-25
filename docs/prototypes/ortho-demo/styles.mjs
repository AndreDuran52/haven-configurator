import { launch, openPage, settle, VIEWPORTS } from './pw.mjs'
const b = await launch()
for (const style of ['soft', 'outline', 'edges']) {
  const { page, ctx } = await openPage(b, VIEWPORTS.ipadLandscape, `preset=trimetric&ui=0&style=${style}`)
  await page.screenshot({ path: `shots/style-${style}-trimetric.png` })
  // close-up: zoom 3x on the left arm/wedge area to judge line weight vs zoom
  await page.evaluate(() => { const s = window.__haven.state(); window.__haven.apply('trimetric', false) })
  await settle(page)
  const z0 = await page.evaluate(() => window.__haven.state().zoom)
  await page.evaluate((z) => { const c = window.__r3f; }, z0)
  await ctx.close()
}
await b.close()
