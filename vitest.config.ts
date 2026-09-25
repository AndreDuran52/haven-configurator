import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Node environment by default; DOM tests opt in per file with
// `// @vitest-environment jsdom` (plan §3).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
