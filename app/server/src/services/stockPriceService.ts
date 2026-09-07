import { prisma } from '../config/database';
import axios from 'axios';
import { config } from '../config';
import { alertService } from './alertService';

interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  cached?: boolean;
  source?: string;
}

interface MemoryCacheEntry {
  quote: Quote;
  expiresAt: number;
}

const MEMORY_TTL_MS = 60 * 1000;
const FRESH_CACHE_MS = 5 * 60 * 1000;

export class StockPriceService {
  private alphaVantageKey: string;
  private twelveDataKey: string;
  private fmpKey: string;
  private memoryCache = new Map<string, MemoryCacheEntry>();

  constructor() {
    this.alphaVantageKey = config.apis.alphaVantage.key;
    this.twelveDataKey = config.apis.twelveData.key;
    this.fmpKey = config.apis.financialModelingPrep.key;
  }

  async getQuote(ticker: string): Promise<Quote> {
    const prices = await this.getQuotes([ticker]);
    const price = prices[ticker.toUpperCase()];
    if (!price) {
      throw new Error('Unable to fetch stock price and no cached data available');
    }
    return {
      ticker: ticker.toUpperCase(),
      price,
      change: 0,
      changePercent: 0,
      volume: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Live or cached last prices for a set of tickers.
   * Order: in-memory → FMP (batch) → Twelve Data → Yahoo → Alpha Vantage → DB cache.
   */
  async getQuotes(tickers: string[]): Promise<Record<string, number>> {
    const unique = [...new Set(tickers.map((t) => t.toUpperCase()).filter(Boolean))];
    const prices: Record<string, number> = {};
    const remember = (ticker: string, price: number, quote?: Quote) => {
      if (!Number.isFinite(price) || price <= 0) return;
      prices[ticker] = price;
      if (quote) {
        this.memoryCache.set(ticker, { quote, expiresAt: Date.now() + MEMORY_TTL_MS });
      }
    };

    const missing = () => unique.filter((t) => prices[t] === undefined);

    for (const ticker of unique) {
      const mem = this.memoryCache.get(ticker);
      if (mem && mem.expiresAt > Date.now() && mem.quote.price > 0) {
        remember(ticker, mem.quote.price);
      }
    }

    if (missing().length > 0 && this.fmpKey) {
      try {
        const quotes = await this.getFromFmp(missing());
        for (const quote of quotes) {
          remember(quote.ticker, quote.price, quote);
          void this.updateCacheSafe(quote.ticker, quote);
        }
      } catch (error) {
        console.warn('FMP batch quote failed, trying next source');
      }
    }

    if (missing().length > 0 && this.twelveDataKey) {
      try {
        const quotes = await this.getFromTwelveDataBatch(missing());
        for (const quote of quotes) {
          remember(quote.ticker, quote.price, quote);
          void this.updateCacheSafe(quote.ticker, quote);
        }
      } catch (error) {
        console.warn('Twelve Data batch quote failed, trying next source');
      }
    }

    if (missing().length > 0) {
      try {
        const quotes = await this.getFromYahoo(missing());
        for (const quote of quotes) {
          remember(quote.ticker, quote.price, quote);
          void this.updateCacheSafe(quote.ticker, quote);
        }
      } catch (error) {
        console.warn('Yahoo Finance quote failed, trying next source');
      }
    }

    if (missing().length > 0 && this.alphaVantageKey) {
      for (const ticker of missing()) {
        try {
          const quote = await this.getFromAlphaVantage(ticker);
          remember(quote.ticker, quote.price, quote);
          void this.updateCacheSafe(quote.ticker, quote);
        } catch {
          console.warn(`Alpha Vantage failed for ${ticker}`);
        }
      }
    }

    if (missing().length > 0) {
      for (const ticker of missing()) {
        const cached = await this.getCachedQuote(ticker, true);
        if (cached?.price) {
          remember(ticker, Number(cached.price), cached);
        }
      }
    }

    return prices;
  }

  private async getFromFmp(tickers: string[]): Promise<Quote[]> {
    const symbols = tickers.map((t) => this.toFmpSymbol(t)).join(',');
    const response = await axios.get(
      `https://financialmodelingprep.com/api/v3/quote/${symbols}`,
      {
        params: { apikey: this.fmpKey },
        timeout: 10000,
      }
    );

    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected FMP response');
    }

    return response.data
      .map((row: any) => {
        const ticker = this.fromFmpSymbol(row.symbol);
        const price = parseFloat(row.price);
        if (!ticker || !Number.isFinite(price) || price <= 0) return null;
        return {
          ticker,
          price,
          change: parseFloat(row.change) || 0,
          changePercent: parseFloat(row.changesPercentage) || 0,
          volume: parseInt(row.volume, 10) || 0,
          timestamp: new Date(),
          source: 'fmp',
        } as Quote;
      })
      .filter((q: Quote | null): q is Quote => q !== null);
  }

  private async getFromTwelveDataBatch(tickers: string[]): Promise<Quote[]> {
    const formatted = tickers.map((t) => t.replace(/-/g, '.'));
    const quotes: Quote[] = [];

    // Free tier is happiest with small batches
    for (let i = 0; i < formatted.length; i += 5) {
      const chunk = formatted.slice(i, i + 5);
      const response = await axios.get('https://api.twelvedata.com/quote', {
        params: {
          symbol: chunk.join(','),
          apikey: this.twelveDataKey,
        },
        timeout: 10000,
      });

      const data = response.data;
      if (data?.status === 'error' || data?.code) {
        throw new Error(data.message || 'Twelve Data error');
      }

      const rows: any[] = data?.symbol
        ? [data]
        : typeof data === 'object' && data !== null
          ? Object.values(data)
          : [];

      for (const row of rows) {
        const price = parseFloat(row?.close);
        if (!row?.symbol || !Number.isFinite(price) || price <= 0) continue;
        quotes.push({
          ticker: String(row.symbol).toUpperCase().replace(/-/g, '.'),
          price,
          change: parseFloat(row.change) || 0,
          changePercent: parseFloat(row.percent_change) || 0,
          volume: parseInt(row.volume, 10) || 0,
          timestamp: new Date(),
          source: 'twelvedata',
        });
      }
    }

    return quotes;
  }

  private async getFromAlphaVantage(ticker: string): Promise<Quote> {
    const response = await axios.get(
      'https://www.alphavantage.co/query',
      {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: ticker,
          apikey: this.alphaVantageKey,
        },
        timeout: 10000,
      }
    );

    const quote = response.data['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      throw new Error('No data available from Alpha Vantage');
    }

    const price = parseFloat(quote['05. price']);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Invalid Alpha Vantage price');
    }

    return {
      ticker: ticker.toUpperCase(),
      price,
      change: parseFloat(quote['09. change']) || 0,
      changePercent: parseFloat(String(quote['10. change percent'] || '0').replace('%', '')) || 0,
      volume: parseInt(quote['06. volume'], 10) || 0,
      timestamp: new Date(),
      source: 'alphavantage',
    };
  }

  private async getFromYahoo(tickers: string[]): Promise<Quote[]> {
    const symbols = tickers.map((t) => this.toYahooSymbol(t)).join(',');
    const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
      params: { symbols },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    });

    const results = response.data?.quoteResponse?.result;
    if (!Array.isArray(results) || results.length === 0) {
      return this.getFromYahooCharts(tickers);
    }

    const quotes = results
      .map((row: any) => {
        const price = parseFloat(row.regularMarketPrice);
        if (!row.symbol || !Number.isFinite(price) || price <= 0) return null;
        return {
          ticker: this.fromYahooSymbol(row.symbol),
          price,
          change: parseFloat(row.regularMarketChange) || 0,
          changePercent: parseFloat(row.regularMarketChangePercent) || 0,
          volume: parseInt(row.regularMarketVolume, 10) || 0,
          timestamp: new Date(),
          source: 'yahoo',
        } as Quote;
      })
      .filter((q: Quote | null): q is Quote => q !== null);

    const found = new Set(quotes.map((q) => q.ticker));
    const stillMissing = tickers.filter((t) => !found.has(t.toUpperCase()) && !found.has(this.fromYahooSymbol(t)));
    if (stillMissing.length > 0) {
      const extras = await this.getFromYahooCharts(stillMissing);
      quotes.push(...extras);
    }

    return quotes;
  }

  private async getFromYahooCharts(tickers: string[]): Promise<Quote[]> {
    const settled = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const symbol = this.toYahooSymbol(ticker);
        const response = await axios.get(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
          {
            params: { interval: '1d', range: '1d' },
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0',
              Accept: 'application/json',
            },
          }
        );
        const meta = response.data?.chart?.result?.[0]?.meta;
        const price = parseFloat(meta?.regularMarketPrice);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`No Yahoo chart price for ${ticker}`);
        }
        return {
          ticker: ticker.toUpperCase(),
          price,
          change: parseFloat(meta.regularMarketChange) || 0,
          changePercent: 0,
          volume: parseInt(meta.regularMarketVolume, 10) || 0,
          timestamp: new Date(),
          source: 'yahoo',
        } as Quote;
      })
    );

    return settled
      .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  private async getCachedQuote(ticker: string, allowStale = false): Promise<Quote | null> {
    try {
      const stock = await prisma.stock.findUnique({
        where: { ticker: ticker.toUpperCase() },
      });

      if (!stock || stock.cachedPrice == null) {
        return null;
      }

      const ageMs = stock.cachedAt ? Date.now() - stock.cachedAt.getTime() : Number.POSITIVE_INFINITY;
      if (!allowStale && ageMs >= FRESH_CACHE_MS) {
        return null;
      }

      const price = Number(stock.cachedPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return null;
      }

      return {
        ticker: stock.ticker,
        price,
        change: Number(stock.cachedChange) || 0,
        changePercent: Number(stock.cachedChangePercent) || 0,
        volume: Number(stock.cachedVolume) || 0,
        timestamp: stock.cachedAt || new Date(),
        cached: true,
        source: 'cache',
      };
    } catch (error) {
      console.warn(`Cache lookup failed for ${ticker}`);
      return null;
    }
  }

  async updateCache(ticker: string, data: any): Promise<void> {
    await prisma.stock.upsert({
      where: { ticker: ticker.toUpperCase() },
      create: {
        ticker: ticker.toUpperCase(),
        name: ticker.toUpperCase(),
        cachedPrice: data.price,
        cachedChange: data.change,
        cachedChangePercent: data.changePercent,
        cachedVolume: data.volume,
        cachedAt: new Date(),
      },
      update: {
        cachedPrice: data.price,
        cachedChange: data.change,
        cachedChangePercent: data.changePercent,
        cachedVolume: data.volume,
        cachedAt: new Date(),
      },
    });

    await prisma.stockPrice.create({
      data: {
        ticker: ticker.toUpperCase(),
        price: data.price,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
      },
    });

    await alertService.checkAlerts(ticker, data.price);
  }

  private async updateCacheSafe(ticker: string, data: Quote): Promise<void> {
    try {
      await this.updateCache(ticker, data);
    } catch (error) {
      console.warn(`Failed to persist quote cache for ${ticker}`);
    }
  }

  private toFmpSymbol(ticker: string): string {
    return ticker.toUpperCase();
  }

  private fromFmpSymbol(symbol: string): string {
    return String(symbol || '').toUpperCase();
  }

  private toYahooSymbol(ticker: string): string {
    return ticker.toUpperCase().replace(/\./g, '-');
  }

  private fromYahooSymbol(symbol: string): string {
    return String(symbol || '').toUpperCase().replace(/-/g, '.');
  }
}

export const stockPriceService = new StockPriceService();
