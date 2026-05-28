import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { QueryFailedError } from 'typeorm';
import { HttpError } from '../utils/http-error';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues,
      },
    });
    return;
  }

  if (err instanceof QueryFailedError) {
    res.status(409).json({
      error: { code: 'DATABASE_ERROR', message: 'Database operation failed' },
    });
    return;
  }

  if (env.NODE_ENV !== 'test') {
    console.error('[unhandled]', err);
  }

  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
  });
};
