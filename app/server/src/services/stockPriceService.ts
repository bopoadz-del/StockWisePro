import { Server } from 'socket.io';
import { prisma } from '../utils/prisma';
import { alphaVantageService } from './alphaVantageService';

interface ClientSubscription {
  socketId: string;
  tickers: Set<string>;
}

// Mock stock data for fallback
const MOCK_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 195.89, change: 2.45, changesPercentage: 1.27, volume: 54200000 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 420.55, change: 5.32, changesPercentage: 1.28, volume: 22100000 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 175.98, change: -1.23, changesPercentage: -0.69, volume: 18900000 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.35, change: 3.12, changesPercentage: 1.78, volume: 38900000 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: -8.75, changesPercentage: -3.40, volume: 98700000 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 875.28, change: 15.42, changesPercentage: 1.79, volume: 45200000 },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 505.68, change: 7.89, changesPercentage: 1.58, volume: 15200000 },
];

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
    const normalizedTickers = tickers.map((t) => t.toUpperCase().replace(/\./g, '-'));
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
      tickers.forEach((t) => subscription.tickers.delete(t.toUpperCase().replace(/\./g, '-')));
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
    // Update every 60 seconds (Alpha Vantage free tier: 5 calls per minute)
    this.updateInterval = setInterval(async () => {
      await this.broadcastPriceUpdates();
    }, 60000);
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
      // Get subscribed tickers
      const tickers = Array.from(this.allSubscribedTickers).slice(0, 5); // Limit to 5 for free tier
      
      // Fetch quotes from Alpha Vantage (rate limited)
      const quotes = [];
      for (const ticker of tickers) {
        const quote = await alphaVantageService.getQuote(ticker);
        if (quote) {
          quotes.push(quote);
        }
      }

      // If no quotes from API, use mock data
      if (quotes.length === 0) {
        for (const ticker of tickers) {
          const mockStock = MOCK_STOCKS.find(s => s.symbol === ticker.toUpperCase());
          if (mockStock) {
            quotes.push(mockStock);
          }
        }
      }

      // Group updates by client
      this.subscriptions.forEach((subscription) => {
        const clientUpdates = quotes.filter((q: any) =>
          subscription.tickers.has(q.symbol.toUpperCase().replace(/\./g, '-'))
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
            changePercent: quote.changePercent,
            volume: quote.volume,
            lastUpdated: new Date(),
          },
          create: {
            ticker: quote.symbol.toUpperCase(),
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
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
      // Get popular stocks to cache (limit to 5 for free tier)
      const popularTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

      for (const ticker of popularTickers) {
        const quote = await alphaVantageService.getQuote(ticker);
        
        if (quote) {
          await prisma.cachedStock.upsert({
            where: { ticker: quote.symbol.toUpperCase() },
            update: {
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              volume: quote.volume,
              lastUpdated: new Date(),
            },
            create: {
              ticker: quote.symbol.toUpperCase(),
              name: quote.name,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              volume: quote.volume,
            },
          });
        }
      }

      console.log('Cached stock prices updated');
    } catch (error) {
      console.error('Error updating cached prices:', error);
    }
  }
}
