import {NextFunction, Request, Response} from 'express';
import {ZodError} from 'zod';
import {logger} from '../utils/logger';

export interface ApiErrorBody {
  error: string;
  issues?: any[];
}

export function errorHandler(err: any, _req: Request, res: Response<ApiErrorBody>, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.errors.map((e) => ({ path: e.path, message: e.message, code: e.code })),
    });
  }

  const status = (err?.status as number) || 500;
  const message = err?.message || 'Internal server error';

  if (status >= 500) {
    logger.error('Unhandled error', err);
  } else {
    logger.warn('Request error', { status, message });
  }

  return res.status(status).json({ error: message });
}
