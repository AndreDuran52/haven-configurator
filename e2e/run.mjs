// `npm run e2e`: serves the existing dist/ with Vite's preview server
// (in-process) and runs the smoke checks against it. Run `npm run build` first.
import { preview } from 'vite'
import { launchBrowser, openPage } from './browser.mjs'

const PORT = 4179
const BASE = `http://127.0.0.1:${PORT}/`

const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failures.push(label)
}

const server = await preview({ preview: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
const browser = await launchBrowser()
try {
  const { page, errors } = await openPage(browser, BASE)
  check((await page.getByRole('heading', { name: /Haven/ }).count()) === 1, 'placeholder page renders its heading')
  check((await page.locator('link[rel="manifest"][href="/manifest.webmanifest"]').count()) === 1, 'manifest link present')

  const manifest = await (await page.request.get(`${BASE}manifest.webmanifest`)).json()
  check(manifest.scope === '/' && manifest.start_url === '/', 'manifest scope and start_url are "/"')
  check(manifest.display === 'standalone' && !('orientation' in manifest), 'manifest standalone, no orientation lock')
  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, BASE).href)
    check(res.ok() && res.headers()['content-type'] === 'image/png', `icon ${icon.src} served`)
  }
  check((await page.request.get(`${BASE}icons/apple-touch-icon-180.png`)).ok(), 'apple-touch-icon served')

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  check(viewport?.includes('viewport-fit=cover') ?? false, 'viewport-fit=cover')
  for (const name of ['apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title']) {
    check((await page.locator(`meta[name="${name}"]`).count()) === 1, `meta ${name}`)
  }
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
  await server.close()
}

if (failures.length) {
  console.error(`e2e: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('e2e: all checks passed')
