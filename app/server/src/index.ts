import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';

import { config } from './config';
import { initializeRedis } from './config/redis';
import { prisma, checkDatabaseConnection, disconnectDatabase } from './config/database';

// Import routes
import authRouter from './routes/auth';
import organizationRouter from './routes/organization';
import stocksRouter from './routes/stocks';
import watchlistRouter from './routes/watchlist';
import portfolioRouter from './routes/portfolio';
import alertsRouter from './routes/alerts';
import apiKeysRouter from './routes/apiKeys';
import webhooksRouter from './routes/webhooks';
import auditLogsRouter from './routes/auditLogs';
import experimentRouter from './routes/experiments';
import userRouter from './routes/user';
import adminRouter from './routes/admin';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimiter';

const app = express();
const httpServer = createServer(app);

// Initialize Redis
initializeRedis();

// CORS configuration
const allowedOrigins = config.isProduction
  ? [
      config.clientUrl,
      'https://stockwise-pro.onrender.com',
      'https://stockwise-pro-web.onrender.com',
      'https://stockwise-pro-api.onrender.com',
      /\.onrender\.com$/,
      ...(config.security.corsOrigins || []),
    ]
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:19006'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
};

// WebSocket server with CORS
const io = new Server(httpServer, {
  cors: corsOptions,
  pingInterval: config.ws.pingInterval,
  pingTimeout: config.ws.pingTimeout,
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.isProduction,
  crossOriginEmbedderPolicy: false,
  hsts: config.isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Request logging in development
if (config.isDevelopment) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint (must be before routes for Render)
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: 'ready',
    },
  });
});

// Deep health check (includes external APIs)
app.get('/health/deep', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  
  // Check external APIs
  const apiStatus: Record<string, string> = {};
  
  if (config.apis.alphaVantage.key) {
    apiStatus.alphaVantage = 'configured';
  } else {
    apiStatus.alphaVantage = 'not_configured';
  }
  
  if (config.apis.twelveData.key) {
    apiStatus.twelveData = 'configured';
  } else {
    apiStatus.twelveData = 'not_configured';
  }
  
  const allHealthy = dbHealthy;
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: 'ready',
      externalApis: apiStatus,
    },
  });
});

// Public routes (no rate limiting)
app.get('/', (req, res) => {
  res.json({
    name: 'AlphaSpectrum Enterprise API',
    version: '2.0.0',
    status: 'running',
    documentation: '/api/docs',
    health: '/health',
  });
});

// Apply rate limiting to API routes
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

app.use('/api', apiRateLimiter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/keys', apiKeysRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/experiments', experimentRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);

// Analytics endpoint (accepts and discards - frontend analytics are local-only)
app.post('/api/analytics', (req, res) => {
  res.status(200).json({ received: true });
});

// Error handler (must be last)
app.use(errorHandler);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Subscribe to stock price updates
  socket.on('subscribe:stocks', (tickers: string[]) => {
    console.log(`Client ${socket.id} subscribed to:`, tickers);
    tickers.forEach(ticker => socket.join(`stock:${ticker}`));
  });

  // Unsubscribe from stock price updates
  socket.on('unsubscribe:stocks', (tickers: string[]) => {
    console.log(`Client ${socket.id} unsubscribed from:`, tickers);
    tickers.forEach(ticker => socket.leave(`stock:${ticker}`));
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Ping-pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Start server
httpServer.listen(config.port, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 AlphaSpectrum Enterprise API Server               ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(36)}║
║   Port: ${config.port.toString().padEnd(43)}║
║   Database: ${(config.database.url ? 'Connected' : 'Not Configured').padEnd(36)}║
║   WebSocket: Ready                                     ║
║                                                        ║
║   Health Check: http://localhost:${config.port}/health   ${' '.repeat(config.port.toString().length === 4 ? 1 : 0)}║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close WebSocket connections
  io.close(() => {
    console.log('WebSocket server closed');
  });
  
  // Close HTTP server
  httpServer.close(async () => {
    console.log('HTTP server closed');
    
    // Disconnect from database
    await disconnectDatabase();
    console.log('Database disconnected');
    
    console.log('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { io };
