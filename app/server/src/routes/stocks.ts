import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest, requirePlan } from '../middleware/auth';

const router = Router();
const FMP_API_KEY = process.env.FMP_API_KEY || 'W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Helper to format ticker for FMP API (BRK.B -> BRK-B)
function formatTicker(ticker: string): string {
  return ticker.replace(/\./g, '-');
}

// Search stocks
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const response = await axios.get(
      `${FMP_BASE_URL}/search?query=${encodeURIComponent(q)}&limit=10&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Search error:', error.message);
    // Return empty array on error so UI doesn't break
    res.json([]);
  }
});

// Get stock quote
router.get('/quote/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;
    const formattedTicker = formatTicker(ticker);

    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${formattedTicker}?apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    const quote = response.data[0];

    if (!quote) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(quote);
  } catch (error: any) {
    console.error(`Quote error for ${req.params.ticker}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch stock data', message: error.message });
  }
});

// Get batch quotes - split into smaller chunks if needed
router.get('/quotes', async (req, res, next) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({ error: 'Symbols parameter required' });
    }

    // Format tickers (BRK.B -> BRK-B)
    const formattedSymbols = symbols.split(',').map(formatTicker).join(',');

    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${formattedSymbols}?apikey=${FMP_API_KEY}`,
      { timeout: 15000 }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Batch quotes error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stock data', message: error.message });
  }
});

// Get key metrics
router.get('/metrics/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;
    const formattedTicker = formatTicker(ticker);

    const response = await axios.get(
      `${FMP_BASE_URL}/key-metrics/${formattedTicker}?limit=1&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data[0] || null);
  } catch (error: any) {
    console.error('Metrics error:', error.message);
    res.json(null);
  }
});

// Get historical prices
router.get('/historical/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;
    const formattedTicker = formatTicker(ticker);
    const { from, to } = req.query;

    const response = await axios.get(
      `${FMP_BASE_URL}/historical-price-full/${formattedTicker}?from=${from}&to=${to}&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data.historical || []);
  } catch (error: any) {
    console.error('Historical error:', error.message);
    res.json([]);
  }
});

// Get income statement
router.get('/income/:ticker', authenticate, requirePlan(['PRO', 'ELITE']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const formattedTicker = formatTicker(ticker);
    const { limit = '4' } = req.query;

    const response = await axios.get(
      `${FMP_BASE_URL}/income-statement/${formattedTicker}?limit=${limit}&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Income statement error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Get balance sheet
router.get('/balance/:ticker', authenticate, requirePlan(['PRO', 'ELITE']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;
    const formattedTicker = formatTicker(ticker);
    const { limit = '4' } = req.query;

    const response = await axios.get(
      `${FMP_BASE_URL}/balance-sheet-statement/${formattedTicker}?limit=${limit}&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Balance sheet error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Get market indices
router.get('/indices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const indices = ['^GSPC', '^IXIC', '^DJI', '^RUT'];
    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${indices.join(',')}?apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Indices error:', error.message);
    res.json([]);
  }
});

// Get trending stocks
router.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await axios.get(
      `${FMP_BASE_URL}/stock_market/actives?apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    res.json(response.data.slice(0, 10));
  } catch (error: any) {
    console.error('Trending error:', error.message);
    res.json([]);
  }
});

// Get all stocks for screener (using a predefined list of popular stocks)
router.get('/screener', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use popular stocks for the screener (formatted for FMP API)
    const popularStocks = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK-B', 'JPM', 'V', 
      'WMT', 'JNJ', 'NFLX', 'DIS', 'UBER', 'PYPL', 'INTC', 'AMD', 'CRM', 'BAC', 
      'PFE', 'KO', 'PEP', 'MCD', 'NKE', 'XOM', 'CVX', 'UNH', 'ABBV', 'TMO', 
      'COST', 'AVGO', 'TXN', 'QCOM', 'HON', 'UNP', 'RTX', 'LMT', 'NEE', 'DUK'
    ];
    
    const response = await axios.get(
      `${FMP_BASE_URL}/quote/${popularStocks.join(',')}?apikey=${FMP_API_KEY}`,
      { timeout: 15000 }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Screener error:', error.message);
    res.json([]);
  }
});

export { router as stocksRouter };
