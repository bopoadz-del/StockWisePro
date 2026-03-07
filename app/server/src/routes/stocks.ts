import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest, requirePlan } from '../middleware/auth';
import { alphaVantageService } from '../services/alphaVantageService';
import { prisma } from '../utils/prisma';

const router = Router();

// Real-time stock data cache (in-memory)
let cachedStockData: any[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Mock stock data for fallback when API fails
const MOCK_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 195.89, change: 2.45, changesPercentage: 1.27, marketCap: 3050000000000, pe: 30.2, volume: 54200000 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 420.55, change: 5.32, changesPercentage: 1.28, marketCap: 3120000000000, pe: 36.8, volume: 22100000 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 175.98, change: -1.23, changesPercentage: -0.69, marketCap: 2180000000000, pe: 25.4, volume: 18900000 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.35, change: 3.12, changesPercentage: 1.78, marketCap: 1850000000000, pe: 58.9, volume: 38900000 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: -8.75, changesPercentage: -3.40, marketCap: 790000000000, pe: 72.5, volume: 98700000 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 875.28, change: 15.42, changesPercentage: 1.79, marketCap: 2150000000000, pe: 72.8, volume: 45200000 },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 505.68, change: 7.89, changesPercentage: 1.58, marketCap: 1290000000000, pe: 26.4, volume: 15200000 },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', price: 412.15, change: 1.85, changesPercentage: 0.45, marketCap: 890000000000, pe: 9.2, volume: 3200000 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 195.42, change: -0.58, changesPercentage: -0.30, marketCap: 560000000000, pe: 11.8, volume: 8900000 },
  { symbol: 'V', name: 'Visa Inc.', price: 285.78, change: 2.15, changesPercentage: 0.76, marketCap: 620000000000, pe: 32.5, volume: 4200000 },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 165.32, change: 0.89, changesPercentage: 0.54, marketCap: 445000000000, pe: 25.8, volume: 5600000 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 152.18, change: -1.24, changesPercentage: -0.81, marketCap: 366000000000, pe: 15.2, volume: 6200000 },
];

// Helper to format ticker for display
function formatTickerForDisplay(ticker: string): string {
  return ticker.replace(/-/g, '.');
}

// Search stocks - uses Alpha Vantage if available, else mock
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Try Alpha Vantage first
    const results = await alphaVantageService.search(q);
    
    if (results.length > 0) {
      return res.json(results);
    }

    // Fallback to mock data search
    const mockResults = MOCK_STOCKS
      .filter(s => 
        s.symbol.toLowerCase().includes(q.toLowerCase()) ||
        s.name.toLowerCase().includes(q.toLowerCase())
      )
      .map(s => ({ symbol: s.symbol, name: s.name }));
    
    res.json(mockResults);
  } catch (error: any) {
    console.error('Search error:', error.message);
    res.json([]);
  }
});

// Get stock quote - uses Alpha Vantage if available, else mock
router.get('/quote/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;

    // Try Alpha Vantage first
    const quote = await alphaVantageService.getQuote(ticker);
    
    if (quote && quote.price > 0) {
      // Enrich with mock data for fields Alpha Vantage doesn't provide
      const mockData = MOCK_STOCKS.find(s => s.symbol === ticker.toUpperCase());
      return res.json({
        ...quote,
        name: mockData?.name || quote.name,
        marketCap: mockData?.marketCap || 0,
        pe: mockData?.pe || 20,
      });
    }

    // Fallback to mock data
    const mockStock = MOCK_STOCKS.find(s => s.symbol === ticker.toUpperCase());
    if (mockStock) {
      return res.json({...mockStock, _source: 'mock'});
    }

    res.status(404).json({ error: 'Stock not found' });
  } catch (error: any) {
    console.error(`Quote error for ${req.params.ticker}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// Debug endpoint to check Alpha Vantage directly
router.get('/debug/quote/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const axios = require('axios');
    
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: ticker,
        apikey: process.env.ALPHA_VANTAGE_API_KEY,
      },
      timeout: 10000,
    });
    
    res.json({
      keyConfigured: !!process.env.ALPHA_VANTAGE_API_KEY,
      keyPrefix: process.env.ALPHA_VANTAGE_API_KEY?.substring(0, 4),
      apiResponse: response.data,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      response: error.response?.data,
    });
  }
});

// Get batch quotes
router.get('/quotes', async (req, res, next) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({ error: 'Symbols parameter required' });
    }

    const symbolList = symbols.split(',');
    
    // Try Alpha Vantage
    const quotes = await alphaVantageService.getBatchQuotes(symbolList);
    
    if (quotes.length > 0) {
      // Enrich with mock data
      const enrichedQuotes = quotes.map(q => {
        const mockData = MOCK_STOCKS.find(s => s.symbol === q.symbol.toUpperCase());
        return {
          ...q,
          name: mockData?.name || q.name,
          marketCap: mockData?.marketCap || 0,
          pe: mockData?.pe || 20,
        };
      });
      return res.json(enrichedQuotes);
    }

    // Fallback to mock data
    const mockQuotes = MOCK_STOCKS.filter(s => 
      symbolList.some(sym => sym.toUpperCase() === s.symbol)
    );
    
    res.json(mockQuotes);
  } catch (error: any) {
    console.error('Batch quotes error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// Get key metrics (mock - Alpha Vantage requires premium)
router.get('/metrics/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;

    // Return mock metrics based on the ticker
    const mockStock = MOCK_STOCKS.find(s => s.symbol === ticker.toUpperCase());
    
    res.json({
      symbol: ticker.toUpperCase(),
      peRatio: mockStock?.pe || 20,
      priceToBookRatio: 3.5,
      priceToSalesRatio: 5.2,
      roe: 0.15,
      roa: 0.08,
      debtToEquity: 0.5,
      currentRatio: 2.0,
      quickRatio: 1.5,
      dividendYield: 0.02,
      payoutRatio: 0.3,
    });
  } catch (error: any) {
    console.error('Metrics error:', error.message);
    res.json(null);
  }
});

// Get historical prices - uses Alpha Vantage if available
router.get('/historical/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;

    // Try Alpha Vantage
    const historical = await alphaVantageService.getHistoricalPrices(ticker);
    
    if (historical.length > 0) {
      return res.json(historical);
    }

    // Generate mock historical data
    const mockStock = MOCK_STOCKS.find(s => s.symbol === ticker.toUpperCase());
    const basePrice = mockStock?.price || 100;
    const change = mockStock?.change || 0;
    
    const mockHistorical = [];
    for (let i = 90; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const randomVariation = (Math.random() - 0.5) * basePrice * 0.02;
      const price = basePrice - (change / 90 * i) + randomVariation;
      mockHistorical.push({
        date: date.toISOString().split('T')[0],
        open: price * 0.99,
        high: price * 1.02,
        low: price * 0.98,
        close: price,
        volume: 1000000 + Math.floor(Math.random() * 5000000),
      });
    }
    
    res.json(mockHistorical);
  } catch (error: any) {
    console.error('Historical error:', error.message);
    res.json([]);
  }
});

// Get income statement (mock)
router.get('/income/:ticker', authenticate, requirePlan(['PRO', 'ELITE']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;

    res.json([
      {
        date: '2024-09-30',
        symbol: ticker,
        revenue: 100000000000,
        netIncome: 20000000000,
        grossProfit: 40000000000,
        eps: 5.5,
      }
    ]);
  } catch (error: any) {
    console.error('Income statement error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Get balance sheet (mock)
router.get('/balance/:ticker', authenticate, requirePlan(['PRO', 'ELITE']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticker } = req.params;

    res.json([
      {
        date: '2024-09-30',
        symbol: ticker,
        totalAssets: 500000000000,
        totalLiabilities: 200000000000,
        totalStockholdersEquity: 300000000000,
        longTermDebt: 50000000000,
      }
    ]);
  } catch (error: any) {
    console.error('Balance sheet error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Get market indices (mock with ETF proxies)
router.get('/indices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json([
      { symbol: 'SPX', name: 'S&P 500', price: 5950.32, change: 42.15, changesPercentage: 0.71 },
      { symbol: 'NDX', name: 'NASDAQ', price: 20850.45, change: 185.32, changesPercentage: 0.90 },
      { symbol: 'DJI', name: 'Dow Jones', price: 43450.28, change: 125.48, changesPercentage: 0.29 },
      { symbol: 'RUT', name: 'Russell 2000', price: 2285.64, change: 18.92, changesPercentage: 0.83 },
    ]);
  } catch (error: any) {
    console.error('Indices error:', error.message);
    res.json([]);
  }
});

// Get trending stocks
router.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return first 10 mock stocks as trending
    res.json(MOCK_STOCKS.slice(0, 10));
  } catch (error: any) {
    console.error('Trending error:', error.message);
    res.json([]);
  }
});

// Get all stocks for screener - uses cached data or mock
router.get('/screener', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_TTL && cachedStockData.length > 0) {
      return res.json(cachedStockData);
    }

    // Try Alpha Vantage for a few stocks (respect rate limit)
    const quotes = await alphaVantageService.getScreenerStocks();
    
    if (quotes.length > 0) {
      // Enrich with mock data
      const enrichedQuotes = quotes.map(q => {
        const mockData = MOCK_STOCKS.find(s => s.symbol === q.symbol.toUpperCase());
        return {
          ...q,
          name: mockData?.name || q.name,
          marketCap: mockData?.marketCap || 0,
          pe: mockData?.pe || 20,
        };
      });
      
      // Update cache
      cachedStockData = enrichedQuotes;
      lastCacheUpdate = now;
      
      return res.json(enrichedQuotes);
    }

    // Fallback to all mock stocks
    res.json(MOCK_STOCKS);
  } catch (error: any) {
    console.error('Screener error:', error.message);
    // Always return mock data on error
    res.json(MOCK_STOCKS);
  }
});

export { router as stocksRouter };
