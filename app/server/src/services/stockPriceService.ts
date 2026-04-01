import { prisma } from '../config/database';
import axios from 'axios';
import { config } from '../config';
import { alertService } from './alertService';

export class StockPriceService {
  private alphaVantageKey: string;
  private twelveDataKey: string;

  constructor() {
    this.alphaVantageKey = config.apis.alphaVantage.key;
    this.twelveDataKey = config.apis.twelveData.key;
  }

  async getQuote(ticker: string): Promise<any> {
    // Try Twelve Data first (better free tier)
    if (this.twelveDataKey) {
      try {
        return await this.getFromTwelveData(ticker);
      } catch (error) {
        console.warn('Twelve Data failed, trying fallback...');
      }
    }

    // Fallback to Alpha Vantage
    if (this.alphaVantageKey) {
      try {
        return await this.getFromAlphaVantage(ticker);
      } catch (error) {
        console.warn('Alpha Vantage failed');
      }
    }

    // Return cached data if available
    const cached = await this.getCachedQuote(ticker);
    if (cached) {
      return cached;
    }

    throw new Error('Unable to fetch stock price and no cached data available');
  }

  private async getFromTwelveData(ticker: string): Promise<any> {
    const response = await axios.get(
      `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${this.twelveDataKey}`,
      { timeout: 10000 }
    );

    if (response.data.status === 'error') {
      throw new Error(response.data.message);
    }

    const data = response.data;
    return {
      ticker: ticker.toUpperCase(),
      price: parseFloat(data.close),
      change: parseFloat(data.change),
      changePercent: parseFloat(data.percent_change),
      volume: parseInt(data.volume),
      timestamp: new Date(),
    };
  }

  private async getFromAlphaVantage(ticker: string): Promise<any> {
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

    return {
      ticker: ticker.toUpperCase(),
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      volume: parseInt(quote['06. volume']),
      timestamp: new Date(),
    };
  }

  private async getCachedQuote(ticker: string): Promise<any | null> {
    const stock = await prisma.stock.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    if (!stock || !stock.cachedPrice) {
      return null;
    }

    // Check if cache is fresh (less than 5 minutes old)
    if (stock.cachedAt && new Date().getTime() - stock.cachedAt.getTime() < 5 * 60 * 1000) {
      return {
        ticker: stock.ticker,
        price: stock.cachedPrice,
        change: stock.cachedChange,
        changePercent: stock.cachedChangePercent,
        volume: stock.cachedVolume,
        timestamp: stock.cachedAt,
        cached: true,
      };
    }

    return null;
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

    // Store historical price
    await prisma.stockPrice.create({
      data: {
        ticker: ticker.toUpperCase(),
        price: data.price,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
      },
    });

    // Check alerts
    await alertService.checkAlerts(ticker, data.price);
  }
}

export const stockPriceService = new StockPriceService();
