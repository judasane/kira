import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../types';

/**
 * Global error handling middleware
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', error);

  // Zod validation
  if (error instanceof ZodError) {
    const apiError: ApiError = {
      error: 'Validation Error',
      message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      code: 'VALIDATION_ERROR',
      details: error.errors,
    };
    res.status(400).json(apiError);
    return;
  }

  // Custom application errors
  if (error.name === 'NotFoundError') {
    const apiError: ApiError = {
      error: 'Not Found',
      message: error.message,
      code: 'NOT_FOUND',
    };
    res.status(404).json(apiError);
    return;
  }

  if (error.name === 'ConflictError') {
    const apiError: ApiError = {
      error: 'Conflict',
      message: error.message,
      code: 'CONFLICT',
    };
    res.status(409).json(apiError);
    return;
  }

  if (error.name === 'BadRequestError') {
    const apiError: ApiError = {
      error: 'Bad Request',
      message: error.message,
      code: 'BAD_REQUEST',
    };
    res.status(400).json(apiError);
    return;
  }

  // Generic error
  const apiError: ApiError = {
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(apiError);
}

/**
 * Middleware for not found routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const apiError: ApiError = {
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  };
  res.status(404).json(apiError);
}
