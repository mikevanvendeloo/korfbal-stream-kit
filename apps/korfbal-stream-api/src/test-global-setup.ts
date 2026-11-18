import path from 'path';
import {execSync} from 'node:child_process';
import {PrismaClient} from '@korfbal-stream-kit/prisma';
import {useTestDatabase} from './test-database';
import {createPrismaAdapter} from './services/prismaAdapter';
import {ensureOrganization, TEST_ORGANIZATION_SLUG} from '../test-scenarios';

/** Runs once before all spec files: create (when missing) and migrate the separate test database. */
export default async function setup() {
  const database = useTestDatabase();
  if (process.env.REQUIRE_DB !== 'true') return;

  console.log(`Migrating test database "${database}"...`);
  // `migrate deploy` creates the database when it doesn't exist yet. The schema, migrations and the
  // connection (DATABASE_URL, the test database set by useTestDatabase above) come from prisma.config.ts.
  execSync('npx prisma migrate deploy', {stdio: 'inherit', env: process.env, cwd: path.resolve(__dirname, '../../..')});

  // The organization every test runs in (test-setup.ts sends it as X-Organization)
  const prisma = new PrismaClient({adapter: createPrismaAdapter()});
  try {
    await ensureOrganization(prisma, TEST_ORGANIZATION_SLUG, 'Testorganisatie');
  } finally {
    await prisma.$disconnect();
  }
}
