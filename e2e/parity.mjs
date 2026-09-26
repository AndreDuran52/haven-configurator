// Top-view parity (V2): the 3D Top silhouette at the plan's exact scale and
// centre against the plan's own polygons, as IoU of two pixel masks.

/** Read in the Plan view: every piece outline and the plan's scale/centre. */
export async function planShapes(page) {
  const polys = await page.$$eval('[data-plan-svg] [data-piece] > polygon:first-child', (els) => els.map((e) => e.getAttribute('points')))
  const fit = await page.evaluate(() => window.__haven.getState().ui.planFit)
  return { polys, fit }
}

/** Run in the 3D view (window.__haven3d present). */
export function topParityIoU(page, { polys, fit }) {
  return page.evaluate(
    async ({ fit, polys }) => {
      const api = window.__haven3d
      api.setTopAt(fit.S, fit.cx, fit.cy)
      const [w, h] = api.state().size
      const img = new Image()
      img.src = api.capture({ silhouette: true })
      await img.decode()
      const mask = (draw) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')
        g.fillStyle = '#fff'
        g.fillRect(0, 0, w, h)
        draw(g)
        const d = g.getImageData(0, 0, w, h).data
        const m = new Uint8Array(w * h)
        for (let i = 0; i < m.length; i++) m[i] = d[i * 4] < 128 ? 1 : 0
        return m
      }
      const a = mask((g) => g.drawImage(img, 0, 0, w, h))
      const b = mask((g) => {
        g.fillStyle = '#000'
        for (const p of polys) {
          const pts = p.split(' ').map((s) => s.split(',').map(Number))
          g.beginPath()
          pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - fit.cx) * fit.S + w / 2, (y - fit.cy) * fit.S + h / 2))
          g.closePath()
          g.fill()
        }
      })
      let inter = 0
      let uni = 0
      for (let i = 0; i < a.length; i++) {
        inter += a[i] & b[i]
        uni += a[i] | b[i]
      }
      return inter / uni
    },
    { fit, polys },
  )
}
