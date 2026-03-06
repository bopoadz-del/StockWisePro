import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requirePlan } from '../middleware/auth';

const router = Router();

// Get user's portfolios
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.user!.id },
      include: { holdings: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(portfolios);
  } catch (error) {
    next(error);
  }
});

// Create portfolio
router.post(
  '/',
  authenticate,
  requirePlan(['ELITE']),
  async (req: AuthRequest, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        investorId: z.string().optional(),
        budget: z.number().positive(),
        holdings: z.array(
          z.object({
            ticker: z.string(),
            name: z.string(),
            shares: z.number().int().positive(),
            price: z.number().positive(),
            allocation: z.number(),
            value: z.number(),
          })
        ),
      });

      const { name, investorId, budget, holdings } = schema.parse(req.body);

      const portfolio = await prisma.portfolio.create({
        data: {
          userId: req.user!.id,
          name,
          investorId,
          budget,
          holdings: {
            create: holdings,
          },
        },
        include: { holdings: true },
      });

      res.status(201).json(portfolio);
    } catch (error) {
      next(error);
    }
  }
);

// Get single portfolio
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: { holdings: true },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

// Update portfolio
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(1).optional(),
    });

    const updates = schema.parse(req.body);

    const portfolio = await prisma.portfolio.update({
      where: {
        id,
        userId: req.user!.id,
      },
      data: updates,
    });

    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

// Delete portfolio
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    await prisma.portfolio.delete({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    res.json({ message: 'Portfolio deleted' });
  } catch (error) {
    next(error);
  }
});

// Export portfolio as CSV
router.get('/:id/export', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: { holdings: true },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Generate CSV
    const headers = ['Ticker', 'Name', 'Shares', 'Price', 'Allocation %', 'Value'];
    const rows = portfolio.holdings.map((h) => [
      h.ticker,
      h.name,
      h.shares,
      h.price,
      h.allocation,
      h.value,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      '',
      `Total Budget,${portfolio.budget}`,
      `Total Value,${portfolio.holdings.reduce((sum, h) => sum + h.value, 0)}`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${portfolio.name.replace(/\s+/g, '_')}.csv"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export { router as portfolioRouter };
