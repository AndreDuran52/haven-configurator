// Shapes B1 checks (plan §10 "Shapes", Andre 2026-10-26): the client's T
// (229 across, 110 stem, 44 deep) for both back options, built from the
// Projects home; labels, editing a half (Undo, touch seam drag, tap to switch),
// save and reload, the share link in a fresh browser, ?view, the PDF plan.
// Fresh browser contexts only. Screenshots light and dark at four sizes.
import { VIEWPORTS } from './browser.mjs'
import { pdfText } from './h6.mjs'
import { dimTexts, labelCheck, setField } from './lib.mjs'

const SHOTS = 'test-results'
const LAPTOP = { width: 1440, height: 900 }
const EXPECT = {
  shared: { top: '14" | 45½" | 110" | 45½" | 14"', stem: '78"', line: 'Each half 119½″. Stem 78″ wide. Seats 6.', halves: [119.5, 119.5] },
  two: { top: '14" | 40½" | 60" | 60" | 40½" | 14"', stem: '88"', line: 'Each half 114½″. Stem 88″ wide. Seats 6.', halves: [114.5, 114.5] },
}

const state = (page) => page.evaluate(() => {
  const s = window.__haven.getState()
  return { section: s.ui.section, W: s.layout.sections.map((x) => x.config.W), n: s.layout.sections.length, past: s.past.length, draft: s.draftLayout !== null }
})
const code = (page) => page.evaluate(() => window.__plan.encode())

/** A fresh context on the Projects home; builds the T from "T shape…". */
async function buildTee(browser, base, back, viewport = VIEWPORTS.ipadLandscape, scheme = 'light', sizes = null) {
  const context = await browser.newContext({ viewport, hasTouch: true, colorScheme: scheme })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByTestId('new-tee').click()
  await page.waitForSelector('[data-testid=tee-form]')
  if (back === 'two') await page.getByRole('radio', { name: 'Two backs' }).click()
  if (sizes) {
    await page.locator('[name=tee-total]').fill(String(sizes.total))
    await page.locator('[name=tee-stem]').fill(String(sizes.stem))
  }
  const line = await page.textContent('[data-testid=tee-line]')
  await page.getByTestId('tee-start').click()
  await page.waitForSelector('[data-plan-svg]')
  await page.waitForTimeout(200)
  return { context, page, errors, line }
}

/** The dimension row the top chain sits on (smallest y), left to right. */
const topChain = (page) =>
  page.$$eval('[data-dim-text]', (els) => {
    const t = els.map((e) => ({ s: e.textContent, r: e.getBoundingClientRect() })).filter((x) => x.r.width > x.r.height)
    const rows = [...new Set(t.map((x) => Math.round(x.r.top)))].sort((a, b) => a - b)
    return t.filter((x) => Math.round(x.r.top) === rows[1]).sort((a, b) => a.r.left - b.r.left).map((x) => x.s).join(' | ')
  })

export async function shapes(browser, base, check) {
  // 1. Both back options from the Projects home, at three sizes: the engine line, labels, no overlaps, no 3D.
  for (const back of ['shared', 'two']) {
    const want = EXPECT[back]
    for (const [vn, vp] of Object.entries(VIEWPORTS)) {
      const { context, page, errors, line } = await buildTee(browser, base, back, vp)
      if (vn === 'ipadLandscape') {
        check(line === want.line, `${back}: the form says "${line}"`)
        const s = await state(page)
        check(s.n === 2 && s.W.join('/') === want.halves.join('/'), `${back}: two halves of ${s.W.join(' and ')}`)
        const texts = await dimTexts(page)
        check((await topChain(page)) === want.top, `${back}: top chain ${await topChain(page)}`)
        check(texts.includes(`229" (19'-1")`) && texts.includes(`110" (9'-2")`) && texts.includes(want.stem), `${back}: 229" (19'-1"), stem 110" (9'-2"), stem width ${want.stem}`)
        check(texts.filter((t) => t === '44"D').length === 2, `${back}: 44"D at each wing end`)
        check((await page.textContent('[data-testid=seats]')) === 'Seats 6', `${back}: Seats 6`)
        check((await page.getByRole('radio', { name: '3D' }).count()) === 0, `${back}: no 3D for a T until B2`)
      }
      const lc = await labelCheck(page)
      check(lc.overlaps === 0 && lc.clipped === 0, `${back} at ${vn}: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped`)
      check(errors.length === 0, `${back} at ${vn}: no console errors ${errors.join('; ')}`)
      await context.close()
    }
  }

  // 2. Edit the right half: its width moves the total, Undo brings it back; a tap on the left half edits that one.
  {
    const { context, page } = await buildTee(browser, base, 'shared')
    await page.getByRole('radio', { name: 'Right half' }).click()
    await setField(page, 'W', 124.5)
    let s = await state(page)
    check(s.section === 'b' && s.W.join('/') === '119.5/124.5' && (await page.inputValue('#m-total')) === '234', `right half W 124½: total ${await page.inputValue('#m-total')}`)
    await page.getByRole('button', { name: 'Undo' }).click()
    s = await state(page)
    check(s.W.join('/') === '119.5/119.5', 'one Undo: both halves 119½ again')
    await setField(page, 'D', 40)
    s = await page.evaluate(() => window.__haven.getState().layout.sections.map((x) => x.config.D).join('/'))
    check(s === '40/40', `depth from the right half reaches both halves (${s})`)
    await page.getByRole('button', { name: 'Undo' }).click()
    // Tap the left wing's seat (inside the left half, away from any seam).
    const wing = await page.$eval('[data-section="a"] [data-piece]', (e) => {
      const r = e.getBoundingClientRect()
      return [r.left + r.width * 0.6, r.top + r.height * 0.6]
    })
    await page.mouse.click(wing[0], wing[1])
    await page.waitForTimeout(100)
    s = await state(page)
    check(s.section === 'a', `a tap on the left half edits it (section ${s.section})`)
    await context.close()
  }

  // 3. Touch seam drag in the right half: one undo step, the left half untouched.
  //    The client's halves are one piece per run (no seams); a 340 x 160 T has two seats on each back.
  {
    const { context, page } = await buildTee(browser, base, 'two', VIEWPORTS.ipadLandscape, 'light', { total: 340, stem: 160 })
    await page.getByRole('radio', { name: 'Right half' }).click()
    await page.waitForTimeout(100)
    const cdp = await context.newCDPSession(page)
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts })
    const grips = await page.$$eval('[data-grip]', (els) => els.map((e) => e.getAttribute('data-grip')))
    const sel = `[data-grip="${grips[0]}"] circle:nth-of-type(2)`
    const g = await page.$eval(sel, (e) => {
      const r = e.getBoundingClientRect()
      return [r.left + r.width / 2, r.top + r.height / 2]
    })
    const k = await page.evaluate(() => window.__plan.k())
    const vertical = grips[0].startsWith('left') || grips[0].startsWith('right')
    const before = await page.evaluate(() => JSON.stringify(window.__haven.getState().layout.sections[0].config.runs))
    const runsB = await page.evaluate(() => JSON.stringify(window.__haven.getState().layout.sections[1].config.runs))
    const d0 = (await state(page)).past
    await touch('touchStart', [{ x: g[0], y: g[1], id: 1 }])
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', [{ x: g[0] + (vertical ? 0 : (6 / k) * (i / 12)), y: g[1] + (vertical ? (6 / k) * (i / 12) : 0), id: 1 }])
      await page.waitForTimeout(20)
    }
    await touch('touchEnd', [])
    await page.waitForTimeout(120)
    const s = await state(page)
    const after = await page.evaluate(() => JSON.stringify(window.__haven.getState().layout.sections[0].config.runs))
    const runsB2 = await page.evaluate(() => JSON.stringify(window.__haven.getState().layout.sections[1].config.runs))
    check(grips.length > 0, `the right half's seams: ${grips.join(', ')}`)
    check(grips.length > 0 && runsB2 !== runsB && s.past === d0 + 1 && !s.draft, `touch seam drag on ${grips[0]} in the right half: one undo step`)
    check(after === before, 'the left half is untouched by the drag')
    await context.close()
  }

  // 4. Save, reload (the open project is kept), the share link in a fresh browser, ?view, the PDF.
  {
    const { context, page } = await buildTee(browser, base, 'shared')
    const c = await code(page)
    check(c.startsWith('3') && c.includes('_P'), `the share code is a v3 layout (${c})`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByTestId('save-name').fill('Rubin T')
    await page.getByTestId('save-confirm').click()
    await page.waitForTimeout(150)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check((await code(page)) === c && (await state(page)).n === 2, 'after a reload the T is still open, both halves')
    await page.getByTestId('projects').click()
    await page.waitForSelector('[data-testid=projects-home]')
    check((await page.locator('[data-thumb] [data-piece]').count()) > 0 && (await page.textContent('[data-testid=projects-home]')).includes('Rubin T'), 'the Projects home lists "Rubin T" with its plan')
    await context.close()

    const fresh = await browser.newContext({ viewport: VIEWPORTS.ipadLandscape })
    const p2 = await fresh.newPage()
    await p2.goto(`${base}#c=${c}`, { waitUntil: 'networkidle' })
    await p2.waitForSelector('[data-plan-svg]')
    check((await code(p2)) === c && (await state(p2)).n === 2, 'the #c=3… link opens the same T in a fresh browser')
    await p2.goto(`${base}?view#c=${c}`, { waitUntil: 'networkidle' })
    await p2.reload({ waitUntil: 'networkidle' })
    await p2.waitForSelector('[data-testid=view-summary]')
    const summary = await p2.textContent('[data-testid=view-summary]')
    check(summary.includes('T, shared back') && summary.includes('Stem width78"') && summary.includes('6'), `?view summary: ${summary.slice(0, 120)}`)
    await p2.screenshot({ path: `${SHOTS}/shapes-view-shared.png` })
    await fresh.close()
  }

  // 5. The PDF: plan only, to scale, the T header, file name, the whole link printed.
  for (const back of ['shared', 'two']) {
    const { context, page } = await buildTee(browser, base, back)
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    const boxes = await page.locator('[data-testid=sheet-views] input').count()
    check(boxes === 1, `${back}: the sheet offers the plan only (${boxes} choice)`)
    await page.getByTestId('make-pdf').click()
    await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
    const path = `${SHOTS}/shapes-${back}.pdf`
    await dl.saveAs(path)
    const t = await pdfText(path)
    const file = dl.suggestedFilename()
    check(/^Haven-T-229x110-\d{4}-\d\d-\d\d\.pdf$/.test(file), `${back}: file name ${file}`)
    // pdf.js reads the header's double spaces as one.
    const header = t.items.find((i) => i.str.startsWith('T shape'))?.str.replace(/\s+/g, ' ')
    check(header === `T shape, ${back === 'shared' ? 'shared back' : 'two backs'} · 229" W x 110" stem · 44" deep · 19'-1" wide`, `${back}: header "${header}"`)
    check(t.items.some((i) => i.str.startsWith('SCALE 3/8')), `${back}: plan at 3/8" = 1'-0"`)
    const strs = t.items.map((i) => i.str)
    check(strs.includes(`229" (19'-1")`) && strs.includes(`110" (9'-2")`) && strs.includes(EXPECT[back].stem), `${back}: overall, stem and stem width printed`)
    const plan = t.items.filter((i) => i.y > 84 && i.y < 540)
    check(plan.every((i) => i.x >= 28 && i.x + i.w <= 764), `${back}: every plan label inside the margins`)
    // The link lines: right of the footer's centre, under "Open this layout:".
    const printed = t.items.filter((i) => i.y > 560 && i.x > 450).sort((a, b) => a.y - b.y).map((i) => i.str).join('')
    check(printed.includes(`#c=${await code(page)}`), `${back}: the footer prints the whole link (${printed.length} chars)`)
    await context.close()
  }

  // 6. Screenshots: light and dark at iPad landscape/portrait, laptop and phone.
  for (const scheme of ['light', 'dark']) {
    for (const [vn, vp] of [...Object.entries(VIEWPORTS), ['laptop', LAPTOP]]) {
      const { context, page } = await buildTee(browser, base, 'shared', vp, scheme)
      await page.screenshot({ path: `${SHOTS}/shapes-${scheme}-${vn}.png` })
      await context.close()
    }
  }
}
