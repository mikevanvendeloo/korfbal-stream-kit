import {NextFunction, Request, Response} from 'express';
import {ZodError} from 'zod';
import {logger} from '../utils/logger';
import {PrismaClientInitializationError, PrismaClientKnownRequestError} from '@prisma/client/runtime/library'; // Importeer de Prisma fouttypes

export interface ApiErrorBody {
  error: string;
  issues?: any[];
}

export const INTERNAL_ERROR_MESSAGE = 'Interne serverfout';
export const DATABASE_UNAVAILABLE_MESSAGE = 'De database is niet bereikbaar. Probeer het later opnieuw.';

/**
 * Turns an error into a response without internals: Prisma messages (query, table and column names,
 * values) and messages of unexpected errors stay in the server log. Errors the code throws on purpose
 * with a 4xx `status` (ImageUploadError, SeasonError, NotFoundError, ...) keep their message; routes
 * that answer with `res.status(..).json({error})` themselves never get here.
 */
export function errorHandler(err: any, req: Request, res: Response<ApiErrorBody>, _next: NextFunction) {
  const where = {method: req?.method, path: req?.originalUrl ?? req?.url};

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.errors.map((e) => ({ path: e.path, message: e.message, code: e.code })),
    });
  }

  const code = prismaErrorCode(err);

  // The database can't be reached (P1xxx, or the client failed to start)
  if (isDatabaseUnavailable(err, code)) {
    logger.error('Database connection error', {...where, code, error: err});
    return res.status(503).json({ error: DATABASE_UNAVAILABLE_MESSAGE });
  }

  // A record that isn't there (or belongs to another organization: the tenant scope hides it)
  if (code === 'P2025') {
    logger.warn('Request error', { ...where, status: 404, code, message: err.message });
    return res.status(404).json({ error: 'Niet gevonden' });
  }

  // A reference to a missing row, or to a row of another organization (trigger enforce_same_organization):
  // for the caller both simply don't exist
  if (isForeignReferenceError(err)) {
    logger.warn('Request error', { ...where, status: 404, code, message: err.message });
    return res.status(404).json({ error: 'Verwijzing niet gevonden' });
  }

  if (code === 'P2002') {
    logger.warn('Request error', { ...where, status: 409, code, message: err.message });
    return res.status(409).json({ error: 'Bestaat al' });
  }

  // Any other Prisma error, and anything unexpected: details only in the log
  const status = prismaErrorName(err) ? 500 : Number(err?.status ?? err?.statusCode) || 500;
  if (status >= 500 || status < 400) {
    logger.error('Unhandled error', {...where, code, error: err});
    return res.status(500).json({ error: INTERNAL_ERROR_MESSAGE });
  }

  const message = typeof err?.message === 'string' && err.message ? err.message : 'Ongeldig verzoek';
  logger.warn('Request error', { ...where, status, message });
  return res.status(status).json({ error: message });
}

function isDatabaseUnavailable(err: any, code: string | undefined): boolean {
  if (err instanceof PrismaClientInitializationError || err?.name === 'PrismaClientInitializationError') return true;
  const errorCode = code ?? (typeof err?.errorCode === 'string' ? err.errorCode : undefined);
  return !!errorCode && /^P1\d{3}$/.test(errorCode);
}

/** Prisma's error classes, by name (see prismaErrorCode). */
function prismaErrorName(err: any): boolean {
  return typeof err?.name === 'string' && err.name.startsWith('PrismaClient');
}

const OTHER_ORGANIZATION_MESSAGE = 'refers to a row of another organization';

function isForeignReferenceError(err: any): boolean {
  if (prismaErrorCode(err) === 'P2003') return true;
  return typeof err?.message === 'string' && err.message.includes(OTHER_ORGANIZATION_MESSAGE);
}

/**
 * The Prisma error code. Checked by name, not instanceof: errors from the extended client can come
 * from another copy of the runtime than the one imported here.
 */
function prismaErrorCode(err: any): string | undefined {
  const known = err instanceof PrismaClientKnownRequestError || err?.name === 'PrismaClientKnownRequestError';
  return known && typeof err.code === 'string' ? err.code : undefined;
}

/** A resource that doesn't exist, or belongs to another organization: answered with 404. */
export class NotFoundError extends Error {
  readonly status = 404;
}
