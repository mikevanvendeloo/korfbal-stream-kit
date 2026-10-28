import {PrismaClient} from '@prisma/client';
import {logger} from '../utils/logger';
import {tenantScope} from './tenantScope';

// Service wrapper around PrismaClient to centralize configuration & logging
class PrismaService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Log queries in development for easier debugging
    if (process.env.NODE_ENV === 'development') {
      // cast to never to satisfy TS for event names without importing Prisma types
      this.prisma.$on('query' as never, (e: any) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Always log Prisma errors
    this.prisma.$on('error' as never, (e: any) => {
      logger.error('Prisma error:', e);
    });
  }

  getClient() {
    return this.prisma;
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

export const prismaService = new PrismaService();

/**
 * Not scoped to an organization: only for system work that must see every organization (restoring
 * live state on startup, startup checks). Everything else uses `prisma`.
 */
export const prismaUnscoped = prismaService.getClient();

/**
 * The client for all application code: queries on tenant tables are confined to the organization in
 * the context (see services/tenantScope.ts). A query extension doesn't change any types, so it is
 * typed as a plain PrismaClient and existing helpers taking a PrismaClient keep working.
 */
export const prisma = prismaUnscoped.$extends(tenantScope) as unknown as PrismaClient;

/**
 * Options for a transaction that writes a whole production at once (import, backup restore, applying a
 * draaiboek template): row by row that can take longer than Prisma's default 5 s, and then the
 * transaction is closed halfway (P2028 "Transaction already closed").
 */
export const LONG_TRANSACTION = {timeout: 60_000, maxWait: 10_000} as const;
