// H2 done-when checks (plan §10), judged by outcome in the DOM.
import { mkdirSync } from 'node:fs'
import { enterEditor, VIEWPORTS } from './browser.mjs'
import { config, dimTexts, labelCheck, openApp, seats, setField, slide, warnings } from './lib.mjs'

const SHOTS = 'test-results'

export async function h2(browser, base, check) {
  // 1. `/` opens the Projects home (H6b), never the draft by itself; "Standard U" opens the Standard U.
  {
    const { context, page } = await openApp(browser, base)
    await page.evaluate(() => localStorage.setItem('haven:draft', JSON.stringify({ code: '1UW300L132R132D44_bt32s74~s74_la72_ra72.fh', savedAt: 1 })))
    await page.reload()
    await page.waitForSelector('[data-testid=projects-home]')
    check(await page.getByTestId('continue').isVisible(), 'a reload opens the Projects home, offering "Continue last layout"')
    await page.waitForTimeout(400)
    check(!page.url().includes('#'), `the home has no layout in the URL (${page.url()})`)
    await page.getByTestId('new-standardU').click()
    await page.waitForSelector('[data-plan-svg]')
    const t = await dimTexts(page)
    check(t.slice(0, 5).join(' | ') === `60" | 32" | 36" | 60" | 188" (15'-8")`, `Standard U: back chain 60 | 32 | 36 | 60, overall 188" (got ${t.slice(0, 5).join(' | ')})`)
    check(t.filter((x) => x === '58"').length === 2 && t.filter((x) => x === '14"').length === 2 && !t.includes('72"') && t.includes('44"D'), 'legs one-arm 72 read seat 58 | arm 14 (Andre, 2026-09-28), 44"D')
    check((await seats(page)) === 'Seats 7', 'Seats 7')
    await context.close()
  }

  // 2. D = 36: back 52, legs 80, Seats 7–8 (test 2).
  {
    const { context, page } = await openApp(browser, base)
    await setField(page, 'D', 36)
    const t = await dimTexts(page)
    check(t.includes('52"') && t.filter((x) => x === '66"').length === 2 && (await seats(page)) === 'Seats 7–8', 'D = 36: back 52, legs 80 (seat 66 | arm 14), Seats 7–8')
    await context.close()
  }

  // 3. The slider at 55: legs 77, back 46 (test 6).
  {
    const { context, page } = await openApp(browser, base)
    await slide(page, 'ArrowLeft', 5)
    const t = await dimTexts(page)
    check(t.filter((x) => x === '63"').length === 2 && t.includes('46"'), 'slider at 55: legs 77 (seat 63 | arm 14), back 46')
    check((await config(page)).wedgeC === 55, 'wedge C stored as 55 (manual)')
    await context.close()
  }

  // 4. W = 300: 74 | 74 (test 5). 5. W = 140: "min 158″" and reverts.
  {
    const { context, page } = await openApp(browser, base)
    await setField(page, 'W', 300)
    check((await dimTexts(page)).filter((x) => x === '74"').length === 2, 'W = 300: back 74 | 74')
    await setField(page, 'W', 140)
    const err = await page.textContent('[data-error=W]')
    check(err === 'min 158″', `W = 140 shows "min 158″" (got ${err})`)
    check((await page.inputValue('#m-W')) === '300' && (await config(page)).W === 300, 'W = 140 reverts (field and layout)')
    await context.close()
  }

  // 6. Warnings, none blocking.
  {
    const { context, page } = await openApp(browser, base)
    await setField(page, 'D', 30)
    check((await warnings(page)).includes('Seat depth 12″ (under 16)'), 'D = 30: "Seat depth 12″ (under 16)" (to the back cushions, Andre 2026-09-27)')
    await setField(page, 'D', 44)
    await slide(page, 'ArrowLeft', 11) // 60 -> 49
    const chip = await page.textContent('[data-testid=wedge]')
    check(chip.includes('angled face 7.1″'), 'slider at 49: amber "angled face 7.1″"')
    await setField(page, 'L', 100)
    check((await warnings(page)).includes('Opening 56″ deep (under 60)'), 'L = 100: "Opening 56″ deep (under 60)"')
    await setField(page, 'W', 190)
    check((await config(page)).W === 190, 'warnings never block editing')
    await context.close()
  }

  // 6b. Arm width (Andre, 2026-09-28): 14 → 10 in half-inch steps; a one-piece leg keeps its
  // footprint, so it reads seat 62 | arm 10; one Undo brings it back.
  {
    const { context, page } = await openApp(browser, base)
    for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Arm width minus ½' }).click()
    const t = await dimTexts(page)
    const c = await config(page)
    check(c.dims.A === 10 && t.filter((x) => x === '10"').length === 2 && t.filter((x) => x === '62"').length === 2 && c.L === 132, `arm width 10: legs read 62 | 10, L holds 132 (A ${c.dims.A}, ${t.join(' ')})`)
    // Stepper presses coalesce into one undo step (like Seat width).
    await page.getByRole('button', { name: 'Undo' }).click()
    check((await config(page)).dims.A === 14, 'one Undo takes the arm width back to 14')
    await context.close()
  }

  // 7. Reset restores the Standard U; one Undo brings the edited layout back.
  {
    const { context, page } = await openApp(browser, base)
    await setField(page, 'D', 36)
    await setField(page, 'W', 300)
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click()
    const t = await dimTexts(page)
    check(t.slice(0, 4).join(' | ') === '60" | 32" | 36" | 60"', 'Reset restores the Standard U')
    await page.getByRole('button', { name: 'Undo' }).click()
    const c = await config(page)
    check(c.W === 300 && c.D === 36, 'one Undo brings the edited layout back')
    await context.close()
  }

  // 8. Blank U shows hatched "unfilled 68/72/72".
  {
    const { context, page } = await openApp(browser, base)
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.getByRole('button', { name: 'Start blank' }).click()
    await page.waitForSelector('[data-gap]')
    const labels = await page.$$eval('[data-gap] text', (els) => els.map((e) => e.textContent))
    const hatch = await page.$$eval('[data-gap] line', (els) => els.length)
    check(labels.join('/') === 'unfilled 68"/unfilled 72"/unfilled 72"' && hatch > 20, `Blank U: hatched unfilled 68/72/72 (${labels.join('/')}, ${hatch} hatch lines)`)
    await context.close()
  }

  // 9. Reload restores the layout from the hash; ?view survives a commit; storage throwing.
  {
    const { context, page } = await openApp(browser, base)
    await setField(page, 'W', 300)
    await page.waitForTimeout(400)
    check(page.url().includes('#c=1UW300'), 'commit writes the #c= hash')
    await page.reload()
    await page.waitForSelector('[data-plan-svg]')
    check((await dimTexts(page)).filter((x) => x === '74"').length === 2, 'reload restores the layout from the hash')
    await context.close()
  }
  {
    // ?view is read-only since H6: a commit there comes from a pasted link (hashchange).
    const { context, page } = await openApp(browser, base, '?view')
    await page.evaluate(() => (location.hash = '#c=1UW188L132R132D36_bt32s52_la80_ra80.pg'))
    await page.waitForTimeout(500)
    const u = new URL(page.url())
    check(u.search === '?view' && u.hash.includes('D36') && (await config(page)).D === 36, `?view survives a commit (${u.search}${u.hash.slice(0, 24)}…)`)
    await context.close()
  }
  {
    const blockStorage = () =>
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    const { context, page, errors } = await openApp(browser, base, '', undefined, blockStorage)
    await setField(page, 'W', 300)
    await page.waitForTimeout(1200) // past the 1 s draft write
    check((await config(page)).W === 300 && errors.length === 0, `localStorage throwing: loads and edits, no errors${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }

  // 10. Undo walks back each commit.
  {
    const { context, page } = await openApp(browser, base)
    await setField(page, 'W', 190)
    await setField(page, 'D', 40)
    await setField(page, 'L', 140)
    const seen = []
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Undo' }).click()
      const c = await config(page)
      seen.push(`${c.W}/${c.D}/${c.L}`)
    }
    check(seen.join(' ') === '190/40/132 190/44/132 188/44/132', `Undo walks back each commit (${seen.join(' → ')})`)
    check(await page.getByRole('button', { name: 'Undo' }).isDisabled(), 'Undo disabled at the start')
    await context.close()
  }

  // 11. Offline after one online load (service worker): / and /#c=… both render.
  {
    const { context, page } = await openApp(browser, base)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await enterEditor(page)
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
    await context.setOffline(true)
    await page.reload()
    // `/` is the Projects home (H6b), or the editor when the hash was already written.
    const home = await page.waitForSelector('[data-plan-svg], [data-testid=projects-home]', { timeout: 5000 }).then(() => true, () => false)
    const p2 = await context.newPage()
    await p2.goto(`${base}#c=1UW300L132R132D44_bt32s74~s74_la72_ra72.fh`)
    const link = await p2.waitForSelector('[data-plan-svg]', { timeout: 5000 }).then(() => true, () => false)
    const t = link ? await dimTexts(p2) : []
    check(controlled && home && link && t.filter((x) => x === '74"').length === 2, `offline: / and /#c=… render from the service worker (controlled ${controlled})`)
    await context.close()
  }

  // Screenshots at 3 viewports + label overlap / clip check (0 / 0).
  mkdirSync(SHOTS, { recursive: true })
  const layouts = { standardU: '', W300: '#c=1UW300L132R132D44_bt32s74~s74_la72_ra72.fh', blank: '#c=1UW188L132R132D44_bg68_lg72_rg72.ct', L: '#c=1rW120L132R100D44_ba60_ra40.wv' }
  for (const [vName, vp] of Object.entries(VIEWPORTS)) {
    for (const [lName, hash] of Object.entries(layouts)) {
      const { context, page } = await openApp(browser, base, hash, vp)
      const r = await labelCheck(page)
      check(r.overlaps === 0 && r.clipped === 0, `${vName} ${lName}: labels overlap ${r.overlaps} / clipped ${r.clipped} (of ${r.count})`)
      if (lName === 'standardU') await page.screenshot({ path: `${SHOTS}/h2-${vName}.png` })
      await context.close()
    }
  }
}
