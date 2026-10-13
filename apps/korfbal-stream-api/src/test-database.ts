import path from 'path';
import dotenv from 'dotenv';

/**
 * Points DATABASE_URL at the test database from `.env.test`, overriding anything already set (such as
 * the dev database from `.env`), and refuses to continue unless the database name ends in `_test`.
 * Integration tests wipe tables, so they must never run against a dev or production database.
 */
export function useTestDatabase(): string {
  const envFile = path.resolve(__dirname, '../.env.test');
  const result = dotenv.config({path: envFile, override: true});
  if (result.error) {
    throw new Error(`Could not load ${envFile}: ${result.error.message}`);
  }

  const url = process.env.DATABASE_URL;
  const database = url ? new URL(url).pathname.replace(/^\//, '') : '';
  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${database || '<none>'}": the test database name must end in "_test" (see ${envFile}).`,
    );
  }
  return database;
}
