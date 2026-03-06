import axios from 'axios';
import { prisma } from '../utils/prisma';
import type { PriceAlert } from '@prisma/client';

const FMP_API_KEY = process.env.FMP_API_KEY || 'W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

export class AlertService {
  async checkAlerts(): Promise<PriceAlert[]> {
    const triggeredAlerts: PriceAlert[] = [];

    // Get all active alerts
    const alerts = await prisma.priceAlert.findMany({
      where: {
        isActive: true,
        wasTriggered: false,
      },
      include: {
        user: true,
      },
    });

    if (alerts.length === 0) return triggeredAlerts;

    // Get unique tickers
    const tickers = [...new Set(alerts.map((a) => a.ticker))];

    try {
      // Fetch current prices
      const response = await axios.get(
        `${FMP_BASE_URL}/quote/${tickers.join(',')}?apikey=${FMP_API_KEY}`
      );

      const quotes = response.data;
      const priceMap = new Map(
        quotes.map((q: any) => [q.symbol.toUpperCase(), q.price])
      );

      // Check each alert
      for (const alert of alerts) {
        const currentPrice = priceMap.get(alert.ticker);
        if (!currentPrice) continue;

        const shouldTrigger =
          (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) ||
          (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice);

        if (shouldTrigger) {
          // Update alert as triggered
          const updatedAlert = await prisma.priceAlert.update({
            where: { id: alert.id },
            data: {
              wasTriggered: true,
              triggeredAt: new Date(),
            },
          });

          triggeredAlerts.push(updatedAlert);
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }

    return triggeredAlerts;
  }
}
