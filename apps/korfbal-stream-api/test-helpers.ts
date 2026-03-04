import {PrismaClient} from '@prisma/client';

/**
 * Cleans all data from the test database by truncating all tables.
 * This is much faster than deleting from each table individually.
 * @param prisma The PrismaClient instance connected to the test database.
 */
export async function cleanDatabase(prisma: PrismaClient) {
  // This logic is for PostgreSQL. If you use a different database,
  // you will need to adjust the query to get table names.
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tablesToTruncate = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations'); // Don't truncate the migrations table

  if (tablesToTruncate.length === 0) {
    return;
  }

  const truncateQuery = `TRUNCATE TABLE ${tablesToTruncate
    .map((name) => `"${name}"`)
    .join(', ')} RESTART IDENTITY CASCADE;`;

  await prisma.$executeRawUnsafe(truncateQuery);
}
