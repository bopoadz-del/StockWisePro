import { prisma } from '../config/database';
import { io } from '../index';

export class AlertService {
  async checkAlerts(ticker: string, currentPrice: number): Promise<void> {
    try {
      // Find all active alerts for this ticker
      const alerts = await prisma.alert.findMany({
        where: {
          ticker: ticker.toUpperCase(),
          isActive: true,
          deletedAt: null,
        },
      });

      for (const alert of alerts) {
        const triggered = this.evaluateAlert(alert, currentPrice);
        
        if (triggered) {
          await this.triggerAlert(alert, currentPrice);
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  private evaluateAlert(alert: any, currentPrice: number): boolean {
    const targetValue = parseFloat(alert.value.toString());
    
    switch (alert.condition) {
      case 'ABOVE':
        return currentPrice > targetValue;
      case 'BELOW':
        return currentPrice < targetValue;
      case 'EQUALS':
        return Math.abs(currentPrice - targetValue) < 0.01;
      default:
        return false;
    }
  }

  private async triggerAlert(alert: any, currentPrice: number): Promise<void> {
    try {
      // Update alert
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          triggeredCount: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      });

      // Create alert log
      await prisma.alertLog.create({
        data: {
          alertId: alert.id,
          triggeredPrice: currentPrice,
          triggeredAt: new Date(),
        },
      });

      // Emit WebSocket event
      io.emit('alert:triggered', {
        alertId: alert.id,
        ticker: alert.ticker,
        price: currentPrice,
      });

      // Send notifications based on preferences
      if (alert.notifyInApp) {
        // In-app notification logic
      }

      // Note: Email notifications would be handled by a separate service
    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }
}

export const alertService = new AlertService();
