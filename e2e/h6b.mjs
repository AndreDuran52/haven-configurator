// H6b done-when checks (Andre, 2026-10-02): the Projects home (unsaved-changes
// guard, backup and restore), and Download / Print as the sheet's main actions.
import { readFileSync } from 'node:fs'
import { VIEWPORTS } from './browser.mjs'
import { config, openApp } from './lib.mjs'

const SHOTS = 'test-results'

async function saveAs(page, name, W) {
  await page.locator('#m-W').fill(String(W))
  await page.locator('#m-W').press('Enter')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByTestId('save-name').fill(name)
  await page.getByTestId('save-confirm').click()
  await page.waitForTimeout(100)
}

const home = async (page) => {
  await page.getByTestId('projects').click()
  await page.waitForSelector('[data-testid=projects-home]')
}

export async function h6b(browser, base, check) {
  // 1. Unsaved changes: Projects asks first; "Don't save" goes home and the layout waits under "Continue last layout".
  {
    const { context, page } = await openApp(browser, base)
    await page.getByTestId('projects').click()
    check(await page.getByTestId('projects-home').isVisible(), 'no edits: Projects goes straight home')
    await page.getByTestId('new-standardU').click()
    await page.waitForSelector('[data-plan-svg]')
    check(!(await page.getByRole('button', { name: 'Undo' }).isEnabled()), 'a new Haven from home starts a fresh undo history')
    await page.locator('#m-W').fill('230')
    await page.locator('#m-W').press('Enter')
    await page.waitForTimeout(1300) // the draft is written 1 s after a commit
    await page.getByTestId('projects').click()
    const asked = await page.getByRole('dialog', { name: 'Save before leaving?' }).waitFor({ timeout: 5000 }).then(() => true, () => false)
    check(asked, 'unsaved edits: "Save before leaving?"')
    await page.getByTestId('leave-unsaved').click()
    await page.waitForSelector('[data-testid=projects-home]')
    await page.getByTestId('continue').click()
    await page.waitForSelector('[data-plan-svg]')
    check((await config(page)).W === 230, '"Continue last layout" brings it back (W 230)')
    await context.close()
  }

  // 2. Back up all projects, then restore them in a fresh browser (another device).
  {
    const { context, page } = await openApp(browser, base)
    await saveAs(page, 'Garcia', 200)
    await home(page)
    await page.getByTestId('new-standardU').click()
    await page.waitForSelector('[data-plan-svg]')
    await saveAs(page, 'Mitchell', 220)
    await home(page)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup').click()])
    const path = `${SHOTS}/h6b-backup.json`
    await dl.saveAs(path)
    const backup = JSON.parse(readFileSync(path, 'utf8'))
    check(/^haven-projects-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()) && backup.projects.length === 2, `backup file ${dl.suggestedFilename()} holds 2 projects`)
    for (const [vName, vp] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(vp)
      await page.waitForTimeout(150)
      const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      check(!over, `${vName}: Projects home has no horizontal overflow`)
      await page.screenshot({ path: `${SHOTS}/h6b-${vName}-home.png` })
    }
    await context.close()

    const fresh = await browser.newContext({ viewport: VIEWPORTS.ipadLandscape, hasTouch: true })
    const p2 = await fresh.newPage()
    await p2.goto(base, { waitUntil: 'networkidle' })
    await p2.waitForSelector('[data-testid=projects-home]')
    await p2.getByTestId('restore-file').setInputFiles(path)
    await p2.locator('[data-saved="Mitchell"]').waitFor()
    check((await p2.locator('[data-saved]').count()) === 2, 'restore in a fresh browser adds both projects')
    await p2.getByTestId('restore-file').setInputFiles(path)
    await p2.waitForTimeout(150)
    check((await p2.locator('[data-saved]').count()) === 2 && /0 added/.test(await p2.textContent('[data-testid=toast]')), 'restoring twice adds nothing')
    await p2.locator('[data-saved="Mitchell"]').getByRole('button', { name: 'Open', exact: true }).click()
    await p2.waitForSelector('[data-plan-svg]')
    check((await config(p2)).W === 220, 'a restored project opens (W 220)')
    await fresh.close()
  }

  // 3. The sheet: Download PDF and Print first; Share… only where the browser can share files.
  {
    const { context, page, errors } = await openApp(browser, base)
    await page.getByTestId('share').click()
    await page.getByTestId('make-pdf').click()
    await page.waitForSelector('[data-testid=made]', { timeout: 60000 })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
    check(/\.pdf$/.test(dl.suggestedFilename()), `Download PDF downloads ${dl.suggestedFilename()}`)
    await page.getByTestId('print-pdf').click()
    const frame = await page.waitForSelector('iframe[data-print]', { state: 'attached', timeout: 10000 }).catch(() => null)
    const src = frame ? await frame.getAttribute('src') : ''
    check(!!frame && src.startsWith('blob:'), `Print loads the PDF into a print frame (${src.slice(0, 5)}…)`)
    const canShare = await page.evaluate(() => {
      try {
        return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })
      } catch {
        return false
      }
    })
    check((await page.getByTestId('share-pdf').count()) === (canShare ? 1 : 0), `Share… shown only where files can be shared (here: ${canShare})`)
    const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-png').click()])
    check(/\.png$/.test(png.suggestedFilename()), `Image (PNG) downloads ${png.suggestedFilename()}`)
    check(errors.length === 0, `no console errors (${errors.join(' | ')})`)
    await page.screenshot({ path: `${SHOTS}/h6b-sheet-actions.png` })
    await context.close()
  }
}
