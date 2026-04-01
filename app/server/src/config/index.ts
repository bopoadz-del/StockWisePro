import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

// Validate required environment variables in production
if (IS_PRODUCTION) {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const config = {
  // Environment
  nodeEnv: NODE_ENV,
  isProduction: IS_PRODUCTION,
  isDevelopment: IS_DEVELOPMENT,
  port: parseInt(process.env.PORT || '3001', 10),
  
  // URLs
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || '3001'}`,
  
  // Database
  database: {
    url: process.env.DATABASE_URL || '',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '20', 10),
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL || '',
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'alphaspectrum',
    audience: process.env.JWT_AUDIENCE || 'alphaspectrum-api',
  },
  
  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  
  // External APIs
  apis: {
    alphaVantage: {
      key: process.env.ALPHA_VANTAGE_API_KEY || '',
      rateLimitPerMinute: parseInt(process.env.ALPHA_VANTAGE_RATE_LIMIT || '5', 10),
    },
    twelveData: {
      key: process.env.TWELVE_DATA_API_KEY || '',
    },
    financialModelingPrep: {
      key: process.env.FMP_API_KEY || '',
    },
  },
  
  // Email
  email: {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.EMAIL_FROM || 'noreply@alphaspectrum.app',
    fromName: process.env.EMAIL_FROM_NAME || 'AlphaSpectrum',
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30', 10),
    passwordHistorySize: parseInt(process.env.PASSWORD_HISTORY_SIZE || '5', 10),
    mfaEnabled: process.env.MFA_ENABLED === 'true',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
  },
  
  // Rate Limiting
  rateLimiting: {
    defaultWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    defaultMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // WebSocket
  ws: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000', 10),
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (IS_DEVELOPMENT ? 'debug' : 'info'),
    format: process.env.LOG_FORMAT || (IS_DEVELOPMENT ? 'pretty' : 'json'),
  },
  
  // Feature flags
  features: {
    webhooks: process.env.FEATURE_WEBHOOKS !== 'false',
    apiKeys: process.env.FEATURE_API_KEYS !== 'false',
    sso: process.env.FEATURE_SSO === 'true',
    auditLogs: process.env.FEATURE_AUDIT_LOGS !== 'false',
    bulkOperations: process.env.FEATURE_BULK_OPERATIONS !== 'false',
  },
  
  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    enabled: !!process.env.SENTRY_DSN && IS_PRODUCTION,
  },
};

// Type export
export type Config = typeof config;
