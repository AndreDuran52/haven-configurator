// UX Phase 3c, keep my work (Andre, 2026-11-09). Switching shape converts the
// sofa in place with no prompt and the seats stay (U 188″ -> L left 142″;
// Straight 120″ -> U 212″ with 132″ legs); the result line says so and one Undo
// brings it back; switching back gives the same link. Copy left to right on a
// U. The Pieces tab's Tables: the ± grows a table from its middle (a hold is
// one undo step). Seats even around a table stay even when a side grows.
// Judged by outcome: the store, the link, the DOM.
import { config, panel, setField } from './lib.mjs'
import { shot, smallText } from './phase3.mjs'

const LAPTOP = { width: 1440, height: 900 }
const LAPTOP_SMALL = { width: 1280, height: 800 }
const U = '1UW188L132R132D44_bt32s36_la72_ra72.wh'

async function fresh(browser, base, path = '', viewport = LAPTOP) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForSelector(path ? '[data-plan-svg]' : '[data-testid=projects-home]')
  return { context, page, errors }
}
const code = (page) => page.evaluate(() => window.__plan.encode())
const undoDepth = (page) => page.evaluate(() => window.__haven.getState().past.length)
const result = (page) => page.waitForSelector('[data-testid=result-text]').then((e) => e.textContent())
const run = (c, r) => (c.runs[r] ?? []).map((p) => p.kind + p.length).join(' ')
const pick = async (page, name) => {
  await page.getByRole('radio', { name, exact: true }).click()
  await page.waitForTimeout(250)
}

export async function keep(browser, base, check) {
  // 1. U -> L left -> U: no prompt, the seats stay, the line says it, Undo, and back gives the same link.
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    const d = await undoDepth(page)
    await pick(page, 'L left')
    const l = await config(page)
    check((await page.getByTestId('shape-guard').count()) === 0 && l.shape === 'L-left' && l.W === 142, `U -> L left in place, no prompt: W ${l.W}`)
    check(run(l, 'back') === 'table32 oneArm50' && run(l, 'left') === 'oneArm72', `the seats stay: back ${run(l, 'back')}, left ${run(l, 'left')}`)
    const line = await result(page)
    check(line === 'U → L left · Width 188″ → 142″ · Seats 7 → 4', `the result line: "${line}"`)
    check((await undoDepth(page)) === d + 1, 'one undo step')
    await shot(browser, page, 'keep-l-left-1440')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await code(page)) === U, 'Undo: the U again, same link')
    await pick(page, 'L left')
    await pick(page, 'U')
    check((await code(page)) === U, 'L left -> U: the leg is copied back, the same link as before')
    await pick(page, 'L right')
    check(run(await config(page), 'back') === 'table32 armless36' && (await config(page)).W === 128, 'U -> L right: the table end stays a table end (W 128)')
    await pick(page, 'U')
    check((await code(page)) === U, 'L right -> U: the same link')
    await pick(page, 'L right')
    await pick(page, 'L left')
    check(run(await config(page), 'back') === 'armless36 table32', 'L right -> L left: a mirror (the back reverses)')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. Straight -> U: corners at the ends, 132″ legs; the Reset menu names the new shape.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByTestId('new-straight').click()
    await page.waitForSelector('[data-plan-svg]')
    await pick(page, 'U')
    const u = await config(page)
    check(u.shape === 'U' && u.W === 212 && u.L === 132 && u.R === 132 && run(u, 'back') === 'armless46 armless46', `Straight 120″ -> U: W ${u.W}, sides ${u.L} | ${u.R}, back ${run(u, 'back')}`)
    check(run(u, 'left') === 'oneArm72' && run(u, 'right') === 'oneArm72', 'standard legs: one 72″ one-arm seat each')
    check((await result(page)).startsWith('Straight → U · Width 120″ → 212″'), `the result line: "${await result(page)}"`)
    await pick(page, 'Straight')
    check(run(await config(page), 'back') === 'oneArm60 oneArm60' && (await config(page)).W === 120, 'U -> Straight: the straight sofa again')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3. Copy left to right / right to left on a U.
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    await setField(page, 'R', 120)
    const d = await undoDepth(page)
    await page.getByTestId('copy-left').click()
    await page.waitForTimeout(250)
    const c = await config(page)
    check(c.R === 132 && run(c, 'right') === run(c, 'left') && (await undoDepth(page)) === d + 1, `Copy left to right: right side ${c.R}″, ${run(c, 'right')}; one undo step`)
    const line = await result(page)
    check(line.startsWith('Copied the left side to the right · Right side 120″ → 132″'), `the result line: "${line}"`)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check((await config(page)).R === 120, 'Undo: the right side is 120″ again')
    await page.getByTestId('copy-right').click()
    await page.waitForTimeout(250)
    check((await config(page)).L === 120 && run(await config(page), 'left') === run(await config(page), 'right'), 'Copy right to left: the left side is 120″ too')
    await page.getByTestId('copy-right').click()
    await page.waitForTimeout(250)
    const toast = (await page.textContent('[data-testid=toast]').catch(() => '')) ?? ''
    check(toast.includes('already the same'), `the sides already match: "${toast.trim()}"`)
    const small = await smallText(page)
    check(small.length === 0, `Size tab: no text under 14 px (${small.join('; ')})`)
    await shot(browser, page, 'keep-size-1440')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 4. The Pieces tab's Tables: the ± grows the table from its middle; a hold is one undo step.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByTestId('new-straight').click()
    await page.waitForSelector('[data-plan-svg]')
    await panel(page, 'Pieces')
    await page.locator('[data-tray-item=table]').click()
    await page.waitForSelector('[data-testid=table-row]')
    const t = (await config(page)).runs.back.find((p) => p.kind === 'table')
    const row = page.locator(`[data-table="${t.id}"]`)
    check((await row.textContent()).includes('Table') && (await row.locator('[data-testid=table-row-seats]').textContent()) === 'Seats 30" | 30"', `Tables: "${await row.textContent()}"`)
    const d = await undoDepth(page)
    await row.getByRole('button', { name: 'Width minus 1' }).click()
    check(run(await config(page), 'back') === 'oneArm44.5 table31 oneArm44.5', `− 1″: half to each seat (${run(await config(page), 'back')})`)
    await page.waitForTimeout(900) // past the 800 ms that joins quick presses into one undo step
    const plus = row.getByRole('button', { name: 'Width plus 1' })
    const box = await plus.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(900)
    await page.mouse.up()
    await page.waitForTimeout(300)
    const c = await config(page)
    const [a, tb, b] = c.runs.back
    check(tb.length > 33 && a.length === b.length && c.W === 120, `holding +: table ${tb.length}″, seats ${a.length - 14} | ${b.length - 14}, width ${c.W}″`)
    check((await undoDepth(page)) === d + 2, 'the − and the hold: two undo steps')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    check(run(await config(page), 'back') === 'oneArm44.5 table31 oneArm44.5', 'one Undo takes the whole hold back')
    const small = await smallText(page)
    check(small.length === 0, `Pieces tab: no text under 14 px (${small.join('; ')})`)
    await shot(browser, page, 'keep-pieces-1440')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 5. Seats even around a table stay even when a side grows (they used to go to the end seat).
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`, LAPTOP_SMALL)
    await page.evaluate(() => {
      const s = window.__haven.getState()
      const c = structuredClone(s.config)
      const n = c.nextId
      c.runs.right = [
        { id: c.runs.right[0].id, kind: 'armless', length: 19 },
        { id: `p${n}`, kind: 'table', length: 20 },
        { id: `p${n + 1}`, kind: 'oneArm', length: 33, arm: 'end' },
      ]
      c.nextId = n + 2
      s.commit(c)
    })
    await setField(page, 'R', 142)
    check(run(await config(page), 'right') === 'armless24 table20 oneArm38', `Right side +10: seats 19 | 19 become 24 | 24 around the table (it used to give 19 | 29) (${run(await config(page), 'right')})`)
    await shot(browser, page, 'keep-even-1280')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }
}
