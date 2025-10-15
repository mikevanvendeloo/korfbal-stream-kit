import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Service wrapper around PrismaClient to centralize configuration & logging
class PrismaService {
  private prisma: PrismaClient;

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

// Keep a named export `prisma` for backwards compatibility with existing imports/tests
export const prisma = prismaService.getClient();
