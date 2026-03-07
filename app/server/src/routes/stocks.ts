import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest, requirePlan } from '../middleware/auth';

const router = Router();
const FMP_API_KEY = process.env.FMP_API_KEY || 'W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Search stocks
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const response = await axios.get(
      `${FMP_BASE_URL}/search?query=${encodeURIComponent(q)}&limit=10&apikey=${FMP_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Get stock quote
router.get('/quote/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;

    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${ticker}?apikey=${FMP_API_KEY}`
    );

    const quote = response.data[0];

    if (!quote) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Get batch quotes
router.get('/quotes', async (req, res, next) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({ error: 'Symbols parameter required' });
    }

    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${symbols}?apikey=${FMP_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Get key metrics
router.get('/metrics/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;

    const response = await axios.get(
      `${FMP_BASE_URL}/key-metrics/${ticker}?limit=1&apikey=${FMP_API_KEY}`
    );

    res.json(response.data[0] || null);
  } catch (error) {
    next(error);
  }
});

// Get historical prices
router.get('/historical/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;
    const { from, to } = req.query;

    const response = await axios.get(
      `${FMP_BASE_URL}/historical-price-full/${ticker}?from=${from}&to=${to}&apikey=${FMP_API_KEY}`
    );

    res.json(response.data.historical || []);
  } catch (error) {
    next(error);
  }
});

// Get income statement
router.get('/income/:ticker', authenticate, requirePlan(['PRO', 'ELITE']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const { limit = '4' } = req.query;

    const response = await axios.get(
      `${FMP_BASE_URL}/income-statement/${ticker}?limit=${limit}&apikey=${FMP_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Get balance sheet
router.get('/balance/:ticker', authenticate, requirePlan(['PRO', 'ELITE']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const { limit = '4' } = req.query;

    const response = await axios.get(
      `${FMP_BASE_URL}/balance-sheet-statement/${ticker}?limit=${limit}&apikey=${FMP_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Get market indices
router.get('/indices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const indices = ['^GSPC', '^IXIC', '^DJI', '^RUT'];
    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${indices.join(',')}?apikey=${FMP_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Get trending stocks
router.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get most active stocks
    const response = await axios.get(
      `${FMP_BASE_URL}/stock_market/actives?apikey=${FMP_API_KEY}`
    );

    res.json(response.data.slice(0, 10));
  } catch (error) {
    next(error);
  }
});

// Get all stocks for screener (using a predefined list of popular stocks)
router.get('/screener', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use popular stocks for the screener
    const popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'WMT', 'JNJ', 'NFLX', 'DIS', 'UBER', 'PYPL', 'INTC', 'AMD', 'CRM', 'BAC', 'PFE', 'KO', 'PEP', 'MCD', 'NKE', 'XOM', 'CVX', 'UNH', 'ABBV', 'TMO', 'COST', 'AVGO', 'TXN', 'QCOM', 'HON', 'UNP', 'RTX', 'LMT', 'NEE', 'DUK', 'PLD', 'AMT', 'LIN', 'APD', 'FCX', 'T', 'VZ', 'CHTR', 'GM', 'F', 'STLA'];
    
    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${popularStocks.join(',')}?apikey=${FMP_API_KEY}`
    );

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

export { router as stocksRouter };
