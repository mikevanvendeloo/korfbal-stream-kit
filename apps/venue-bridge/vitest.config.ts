import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

process.env.TZ ||= 'UTC';

export default defineConfig({
  resolve: {
    alias: {'@korfbal-stream-kit/venue-protocol': fileURLToPath(new URL('../../libs/venue-protocol/src/index.ts', import.meta.url))},
  },
  test: {
    name: 'venue-bridge-tests',
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    testTimeout: 30000,
    globals: true,
    // Tests change the (module-level) configuration: one spec file at a time
    pool: 'forks',
    poolOptions: {forks: {singleFork: true}},
    fileParallelism: false,
  },
});
