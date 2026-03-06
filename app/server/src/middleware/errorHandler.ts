import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Prisma errors
  if (err.code?.startsWith('P')) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Resource already exists',
          message: err.message,
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Resource not found',
          message: err.message,
        });
      default:
        return res.status(500).json({
          error: 'Database error',
          message: err.message,
        });
    }
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
