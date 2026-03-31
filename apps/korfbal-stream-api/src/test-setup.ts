import {afterAll, beforeAll} from 'vitest';
import {PrismaClient} from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.test before any other code runs
const envFile = path.resolve(__dirname, '../.env.test');
const result = dotenv.config({ path: envFile });
if (result.error) {
  console.warn(`Could not load .env.test from ${envFile}:`, result.error);
} else {
  // Explicitly override DATABASE_URL to ensure it's correct for the tests
  if (result.parsed?.DATABASE_URL) {
    process.env.DATABASE_URL = result.parsed.DATABASE_URL;
  }
}

const prisma = new PrismaClient();

beforeAll(async () => {
  // Check if database is required and available
  if (process.env.REQUIRE_DB === 'true') {
    try {
      await prisma.$connect();
      console.log('Database connection verified.');
    } catch (e) {
      console.error('Failed to connect to database but REQUIRE_DB is set to true:', e);
      throw e;
    }
  }

  // Skipping database reset for unit tests if not using a real DB
  // Ensure the test database schema is up-to-date and all data is cleared
  // before starting the test run.
  if (process.env.SKIP_DB_RESET !== 'true') {
    console.log('Resetting test database...');
    try {
      // execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('Test database reset complete.');
    } catch (e) {
      console.error('Failed to reset test database:', e);
      if (process.env.REQUIRE_DB === 'true') {
        throw e;
      }
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
