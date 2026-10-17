import path from 'path';
import {execSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
import {useTestDatabase} from './test-database';
import {ensureOrganization, TEST_ORGANIZATION_SLUG} from '../test-scenarios';

/** Runs once before all spec files: create (when missing) and migrate the separate test database. */
export default async function setup() {
  const database = useTestDatabase();
  if (process.env.REQUIRE_DB !== 'true') return;

  const schema = path.resolve(__dirname, '../prisma/schema.prisma');
  console.log(`Migrating test database "${database}"...`);
  // `migrate deploy` creates the database when it doesn't exist yet
  execSync(`npx prisma migrate deploy --schema=${schema}`, {stdio: 'inherit', env: process.env});

  // The organization every test runs in (test-setup.ts sends it as X-Organization)
  const prisma = new PrismaClient();
  try {
    await ensureOrganization(prisma, TEST_ORGANIZATION_SLUG, 'Testorganisatie');
  } finally {
    await prisma.$disconnect();
  }
}
