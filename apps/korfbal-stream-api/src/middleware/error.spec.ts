import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError, PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { errorHandler } from './error';
import { logger } from '../utils/logger';

// Mock logger to prevent actual logging during tests
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('errorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should handle ZodError correctly', () => {
    const zodError = new ZodError([{
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['name'],
      message: 'Expected string, received number',
    }]);

    errorHandler(zodError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      issues: [{ path: ['name'], message: 'Expected string, received number', code: 'invalid_type' }],
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should handle PrismaClientInitializationError (P1001) correctly', () => {
    const prismaInitError = new PrismaClientInitializationError('Can\'t reach database server', '4.0.0', 'P1001');

    errorHandler(prismaInitError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Database is currently unavailable. Please try again later.',
      issues: [{ message: 'Could not connect to the database server. Can\'t reach database server' }],
    });
    expect(logger.error).toHaveBeenCalledWith('!!!!!!! Database connection error:', prismaInitError);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should handle PrismaClientKnownRequestError (P1000) correctly', () => {
    const prismaKnownError = new PrismaClientKnownRequestError('Authentication failed', 'P1000', '4.0.0');

    errorHandler(prismaKnownError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Database is currently unavailable. Please try again later.',
      issues: [{ message: 'Could not connect to the database server. Authentication failed' }],
    });
    expect(logger.error).toHaveBeenCalledWith('!!!!!!! Database connection error:', prismaKnownError);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should handle generic 4xx errors correctly', () => {
    const clientError = new Error('Bad Request');
    (clientError as any).status = 400;

    errorHandler(clientError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Bad Request' });
    expect(logger.warn).toHaveBeenCalledWith('Request error', { status: 400, message: 'Bad Request' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should handle generic 5xx errors correctly', () => {
    const serverError = new Error('Something went wrong');
    (serverError as any).status = 500;

    errorHandler(serverError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    expect(logger.error).toHaveBeenCalledWith('Unhandled error', serverError);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should default to 500 for unknown errors', () => {
    const unknownError = new Error('Unknown error type');

    errorHandler(unknownError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unknown error type' });
    expect(logger.error).toHaveBeenCalledWith('Unhandled error', unknownError);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
