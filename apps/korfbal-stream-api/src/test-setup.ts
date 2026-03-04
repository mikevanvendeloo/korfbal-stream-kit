import {execSync} from 'child_process';
import {afterAll, beforeAll} from 'vitest';
import {PrismaClient} from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.test before any other code runs
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const prisma = new PrismaClient();

beforeAll(() => {
  // Ensure the test database schema is up-to-date and all data is cleared
  // before starting the test run.
  console.log('Resetting test database...');
  execSync('npx prisma db push --force-accept-data-loss', { stdio: 'inherit' });
  console.log('Test database reset complete.');
});

afterAll(async () => {
  await prisma.$disconnect();
});
