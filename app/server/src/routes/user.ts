import { Router, Response, NextFunction } from 'express';
import { requireDatabase } from '../middleware/dbHealth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply database health check
router.use(requireDatabase);

// Get current user profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        plan: true,
        createdAt: true,
        subscription: true,
        _count: {
          select: {
            watchlists: true,
            alerts: true,
            portfolios: true,
            experiments: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      avatar: z.string().url().optional(),
    });

    const updates = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        plan: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get user stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.$transaction([
      prisma.watchlist.count({ where: { userId: req.user!.id } }),
      prisma.priceAlert.count({ where: { userId: req.user!.id, isActive: true } }),
      prisma.portfolio.count({ where: { userId: req.user!.id } }),
      prisma.experiment.count({ where: { userId: req.user!.id } }),
    ]);

    res.json({
      watchlistCount: stats[0],
      activeAlerts: stats[1],
      portfolios: stats[2],
      experiments: stats[3],
    });
  } catch (error) {
    next(error);
  }
});

// Delete account
router.delete('/account', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.delete({
      where: { id: req.user!.id },
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };
