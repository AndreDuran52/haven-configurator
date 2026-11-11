// The side drawing and the person (Andre, 2026-11-11; plan Q63, Q78–Q80):
// Side in 3D is a cut through a seat with its measurements (not a 3D picture);
// a person can be shown sitting on the sofa (View menu, in 3D), in the drawing
// and in the 3D views; the PDF's Side view is the drawing without the person.
// Judged by outcome: the drawing's own texts and numbers, mesh names, the PDF's text.
import { VIEWPORTS } from './browser.mjs'
import { openApp, panel, preset, viewMenu } from './lib.mjs'
import { pdfText } from './h6.mjs'
import { shot, smallText } from './phase3.mjs'

const LAPTOP = { width: 1440, height: 900 }
const LAPTOP_SMALL = { width: 1280, height: 800 }
const U = '1UW188L132R132D44_bt32s36_la72_ra72.wh'

const texts = (page) => page.$$eval('[data-side-svg] text', (els) => els.map((e) => e.textContent))
const sideData = (page) => page.$eval('[data-side-svg]', (e) => ({ usable: Number(e.dataset.usable), depth: Number(e.dataset.depth), scale: Number(e.dataset.scale) }))
const person = (page) =>
  page.$eval('[data-person]', (e) => ({ hip: e.dataset.hip.split(',').map(Number), top: Number(e.dataset.top), feet: e.dataset.feet, seatBack: Number(e.dataset.seatBack) })).catch(() => null)
/** Labels of the side drawing that overlap each other, leave the drawing, or are under 14 px. */
const sideLabels = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('[data-side-svg]').getBoundingClientRect()
    const els = [...document.querySelectorAll('[data-side-svg] text')]
    const boxes = els.map((e) => e.getBoundingClientRect())
    let overlaps = 0
    let clipped = 0
    boxes.forEach((a, i) => {
      if (a.left < svg.left - 0.5 || a.right > svg.right + 0.5 || a.top < svg.top - 0.5 || a.bottom > svg.bottom + 0.5) clipped++
      for (const b of boxes.slice(i + 1)) {
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 0.5 && h > 0.5) overlaps++
      }
    })
    const small = els.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 14).length
    return { count: els.length, overlaps, clipped, small }
  })

async function open3d(page) {
  await page.getByRole('radio', { name: '3D' }).click()
  await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 40000 })
}
async function side(page) {
  await page.locator('[data-preset=side]').click()
  await page.waitForSelector('[data-side-svg]')
}

export async function sideView(browser, base, check) {
  // 1. Side is the drawing, with the real measurements, at every size.
  for (const [name, vp] of [['1440', LAPTOP], ['1280', LAPTOP_SMALL], ['iPad', VIEWPORTS.ipadLandscape], ['portrait', VIEWPORTS.ipadPortrait]]) {
    const { context, page, errors } = await openApp(browser, base, `#c=${U}`, vp)
    await open3d(page)
    await side(page)
    const t = await texts(page)
    const d = await sideData(page)
    check(d.usable === 26 && d.depth === 44 && t.includes('26" USABLE SEAT') && t.includes('44" TOTAL DEPTH'), `${name}: Side is the drawing: 26" usable seat, 44" total depth`)
    for (const want of ['10"', '34" seat', '18" seat height', '17" seat', '1" leg', '23" arm', '27" back', '31" back pillows', 'BACK'])
      check(t.includes(want), `${name}: the drawing says ${want}`)
    check(t.some((s) => s.startsWith('Back pillow: 5" at the stitching, fills to 8"')), `${name}: the back pillow's note`)
    const stitch = await page.$eval('[data-part=stitch]', (e) => Number(e.dataset.z))
    check(stitch === 9.5, `${name}: the stitch line is at 9½" (${stitch}), the middle of the 1"–18" seat`)
    const lc = await sideLabels(page)
    check(lc.overlaps === 0 && lc.clipped === 0 && lc.small === 0, `${name}: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped, ${lc.small} under 14 px`)
    const small = await smallText(page)
    check(small.length === 0, `${name}: no interface text under 14 px (${small.join('; ')})`)
    // The drawing covers the 3D picture; the other views still show it.
    const cover = await page.$eval('[data-testid=side-section]', (e) => {
      const r = e.getBoundingClientRect()
      const c = document.querySelector('[data-testid=three-view] canvas').getBoundingClientRect()
      return r.width >= c.width - 1 && r.height >= c.height - 1
    })
    check(cover, `${name}: the drawing covers the 3D box`)
    check((await person(page)) === null, `${name}: no person by default`)
    if (name === '1440') await shot(browser, page, 'side-44-1440')
    await page.locator('[data-preset=front]').click()
    await page.waitForTimeout(100)
    check((await page.$('[data-side-svg]')) === null, `${name}: Front is the 3D view again`)
    check(errors.length === 0, `${name}: no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 2. The depth follows the sofa: 36" deep has an 18" usable seat. A phone shows the main measurements.
  {
    const { context, page } = await openApp(browser, base, `#c=${U}`, LAPTOP)
    await panel(page, 'Size')
    await page.getByRole('button', { name: '36″' }).click()
    await open3d(page)
    await side(page)
    const t = await texts(page)
    check((await sideData(page)).usable === 18 && t.includes('18" USABLE SEAT') && t.includes('36" TOTAL DEPTH') && t.includes('26" seat'), '36" deep: 18" usable seat, 26" seat, 36" total depth')
    await shot(browser, page, 'side-36-1440')
    await context.close()
  }
  {
    const { context, page } = await openApp(browser, base, `?view#c=${U}`, VIEWPORTS.phone)
    await open3d(page)
    await side(page)
    const t = await texts(page)
    const lc = await sideLabels(page)
    check(t.includes('26" USABLE SEAT') && t.includes('18" seat height') && t.includes('27" back'), 'phone: the main measurements show')
    check(lc.overlaps === 0 && lc.clipped === 0 && lc.small === 0, `phone: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped, ${lc.small} under 14 px`)
    await page.screenshot({ path: 'test-results/side-phone.png' })
    await context.close()
  }

  // 3. The person: View menu in 3D; in the drawing and in the 3D views; height and pose; remembered here.
  {
    const { context, page, errors } = await openApp(browser, base, `#c=${U}`, LAPTOP)
    await viewMenu(page)
    check((await page.$('[data-testid=person-section]')) === null, 'Plan: the View menu has no Person section')
    await page.keyboard.press('Escape')
    await open3d(page)
    await side(page)
    await viewMenu(page)
    await page.waitForSelector('[data-testid=person-section]')
    check((await page.getByTestId('person').getAttribute('aria-checked')) === 'false', '3D: Person in the View menu, off')
    await page.getByTestId('person').click()
    await page.waitForSelector('[data-person]')
    check((await page.getByTestId('person-height').inputValue()) === "5'9″", `the height starts at 5'9″ (${await page.getByTestId('person-height').inputValue()})`)
    const lounge = await person(page)
    check(lounge.feet === 'up' && Math.abs(lounge.seatBack - 20) < 0.01, `Lounge at 44" deep: back on the pillow, legs out over the edge (seat back ${lounge.seatBack})`)
    check((await page.$('[data-part=upright-pillow]')) === null, 'Lounge: no extra pillow')
    const lc = await sideLabels(page)
    check(lc.overlaps === 0 && lc.clipped === 0, `with the person: ${lc.count} labels, ${lc.overlaps} overlapping, ${lc.clipped} clipped`)
    await page.keyboard.press('Escape')
    await shot(browser, page, 'side-44-lounge')
    await viewMenu(page)
    await page.getByRole('radio', { name: 'Upright' }).click()
    const upright = await person(page)
    check(upright.feet === 'floor' && upright.hip[0] > lounge.hip[0] + 3 && (await page.$('[data-part=upright-pillow]')) !== null, `Upright: a pillow behind the back, hips ${lounge.hip[0]} → ${upright.hip[0]}, feet on the floor`)
    // Height: + raises the head; a typed height is taken; out-of-range is held.
    await page.getByRole('button', { name: 'Height plus 1' }).click()
    const taller = await person(page)
    check(taller.top > upright.top && (await page.getByTestId('person-height').inputValue()) === "5'10″", `Height +: 5'10″, the head ${upright.top} → ${taller.top}`)
    await page.getByTestId('person-height').fill("6'2")
    await page.getByTestId('person-height').press('Enter')
    check((await page.evaluate(() => window.__haven.getState().ui.personHeight)) === 74 && (await person(page)).top > taller.top, "a typed 6'2 is 74\"")
    await page.getByTestId('person-height').fill('99')
    await page.getByTestId('person-height').press('Enter')
    check((await page.evaluate(() => window.__haven.getState().ui.personHeight)) === 80, 'a typed 99 is held at 6\'8″')
    await page.getByTestId('person-height').fill("5'9")
    await page.getByTestId('person-height').press('Enter')
    await page.keyboard.press('Escape')
    await shot(browser, page, 'side-44-upright')
    // The link never carries the person; undo history is untouched.
    check(!/person|69/.test(await page.evaluate(() => location.hash)) && (await page.evaluate(() => window.__haven.getState().past.length)) === 0, 'the person is not in the link and is not an edit')
    // In the 3D views: a figure on the back run's seat, inside the frame.
    await preset(page, 'threeQuarter')
    await page.waitForFunction(() => window.__haven3d.meshNames('person:').length > 0, null, { timeout: 10000 })
    await page.waitForFunction(() => window.__haven3d.state().resting, null, { timeout: 30000, polling: 100 })
    const names = await page.evaluate(() => window.__haven3d.meshNames('person:'))
    check(names.includes('person:torso') && names.includes('person:head') && names.filter((n) => n === 'person:thigh').length === 2 && names.includes('person:pillow'), `3D: the figure (${names.length} parts, with the Upright pillow)`)
    const b = await page.evaluate(() => {
      const bs = window.__haven3d.bounds('person:')
      const min = [0, 1, 2].map((i) => Math.min(...bs.map((q) => q.min[i])))
      const max = [0, 1, 2].map((i) => Math.max(...bs.map((q) => q.max[i])))
      return { min, max, offset: window.__haven3d.offset }
    })
    // The back run's only seat is p2: plan x 92–128 (middle 110); the head is about 18 + 36" up.
    const midX = (b.min[0] + b.max[0]) / 2 - b.offset[0]
    check(Math.abs(midX - 110) < 0.5 && b.max[1] > 50 && b.max[1] < 56 && b.min[1] > -0.5, `3D: seated at the middle of the back seat (x ${midX.toFixed(1)}), head at ${b.max[1].toFixed(1)}", feet on the floor`)
    for (const name of ['threeQuarter', 'front', 'top']) {
      await preset(page, name)
      await page.waitForTimeout(300)
      await page.waitForFunction(() => window.__haven3d.state().resting, null, { timeout: 30000, polling: 100 })
      const out = await page.evaluate(() => {
        const api = window.__haven3d
        const [w, h] = api.state().size
        const pts = api.bounds('person:').flatMap((q) => [q.min, q.max])
        return api.project(pts).filter(([x, y]) => x < 0 || y < 0 || x > w || y > h).length
      })
      check(out === 0, `3D ${name}: the whole figure is in the frame (${out} points outside)`)
    }
    await preset(page, 'threeQuarter')
    await page.waitForTimeout(400)
    await shot(browser, page, 'person-3d-1440')
    // A reload keeps the height and pose (this device); the person starts off again.
    await viewMenu(page)
    await page.getByRole('button', { name: 'Height plus 1' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    const ui = await page.evaluate(() => window.__haven.getState().ui)
    check(ui.personHeight === 70 && ui.personPose === 'upright' && ui.person === false, `a reload keeps 5'10″ and Upright; the person is off again (${ui.personHeight}, ${ui.personPose}, ${ui.person})`)
    check(errors.length === 0, `person: no console errors ${errors.join('; ')}`)
    await context.close()
  }

  // 4. The PDF's Side view is the drawing (vector text, no 3D picture), without the person.
  {
    const { context, page, errors } = await openApp(browser, base, `#c=${U}`, LAPTOP)
    await page.evaluate(() => window.__haven.getState().setUi({ person: true }))
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    for (const k of ['plan', 'threeQuarter', 'iso', 'front', 'side']) {
      const box = page.locator(`[data-view="${k}"]`)
      if ((await box.isChecked()) !== (k === 'plan' || k === 'side')) await box.click()
    }
    await page.getByTestId('make-pdf').click()
    await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const svg = await page.evaluate(() => fetch(document.querySelector('[data-testid=made] img').src).then((r) => r.text()))
    check((svg.match(/<image /g) || []).length === 0 && svg.includes('data-side-svg') && !svg.includes('data-person'), 'sheet: Side is drawn (no rendered image), without the person')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
    await dl.saveAs('test-results/side-sheet.pdf')
    const t = await pdfText('test-results/side-sheet.pdf')
    const has = (s) => t.items.some((i) => i.str === s)
    check(t.items.some((i) => i.str.startsWith('SIDE VIEW')) && t.items.some((i) => /cut through a seat/.test(i.str)), 'PDF: "SIDE VIEW · cut through a seat"')
    check(has('26" USABLE SEAT') && has('44" TOTAL DEPTH') && has('18" seat height') && has('27" back'), `PDF: the drawing's measurements are text (${t.items.filter((i) => /USABLE|TOTAL|seat height/.test(i.str)).map((i) => i.str).join(' / ')})`)
    await page.locator('[data-testid=made] img').screenshot({ path: 'test-results/side-sheet.png' })
    check(errors.length === 0, `PDF: no console errors ${errors.join('; ')}`)
    await context.close()
  }
}
