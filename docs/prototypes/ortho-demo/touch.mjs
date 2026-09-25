import { launch, settle } from './pw.mjs'
const BASE = 'http://127.0.0.1:5199/'
const b = await launch()
const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto(BASE + '?preset=trimetric')
await page.waitForFunction(() => !!window.__haven)
await settle(page)
const cdp = await ctx.newCDPSession(page)
const pinch = async (cx, cy, d0, d1, steps = 12) => {
  const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) })
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + ((d1 - d0) * i) / steps) }); await page.waitForTimeout(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
}
const snap = () => page.evaluate(() => ({ pageScale: +visualViewport.scale.toFixed(3), zoom: +window.__haven.state().zoom.toFixed(3), autoFit: window.__haven.autoFit(), maxZoom: window.__haven.state().maxZoom, minZoom: +window.__haven.state().minZoom.toFixed(3) }))
console.log('start            ', JSON.stringify(await snap()))
await pinch(410, 600, 100, 300)
await settle(page)
console.log('pinch-out canvas ', JSON.stringify(await snap()))
for (let i = 0; i < 3; i++) await pinch(410, 600, 60, 700, 6)
await settle(page)
console.log('huge pinch-outs  ', JSON.stringify(await snap()), '(clamped to maxZoom?)')
for (let i = 0; i < 5; i++) await pinch(410, 600, 700, 60, 6)
await settle(page)
console.log('huge pinch-ins   ', JSON.stringify(await snap()), '(clamped to minZoom?)')
// one-finger drag = orbit; check polar stays within [0, 90]
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 500, id: 1 }] })
for (let i = 1; i <= 20; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 400, y: 500 - i * 30, id: 1 }] }); await page.waitForTimeout(16) }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await settle(page)
console.log('drag up (orbit)  polar=', (await page.evaluate(() => window.__haven.state().polarDeg)).toFixed(2), '(maxPolar 90 -> should stop at the horizon)')
// control experiment: the same pinch on the toolbar (touch-action auto) should zoom the PAGE
await pinch(410, 30, 100, 300)
await page.waitForTimeout(500)
console.log('pinch on toolbar ', JSON.stringify(await snap()), '(control: page scale should change here)')
await ctx.close(); await b.close()
