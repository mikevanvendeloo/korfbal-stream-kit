import {defineConfig, devices} from '@playwright/test';
import {nxE2EPreset} from '@nx/playwright/preset';
import {workspaceRoot} from '@nx/devkit';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

/**
 * End-to-end tests: a real browser against a real API on the TEST database. The API gets its own
 * port and the dev server is pointed at it, so a running dev API (with the dev database) is never used.
 */
const API_PORT = 3335;
const KIT_PORT = 4300;
const baseURL = process.env['BASE_URL'] || `http://localhost:${KIT_PORT}`;

const testEnv = dotenv.parse(fs.readFileSync(path.join(workspaceRoot, 'apps/korfbal-stream-api/.env.test')));
const databaseUrl = testEnv.DATABASE_URL ?? '';
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.replace(/^\//, '') : '';
if (!databaseName.endsWith('_test')) {
  // Same rule as the API tests (src/test-database.ts): the tests change data
  throw new Error(`Refusing to run e2e tests against database "${databaseName || '<none>'}": its name must end in "_test".`);
}
process.env['E2E_DATABASE_URL'] = databaseUrl;
process.env['E2E_API_URL'] = `http://localhost:${API_PORT}`;

export default defineConfig({
  ...nxE2EPreset(__filename, {testDir: './src'}),
  // One test database and one live show state: no parallel tests
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma && npx tsx apps/korfbal-stream-api/src/main.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      // Never reuse whatever already listens on the port: it could be an API on another database
      reuseExistingServer: false,
      cwd: workspaceRoot,
      timeout: 120_000,
      env: {
        DATABASE_URL: databaseUrl,
        PORT: String(API_PORT),
        // 'test' would keep the server from listening (that is for the Vitest suites)
        NODE_ENV: 'development',
        // The zone the API runs in on Docker: text for vMix and reports must still be Amsterdam time
        TZ: 'UTC',
        ASSETS_DIR: path.join(workspaceRoot, 'tmp/e2e-storage'),
      },
    },
    {
      command: `npx vite --config apps/korfbal-stream-kit/vite.config.ts --port ${KIT_PORT} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      cwd: workspaceRoot,
      timeout: 120_000,
      env: {API_PROXY_TARGET: `http://localhost:${API_PORT}`},
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
});
