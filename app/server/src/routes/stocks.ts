import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { apiKeyRateLimiter } from '../middleware/rateLimiter';
import { prisma } from '../config/database';
import { z } from 'zod';
import {
  DEFAULT_SCREENER_TICKERS,
  UnknownTickerError,
  getHistoricalPrices,
  scoreTicker,
  scoreTickers,
  yahooSearch,
  type ScoreOptions,
  type WeightPreset,
} from '../services/openbox';

const router = Router();

const weightSchema = z.object({
  valuation: z.number().min(0).max(100).optional(),
  profitability: z.number().min(0).max(100).optional(),
  growth: z.number().min(0).max(100).optional(),
  financialHealth: z.number().min(0).max(100).optional(),
  momentum: z.number().min(0).max(100).optional(),
});

const presetSchema = z.enum(['balanced', 'value', 'growth', 'quality']);

function scoreOptionsFromRequest(req: { query?: Record<string, unknown>; body?: Record<string, unknown> }): ScoreOptions {
  const body = (req.body || {}) as Record<string, unknown>;
  const query = (req.query || {}) as Record<string, unknown>;
  const presetRaw = (body.preset ?? query.preset) as string | undefined;
  const preset = presetRaw && presetSchema.safeParse(presetRaw).success ? (presetRaw as WeightPreset) : undefined;

  const rawWeights = body.weights ?? {
    valuation: query.valuation !== undefined ? Number(query.valuation) : undefined,
    profitability: query.profitability !== undefined ? Number(query.profitability) : undefined,
    growth: query.growth !== undefined ? Number(query.growth) : undefined,
    financialHealth: query.financialHealth !== undefined ? Number(query.financialHealth) : undefined,
    momentum: query.momentum !== undefined ? Number(query.momentum) : undefined,
  };

  const parsed = weightSchema.safeParse(rawWeights);
  const weights = parsed.success ? parsed.data : undefined;
  const hasWeights = weights && Object.values(weights).some((value) => value !== undefined);

  return {
    preset,
    weights: hasWeights ? weights : undefined,
  };
}

function sendScoreError(res: import('express').Response, error: unknown, ticker: string) {
  if (error instanceof UnknownTickerError) {
    return res.status(404).json({ error: 'Unknown ticker', ticker: error.ticker });
  }
  console.error('Score error:', error);
  return res.status(502).json({ error: 'Failed to score ticker', ticker });
}

function toQuote(score: Awaited<ReturnType<typeof scoreTicker>>) {
  return score.quote;
}

// ── Static paths first (must precede /:ticker) ──────────────────────────────

router.get('/', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { page = '1', limit = '50', search, sector, exchange } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: Record<string, unknown> = {};

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

router.get('/search', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { q, limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const hits = await yahooSearch(q, parseInt(limit as string, 10) || 10);
    if (hits.length > 0) {
      return res.json(hits);
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

    res.json(stocks.map((s) => ({ symbol: s.ticker, name: s.name })));
  } catch (error) {
    console.error('Search stocks error:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

router.get('/screener', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { scores, errors } = await scoreTickers(DEFAULT_SCREENER_TICKERS, scoreOptionsFromRequest(req));
    res.json(
      scores.map((score) => ({
        ...score.quote,
        score: score.finalScore,
        signal: score.action,
        pillars: score.pillars,
        sources: score.sources,
        warnings: score.warnings,
        sparkline: score.sparkline,
      }))
    );
    if (errors.length) {
      console.warn('Screener partial errors', errors);
    }
  } catch (error) {
    console.error('Screener error:', error);
    res.status(502).json({ error: 'Failed to load screener' });
  }
});

router.get('/quotes', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const symbols = String(req.query.symbols || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (symbols.length === 0) {
      return res.status(400).json({ error: 'symbols query parameter required' });
    }

    const { scores } = await scoreTickers(symbols, scoreOptionsFromRequest(req));
    res.json(scores.map(toQuote));
  } catch (error) {
    console.error('Batch quotes error:', error);
    res.status(502).json({ error: 'Failed to get quotes' });
  }
});

router.get('/indices', optionalAuth, apiKeyRateLimiter, async (_req, res) => {
  try {
    const { scores } = await scoreTickers(['SPY', 'QQQ', 'DIA', 'IWM']);
    res.json(scores.map(toQuote));
  } catch (error) {
    console.error('Indices error:', error);
    res.status(502).json({ error: 'Failed to get indices' });
  }
});

router.get('/trending', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { scores } = await scoreTickers(DEFAULT_SCREENER_TICKERS.slice(0, 8), scoreOptionsFromRequest(req));
    res.json(scores.map((score) => ({ ...toQuote(score), score: score.finalScore, signal: score.action })));
  } catch (error) {
    console.error('Trending error:', error);
    res.status(502).json({ error: 'Failed to get trending stocks' });
  }
});

router.post('/scores', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      tickers: z.array(z.string()).min(1).max(20),
      weights: weightSchema.optional(),
      preset: presetSchema.optional(),
    });
    const body = schema.parse(req.body);
    const { scores, errors } = await scoreTickers(body.tickers, {
      weights: body.weights,
      preset: body.preset,
    });
    res.json({ scores, errors });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Batch scores error:', error);
    res.status(502).json({ error: 'Failed to score tickers' });
  }
});

router.get('/quote/:ticker', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const score = await scoreTicker(req.params.ticker, scoreOptionsFromRequest(req));
    res.json(score.quote);
  } catch (error) {
    sendScoreError(res, error, req.params.ticker);
  }
});

router.get('/metrics/:ticker', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const score = await scoreTicker(req.params.ticker, scoreOptionsFromRequest(req));
    res.json(score.metrics);
  } catch (error) {
    sendScoreError(res, error, req.params.ticker);
  }
});

router.get('/historical/:ticker', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const range = req.query.range === '3mo' || req.query.range === '2y' ? req.query.range : '1y';
    const prices = await getHistoricalPrices(req.params.ticker, range);
    if (prices.length === 0) {
      return res.status(404).json({ error: 'Unknown ticker', ticker: req.params.ticker.toUpperCase() });
    }
    res.json(prices.map((bar) => ({ date: bar.date, open: bar.close, high: bar.close, low: bar.close, close: bar.close, volume: 0 })));
  } catch (error) {
    console.error('Historical error:', error);
    res.status(502).json({ error: 'Failed to get price history' });
  }
});

// ── Ticker-scoped OpenBox score ─────────────────────────────────────────────

router.get('/:ticker/score', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const score = await scoreTicker(req.params.ticker, scoreOptionsFromRequest(req));
    res.json(score);
  } catch (error) {
    sendScoreError(res, error, req.params.ticker);
  }
});

router.post('/:ticker/score', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const score = await scoreTicker(req.params.ticker, scoreOptionsFromRequest(req));
    res.json(score);
  } catch (error) {
    sendScoreError(res, error, req.params.ticker);
  }
});

router.get('/:ticker/quote', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const score = await scoreTicker(req.params.ticker, scoreOptionsFromRequest(req));
    res.json(score.quote);
  } catch (error) {
    sendScoreError(res, error, req.params.ticker);
  }
});

router.get('/:ticker/historical', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const range = req.query.range === '3mo' || req.query.range === '2y' ? req.query.range : '1y';
    const prices = await getHistoricalPrices(req.params.ticker, range);
    if (prices.length === 0) {
      return res.status(404).json({ error: 'Unknown ticker', ticker: req.params.ticker.toUpperCase() });
    }
    res.json({ ticker: req.params.ticker.toUpperCase(), prices });
  } catch (error) {
    console.error('Historical error:', error);
    res.status(502).json({ error: 'Failed to get price history' });
  }
});

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

    if (prices.length > 0) {
      return res.json({ ticker: ticker.toUpperCase(), prices });
    }

    const range = parseInt(days as string, 10) <= 90 ? '3mo' : '1y';
    const yahoo = await getHistoricalPrices(ticker, range);
    res.json({
      ticker: ticker.toUpperCase(),
      prices: yahoo.map((bar) => ({
        date: bar.date,
        price: bar.close,
        close: bar.close,
      })),
    });
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Failed to get price history' });
  }
});

router.get('/:ticker', optionalAuth, apiKeyRateLimiter, async (req, res) => {
  try {
    const { ticker } = req.params;

    const stock = await prisma.stock.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    if (stock) {
      return res.json(stock);
    }

    try {
      const score = await scoreTicker(ticker);
      return res.json({
        ...score.quote,
        ticker: score.ticker,
        name: score.name,
        score: score.finalScore,
        signal: score.action,
      });
    } catch (error) {
      if (error instanceof UnknownTickerError) {
        return res.status(404).json({ error: 'Unknown ticker', ticker: error.ticker });
      }
      throw error;
    }
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

router.post('/bulk', authenticate, apiKeyRateLimiter, async (req, res) => {
  try {
    const schema = z.object({
      tickers: z.array(z.string()).min(1).max(100),
    });

    const { tickers } = schema.parse(req.body);

    const stocks = await prisma.stock.findMany({
      where: {
        ticker: { in: tickers.map((t) => t.toUpperCase()) },
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
