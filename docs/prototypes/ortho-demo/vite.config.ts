import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Default chunking (realistic). vite.attrib.config.ts adds manualChunks purely to attribute
// bytes per library — do NOT ship that: it drags Vite's preload helper into a vendor chunk
// and makes the lazy 3D stack load eagerly with the entry.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  preview: { host: '127.0.0.1', port: 5198, strictPort: true },
})
