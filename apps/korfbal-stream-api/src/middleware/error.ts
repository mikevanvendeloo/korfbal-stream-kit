import {NextFunction, Request, Response} from 'express';
import {ZodError} from 'zod';
import {logger} from '../utils/logger';
import {PrismaClientInitializationError, PrismaClientKnownRequestError} from '@prisma/client/runtime/library'; // Importeer de Prisma fouttypes

export interface ApiErrorBody {
  error: string;
  issues?: any[];
}

export function errorHandler(err: any, _req: Request, res: Response<ApiErrorBody>, _next: NextFunction) {
  console.error('Error caught by errorHandler:', err); // Added logging

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.errors.map((e) => ({ path: e.path, message: e.message, code: e.code })),
    });
  }

  // Handle Prisma database connection errors
  if (err instanceof PrismaClientInitializationError || err instanceof PrismaClientKnownRequestError) {
    // P1001: Can't reach database server
    // P1000: Authentication failed against database server
    // P1002: The database server was reached but timed out
    // P1003: A database access error occurred
      logger.error('!!!!!!! Database connection error:', err);
      return res.status(503).json({
        error: 'Database is currently unavailable. Please try again later.',
        issues: [{ message: `Could not connect to the database server. ${err.message}` }],
      });

  }

  // Generic error handling
  const status = (err?.status as number) || 500;
  const message = err?.message || 'Internal server error';

  if (status >= 500) {
    logger.error('Unhandled error', err);
  } else {
    logger.warn('Request error', { status, message });
  }

  return res.status(status).json({ error: message });
}
