// Plan parity: the ortho TOP view at zoom S must land every plan point on the SVG plan drawn at
// S px/in — independent of height (that is the orthographic property).
import { launch, openPage, VIEWPORTS } from './pw.mjs'
const cases = [
  { S: 4.25, cx: 94, cy: 66, vp: VIEWPORTS.ipadLandscape },
  { S: 5.5, cx: 80, cy: 50, vp: VIEWPORTS.ipadPortrait },
  { S: 1.83, cx: 94, cy: 66, vp: VIEWPORTS.phone },
]
const b = await launch()
for (const { S, cx, cy, vp } of cases) {
  for (const mode of ['outline', 'fill']) {
    const style = mode === 'fill' ? 'silhouette' : 'outline'
    const { page, ctx } = await openPage(b, vp, `preset=top&ui=0&shadows=0&style=${style}&parity=${S},${cx},${cy},${mode}`)
    await page.evaluate(([S, cx, cy]) => window.__haven.setTopAt(S, cx, cy), [S, cx, cy])
    await page.waitForTimeout(300)
    if (mode === 'outline') {
      const r = await page.evaluate(() => {
        const svg = document.getElementById('plan-overlay')
        const host = document.getElementById('view3d').getBoundingClientRect()
        const [ox, , oz] = window.__haven.offset
        let maxErr = 0, maxHeightShift = 0, n = 0
        for (const poly of svg.querySelectorAll('polygon')) {
          const m = poly.getScreenCTM()
          for (const pt of poly.points) {
            const s = pt.matrixTransform(m)
            const svgXY = [s.x - host.left, s.y - host.top]
            const [a, b2] = window.__haven.project([[pt.x + ox, 0, pt.y + oz], [pt.x + ox, 27, pt.y + oz]])
            maxErr = Math.max(maxErr, Math.hypot(a[0] - svgXY[0], a[1] - svgXY[1]))
            maxHeightShift = Math.max(maxHeightShift, Math.hypot(a[0] - b2[0], a[1] - b2[1]))
            n++
          }
        }
        return { n, maxErr, maxHeightShift, zoom: window.__haven.state().zoom }
      })
      console.log(`S=${S} centre=(${cx},${cy}) ${vp.width}x${vp.height}: ${r.n} vertices, max |3D−SVG| = ${r.maxErr.toExponential(2)} px, max shift floor→27" = ${r.maxHeightShift.toExponential(2)} px, camera.zoom=${r.zoom}`)
      await page.screenshot({ path: `shots/parity-overlay-${vp.width}x${vp.height}.png` })
    } else {
      const r = await page.evaluate(async () => {
        const glUrl = window.__haven.capture()
        const svg = document.getElementById('plan-overlay')
        const W = svg.width.baseVal.value, H = svg.height.baseVal.value
        const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
        const load = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = u })
        const [gi, si] = await Promise.all([load(glUrl), load(svgUrl)])
        const mask = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data; const m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = d[i * 4] < 128 ? 1 : 0; return m }
        const a = mask(gi), bm = mask(si)
        let inter = 0, uni = 0, xor = 0, areaA = 0, areaB = 0
        for (let i = 0; i < a.length; i++) { inter += a[i] & bm[i]; uni += a[i] | bm[i]; xor += a[i] ^ bm[i]; areaA += a[i]; areaB += bm[i] }
        return { W, H, iou: inter / uni, xor, areaA, areaB }
      })
      const perimIn = 188 + 132 + 44 + 72 + 16 * Math.SQRT2 + 68 + 16 * Math.SQRT2 + 72 + 44 + 132 // union outline of the Standard U
      const expectedArea = (188 * 44 + 2 * 44 * 88 + 2 * (16 * 16) / 2) * S * S // back run + legs + the two wedge triangles = 16272 in²
      console.log(`   pixel: IoU=${r.iou.toFixed(5)}  XOR=${r.xor}px  = ${(r.xor / (perimIn * S)).toFixed(3)} px mean edge offset;  area 3D=${r.areaA} SVG=${r.areaB} analytic=${Math.round(expectedArea)}`)
    }
    await ctx.close()
  }
}
await b.close()
