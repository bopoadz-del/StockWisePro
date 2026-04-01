import nodemailer from 'nodemailer';
import { config } from '../config';

interface EmailAlert {
  ticker: string;
  condition: string;
  value: number;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (config.email.smtp.host) {
      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass,
        },
      });
    }
  }

  async sendAlertEmail(to: string, alert: EmailAlert, currentPrice: number): Promise<void> {
    if (!this.transporter) {
      console.warn('Email service not configured');
      return;
    }

    const subject = `Price Alert: ${alert.ticker} is ${alert.condition} $${alert.value}`;
    const html = `
      <h2>Price Alert Triggered</h2>
      <p>Your price alert for <strong>${alert.ticker}</strong> has been triggered.</p>
      <ul>
        <li>Condition: ${alert.condition} $${alert.value}</li>
        <li>Current Price: $${currentPrice}</li>
      </ul>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to,
        subject,
        html,
      });
      console.log(`Alert email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send alert email:', error);
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to,
        subject: 'Welcome to AlphaSpectrum',
        html: `<h1>Welcome, ${name}!</h1><p>Thank you for joining AlphaSpectrum.</p>`,
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
}

export const emailService = new EmailService();
