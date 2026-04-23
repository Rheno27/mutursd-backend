import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors';
import { buildEnvelope } from '../util';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = err instanceof AppError ? err : null;
  const statusCode = appError?.statusCode ?? 500;
  const message = appError?.message ?? 'Internal Server Error';
  const errors = appError?.details ?? (err instanceof Error ? { message: err.message } : undefined);

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json(buildEnvelope(false, message, null, errors));
};