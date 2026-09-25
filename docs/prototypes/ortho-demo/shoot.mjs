// Screenshot every preset at every target viewport. Presets are applied through the UI's
// test hook with animate=true, then we wait for camera-controls' "rest" before shooting.
import { launch, openPage, settle, VIEWPORTS } from './pw.mjs'
const presets = (process.env.PRESETS ?? 'iso,dimetric,trimetric,front,side,top').split(',')
const style = process.env.STYLE ?? 'outline'
const tag = process.env.TAG ?? ''
const vps = (process.env.VPS ?? 'ipadLandscape,ipadPortrait,phone').split(',')
const b = await launch()
const report = []
for (const vp of vps) {
  const { page, ctx, messages } = await openPage(b, VIEWPORTS[vp], `preset=top&style=${style}`)
  for (const p of presets) {
    await page.evaluate((p) => window.__haven.apply(p, true), p)
    await page.waitForTimeout(100)
    await settle(page)
    const s = await page.evaluate(() => window.__haven.state())
    const f = await page.evaluate((p) => window.__haven.fit(p), p)
    const path = `shots/${vp}-${p}${tag ? '-' + tag : ''}.png`
    await page.screenshot({ path })
    report.push({ vp, p, zoom: +s.zoom.toFixed(3), fitZoom: +f.zoom.toFixed(3), az: +s.azimuthDeg.toFixed(2), polar: +s.polarDeg.toFixed(2), size: s.size, path })
  }
  const errs = messages.filter((m) => /error|warn/i.test(m))
  if (errs.length) console.log(vp, errs.join('\n'))
  await ctx.close()
}
console.table(report)
await b.close()
