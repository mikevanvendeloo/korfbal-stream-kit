import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    globals: true,
    // This file is executed once before all test suites.
    setupFiles: ['./src/test-setup.ts'],
    // Run tests in a single thread to avoid race conditions on the database.
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
