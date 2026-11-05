import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    name: 'venue-protocol-tests',
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    globals: true,
  },
});
