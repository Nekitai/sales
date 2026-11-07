import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Frontend & API satu origin saat development => cookie session SameSite=Lax bekerja.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
})
