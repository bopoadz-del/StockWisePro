import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { config } from '../config';

interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: any;
  stack?: string;
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', error);

  const response: ErrorResponse = {
    error: 'Internal server error',
  };

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    response.error = 'Validation error';
    response.code = 'VALIDATION_ERROR';
    response.details = error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json(response);
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        response.error = 'Duplicate entry';
        response.code = 'DUPLICATE_ERROR';
        response.message = `A record with this ${error.meta?.target} already exists`;
        return res.status(409).json(response);
      
      case 'P2003':
        response.error = 'Foreign key constraint failed';
        response.code = 'FOREIGN_KEY_ERROR';
        return res.status(400).json(response);
      
      case 'P2025':
        response.error = 'Record not found';
        response.code = 'NOT_FOUND';
        return res.status(404).json(response);
      
      default:
        response.error = 'Database error';
        response.code = error.code;
        break;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    response.error = 'Invalid data';
    response.code = 'VALIDATION_ERROR';
    return res.status(400).json(response);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    response.error = 'Invalid token';
    response.code = 'INVALID_TOKEN';
    return res.status(401).json(response);
  }

  if (error.name === 'TokenExpiredError') {
    response.error = 'Token expired';
    response.code = 'TOKEN_EXPIRED';
    return res.status(401).json(response);
  }

  // Handle specific error types
  if (error.name === 'UnauthorizedError') {
    response.error = 'Unauthorized';
    response.code = 'UNAUTHORIZED';
    return res.status(401).json(response);
  }

  // Include stack trace in development
  if (config.isDevelopment) {
    response.stack = error.stack;
    response.message = error.message;
  }

  res.status(500).json(response);
}
