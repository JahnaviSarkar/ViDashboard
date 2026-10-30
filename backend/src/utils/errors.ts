import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable: boolean;
  };
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: unknown,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryable = retryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, 404, details, false);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details, false);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details, false);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super('DATABASE_ERROR', message, 500, details, true);
  }
}

export function handleFastifyError(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ err: error, reqId: request.id }, 'Request error caught by centralized handler');

  if (error instanceof AppError) {
    const response: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
      },
    };
    return reply.status(error.statusCode).send(response);
  }

  if (error instanceof ZodError) {
    const response: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed schema validation',
        details: error.issues,
        retryable: false,
      },
    };
    return reply.status(400).send(response);
  }

  // Fastify validation errors (from route schema)
  if ('validation' in error && (error as FastifyError).validation) {
    const response: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: (error as FastifyError).validation,
        retryable: false,
      },
    };
    return reply.status(400).send(response);
  }

  // Fallback for unhandled internal errors
  const statusCode = (error as FastifyError).statusCode || 500;
  const isRetryable = statusCode >= 500;
  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An internal server error occurred' : error.message,
      retryable: isRetryable,
    },
  };

  return reply.status(statusCode).send(response);
}
