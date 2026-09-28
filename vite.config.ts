import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so the build needs that base.
// Dev and local `vite preview` stay at '/'. Set BASE_PATH in CI to override.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5177 },
  build: {
    // pixi + spine + the dango UI kit land in one chunk; that's expected here.
    chunkSizeWarningLimit: 1600,
  },
})
