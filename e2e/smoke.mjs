// H0b install checks: manifest, icons, iOS meta, no console errors.
import { openPage } from './browser.mjs'

export async function smoke(browser, base, check) {
  const { context, page, errors } = await openPage(browser, base)
  await page.waitForSelector('[data-plan-svg]')
  check((await page.locator('link[rel="manifest"][href="/manifest.webmanifest"]').count()) === 1, 'manifest link present')
  const manifest = await (await page.request.get(`${base}manifest.webmanifest`)).json()
  check(manifest.scope === '/' && manifest.start_url === '/', 'manifest scope and start_url are "/"')
  check(manifest.display === 'standalone' && !('orientation' in manifest), 'manifest standalone, no orientation lock')
  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, base).href)
    check(res.ok() && res.headers()['content-type'] === 'image/png', `icon ${icon.src} served`)
  }
  check((await page.request.get(`${base}icons/apple-touch-icon-180.png`)).ok(), 'apple-touch-icon served')
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  check(viewport?.includes('viewport-fit=cover') ?? false, 'viewport-fit=cover')
  for (const name of ['apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title']) {
    check((await page.locator(`meta[name="${name}"]`).count()) === 1, `meta ${name}`)
  }
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`)
  await context.close()
}
