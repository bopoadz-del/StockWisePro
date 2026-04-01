// Twelve Data API Integration
// Free tier: 800 API calls/day, works on Render (no IP blocking)

import axios from 'axios';

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '';
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

// Popular stocks for screener
const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK.B', 'JPM', 'V',
  'WMT', 'JNJ', 'NFLX', 'DIS', 'UBER', 'PYPL', 'INTC', 'AMD', 'CRM', 'BAC',
  'PFE', 'KO', 'PEP', 'MCD', 'NKE', 'XOM', 'CVX', 'UNH', 'ABBV', 'TMO',
  'COST', 'AVGO', 'TXN', 'QCOM', 'HON', 'UNP', 'RTX', 'LMT', 'NEE', 'DUK'
];

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly TTL: number = 60 * 1000; // 1 minute cache

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new SimpleCache();

// Rate limiting tracking
class RateLimiter {
  private lastCallTime: number = 0;
  private minInterval: number = 200; // Minimum 200ms between calls (5 calls/second max)
  private consecutiveErrors: number = 0;
  private lastErrorTime: number = 0;
  private cooldownPeriod: number = 60000; // 1 minute cooldown after errors

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Check if we're in cooldown period due to errors
    if (this.consecutiveErrors >= 3) {
      const timeSinceLastError = now - this.lastErrorTime;
      if (timeSinceLastError < this.cooldownPeriod) {
        console.log(`Rate limiter: In cooldown period, waiting ${this.cooldownPeriod - timeSinceLastError}ms`);
        throw new Error('API_COOLDOWN');
      }
      // Reset error count after cooldown
      this.consecutiveErrors = 0;
    }
    
    // Enforce minimum interval between calls
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
    }
    
    this.lastCallTime = Date.now();
  }

  recordError(): void {
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();
    console.log(`Rate limiter: Error recorded, consecutive errors: ${this.consecutiveErrors}`);
  }

  recordSuccess(): void {
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
    }
  }
}

const rateLimiter = new RateLimiter();

export interface TDQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  latestTradingDay: string;
  open: number;
  high: number;
  low: number;
  previousClose: number;
}

export interface TDSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
}

export interface TDHistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TwelveDataService {
  // Get stock quote with retry logic
  async getQuote(symbol: string): Promise<TDQuote | null> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return null;
    }

    const cacheKey = `quote:${symbol.toUpperCase()}`;
    const cached = cache.get<TDQuote>(cacheKey);
    if (cached) {
      console.log(`Cache hit for quote: ${symbol}`);
      return cached;
    }

    try {
      await rateLimiter.waitIfNeeded();
    } catch (e: any) {
      if (e.message === 'API_COOLDOWN') {
        console.log('API in cooldown, skipping request');
        return null;
      }
      throw e;
    }

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE_URL}/quote`, {
        params: {
          symbol: symbol.toUpperCase().replace(/-/g, '.'),
          apikey: TWELVE_DATA_API_KEY,
        },
        timeout: 10000,
      });

      const data = response.data;
      
      // Check for rate limit or API error
      if (data.code) {
        console.error(`Twelve Data error for ${symbol}:`, data.message);
        if (data.code === 429 || data.message?.toLowerCase().includes('rate') || data.message?.toLowerCase().includes('limit')) {
          rateLimiter.recordError();
        }
        return null;
      }

      if (!data.close) {
        return null;
      }

      rateLimiter.recordSuccess();

      // Format ticker back from BRK.B to BRK-B for consistency
      const formattedSymbol = data.symbol.replace(/\./g, '-');

      const quote: TDQuote = {
        symbol: formattedSymbol,
        name: data.name || formattedSymbol,
        price: parseFloat(data.close),
        change: parseFloat(data.change || '0'),
        changePercent: parseFloat(data.percent_change || '0'),
        volume: parseInt(data.volume || '0'),
        latestTradingDay: data.datetime?.split(' ')[0] || new Date().toISOString().split('T')[0],
        open: parseFloat(data.open || '0'),
        high: parseFloat(data.high || '0'),
        low: parseFloat(data.low || '0'),
        previousClose: parseFloat(data.previous_close || '0'),
      };

      cache.set(cacheKey, quote);
      return quote;
    } catch (error: any) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      if (error.response?.status === 429) {
        rateLimiter.recordError();
      }
      return null;
    }
  }

  // Search stocks with caching
  async search(keywords: string): Promise<TDSearchResult[]> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return [];
    }

    const cacheKey = `search:${keywords.toLowerCase()}`;
    const cached = cache.get<TDSearchResult[]>(cacheKey);
    if (cached) {
      console.log(`Cache hit for search: ${keywords}`);
      return cached;
    }

    // Handle single character searches specially - they tend to return too many ETF matches
    const isSingleChar = keywords.length === 1;

    try {
      await rateLimiter.waitIfNeeded();
    } catch (e: any) {
      if (e.message === 'API_COOLDOWN') {
        console.log('API in cooldown, returning empty search results');
        return [];
      }
      throw e;
    }

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE_URL}/symbol_search`, {
        params: {
          symbol: keywords,
          apikey: TWELVE_DATA_API_KEY,
        },
        timeout: 10000,
      });

      const data = response.data;
      
      // Check for API error
      if (data.code) {
        console.error('Twelve Data search error:', data.message);
        if (data.code === 429 || data.message?.toLowerCase().includes('rate') || data.message?.toLowerCase().includes('limit')) {
          rateLimiter.recordError();
        }
        return [];
      }

      const matches = data.data;
      if (!matches || !Array.isArray(matches)) {
        return [];
      }

      rateLimiter.recordSuccess();

      // For single char searches, prioritize exact symbol matches and common stocks
      let filteredMatches = matches.filter((match: any) => match.country === 'United States');
      
      if (isSingleChar) {
        // Prioritize: exact symbol match first, then common stocks (not ETFs)
        filteredMatches.sort((a: any, b: any) => {
          const aExactMatch = a.symbol.toUpperCase() === keywords.toUpperCase();
          const bExactMatch = b.symbol.toUpperCase() === keywords.toUpperCase();
          
          if (aExactMatch && !bExactMatch) return -1;
          if (bExactMatch && !aExactMatch) return 1;
          
          // Prioritize common stocks over ETFs
          const aIsStock = a.instrument_type === 'Common Stock';
          const bIsStock = b.instrument_type === 'Common Stock';
          
          if (aIsStock && !bIsStock) return -1;
          if (bIsStock && !aIsStock) return 1;
          
          return 0;
        });
        
        // Limit to top 5 for single char searches
        filteredMatches = filteredMatches.slice(0, 5);
      } else {
        // Limit to top 10 for other searches
        filteredMatches = filteredMatches.slice(0, 10);
      }

      const results = filteredMatches.map((match: any) => ({
        symbol: match.symbol.replace(/\./g, '-'),
        name: match.instrument_name,
        type: match.instrument_type,
        exchange: match.exchange,
        currency: match.currency || 'USD',
      }));

      cache.set(cacheKey, results);
      return results;
    } catch (error: any) {
      console.error('Search error:', error.message);
      if (error.response?.status === 429) {
        rateLimiter.recordError();
      }
      return [];
    }
  }

  // Get batch quotes (Twelve Data supports multiple symbols)
  async getBatchQuotes(symbols: string[]): Promise<TDQuote[]> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return [];
    }

    if (!symbols || symbols.length === 0) {
      return [];
    }

    // Check cache first for each symbol
    const results: TDQuote[] = [];
    const symbolsToFetch: string[] = [];

    for (const symbol of symbols) {
      const cacheKey = `quote:${symbol.toUpperCase()}`;
      const cached = cache.get<TDQuote>(cacheKey);
      if (cached) {
        results.push(cached);
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // If all symbols were cached, return immediately
    if (symbolsToFetch.length === 0) {
      console.log(`All ${symbols.length} symbols found in cache`);
      return results;
    }

    console.log(`Fetching batch quotes for ${symbolsToFetch.length} symbols: ${symbolsToFetch.join(',')}`);

    try {
      await rateLimiter.waitIfNeeded();
    } catch (e: any) {
      if (e.message === 'API_COOLDOWN') {
        console.log('API in cooldown, returning cached results only');
        return results;
      }
      throw e;
    }

    try {
      // Twelve Data supports batch requests with comma-separated symbols
      // Format symbols: replace - with . for API (BRK-B -> BRK.B)
      const formattedSymbols = symbolsToFetch
        .slice(0, 5) // Limit to 5 for free tier
        .map(s => s.toUpperCase().replace(/-/g, '.'));
      
      const symbolString = formattedSymbols.join(',');

      const response = await axios.get(`${TWELVE_DATA_BASE_URL}/quote`, {
        params: {
          symbol: symbolString,
          apikey: TWELVE_DATA_API_KEY,
        },
        timeout: 10000,
      });

      const data = response.data;
      
      // Check for API error
      if (data.code) {
        console.error('Twelve Data batch error:', data.message);
        if (data.code === 429 || data.message?.toLowerCase().includes('rate') || data.message?.toLowerCase().includes('limit')) {
          rateLimiter.recordError();
        }
        return results; // Return any cached results
      }

      rateLimiter.recordSuccess();

      // Batch response is an object keyed by symbol: { AAPL: {...}, MSFT: {...} }
      // Single symbol response is a single object with 'symbol' property
      const quotesArray: any[] = [];
      
      if (data.symbol) {
        // Single symbol response
        if (data.close) {
          quotesArray.push(data);
        }
      } else if (typeof data === 'object' && data !== null) {
        // Batch response - extract values
        Object.values(data).forEach((quote: any) => {
          if (quote && quote.close && quote.symbol) {
            quotesArray.push(quote);
          }
        });
      }

      console.log(`Received ${quotesArray.length} quotes from batch request`);

      const newQuotes = quotesArray
        .filter((q: any) => q.close && q.symbol)
        .map((q: any) => {
          const quote: TDQuote = {
            symbol: q.symbol.replace(/\./g, '-'),
            name: q.name || q.symbol,
            price: parseFloat(q.close),
            change: parseFloat(q.change || '0'),
            changePercent: parseFloat(q.percent_change || '0'),
            volume: parseInt(q.volume || '0'),
            latestTradingDay: q.datetime?.split(' ')[0] || new Date().toISOString().split('T')[0],
            open: parseFloat(q.open || '0'),
            high: parseFloat(q.high || '0'),
            low: parseFloat(q.low || '0'),
            previousClose: parseFloat(q.previous_close || '0'),
          };
          
          // Cache individual quote
          cache.set(`quote:${quote.symbol.toUpperCase()}`, quote);
          return quote;
        });

      return [...results, ...newQuotes];
    } catch (error: any) {
      console.error('Batch quotes error:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
        if (error.response.status === 429) {
          rateLimiter.recordError();
        }
      }
      return results; // Return any cached results on error
    }
  }

  // Get historical prices
  async getHistoricalPrices(symbol: string): Promise<TDHistoricalData[]> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return [];
    }

    const cacheKey = `historical:${symbol.toUpperCase()}`;
    const cached = cache.get<TDHistoricalData[]>(cacheKey);
    if (cached) {
      console.log(`Cache hit for historical: ${symbol}`);
      return cached;
    }

    try {
      await rateLimiter.waitIfNeeded();
    } catch (e: any) {
      if (e.message === 'API_COOLDOWN') {
        console.log('API in cooldown, returning empty historical data');
        return [];
      }
      throw e;
    }

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE_URL}/time_series`, {
        params: {
          symbol: symbol.toUpperCase().replace(/-/g, '.'),
          interval: '1day',
          outputsize: 90,
          apikey: TWELVE_DATA_API_KEY,
        },
        timeout: 15000,
      });

      const data = response.data;
      
      // Check for API error
      if (data.code) {
        console.error('Twelve Data historical error:', data.message);
        if (data.code === 429 || data.message?.toLowerCase().includes('rate') || data.message?.toLowerCase().includes('limit')) {
          rateLimiter.recordError();
        }
        return [];
      }

      rateLimiter.recordSuccess();

      const values = data.values;
      if (!values || !Array.isArray(values)) {
        return [];
      }

      const results = values
        .map((v: any) => ({
          date: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: parseInt(v.volume),
        }))
        .reverse(); // Oldest first

      cache.set(cacheKey, results);
      return results;
    } catch (error: any) {
      console.error('Historical prices error:', error.message);
      if (error.response?.status === 429) {
        rateLimiter.recordError();
      }
      return [];
    }
  }

  // Get screener data (popular stocks)
  async getScreenerStocks(): Promise<TDQuote[]> {
    return this.getBatchQuotes(POPULAR_STOCKS.slice(0, 5));
  }

  // Get market indices (Twelve Data supports indices directly)
  async getMarketIndices(): Promise<TDQuote[]> {
    const indices = ['SPX', 'IXIC', 'DJI', 'RUT'];
    return this.getBatchQuotes(indices);
  }

  // Clear cache (useful for testing)
  clearCache(): void {
    cache.clear();
    console.log('Twelve Data cache cleared');
  }
}

// Export singleton instance
export const twelveDataService = new TwelveDataService();
