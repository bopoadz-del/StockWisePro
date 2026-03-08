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
  // Get stock quote
  async getQuote(symbol: string): Promise<TDQuote | null> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return null;
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
      
      // Check for API error
      if (data.code) {
        console.error(`Twelve Data error for ${symbol}:`, data.message);
        return null;
      }

      if (!data.close) {
        return null;
      }

      // Format ticker back from BRK.B to BRK-B for consistency
      const formattedSymbol = data.symbol.replace(/\./g, '-');

      return {
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
    } catch (error: any) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      return null;
    }
  }

  // Search stocks
  async search(keywords: string): Promise<TDSearchResult[]> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return [];
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
        return [];
      }

      const matches = data.data;
      if (!matches || !Array.isArray(matches)) {
        return [];
      }

      return matches
        .filter((match: any) => match.country === 'United States')
        .slice(0, 10)
        .map((match: any) => ({
          symbol: match.symbol.replace(/\./g, '-'),
          name: match.instrument_name,
          type: match.instrument_type,
          exchange: match.exchange,
          currency: match.currency || 'USD',
        }));
    } catch (error: any) {
      console.error('Search error:', error.message);
      return [];
    }
  }

  // Get batch quotes (Twelve Data supports multiple symbols)
  async getBatchQuotes(symbols: string[]): Promise<TDQuote[]> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return [];
    }

    try {
      // Twelve Data supports batch requests with comma-separated symbols
      const symbolString = symbols
        .slice(0, 5) // Limit to 5 for free tier
        .map(s => s.toUpperCase().replace(/-/g, '.'))
        .join(',');

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
        return [];
      }

      // Batch response is an object keyed by symbol: { AAPL: {...}, MSFT: {...} }
      // Single symbol response is a single object
      const quotesArray: any[] = [];
      
      if (data.symbol) {
        // Single symbol response
        quotesArray.push(data);
      } else {
        // Batch response - extract values
        Object.values(data).forEach((quote: any) => {
          if (quote && quote.close) {
            quotesArray.push(quote);
          }
        });
      }

      return quotesArray
        .filter((q: any) => q.close)
        .map((q: any) => ({
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
        }));
    } catch (error: any) {
      console.error('Batch quotes error:', error.message);
      return [];
    }
  }

  // Get historical prices
  async getHistoricalPrices(symbol: string): Promise<TDHistoricalData[]> {
    if (!TWELVE_DATA_API_KEY) {
      console.error('TWELVE_DATA_API_KEY not set');
      return [];
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
        return [];
      }

      const values = data.values;
      if (!values || !Array.isArray(values)) {
        return [];
      }

      return values
        .map((v: any) => ({
          date: v.datetime,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: parseInt(v.volume),
        }))
        .reverse(); // Oldest first
    } catch (error: any) {
      console.error('Historical prices error:', error.message);
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
}

// Export singleton instance
export const twelveDataService = new TwelveDataService();
