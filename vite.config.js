import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'tesseract.js', 'dexie', 'dexie-react-hooks', '@supabase/supabase-js']
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          tesseract: ['tesseract.js'],
          supabase: ['@supabase/supabase-js'],
          vendor: ['react', 'react-dom', 'dexie', 'dexie-react-hooks', 'lucide-react']
        }
      }
    }
  }
});
