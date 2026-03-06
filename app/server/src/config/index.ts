import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'FMP_API_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`Warning: ${envVar} is not set`);
  }
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // FMP API
  fmpApiKey: process.env.FMP_API_KEY || '',
  fmpBaseUrl: 'https://financialmodelingprep.com/api/v3',
  
  // Client
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  
  // SMTP (Email)
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'alerts@stockwise.pro',
    enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
  },
  
  // WebSocket
  ws: {
    pingInterval: 30000, // 30 seconds
    pingTimeout: 5000,   // 5 seconds
  },
  
  // Cron Jobs
  cron: {
    priceUpdateInterval: '*/5 * * * *',    // Every 5 minutes
    alertCheckInterval: '* * * * *',        // Every minute
  },
};

// Validate critical config in production
if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'fallback-secret-change-in-production') {
    console.error('ERROR: JWT_SECRET must be set in production!');
    process.exit(1);
  }
  
  if (!config.databaseUrl) {
    console.error('ERROR: DATABASE_URL must be set in production!');
    process.exit(1);
  }
}

export default config;
