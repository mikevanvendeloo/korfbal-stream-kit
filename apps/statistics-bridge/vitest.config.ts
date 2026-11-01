import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

process.env.TZ ||= 'UTC';

export default defineConfig({
  test: {
    name: 'statistics-bridge-tests',
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
