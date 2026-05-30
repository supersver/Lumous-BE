import { env } from '@config/env';
import type { ErrorRequestHandler, RequestHandler } from 'express';

type ErrorBody = {
  message: string;
  code: string;
  details?: unknown;
  stack?: string;
};

type ErrorResponse = {
  success: false;
  error: ErrorBody;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found.`, 404, 'ROUTE_NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;

  const body: ErrorResponse = {
    success: false,
    error: {
      message: isAppError ? error.message : 'Internal server error.',
      code: isAppError ? error.code : 'INTERNAL_SERVER_ERROR',
    },
  };

  if (isAppError && error.details !== undefined) {
    body.error.details = error.details;
  }

  if (env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
    body.error.stack = error.stack;
  }

  if (env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(statusCode).json(body);
};
