import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Pin root to this directory regardless of cwd or whether this config is
// picked up standalone or via the root vitest.workspace.ts auto-discovery -
// keeps this project scoped to scripts/ only, never the whole repo.
const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: here,
    environment: 'node',
    include: ['**/*.spec.ts'],
  },
});
