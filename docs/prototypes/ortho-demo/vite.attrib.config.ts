import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// manualChunks only to ATTRIBUTE bundle cost per library in the build report
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  preview: { host: '127.0.0.1', port: 5198, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/three\//.test(id)) return 'v-three'
          if (/node_modules\/three-stdlib\//.test(id)) return 'v-three-stdlib'
          if (/node_modules\/camera-controls\//.test(id)) return 'v-camera-controls'
          if (/node_modules\/@react-three\/fiber\//.test(id)) return 'v-r3f'
          if (/node_modules\/@react-three\/drei\//.test(id)) return 'v-drei'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'v-react'
          return 'v-other'
        },
      },
    },
  },
})
