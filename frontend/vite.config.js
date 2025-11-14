import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    cors: true,
    hmr: {
      overlay: false
    },
    watch: {
      usePolling: true
    },
    // Proxy API calls to the local reverse proxy (nginx) so that
    // requests like /api/personas/... and static uploads work while
    // developing on http://localhost:3000
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:80',
        changeOrigin: true,
        // do not rewrite, keep /api prefix as nginx expects it
        secure: false
      }
    }
  }
})
