/// <reference types='vitest' />
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/korfbal-stream-kit',
  server: {
    port: 4200,
    host: 'localhost',
    proxy: {
      // Alle verzoeken naar /api worden nu doorgezonden naar de backend
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      // Statische assets (sponsors logo's, player images, etc.)
      '/uploads': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react()],
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
