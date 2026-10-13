import path from 'path';
import {execSync} from 'node:child_process';
import {useTestDatabase} from './test-database';

/** Runs once before all spec files: create (when missing) and migrate the separate test database. */
export default function setup() {
  const database = useTestDatabase();
  if (process.env.REQUIRE_DB !== 'true') return;

  const schema = path.resolve(__dirname, '../prisma/schema.prisma');
  console.log(`Migrating test database "${database}"...`);
  // `migrate deploy` creates the database when it doesn't exist yet
  execSync(`npx prisma migrate deploy --schema=${schema}`, {stdio: 'inherit', env: process.env});
}
