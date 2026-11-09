// Seat markers (Andre, 2026-11-09): one seat number everywhere. Markers are
// off when a layout opens; switched on in the View menu they number every seat
// the count gives, in the plan and 3D Top, always as many as the top bar says.
// Snug travels with the layout (link v6: a fresh browser opening it says
// "· snug" too); a non-standard seat width says so; the PDF prints the same
// label, and its plan has the markers when they're on. Judged by outcome.
import { pdfText } from './h6.mjs'
import { config, setField, viewMenu } from './lib.mjs'
import { shot, smallText } from './phase3.mjs'

const LAPTOP = { width: 1440, height: 900 }
const U = '1UW188L132R132D44_bt32s36_la72_ra72.wh'

async function fresh(browser, base, path) {
  const context = await browser.newContext({ viewport: LAPTOP })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-plan-svg]')
  await page.waitForTimeout(150)
  return { context, page, errors }
}
const code = (page) => page.evaluate(() => window.__plan.encode())
const topBar = (page) => page.textContent('[data-testid=seats]')
const number = (label) => Number(/^Seats (\d+)/.exec(label)?.[1] ?? NaN)
const planMarkers = (page) => page.$$eval('[data-plan-svg] [data-marker]', (els) => els.map((e) => Number(e.getAttribute('data-marker'))))
const toggle = async (page, id) => {
  await viewMenu(page)
  await page.getByTestId(id).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
}

export async function seats(browser, base, check) {
  // 1. Off by default; on: one marker per seat, numbered 1..N, N = the top bar.
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    check((await planMarkers(page)).length === 0 && (await topBar(page)) === 'Seats 7', 'markers are off when a layout opens; the top bar reads one number: "Seats 7"')
    await viewMenu(page)
    const seating = await page.textContent('[data-testid=seating]')
    check(seating.includes('Seat markers') && seating.includes('Snug (24″ seats)') && seating.includes('28″ seats'), `the View menu's Seating: markers, Snug, seat width (${seating})`)
    const small = await smallText(page)
    check(small.length === 0, `no text under 14 px with the menu open (${small.join('; ')})`)
    await page.keyboard.press('Escape')
    await toggle(page, 'markers')
    await page.waitForSelector('[data-plan-svg] [data-marker]')
    const m = await planMarkers(page)
    check(m.length === 7 && m.join() === '1,2,3,4,5,6,7', `7 markers, numbered 1–7 (${m.join()})`)
    await page.mouse.click(5, 300)
    await shot(browser, page, 'seats-plan-1440')
    // Snug: one number, saved with the layout (link v6); markers follow; Undo goes back.
    const d = await page.evaluate(() => window.__haven.getState().past.length)
    await setField(page, 'D', 36) // the back seat stretch 52: 1 at 28″, 2 at 24″
    check((await topBar(page)) === 'Seats 7', 'D 36: "Seats 7" comfortable')
    await toggle(page, 'snug')
    const snug = await topBar(page)
    check(snug === 'Seats 8 · snug' && (await planMarkers(page)).length === 8, `Snug: "${snug}", 8 markers`)
    const link = await code(page)
    check(/^6.*_N\.[0-9a-z]{2}$/.test(link), `the link carries Snug (v6, ${link})`)
    check((await page.evaluate(() => window.__haven.getState().past.length)) === d + 2, 'Snug is one undo step')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await topBar(page)) === 'Seats 7' && !(await code(page)).startsWith('6'), 'Undo: comfortable again, the older link')
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    // A seat width that isn't the standard one says so.
    await toggle(page, 'snug')
    await viewMenu(page)
    for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Seat width minus 1' }).click()
    await page.keyboard.press('Escape')
    const w21 = await topBar(page)
    check((await config(page)).seatWidth === 21 && /^Seats \d+ · 21″ seats$/.test(w21) && (await planMarkers(page)).length === number(w21), `21″ seats: "${w21}", as many markers`)
    // 3D Top: the same markers; Overview: none.
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    await page.locator('[data-preset=top]').click()
    await page.waitForFunction(() => window.__haven3d?.state().resting, null, { timeout: 30000, polling: 100 })
    await page.waitForTimeout(300)
    const m3 = await page.$$eval('[data-testid=seat-markers-3d] [data-marker]', (els) => els.length)
    check(m3 === number(await topBar(page)), `3D Top: ${m3} markers = the top bar`)
    await shot(browser, page, 'seats-3d-top-1440')
    await page.locator('[data-preset=threeQuarter]').click()
    await page.waitForTimeout(300)
    check((await page.$$('[data-testid=seat-markers-3d]')).length === 0, 'Overview: no markers (they are for the Top view)')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. A snug link in a fresh browser; the PDF prints the same label and the markers.
  {
    const { context, page } = await fresh(browser, base, `#c=${U}`)
    await setField(page, 'D', 36)
    await toggle(page, 'snug')
    const link = await code(page)
    await context.close()
    const { context: c2, page: p2, errors } = await fresh(browser, base, `#c=${link}`)
    check((await topBar(p2)) === 'Seats 8 · snug' && (await code(p2)) === link, 'a fresh browser opening the snug link reads "Seats 8 · snug" and keeps the link')
    await toggle(p2, 'markers')
    await p2.waitForSelector('[data-plan-svg] [data-marker]')
    await p2.getByTestId('share').click()
    await p2.waitForSelector('[data-testid=sheet-views]')
    await p2.getByTestId('make-pdf').click()
    await p2.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const [dl] = await Promise.all([p2.waitForEvent('download'), p2.getByTestId('download-pdf').click()])
    const path = 'test-results/seats.pdf'
    await dl.saveAs(path)
    const pdf = await pdfText(path)
    const footer = pdf.items.find((i) => i.str.includes('Seats'))?.str ?? ''
    check(footer.includes('Seats 8 · snug'), `the PDF says "${footer.trim()}"`)
    const nums = new Set(pdf.items.map((i) => i.str.trim()).filter((s) => /^[1-8]$/.test(s)))
    check(nums.size === 8, `the PDF plan has the 8 numbered markers (${[...nums].sort().join(',')})`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await c2.close()
  }
}
