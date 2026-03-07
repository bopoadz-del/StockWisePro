import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

// Middleware to check database health before processing request
export const requireDatabase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Quick DB check
    await prisma.$queryRaw`SELECT 1`;
    next();
  } catch (error) {
    console.error('Database not available:', error);
    res.status(503).json({
      error: 'Database not available',
      message: 'This feature requires a database connection. Please try again later.',
    });
  }
};
