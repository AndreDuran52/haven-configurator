// Shared Playwright helper: playwright-core + a preinstalled Chromium.
// Cloud sandboxes: HAVEN_CHROMIUM=/opt/pw-browsers/chromium (never `playwright install`).
// Andre's machine: `npx playwright install chromium` once, and leave HAVEN_CHROMIUM unset.
import { chromium } from 'playwright-core'

export const VIEWPORTS = {
  ipadLandscape: { width: 1180, height: 820 },
  ipadPortrait: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
}

export function launchBrowser() {
  return chromium.launch({
    executablePath: process.env.HAVEN_CHROMIUM || undefined,
    headless: true,
    // software WebGL (SwiftShader) so the 3D view renders headless
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  })
}

/** Opens `url` in a fresh touch-enabled context and records console errors. */
export async function openPage(browser, url, viewport = VIEWPORTS.ipadLandscape, init) {
  const context = await browser.newContext({ viewport, hasTouch: true })
  if (init) await context.addInitScript(init)
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url, { waitUntil: 'networkidle' })
  return { context, page, errors }
}
