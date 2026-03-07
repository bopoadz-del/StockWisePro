// Alpha Vantage API Integration
// Free tier: 5 API calls per minute, 500 calls per day

import axios from 'axios';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || '';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// Popular stocks for screener
const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK-B', 'JPM', 'V',
  'WMT', 'JNJ', 'NFLX', 'DIS', 'UBER', 'PYPL', 'INTC', 'AMD', 'CRM', 'BAC',
  'PFE', 'KO', 'PEP', 'MCD', 'NKE', 'XOM', 'CVX', 'UNH', 'ABBV', 'TMO',
  'COST', 'AVGO', 'TXN', 'QCOM', 'HON', 'UNP', 'RTX', 'LMT', 'NEE', 'DUK'
];

export interface AVQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  latestTradingDay: string;
}

export interface AVSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
}

export interface AVHistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Helper to sleep between API calls (to respect rate limit)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AlphaVantageService {
  private lastCallTime: number = 0;
  private minInterval: number = 12000; // 12 seconds between calls (5 per minute)

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minInterval) {
      await sleep(this.minInterval - timeSinceLastCall);
    }
    this.lastCallTime = Date.now();
  }

  // Get stock quote
  async getQuote(symbol: string): Promise<AVQuote | null> {
    if (!ALPHA_VANTAGE_API_KEY) {
      console.error('ALPHA_VANTAGE_API_KEY not set');
      return null;
    }

    await this.rateLimit();

    try {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: ALPHA_VANTAGE_API_KEY,
        },
        timeout: 10000,
      });

      const quote = response.data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        return null;
      }

      // Format ticker back from BRK-B to BRK.B
      const formattedSymbol = symbol.replace(/-/g, '.');

      return {
        symbol: formattedSymbol,
        name: formattedSymbol, // Alpha Vantage doesn't return name in quote
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        latestTradingDay: quote['07. latest trading day'],
      };
    } catch (error: any) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      return null;
    }
  }

  // Search stocks
  async search(keywords: string): Promise<AVSearchResult[]> {
    if (!ALPHA_VANTAGE_API_KEY) {
      console.error('ALPHA_VANTAGE_API_KEY not set');
      return [];
    }

    await this.rateLimit();

    try {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords: keywords,
          apikey: ALPHA_VANTAGE_API_KEY,
        },
        timeout: 10000,
      });

      const matches = response.data.bestMatches;
      if (!matches || !Array.isArray(matches)) {
        return [];
      }

      return matches
        .filter((match: any) => match['4. region'] === 'United States')
        .slice(0, 10)
        .map((match: any) => ({
          symbol: match['1. symbol'].replace(/\./g, '-'),
          name: match['2. name'],
          type: match['3. type'],
          region: match['4. region'],
        }));
    } catch (error: any) {
      console.error('Search error:', error.message);
      return [];
    }
  }

  // Get batch quotes (Alpha Vantage doesn't support batch, so we fetch one by one)
  async getBatchQuotes(symbols: string[]): Promise<AVQuote[]> {
    const quotes: AVQuote[] = [];
    
    for (const symbol of symbols.slice(0, 5)) { // Limit to 5 to respect rate limits
      const quote = await this.getQuote(symbol);
      if (quote) {
        quotes.push(quote);
      }
    }

    return quotes;
  }

  // Get historical prices
  async getHistoricalPrices(symbol: string): Promise<AVHistoricalData[]> {
    if (!ALPHA_VANTAGE_API_KEY) {
      console.error('ALPHA_VANTAGE_API_KEY not set');
      return [];
    }

    await this.rateLimit();

    try {
      const response = await axios.get(ALPHA_VANTAGE_BASE_URL, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol: symbol,
          apikey: ALPHA_VANTAGE_API_KEY,
        },
        timeout: 15000,
      });

      const timeSeries = response.data['Time Series (Daily)'];
      if (!timeSeries) {
        return [];
      }

      return Object.entries(timeSeries)
        .map(([date, data]: [string, any]) => ({
          date,
          open: parseFloat(data['1. open']),
          high: parseFloat(data['2. high']),
          low: parseFloat(data['3. low']),
          close: parseFloat(data['4. close']),
          volume: parseInt(data['5. volume']),
        }))
        .slice(0, 90) // Last 90 days
        .reverse();
    } catch (error: any) {
      console.error('Historical prices error:', error.message);
      return [];
    }
  }

  // Get screener data (popular stocks)
  async getScreenerStocks(): Promise<AVQuote[]> {
    const quotes: AVQuote[] = [];
    
    // Fetch first 5 popular stocks to respect rate limits
    for (const symbol of POPULAR_STOCKS.slice(0, 5)) {
      const quote = await this.getQuote(symbol);
      if (quote) {
        quotes.push(quote);
      }
    }

    return quotes;
  }

  // Get market indices (Alpha Vantage doesn't have direct index quotes, use ETFs)
  async getMarketIndices(): Promise<AVQuote[]> {
    const indexETFs = ['SPY', 'QQQ', 'DIA', 'IWM']; // ETF proxies for indices
    return this.getBatchQuotes(indexETFs);
  }
}

// Export singleton instance
export const alphaVantageService = new AlphaVantageService();
