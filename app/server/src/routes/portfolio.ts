import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';
import { z } from 'zod';

const router = Router();

// Get all portfolios
router.get('/', authenticate, async (req, res) => {
  try {
    const portfolios = await prisma.portfolio.findMany({
      where: {
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      include: {
        _count: { select: { holdings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(portfolios);
  } catch (error) {
    console.error('Get portfolios error:', error);
    res.status(500).json({ error: 'Failed to get portfolios' });
  }
});

// Create portfolio
router.post('/', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      teamId: z.string().optional(),
      mimicInvestor: z.string().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const portfolio = await prisma.portfolio.create({
      data: {
        name: data.name,
        description: data.description,
        teamId: data.teamId,
        mimicInvestor: data.mimicInvestor,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
      },
    });
    
    res.status(201).json(portfolio);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create portfolio error:', error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

// Get single portfolio
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
      include: {
        holdings: {
          include: {
            stock: true,
          },
        },
        transactions: {
          orderBy: { executedAt: 'desc' },
          take: 50,
        },
      },
    });
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
});

// Update portfolio
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
    });
    
    const data = schema.parse(req.body);
    
    const portfolio = await prisma.portfolio.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
        deletedAt: null,
      },
      data,
    });
    
    if (portfolio.count === 0) {
      return res.status(404).json({ error: 'Portfolio not found or not owned by you' });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update portfolio error:', error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
});

// Delete portfolio
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const portfolio = await prisma.portfolio.updateMany({
      where: {
        id,
        organizationId: req.organization!.id,
        createdBy: req.user!.id,
      },
      data: { deletedAt: new Date() },
    });
    
    if (portfolio.count === 0) {
      return res.status(404).json({ error: 'Portfolio not found or not owned by you' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
});

// Add holding
router.post('/:id/holdings', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      ticker: z.string().min(1).max(10),
      shares: z.number().positive(),
      avgCostBasis: z.number().positive(),
    });
    
    const data = schema.parse(req.body);
    
    // Verify portfolio belongs to user/org
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        organizationId: req.organization!.id,
        deletedAt: null,
      },
    });
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Upsert holding
    const holding = await prisma.portfolioHolding.upsert({
      where: {
        portfolioId_ticker: {
          portfolioId: id,
          ticker: data.ticker.toUpperCase(),
        },
      },
      create: {
        portfolioId: id,
        ticker: data.ticker.toUpperCase(),
        shares: data.shares,
        avgCostBasis: data.avgCostBasis,
      },
      update: {
        shares: { increment: data.shares },
        avgCostBasis: data.avgCostBasis,
      },
    });
    
    // Create transaction record
    await prisma.portfolioTransaction.create({
      data: {
        portfolioId: id,
        ticker: data.ticker.toUpperCase(),
        type: 'BUY',
        shares: data.shares,
        price: data.avgCostBasis,
        totalAmount: data.shares * data.avgCostBasis,
        executedAt: new Date(),
      },
    });
    
    res.status(201).json(holding);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Add holding error:', error);
    res.status(500).json({ error: 'Failed to add holding' });
  }
});

// Remove holding
router.delete('/:id/holdings/:ticker', authenticate, async (req, res) => {
  try {
    const { id, ticker } = req.params;
    
    await prisma.portfolioHolding.deleteMany({
      where: {
        portfolioId: id,
        ticker: ticker.toUpperCase(),
      },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove holding error:', error);
    res.status(500).json({ error: 'Failed to remove holding' });
  }
});

// Mimic investor portfolio
router.post('/:id/mimic', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      investor: z.string(),
      budget: z.number().positive(),
    });
    
    const data = schema.parse(req.body);
    
    // Get investor allocation
    const investorAllocations: Record<string, Record<string, number>> = {
      warren_buffett: { AAPL: 0.40, BAC: 0.15, KO: 0.10, AXP: 0.08, OXY: 0.07 },
      ray_dalio: { SPY: 0.30, GLD: 0.15, TLT: 0.15, IEF: 0.10, VTI: 0.10 },
      cathie_wood: { TSLA: 0.20, ROKU: 0.08, SQ: 0.08, ZM: 0.07, COIN: 0.07 },
    };
    
    const allocation = investorAllocations[data.investor];
    
    if (!allocation) {
      return res.status(400).json({ error: 'Unknown investor' });
    }
    
    // Calculate holdings based on budget
    const holdings = Object.entries(allocation).map(([ticker, weight]) => ({
      ticker,
      budget: data.budget * weight,
      // Note: Would fetch current price and calculate shares in real implementation
      estimatedShares: Math.floor((data.budget * weight) / 100), // Placeholder
    }));
    
    // Update portfolio
    await prisma.portfolio.update({
      where: { id },
      data: {
        mimicInvestor: data.investor,
        mimicAllocation: allocation,
      },
    });
    
    res.json({
      investor: data.investor,
      budget: data.budget,
      holdings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Mimic portfolio error:', error);
    res.status(500).json({ error: 'Failed to mimic portfolio' });
  }
});

export default router;
