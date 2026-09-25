import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true })
const page = await (await browser.newContext({ viewport: { width: 1000, height: 800 } })).newPage()
await page.goto('file://' + process.cwd() + '/out/gallery.html')
const r = await page.evaluate(() => {
  const out = {}
  for (const fig of document.querySelectorAll('figure')) {
    const svg = fig.querySelector('svg'); const vb = svg.viewBox.baseVal
    let worst = 0
    for (const t of svg.querySelectorAll('text')) {
      const b = t.getBBox(); // user units, pre-transform
      const m = t.transform.baseVal.consolidate()?.matrix
      const corners = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y]) => m ? [m.a*x+m.c*y+m.e, m.b*x+m.d*y+m.f] : [x,y])
      for (const [x,y] of corners) {
        worst = Math.max(worst, vb.x - x, x - (vb.x+vb.width), vb.y - y, y - (vb.y+vb.height))
      }
    }
    out[fig.dataset.name] = +worst.toFixed(2)
  }
  return out
})
console.log(JSON.stringify(r))
await browser.close()
