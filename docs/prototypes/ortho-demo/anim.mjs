import { launch, openPage, settle, VIEWPORTS } from './pw.mjs'
const b = await launch()
const { page, ctx } = await openPage(b, VIEWPORTS.ipadLandscape, 'preset=top&ui=0')

// 1) demand mode: no frames while idle
const f0 = await page.evaluate(() => window.__haven.state().frames)
await page.waitForTimeout(2500)
const f1 = await page.evaluate(() => window.__haven.state().frames)
console.log(`idle 2.5s: frames ${f0} -> ${f1} (${f1 - f0} rendered while idle)`)

async function transition(to, clamp) {
  await page.evaluate((c) => window.__haven.setClamp(c), clamp)
  await page.waitForTimeout(2500) // go idle so the next frame's raw delta is ~2.5 s
  return page.evaluate((to) => new Promise((res) => {
    const out = []
    const s0 = window.__haven.state()
    window.__haven.apply(to, true)
    const t0 = performance.now()
    const tick = () => {
      const s = window.__haven.state()
      out.push({ t: Math.round(performance.now() - t0), f: s.frames - s0.frames, polar: +s.polarDeg.toFixed(2), az: +s.azimuthDeg.toFixed(2), zoom: +s.zoom.toFixed(3) })
      if (out.length < 400 && !(s.resting && out.length > 3)) requestAnimationFrame(tick)
      else res({ from: { polar: +s0.polarDeg.toFixed(2), zoom: +s0.zoom.toFixed(3) }, samples: out })
    }
    requestAnimationFrame(tick)
  }), to)
}
for (const [to, clamp] of [['trimetric', true], ['top', true], ['trimetric', false], ['top', false]]) {
  const r = await transition(to, clamp)
  const s = r.samples
  const distinctFrames = new Set(s.map((x) => x.f)).size
  const firstMoved = s.find((x) => x.polar !== r.from.polar)
  const end = s[s.length - 1]
  const frac = firstMoved ? (firstMoved.polar - r.from.polar) / (end.polar - r.from.polar) : NaN
  console.log(`${to.padEnd(9)} clamp=${clamp}: ${distinctFrames} distinct camera frames, ${end.t} ms to sleep; first moved frame covered ${(frac * 100).toFixed(1)}% of the polar change; end polar=${end.polar} az=${end.az} zoom=${end.zoom}`)
  console.log('   first samples:', JSON.stringify(s.slice(0, 5)))
}
await page.evaluate(() => window.__haven.setClamp(true))
await ctx.close(); await b.close()
