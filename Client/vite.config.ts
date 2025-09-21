// Client/vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_TARGET = env.VITE_API_TARGET || 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
        },
        '/socket.io': {
          target: API_TARGET,
          ws: true,
          changeOrigin: true,
        },
        '/uploads': {
          target: API_TARGET,
          changeOrigin: true,
        },
      },
    },
    preview: { port: 5173 },
    build: {
      chunkSizeWarningLimit: 1024,
    },
  };
});
