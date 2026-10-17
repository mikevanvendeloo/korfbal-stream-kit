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

  it('answers 503 with a generic message when the database can\'t be reached (P1xxx), details only in the log', () => {
    const prismaInitError = new PrismaClientInitializationError('Can\'t reach database server at db:5432', '6.0.0', 'P1001');
    const prismaKnownError = new PrismaClientKnownRequestError('Authentication failed for user korfbal', {code: 'P1000', clientVersion: '6.0.0'});

    for (const err of [prismaInitError, prismaKnownError]) {
      errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenLastCalledWith(503);
      expect(mockResponse.json).toHaveBeenLastCalledWith({ error: 'De database is niet bereikbaar. Probeer het later opnieuw.' });
      expect(logger.error).toHaveBeenLastCalledWith('Database connection error', expect.objectContaining({ error: err }));
    }
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('answers 409 with a generic message for a unique constraint (P2002)', () => {
    const unique = new PrismaClientKnownRequestError('Unique constraint failed on the fields: (`id`)', {code: 'P2002', clientVersion: '6.0.0'});

    errorHandler(unique, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Bestaat al' });
  });

  it('answers 500 "Interne serverfout" for other Prisma errors, without their message', () => {
    const tooLong = new PrismaClientKnownRequestError('The provided value for the column "name" is too long', {code: 'P2000', clientVersion: '6.0.0'});
    const validation = Object.assign(new Error('Invalid `prisma.sponsor.create()` invocation: Argument `organizationId` is missing'), {name: 'PrismaClientValidationError'});
    const unknown = Object.assign(new Error('ERROR: organizationId is required (code 23502)'), {name: 'PrismaClientUnknownRequestError'});

    for (const err of [tooLong, validation, unknown]) {
      errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenLastCalledWith(500);
      expect(mockResponse.json).toHaveBeenLastCalledWith({ error: 'Interne serverfout' });
      expect(logger.error).toHaveBeenLastCalledWith('Unhandled error', expect.objectContaining({ error: err }));
    }
  });

  it('keeps the message of an error thrown on purpose with a 4xx status', () => {
    const clientError = new Error('Bad Request');
    (clientError as any).status = 400;

    errorHandler(clientError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Bad Request' });
    expect(logger.warn).toHaveBeenCalledWith('Request error', expect.objectContaining({ status: 400, message: 'Bad Request' }));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('answers 500 "Interne serverfout" for 5xx and unknown errors, details only in the log', () => {
    const serverError = new Error('connect ECONNREFUSED 10.0.0.5:8088');
    (serverError as any).status = 500;
    const unknownError = new Error('Cannot read properties of undefined (reading \'id\')');

    for (const err of [serverError, unknownError]) {
      errorHandler(err, mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenLastCalledWith(500);
      expect(mockResponse.json).toHaveBeenLastCalledWith({ error: 'Interne serverfout' });
      expect(logger.error).toHaveBeenLastCalledWith('Unhandled error', expect.objectContaining({ error: err }));
    }
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('answers 404 for a record that was not found (P2025)', () => {
    const notFound = new PrismaClientKnownRequestError('No record found', {code: 'P2025', clientVersion: '6.0.0'});

    errorHandler(notFound, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Niet gevonden' });
  });

  it('answers 404 for a foreign key to a missing row (P2003) or a row of another organization', () => {
    const foreignKey = new PrismaClientKnownRequestError('Foreign key constraint failed', {code: 'P2003', clientVersion: '6.0.0'});
    const otherOrganization = new Error('ERROR: ProductionPerson.personId refers to a row of another organization');

    errorHandler(foreignKey, mockRequest as Request, mockResponse as Response, mockNext);
    errorHandler(otherOrganization, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenNthCalledWith(1, 404);
    expect(mockResponse.status).toHaveBeenNthCalledWith(2, 404);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Verwijzing niet gevonden' });
  });
});
