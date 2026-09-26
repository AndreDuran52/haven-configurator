// H6 done-when checks (plan §10 H6, as simplified by Andre 2026-09-26: one
// sheet, the plan to scale plus the ticked 3D views). PDFs are downloaded and
// measured with pdf.js: text positions in points on the page.
import { readFileSync } from 'node:fs'
import { VIEWPORTS } from './browser.mjs'
import { config, openApp } from './lib.mjs'

const SHOTS = 'test-results'
const T1 = '1UW188L132R132D44_bt32s36_la72_ra72.wh'

/** Text items of page 1: { str, x, y (from the top), w }. */
async function pdfText(path) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise
  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const items = tc.items.filter((i) => i.str.trim()).map((i) => ({ str: i.str, x: i.transform[4], y: vp.height - i.transform[5], w: i.width, h: i.height }))
  return { items, w: vp.width, h: vp.height, pages: doc.numPages }
}

async function setViews(page, want) {
  for (const k of ['plan', 'threeQuarter', 'iso', 'front', 'side']) {
    const box = page.locator(`[data-view="${k}"]`)
    if ((await box.isChecked()) !== !!want[k]) await box.click()
  }
}

/** Share → tick views → Make PDF → download it. */
async function makePdf(page, want, name) {
  await page.getByTestId('share').click()
  await page.waitForSelector('[data-testid=sheet-views]')
  await setViews(page, want)
  await page.getByTestId('make-pdf').click()
  await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('share-pdf').click()])
  const path = `${SHOTS}/${name}.pdf`
  await dl.saveAs(path)
  return { path, file: dl.suggestedFilename() }
}

export async function h6(browser, base, check) {
  // 1. Plan only, Standard U: 3/8" = 1'-0" (2.25 pt/in), exact.
  {
    const { context, page, errors } = await openApp(browser, base)
    const { path, file } = await makePdf(page, { plan: true }, 'h6-plan-only')
    const t = await pdfText(path)
    check(t.w === 792 && t.h === 612 && t.pages === 1, `Letter landscape, 1 page (${t.w} × ${t.h}, ${t.pages})`)
    check(/^Haven-U-188x132x132-\d{4}-\d\d-\d\d\.pdf$/.test(file), `file name ${file}`)
    const scale = t.items.find((i) => i.str.startsWith('SCALE 3/8'))
    check(!!scale, `prints "${scale?.str ?? t.items.find((i) => i.str.startsWith('SCALE'))?.str}"`)
    // The top chain row: the "60"" labels that share the smallest y.
    const sixty = t.items.filter((i) => i.str === '60"')
    const topY = Math.min(...sixty.map((i) => i.y))
    const wedges = sixty.filter((i) => Math.abs(i.y - topY) < 0.5).sort((a, b) => a.x - b.x)
    const cx = (i) => i.x + i.w / 2
    const d = wedges.length >= 2 ? cx(wedges[wedges.length - 1]) - cx(wedges[0]) : NaN
    check(Math.abs(d - 288) < 0.05, `the two wedge 60" labels are ${d.toFixed(2)} pt apart (288.00 = (188 − 60) × 2.25)`)
    const overall = t.items.find((i) => i.str.startsWith('188"'))
    check(!!overall, `overall "${overall?.str}" printed`)
    const svg = await page.evaluate(() => fetch(document.querySelector('[data-testid=made] img').src).then((r) => r.text()))
    const geo = await page.evaluate((svg) => {
      const host = document.createElement('div')
      host.innerHTML = svg
      document.body.appendChild(host)
      const g = host.querySelector('[data-plan-scale]')
      const S = Number(g.getAttribute('data-plan-scale'))
      const m = g.getCTM()
      const bar = host.querySelector('[data-scalebar]')
      const out = { S, x0: m.e, x188: m.e + 188 * m.a, bar: Number(bar.getAttribute('data-scalebar-len')), barFt: Number(bar.getAttribute('data-scalebar')) }
      host.remove()
      return out
    }, svg)
    check(Math.abs(geo.x188 - geo.x0 - 423) < 0.01, `the 188" width spans ${(geo.x188 - geo.x0).toFixed(2)} pt on paper (423.00)`)
    check(geo.barFt === 4 && Math.abs(geo.bar - 108) < 0.01, `the 4' scale-bar is ${geo.bar.toFixed(2)} pt (108.00)`)
    const over = cx(overall)
    check(Math.abs(over - (geo.x0 + geo.x188) / 2) < 0.5, `PDF text sits where the SVG put it (188" label centre ${over.toFixed(1)} pt)`)
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 2. Plan + 3/4 + Iso from the Plan view on a fresh load (3D never opened), then offline.
  {
    const { context, page, errors } = await openApp(browser, base)
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 20000 }).catch(() => {})
    const { path } = await makePdf(page, { plan: true, threeQuarter: true, iso: true }, 'h6-plan-34-iso')
    const t = await pdfText(path)
    const labels = t.items.filter((i) => /VIEW/.test(i.str)).map((i) => i.str)
    check(labels.length === 2 && labels.some((s) => s.startsWith('3/4 VIEW')) && labels.some((s) => s.startsWith('ISO VIEW')), `3D views on the sheet: ${labels.join(' / ')}`)
    check(!(await page.evaluate(() => !!window.__haven3d)), 'made from the Plan view: the live 3D view was never opened')
    const imgs = await page.evaluate(() => fetch(document.querySelector('[data-testid=made] img').src).then((r) => r.text()).then((s) => (s.match(/<image /g) || []).length))
    check(imgs === 2, `2 rendered images on the sheet (${imgs})`)
    await page.screenshot({ path: `${SHOTS}/h6-dialog.png` })
    await page.keyboard.press('Escape')
    await context.setOffline(true)
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-plan-svg]')
    const { path: p2 } = await makePdf(page, { plan: true, threeQuarter: true }, 'h6-offline')
    const t2 = await pdfText(p2)
    check(t2.items.some((i) => i.str.startsWith('3/4 VIEW')), 'offline after one online load: the sheet (with its 3D view) still exports')
    check(errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e)).length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 3. Disabled on the Blank U; enabled again once filled is covered by e2e/h4 (export unblocks).
  {
    const { context, page } = await openApp(browser, base)
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.getByRole('button', { name: 'Start blank' }).click()
    await page.waitForSelector('[data-gap]')
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    check(await page.getByTestId('make-pdf').isDisabled(), 'Blank U: Make PDF is disabled')
    await context.close()
  }

  // 4. ?view: read-only, no editing controls; "Edit a copy" opens the same layout editable.
  {
    const { context, page, errors } = await openApp(browser, base, `?view#c=${T1}`)
    const r = await page.evaluate(() => ({
      tray: !!document.querySelector('[data-tray]'),
      grips: document.querySelectorAll('[data-grip]').length,
      fields: document.querySelectorAll('#m-W').length,
      undo: !!document.querySelector('button[aria-label=Undo]'),
      wedge: !!document.querySelector('[data-testid=wedge]'),
    }))
    await page.waitForSelector('[data-testid=view-summary]')
    check(!r.tray && r.grips === 0 && r.fields === 0 && !r.undo && !r.wedge, `?view: no tray, grips, fields, undo or wedge slider (${JSON.stringify(r)})`)
    const box = await page.$eval('[data-plan-svg]', (e) => e.getBoundingClientRect().toJSON())
    await page.mouse.click(box.x + box.width / 2, box.y + 60)
    check((await page.evaluate(() => window.__haven.getState().ui.selectedId)) === null, '?view: tapping the plan selects nothing')
    await page.getByRole('radio', { name: '3D' }).click()
    await page.waitForFunction(() => !!window.__haven3d, null, { timeout: 30000 })
    check(true, '?view: 3D opens')
    await page.getByTestId('edit-copy').click()
    await page.waitForSelector('#m-W')
    check((await page.evaluate(() => location.search)) === '', '"Edit a copy" drops ?view')
    await page.getByRole('radio', { name: 'Plan' }).click()
    await page.waitForSelector('[data-grip]')
    check((await page.evaluate(() => window.__plan.encode())) === T1, '…and opens the same layout, editable')
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await context.close()
  }

  // 5. Saved layouts: save, reload, reopen, rename, delete; storage throwing.
  {
    const { context, page } = await openApp(browser, base)
    await page.locator('#m-W').fill('200')
    await page.locator('#m-W').press('Enter')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByTestId('save-name').fill('Mitchell family room')
    await page.getByTestId('save-confirm').click()
    await page.waitForTimeout(100)
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-plan-svg]')
    check((await config(page)).W === 188, 'a fresh load opens the Standard U')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    const row = page.locator('[data-saved="Mitchell family room"]')
    await row.waitFor()
    await row.getByRole('button', { name: 'Open' }).click()
    await page.waitForTimeout(100)
    check((await config(page)).W === 200, 'reopened from Start: W 200')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await row.getByRole('button', { name: 'Rename' }).click()
    await page.getByLabel('New name').fill('Mitchell, den')
    await page.getByRole('button', { name: 'OK' }).click()
    const renamed = page.locator('[data-saved="Mitchell, den"]')
    check(await renamed.isVisible(), 'renamed')
    await renamed.getByRole('button', { name: 'Delete' }).click()
    await renamed.getByRole('button', { name: /^Delete "/ }).click()
    check((await page.locator('[data-saved]').count()) === 0, 'deleted (after confirming)')
    await context.close()
  }
  {
    const init = `(() => { const t = () => { throw new Error('blocked') }; Object.defineProperty(window, 'localStorage', { get: t }) })()`
    const { context, page, errors } = await openApp(browser, base, '', VIEWPORTS.ipadLandscape, init)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByTestId('save-name').fill('x')
    await page.getByTestId('save-confirm').click()
    const msg = await page.textContent('[role=alert]')
    check(/Can't save on this device/.test(msg ?? ''), `storage throwing: "${msg}"`)
    await page.keyboard.press('Escape')
    await page.locator('#m-W').fill('190')
    await page.locator('#m-W').press('Enter')
    check((await config(page)).W === 190 && errors.length === 0, 'and nothing else breaks')
    await context.close()
  }

  // 6. Screenshots of the dialog at the three viewports (no horizontal overflow).
  for (const [vName, vp] of Object.entries(VIEWPORTS)) {
    const { context, page } = await openApp(browser, base, '', vp)
    await page.getByTestId('share').click()
    await page.waitForSelector('[data-testid=sheet-views]')
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    const top = await page.evaluate(() => {
      const bar = document.querySelector('header').getBoundingClientRect()
      return bar.right <= innerWidth + 0.5
    })
    check(!over && top, `${vName}: Share dialog on screen, top bar fits`)
    await page.screenshot({ path: `${SHOTS}/h6-${vName}-share.png` })
    await context.close()
  }
}
