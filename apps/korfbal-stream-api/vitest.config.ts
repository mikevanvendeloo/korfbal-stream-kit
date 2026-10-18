import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

// The server runs in Docker with TZ=UTC; test in a zone other than Amsterdam so code that formats with
// the server's zone fails here instead of on the night. Override with e.g. TZ=America/New_York.
// Set before the forks start, so the test processes inherit it.
process.env.TZ ||= 'UTC';

export default defineConfig({
  test: {
    name: 'korfbal-stream-api-tests',
    // Only this app's tests, wherever vitest is started from. Run it from the repo root: some
    // integration specs call prisma with repo-root relative paths.
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    testTimeout: 30000,
    globals: true,
    // Once before everything: guard, create and migrate the separate test database (see src/test-database.ts)
    globalSetup: ['./src/test-global-setup.ts'],
    // Before every spec file
    setupFiles: ['./src/test-setup.ts'],
    // All integration tests share one database: run the files one after another in a single process.
    // (Vitest's default pool is 'forks', so a threads-only option has no effect.)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
  },
});
