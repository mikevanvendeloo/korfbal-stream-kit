import {afterAll, beforeAll} from 'vitest';
import {PrismaClient} from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.test before any other code runs
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const prisma = new PrismaClient();

beforeAll(() => {
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
