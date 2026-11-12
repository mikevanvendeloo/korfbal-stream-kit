/// <reference types='vitest/config' />
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {nxViteTsPaths} from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// The page is served by the bridge itself at `/`; in dev the bridge (default port 3340) answers /bridge/status.
const bridge = process.env.BRIDGE_PROXY_TARGET || 'http://localhost:3340';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/venue-bridge-ui',
  server: {port: 4210, host: 'localhost', proxy: {'/bridge': bridge}},
  plugins: [react(), nxViteTsPaths()],
  build: {
    // Into the bridge's own output, where it serves `public` next to its bundle
    outDir: '../../dist/apps/venue-bridge/public',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  test: {
    name: '@korfbal-stream-kit/venue-bridge-ui',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    reporters: ['default'],
  },
}));
