import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Same-origin in development: no CORS, and the WebSocket goes through the proxy too.
    proxy: {
      '/graphql': { target: api, ws: true },
      '/api': { target: api },
      '/mcp': { target: api },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
