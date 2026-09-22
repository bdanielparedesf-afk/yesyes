import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    // Code-splitting manual: evita que recharts/xlsx/framer-motion
    // (solo usados en Admin) inflen el JS inicial de la tienda pública.
    // Sin esto, todo cae en un único index-*.js de ~580KB que bloquea
    // el primer paint en 3G/4G = pantalla "blanca" prolongada.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'axios', 'zustand'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
