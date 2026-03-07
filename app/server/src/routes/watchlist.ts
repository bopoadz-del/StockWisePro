import { Router, Response, NextFunction } from 'express';
import { requireDatabase } from '../middleware/dbHealth';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply database health check
router.use(requireDatabase);

// Get user's watchlist
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: req.user!.id },
      orderBy: { addedAt: 'desc' },
    });

    res.json(watchlist);
  } catch (error) {
    next(error);
  }
});

// Add to watchlist
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      ticker: z.string().min(1),
      name: z.string().optional(),
    });

    const { ticker, name } = schema.parse(req.body);

    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: req.user!.id,
        ticker: ticker.toUpperCase(),
        name: name || ticker.toUpperCase(),
      },
    });

    res.status(201).json(watchlistItem);
  } catch (error) {
    next(error);
  }
});

// Remove from watchlist
router.delete('/:ticker', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;

    await prisma.watchlist.delete({
      where: {
        userId_ticker: {
          userId: req.user!.id,
          ticker: ticker.toUpperCase(),
        },
      },
    });

    res.json({ message: 'Removed from watchlist' });
  } catch (error) {
    next(error);
  }
});

// Check if stock is in watchlist
router.get('/check/:ticker', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;

    const item = await prisma.watchlist.findUnique({
      where: {
        userId_ticker: {
          userId: req.user!.id,
          ticker: ticker.toUpperCase(),
        },
      },
    });

    res.json({ inWatchlist: !!item });
  } catch (error) {
    next(error);
  }
});

export { router as watchlistRouter };
