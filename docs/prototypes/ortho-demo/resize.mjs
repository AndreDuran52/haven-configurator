import { launch, openPage, settle, VIEWPORTS } from './pw.mjs'
const b = await launch()
const { page, ctx } = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=trimetric')
const st = () => page.evaluate(() => { const s = window.__haven.state(); const f = window.__haven.fit('trimetric'); return { size: s.size.join('x'), zoom: +s.zoom.toFixed(3), fitZoom: +f.zoom.toFixed(3), autoFit: window.__haven.autoFit() } })
const resizeTo = async (vp) => {
  await page.setViewportSize(vp)
  await page.waitForFunction(() => { const v = document.getElementById('view3d'); return window.__haven.state().size.join('x') === `${v.clientWidth}x${v.clientHeight}` }, null, { polling: 50 })
  await page.waitForTimeout(200); await settle(page)
}
console.log('landscape               ', JSON.stringify(await st()))
await resizeTo(VIEWPORTS.ipadPortrait)
console.log('rotate -> portrait      ', JSON.stringify(await st()), '(autoFit on: zoom should equal the new fit)')
await page.screenshot({ path: 'shots/resize-portrait-after-rotate.png' })
// simulate the user taking over: a real pinch fires 'controlstart' → autoFit=false
const cdp = await ctx.newCDPSession(page)
const pts = (d) => [{ x: 410 - d / 2, y: 600, id: 1 }, { x: 410 + d / 2, y: 600, id: 2 }]
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(100) })
for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(100 + i * 25) })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await settle(page)
const userZoom = (await st()).zoom
console.log('after user pinch        ', JSON.stringify(await st()))
await resizeTo(VIEWPORTS.ipadLandscape)
console.log('rotate -> landscape     ', JSON.stringify(await st()), `(autoFit off: zoom should stay ${userZoom})`)
await ctx.close(); await b.close()
