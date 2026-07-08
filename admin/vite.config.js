
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
  // `vite preview` serves the production build — same proxy so local prod-build
  // testing (`npm run build && npm run preview`) exercises the real API too,
  // matching how Vercel puts admin + API on the same origin via rewrites.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist'
  }
})
