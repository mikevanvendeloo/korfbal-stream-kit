import {defineConfig} from 'prisma/config';

// .env files are not loaded by Prisma 7: the npm scripts run through dotenv-cli, the tests set
// DATABASE_URL themselves (src/test-database.ts), the Docker image gets it from the environment.
export default defineConfig({
  schema: 'apps/korfbal-stream-api/prisma/schema.prisma',
  migrations: {
    path: 'apps/korfbal-stream-api/prisma/migrations',
    // With a prisma config file, `prisma db seed` only reads the seed command from here
    // (package.json's "prisma.seed" is ignored), so without it seeding silently does nothing.
    seed: 'tsx apps/korfbal-stream-api/prisma/seed.ts',
  },
  datasource: {
    // Empty when unset: generating the client needs no database (CI, Docker build); migrate then fails on it
    url: process.env.DATABASE_URL ?? '',
  },
});
