import { Server } from 'socket.io';
import axios from 'axios';
import { prisma } from '../utils/prisma';

const FMP_API_KEY = process.env.FMP_API_KEY || 'W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

interface ClientSubscription {
  socketId: string;
  tickers: Set<string>;
}

export class StockPriceService {
  private io: Server;
  private subscriptions: Map<string, ClientSubscription> = new Map();
  private allSubscribedTickers: Set<string> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  subscribeClient(socketId: string, tickers: string[]) {
    // Remove old subscriptions
    this.unsubscribeClient(socketId);

    // Add new subscription
    const normalizedTickers = tickers.map((t) => t.toUpperCase());
    this.subscriptions.set(socketId, {
      socketId,
      tickers: new Set(normalizedTickers),
    });

    // Update all subscribed tickers
    this.updateAllSubscribedTickers();
  }

  unsubscribeClient(socketId: string, tickers?: string[]) {
    const subscription = this.subscriptions.get(socketId);
    if (!subscription) return;

    if (tickers) {
      // Unsubscribe specific tickers
      tickers.forEach((t) => subscription.tickers.delete(t.toUpperCase()));
    } else {
      // Unsubscribe all
      this.subscriptions.delete(socketId);
    }

    this.updateAllSubscribedTickers();
  }

  removeClient(socketId: string) {
    this.subscriptions.delete(socketId);
    this.updateAllSubscribedTickers();
  }

  private updateAllSubscribedTickers() {
    this.allSubscribedTickers.clear();
    this.subscriptions.forEach((sub) => {
      sub.tickers.forEach((ticker) => this.allSubscribedTickers.add(ticker));
    });
  }

  startPriceUpdates() {
    // Update every 30 seconds
    this.updateInterval = setInterval(async () => {
      await this.broadcastPriceUpdates();
    }, 30000);
  }

  stopPriceUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private async broadcastPriceUpdates() {
    if (this.allSubscribedTickers.size === 0) return;

    try {
      const tickers = Array.from(this.allSubscribedTickers).join(',');
      const response = await axios.get(
        `${FMP_BASE_URL}/quote/${tickers}?apikey=${FMP_API_KEY}`
      );

      const quotes = response.data;

      // Group updates by client
      this.subscriptions.forEach((subscription) => {
        const clientUpdates = quotes.filter((q: any) =>
          subscription.tickers.has(q.symbol.toUpperCase())
        );

        if (clientUpdates.length > 0) {
          this.io.to(subscription.socketId).emit('prices:update', clientUpdates);
        }
      });

      // Update cache
      for (const quote of quotes) {
        await prisma.cachedStock.upsert({
          where: { ticker: quote.symbol.toUpperCase() },
          update: {
            price: quote.price,
            change: quote.change,
            changePercent: quote.changesPercentage,
            volume: quote.volume,
            lastUpdated: new Date(),
          },
          create: {
            ticker: quote.symbol.toUpperCase(),
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changesPercentage,
            marketCap: quote.marketCap,
            peRatio: quote.pe,
            volume: quote.volume,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching price updates:', error);
    }
  }

  async updateCachedPrices() {
    try {
      // Get popular stocks to cache
      const popularTickers = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META',
        'BRK.B', 'JPM', 'V', 'WMT', 'JNJ', 'UNH', 'XOM',
      ];

      const response = await axios.get(
        `${FMP_BASE_URL}/quote/${popularTickers.join(',')}?apikey=${FMP_API_KEY}`
      );

      const quotes = response.data;

      for (const quote of quotes) {
        await prisma.cachedStock.upsert({
          where: { ticker: quote.symbol.toUpperCase() },
          update: {
            price: quote.price,
            change: quote.change,
            changePercent: quote.changesPercentage,
            marketCap: quote.marketCap,
            peRatio: quote.pe,
            volume: quote.volume,
            lastUpdated: new Date(),
          },
          create: {
            ticker: quote.symbol.toUpperCase(),
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changesPercentage,
            marketCap: quote.marketCap,
            peRatio: quote.pe,
            volume: quote.volume,
          },
        });
      }

      console.log(`Cached ${quotes.length} stock prices`);
    } catch (error) {
      console.error('Error updating cached prices:', error);
    }
  }
}
