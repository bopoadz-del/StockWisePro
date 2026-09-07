import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { z } from 'zod';
import {
  isMissingPricesError,
  isUnknownInvestorError,
  listInvestorBooks,
} from '../data/investorAllocations';
import { buildMimicPortfolio, mimicAllocationSnapshot } from '../services/mimicService';

const router = Router();

const mimicRequestSchema = z.object({
  investor: z.string().min(1).optional(),
  investorId: z.string().min(1).optional(),
  budget: z.number().positive(),
}).refine((data) => Boolean(data.investor || data.investorId), {
  message: 'investor is required',
});

function parseMimicBody(body: unknown) {
  const data = mimicRequestSchema.parse(body);
  return {
    investor: (data.investor || data.investorId) as string,
    budget: data.budget,
  };
}

function sendMimicError(res: any, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Invalid input', details: error.errors });
  }
  if (isUnknownInvestorError(error)) {
    return res.status(400).json({ error: 'Unknown investor', investor: error.investor });
  }
  if (isMissingPricesError(error)) {
    return res.status(502).json({
      error: 'Unable to fetch live or cached prices',
      missing: error.missing,
    });
  }
  console.error('Mimic portfolio error:', error);
  return res.status(500).json({ error: 'Failed to mimic portfolio' });
}

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

// Discover the 12 model books (ids + aliases + holdings)
router.get('/investors', optionalAuth, async (_req, res) => {
  const investors = listInvestorBooks().map((book) => ({
    id: book.id,
    name: book.name,
    holdings: book.holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      weight: h.weight,
      allocation: Math.round(h.weight * 1000) / 10,
    })),
  }));
  res.json({ investors });
});

// Preview a mimic (no portfolio write). Used by the marketing UI and mobile.
router.post('/mimic', optionalAuth, async (req, res) => {
  try {
    const { investor, budget } = parseMimicBody(req.body);
    const result = await buildMimicPortfolio(investor, budget);
    res.json(result);
  } catch (error) {
    sendMimicError(res, error);
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
        holdings: true,
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

// Persist a mimic onto an existing portfolio
router.post('/:id/mimic', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { investor, budget } = parseMimicBody(req.body);

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

    const result = await buildMimicPortfolio(investor, budget);
    const allocation = mimicAllocationSnapshot(investor);

    await prisma.$transaction(async (tx) => {
      await tx.portfolio.update({
        where: { id },
        data: {
          mimicInvestor: result.investor,
          mimicAllocation: allocation,
        },
      });

      await tx.portfolioHolding.deleteMany({ where: { portfolioId: id } });

      const sized = result.holdings.filter((h) => h.shares > 0);
      if (sized.length > 0) {
        await tx.portfolioHolding.createMany({
          data: sized.map((h) => ({
            portfolioId: id,
            ticker: h.ticker,
            shares: h.shares,
            avgCostBasis: h.price,
          })),
        });

        await tx.portfolioTransaction.createMany({
          data: sized.map((h) => ({
            portfolioId: id,
            ticker: h.ticker,
            type: 'BUY',
            shares: h.shares,
            price: h.price,
            totalAmount: h.allocated,
            executedAt: new Date(),
            notes: `Mimic ${result.investorName}`,
          })),
        });
      }
    });

    res.json(result);
  } catch (error) {
    sendMimicError(res, error);
  }
});

export default router;
