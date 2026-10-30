import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../Satella.Desktop/wwwroot',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})

