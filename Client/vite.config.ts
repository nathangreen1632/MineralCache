// Client/vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prefer VITE_BACKEND_URL; keep compatibility with existing VITE_API_TARGET
  const BACKEND = env.VITE_BACKEND_URL || env.VITE_API_TARGET || 'http://localhost:3001';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: BACKEND,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 5173,
      strictPort: true,
    },
    build: {
      chunkSizeWarningLimit: 1024,
    },
  };
});
