/// <reference types='vitest' />
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {nxViteTsPaths} from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// Where /api, /uploads and /socket.io go in dev. The e2e tests start their own API on the test database
// and point the dev server at it; everyone else gets the dev API on 3333.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3333';
// changeOrigin rewrites Host to the API's port; xfwd adds X-Forwarded-Host (this dev server's host and
// port), which the API compares with the browser's Origin (cross-site write and socket origin checks).
const proxy = {target: apiTarget, changeOrigin: true, xfwd: true};

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/korfbal-stream-kit',
  server: {
    port: 4200,
    host: 'localhost',
    proxy: {
      // Alle verzoeken naar /api worden nu doorgezonden naar de backend
      '/api': proxy,
      // Statische assets (sponsors logo's, player images, etc.)
      '/uploads': proxy,
      '/storage': proxy,
      // Live state (Socket.io), incl. websocket upgrade
      '/socket.io': {...proxy, ws: true},
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), nxViteTsPaths()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['html2canvas'],
  },
  test: {
    name: '@korfbal-stream-kit/korfbal-stream-kit',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    env: {
      VITE_API_BASE_URL: 'http://localhost/api',
    },
  },
}));
