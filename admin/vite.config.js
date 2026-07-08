
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Express server (API + public site) — see ../server.js
const API_TARGET = 'http://localhost:5175'

export default defineConfig({
  // The admin app is its own deployment (its own Vercel project, its own
  // domain) — it lives at the root, not nested under /admin.
  base: '/',
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist'
  }
})
