import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { apiKeyRateLimiter } from '../middleware/rateLimiter';
import { prisma } from '../config/database';
import { z } from 'zod';

const router = Router();

// Get all stocks with pagination
router.get('/', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { page = '1', limit = '50', search, sector, exchange } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { ticker: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    if (sector) where.sector = sector;
    if (exchange) where.exchange = exchange;
    
    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        skip,
        take,
        orderBy: { ticker: 'asc' },
      }),
      prisma.stock.count({ where }),
    ]);
    
    res.json({
      stocks,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('Get stocks error:', error);
    res.status(500).json({ error: 'Failed to get stocks' });
  }
});

// Get single stock
router.get('/:ticker', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { ticker } = req.params;
    
    const stock = await prisma.stock.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });
    
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    res.json(stock);
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

// Get stock price history
router.get('/:ticker/history', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    
    const prices = await prisma.stockPrice.findMany({
      where: {
        ticker: ticker.toUpperCase(),
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });
    
    res.json({ ticker: ticker.toUpperCase(), prices });
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Failed to get price history' });
  }
});

// Search stocks
router.get('/search', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { q, limit = '10' } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }
    
    const stocks = await prisma.stock.findMany({
      where: {
        OR: [
          { ticker: { startsWith: q.toUpperCase() } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: parseInt(limit as string),
      orderBy: { ticker: 'asc' },
    });
    
    res.json(stocks);
  } catch (error) {
    console.error('Search stocks error:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

// Bulk stock data (requires auth)
router.post('/bulk', authenticate, apiKeyRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      tickers: z.array(z.string()).min(1).max(100),
    });
    
    const { tickers } = schema.parse(req.body);
    
    const stocks = await prisma.stock.findMany({
      where: {
        ticker: { in: tickers.map(t => t.toUpperCase()) },
      },
    });
    
    res.json(stocks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Bulk stocks error:', error);
    res.status(500).json({ error: 'Failed to get stocks' });
  }
});

export default router;
