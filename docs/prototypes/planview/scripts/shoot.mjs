import { chromium } from 'playwright-core'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto('file://' + process.cwd() + '/out/gallery.html')
const names = process.argv.slice(2)
fs.mkdirSync('shots', { recursive: true })
for (const n of names) {
  const el = await page.$(`figure[data-name="${n}"]`)
  await el.screenshot({ path: `shots/${n}.png` })
}
// overlap audit: every pair of dimension text boxes (real rendered bboxes)
const audit = await page.evaluate(() => {
  const res = {}
  for (const fig of document.querySelectorAll('figure')) {
    const texts = [...fig.querySelectorAll('[data-dims] text, [data-seats] text, [data-gaps] text')].map((t) => t.getBoundingClientRect())
    let overlaps = 0
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j]
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps++
    }
    const minFont = Math.min(...[...fig.querySelectorAll('[data-dims] text')].map((t) => t.getBoundingClientRect().height))
    res[fig.dataset.name] = { overlaps, minTextBoxPx: +minFont.toFixed(1) }
  }
  return res
})
console.log(JSON.stringify(audit))
await browser.close()
