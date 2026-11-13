import {PrismaPg} from '@prisma/adapter-pg';

/**
 * The driver adapter every PrismaClient needs (Prisma 7 has no query engine of its own any more).
 * The pool is `pg`'s: unlike Prisma 6 it has no connect timeout by default, so set the 5 seconds
 * Prisma 6 used, or an unreachable database makes a request hang instead of failing (503).
 */
export function createPrismaAdapter(connectionString: string | undefined = process.env.DATABASE_URL) {
  return new PrismaPg({connectionString, connectionTimeoutMillis: 5_000});
}
