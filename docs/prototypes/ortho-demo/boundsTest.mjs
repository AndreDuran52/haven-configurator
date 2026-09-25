import { launch } from './pw.mjs'
const b = await launch()
for (const c of ['cc', 'orbit']) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await page.goto(`http://127.0.0.1:5199/bounds.html?controls=${c}`)
  await page.waitForFunction(() => !!window.__b, null, { timeout: 20000 })
  await page.waitForTimeout(1200)
  const s0 = await page.evaluate(() => window.__b.state())
  await page.evaluate(() => window.__b.refit())
  await page.waitForTimeout(1500)
  const s1 = await page.evaluate(() => window.__b.state())
  console.log(`controls=${c}: initial ${JSON.stringify(s0)}\n   after bounds.to(...).fit(): ${JSON.stringify(s1)}\n   errors: ${JSON.stringify([...new Set(errs)].filter((e) => !/404/.test(e)))}`)
  await ctx.close()
}
await b.close()
