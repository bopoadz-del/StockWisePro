import nodemailer from 'nodemailer';
import type { PriceAlert } from '@prisma/client';

interface AlertWithUser extends PriceAlert {
  user: {
    email: string;
    name: string | null;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Initialize email transporter if SMTP credentials are provided
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async sendPriceAlert(alert: AlertWithUser): Promise<void> {
    if (!this.transporter) {
      console.log('Email service not configured. Would have sent:');
      console.log(`To: ${alert.user.email}`);
      console.log(`Subject: Price Alert: ${alert.ticker}`);
      console.log(`Price ${alert.condition === 'ABOVE' ? 'exceeded' : 'dropped below'} $${alert.targetPrice}`);
      return;
    }

    const subject = `Price Alert: ${alert.ticker}`;
    const condition = alert.condition === 'ABOVE' ? 'risen above' : 'fallen below';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c9a962, #dcc380); padding: 20px; text-align: center; }
          .header h1 { color: #0a0a0a; margin: 0; }
          .content { background-color: #141414; padding: 30px; border-radius: 8px; margin-top: 20px; }
          .alert-box { background-color: #1f1f1f; padding: 20px; border-radius: 8px; text-align: center; }
          .ticker { font-size: 32px; font-weight: bold; color: #c9a962; }
          .price { font-size: 24px; margin: 10px 0; }
          .condition { color: ${alert.condition === 'ABOVE' ? '#22c55e' : '#ef4444'}; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .button { display: inline-block; background-color: #c9a962; color: #0a0a0a; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StockWise Pro</h1>
          </div>
          <div class="content">
            <h2>Price Alert Triggered!</h2>
            <div class="alert-box">
              <div class="ticker">${alert.ticker}</div>
              <div class="price">
                Price has <span class="condition">${condition}</span> your target
              </div>
              <div style="font-size: 28px; font-weight: bold; margin: 15px 0;">
                $${alert.targetPrice.toFixed(2)}
              </div>
            </div>
            <p style="text-align: center;">
              <a href="${process.env.CLIENT_URL}/stock/${alert.ticker}" class="button">View Stock</a>
            </p>
          </div>
          <div class="footer">
            <p>You're receiving this because you set a price alert on StockWise Pro.</p>
            <p><a href="${process.env.CLIENT_URL}/alerts" style="color: #c9a962;">Manage your alerts</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"StockWise Pro" <${process.env.SMTP_FROM || 'alerts@stockwise.pro'}>`,
        to: alert.user.email,
        subject,
        html,
      });

      console.log(`Price alert email sent to ${alert.user.email} for ${alert.ticker}`);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    if (!this.transporter) {
      console.log('Email service not configured. Would have sent welcome email to:', email);
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c9a962, #dcc380); padding: 20px; text-align: center; }
          .header h1 { color: #0a0a0a; margin: 0; }
          .content { background-color: #141414; padding: 30px; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .button { display: inline-block; background-color: #c9a962; color: #0a0a0a; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StockWise Pro</h1>
          </div>
          <div class="content">
            <h2>Welcome, ${name}!</h2>
            <p>Thank you for joining StockWise Pro. You're now part of a community of 50,000+ investors making smarter decisions.</p>
            <h3>Get started with these features:</h3>
            <ul>
              <li>🔍 <strong>Stock Screener</strong> - Find top-rated stocks</li>
              <li>📊 <strong>AI Scoring</strong> - Get transparent stock scores</li>
              <li>💼 <strong>Legend Portfolios</strong> - Invest like the greats</li>
              <li>⚗️ <strong>Formula Lab</strong> - Create custom strategies</li>
            </ul>
            <p style="text-align: center;">
              <a href="${process.env.CLIENT_URL}" class="button">Start Exploring</a>
            </p>
          </div>
          <div class="footer">
            <p>Need help? Contact us at support@stockwise.pro</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"StockWise Pro" <${process.env.SMTP_FROM || 'welcome@stockwise.pro'}>`,
        to: email,
        subject: 'Welcome to StockWise Pro!',
        html,
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    if (!this.transporter) {
      console.log('Email service not configured. Would have sent reset email to:', email);
      return;
    }

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c9a962, #dcc380); padding: 20px; text-align: center; }
          .header h1 { color: #0a0a0a; margin: 0; }
          .content { background-color: #141414; padding: 30px; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .button { display: inline-block; background-color: #c9a962; color: #0a0a0a; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StockWise Pro</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>Need help? Contact us at support@stockwise.pro</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"StockWise Pro" <${process.env.SMTP_FROM || 'security@stockwise.pro'}>`,
        to: email,
        subject: 'Password Reset Request',
        html,
      });
    } catch (error) {
      console.error('Error sending password reset email:', error);
    }
  }
}
