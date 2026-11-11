import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration proxying /api and short links directly to the Express backend (port 3000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
