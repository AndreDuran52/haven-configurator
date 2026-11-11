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

  // 3. Mirror sides (Andre's fixes, Q71): off by default; on with different sides copies the left to the right;
  //    while on, a change to one side is made to the other (one undo step); a new layout opens with it off.
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    const sw = page.getByRole('switch', { name: 'Mirror sides' })
    await sw.waitFor()
    check((await sw.getAttribute('aria-checked')) === 'false', 'Mirror sides is off when a layout opens')
    await setField(page, 'R', 120)
    const d = await undoDepth(page)
    await sw.click()
    await page.waitForTimeout(250)
    let c = await config(page)
    check((await sw.getAttribute('aria-checked')) === 'true' && c.R === 132 && run(c, 'right') === run(c, 'left') && (await undoDepth(page)) === d + 1, `on with different sides: the left is copied to the right (R ${c.R}, ${run(c, 'right')}); one undo step`)
    const line = await result(page)
    check(line.startsWith('Left side copied to the right · Right side 120″ → 132″'), `the result line: "${line}"`)
    await setField(page, 'L', 140)
    c = await config(page)
    check(c.L === 140 && c.R === 140 && run(c, 'right') === run(c, 'left'), `Left side 140: both sides 140 (${run(c, 'left')} | ${run(c, 'right')})`)
    check((await result(page)).startsWith('Sides 132″ → 140″'), `the result line: "${await result(page)}"`)
    await panel(page, 'Pieces')
    await page.evaluate(() => window.__haven.getState().setUi({ selectedId: null }))
    const d2 = await undoDepth(page)
    // A table at the left corner seam (as the tray drops one): the right side gets one too.
    await page.evaluate(() => {
      const s = window.__haven.getState()
      const c = structuredClone(s.config)
      const n = c.nextId
      c.runs.left = [{ id: `p${n}`, kind: 'table', length: 32 }, { ...c.runs.left[0], length: c.runs.left[0].length - 32 }]
      c.nextId = n + 1
      s.commit(c)
    })
    c = await config(page)
    check(run(c, 'left') === 'table32 oneArm48' && run(c, 'right') === run(c, 'left') && (await undoDepth(page)) === d2 + 1, `a table on the left: the right gets one too (${run(c, 'left')} | ${run(c, 'right')})`)
    await panel(page, 'Size')
    await sw.click()
    await page.waitForTimeout(150)
    await setField(page, 'R', 150)
    c = await config(page)
    check((await sw.getAttribute('aria-checked')) === 'false' && c.L === 140 && c.R === 150, 'switched off: the sides edit separately again')
    const small = await smallText(page)
    check(small.length === 0, `Size tab: no text under 14 px (${small.join('; ')})`)
    await sw.click()
    await page.waitForTimeout(250)
    await shot(browser, page, 'keep-size-1440')
    await page.evaluate((u) => (location.hash = `#c=${u}`), U)
    await page.waitForTimeout(400)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check((await page.getByRole('switch', { name: 'Mirror sides' }).getAttribute('aria-checked')) === 'false', 'a reload opens with Mirror sides off')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 3b. A table at the end of a side takes the arm's place (Q72); a long seat offers its middle (Q73).
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    await panel(page, 'Pieces')
    // Drag the tray's Table past the end of the right side: seat | table, no arm between.
    /** Drag the tray's Table to a client point. */
    const dragTable = async (to) => {
      const chip = await page.locator('[data-tray-item=table]').boundingBox()
      const from = [chip.x + chip.width / 2, chip.y + chip.height / 2]
      await page.mouse.move(...from)
      await page.mouse.down()
      for (let i = 1; i <= 16; i++) await page.mouse.move(from[0] + ((to[0] - from[0]) * i) / 16, from[1] + ((to[1] - from[1]) * i) / 16)
      await page.mouse.up()
      await page.waitForTimeout(250)
    }
    const box = (id) => page.$eval(`[data-piece="${id}"]`, (e) => e.getBoundingClientRect().toJSON())
    // Past the end of the right side: seat | table, no arm between.
    const rb = await box((await config(page)).runs.right[0].id)
    await dragTable([rb.left + rb.width / 2, rb.bottom - 8])
    let c = await config(page)
    check(run(c, 'right') === 'armless40 table32', `a table dropped at the end of the right side takes the arm's place: seat | table (${run(c, 'right')})`)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    // The left side does the same (Andre saw the two sides differ: one kept its arm).
    const lb0 = await box((await config(page)).runs.left[0].id)
    await dragTable([lb0.left + lb0.width / 2, lb0.bottom - 8])
    c = await config(page)
    check(run(c, 'left') === 'armless40 table32' && c.L === 132 && c.W === 188, `…and at the end of the left side: seat | table, the sofa's size kept (${run(c, 'left')}, L ${c.L}, W ${c.W})`)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    // A 164″ side (a 90″ seat): its middle is offered; the halves stay 29″.
    await panel(page, 'Size')
    await setField(page, 'L', 164)
    await panel(page, 'Pieces')
    const lb = await box((await config(page)).runs.left[0].id)
    await dragTable([lb.left + lb.width / 2, lb.top + (lb.height - 14 * (lb.height / 104)) / 2])
    c = await config(page)
    check(run(c, 'left') === 'armless29 table32 oneArm43', `a table dropped on the middle of the 90″ seat: 29 | 32 | 29 (${run(c, 'left')})`)
    await shot(browser, page, 'keep-tables-1440')
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

  // 6. Round 2 (Andre, 2026-11-09): the room plan has no line across the floor (Q74); inside the U on the plan,
  //    the Size tab and the PDF (Q75); 23″ seats count and get markers (Q76); no touching tables; a sofa
  //    against a wall is not a walkway.
  {
    const { context, page, errors } = await fresh(browser, base)
    await page.getByTestId('new-standardU').click()
    await page.waitForSelector('[data-plan-svg]')
    await page.getByRole('switch', { name: 'Mirror sides' }).click()
    await setField(page, 'L', 173)
    await panel(page, 'Room')
    await setField(page, 'roomW', 266)
    await setField(page, 'roomD', 276)
    await page.waitForTimeout(250)
    // Every dimension line inside the room lies on the sofa (the inside-U lines); none on the floor around it.
    const floor = await page.evaluate(() => {
      const r = document.querySelector('[data-room] rect')
      const room = { x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height') }
      const c = window.__haven.getState().config
      const sofa = { x: 0, y: 0, w: c.W, h: Math.max(c.L, c.R) }
      const inRoom = (x, y) => x > room.x + 0.5 && x < room.x + room.w - 0.5 && y > room.y + 0.5 && y < room.y + room.h - 0.5
      const onSofa = (x, y) => x >= sofa.x - 0.5 && x <= sofa.w + 0.5 && y >= sofa.y - 0.5 && y <= sofa.h + 0.5
      return [...document.querySelectorAll('[data-plan-svg] [data-dims] line')]
        .map((l) => [+l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')])
        .filter(([x1, y1, x2, y2]) => (inRoom(x1, y1) && !onSofa(x1, y1)) || (inRoom(x2, y2) && !onSofa(x2, y2))).length
    })
    check(floor === 0, `a 266 × 276 room: no dimension line on the floor between the walls and the sofa (${floor})`)
    check((await page.$$('[data-room-gap]')).length === 4, 'inside the room: the four sofa-to-wall gaps')
    const dimTexts = await page.$$eval('[data-plan-svg] [data-dims] [data-dim-text]', (els) => els.map((e) => e.textContent))
    check(dimTexts.includes('100"') && dimTexts.includes('129"'), `inside the U on the plan: 100" across, 129" deep (${dimTexts.filter((t) => t === '100"' || t === '129"').join(', ')})`)
    await shot(browser, page, 'round2-room-1440')
    await panel(page, 'Size')
    const sizeLine = await page.textContent('[data-testid=inside-u]')
    check(sizeLine === 'Inside the U 100″ wide × 129″ deep', `the Size tab: "${sizeLine}"`)
    // 23″ seats either side of a table in the middle of a 152″ side count and get a marker.
    await setField(page, 'L', 152)
    await page.getByRole('switch', { name: 'Mirror sides' }).click() // off: one table, on the left only
    await panel(page, 'Pieces')
    const lb = await page.$eval(`[data-piece="${(await config(page)).runs.left[0].id}"]`, (e) => e.getBoundingClientRect().toJSON())
    const chip = await page.locator('[data-tray-item=table]').boundingBox()
    const from = [chip.x + chip.width / 2, chip.y + chip.height / 2]
    const to = [lb.left + lb.width / 2, lb.top + (lb.height * 46) / 92]
    await page.mouse.move(...from)
    await page.mouse.down()
    for (let i = 1; i <= 16; i++) await page.mouse.move(from[0] + ((to[0] - from[0]) * i) / 16, from[1] + ((to[1] - from[1]) * i) / 16)
    await page.mouse.up()
    await page.waitForTimeout(300)
    const c = await config(page)
    await page.evaluate(() => window.__haven.getState().setUi({ markers: true }))
    await page.waitForSelector('[data-plan-svg] [data-marker]')
    const markers = await page.$$eval('[data-plan-svg] [data-marker]', (els) => els.length)
    const top = await page.textContent('[data-testid=seats]')
    check(run(c, 'left') === 'armless23 table32 oneArm37' && top === `Seats ${markers}` && markers === 7, `23 | 32 | 23 on the left: ${top}, ${markers} markers (${run(c, 'left')})`)
    // A second table never lands right next to the first.
    for (let i = 0; i < 3; i++) await page.locator('[data-tray-item=table]').click()
    await page.waitForTimeout(250)
    const touching = await page.evaluate(() => Object.values(window.__haven.getState().config.runs).some((ps) => ps.some((p, i) => i > 0 && p.kind === 'table' && ps[i - 1].kind === 'table')))
    check(!touching, 'three more Table taps: no two tables touching')
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 7. The PDF footer has the inside of the U; a sofa 2″ from the side walls is against them (no walkway warning).
  {
    const { context, page, errors } = await fresh(browser, base, `#c=${U}`)
    await panel(page, 'Room')
    await setField(page, 'roomW', 192)
    await page.waitForTimeout(250)
    const warns = await page.$$eval('[data-testid=warnings] li', (els) => els.map((e) => e.textContent))
    const short = await page.$$eval('[data-room-gap][data-short]', (els) => els.map((e) => e.getAttribute('data-room-gap')))
    check(!warns.some((w) => w.startsWith('Walkway 2″')) && !short.includes('left') && !short.includes('right'), `2″ from each side wall: no walkway warning, not amber (${warns.join('; ')})`)
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    await page.getByTestId('make-pdf').click()
    await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
    const path = 'test-results/round2.pdf'
    await dl.saveAs(path)
    const { pdfText } = await import('./h6.mjs')
    const pdf = await pdfText(path)
    const footer = pdf.items.map((i) => i.str).join(' ')
    check(footer.includes('Inside 100" × 88"'), `the PDF footer has "Inside 100" × 88"" (${footer.slice(footer.indexOf('Seats'), footer.indexOf('Seats') + 90)})`)
    check(errors.length === 0, `no console errors ${errors.join('; ')}`)
    await context.close()
  }
}
