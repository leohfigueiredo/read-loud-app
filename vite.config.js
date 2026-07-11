import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf-worker'
          if (id.includes('epubjs')) return 'epub'
          if (id.includes('@google/generative-ai')) return 'gemini'
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: 'terser'
  }
})
