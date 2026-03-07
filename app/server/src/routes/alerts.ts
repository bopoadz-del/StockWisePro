import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requirePlan } from '../middleware/auth';

const router = Router();

// Get user's alerts
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

// Create alert
router.post(
  '/',
  authenticate,
  requirePlan(['PRO', 'ELITE']),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        ticker: z.string().min(1),
        targetPrice: z.number().positive(),
        condition: z.enum(['ABOVE', 'BELOW']),
      });

      const { ticker, targetPrice, condition } = schema.parse(req.body);

      // Check alert limit for free users
      const alertCount = await prisma.priceAlert.count({
        where: { userId: req.user!.id, isActive: true },
      });

      if (req.user!.plan === 'FREE' && alertCount >= 3) {
        return res.status(403).json({
          error: 'Free plan limited to 3 active alerts. Upgrade to Pro for unlimited.',
        });
      }

      const alert = await prisma.priceAlert.create({
        data: {
          userId: req.user!.id,
          ticker: ticker.toUpperCase(),
          targetPrice,
          condition,
        },
      });

      res.status(201).json(alert);
    } catch (error) {
      next(error);
    }
  }
);

// Update alert
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      isActive: z.boolean().optional(),
      targetPrice: z.number().positive().optional(),
    });

    const updates = schema.parse(req.body);

    const alert = await prisma.priceAlert.update({
      where: {
        id,
        userId: req.user!.id,
      },
      data: updates,
    });

    res.json(alert);
  } catch (error) {
    next(error);
  }
});

// Delete alert
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.priceAlert.delete({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    res.json({ message: 'Alert deleted' });
  } catch (error) {
    next(error);
  }
});

// Get alerts for a specific stock
router.get('/stock/:ticker', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;

    const alerts = await prisma.priceAlert.findMany({
      where: {
        userId: req.user!.id,
        ticker: ticker.toUpperCase(),
        isActive: true,
      },
    });

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export { router as alertsRouter };
