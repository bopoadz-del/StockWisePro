import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import helmet from 'helmet';
import compression from 'compression';

import { config } from './config';
import { prisma, checkDatabaseConnection, disconnectDatabase } from './config/database';

import { authRouter } from './routes/auth';
import { stocksRouter } from './routes/stocks';
import { watchlistRouter } from './routes/watchlist';
import { alertsRouter } from './routes/alerts';
import { portfolioRouter } from './routes/portfolio';
import { experimentRouter } from './routes/experiments';
import { userRouter } from './routes/user';
import { errorHandler } from './middleware/errorHandler';
import { StockPriceService } from './services/stockPriceService';
import { AlertService, AlertWithUser } from './services/alertService';
import { EmailService } from './services/emailService';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = config.nodeEnv === 'production'
  ? [
      config.clientUrl,
      'https://stockwise-pro.onrender.com',
      'https://stockwise-pro-web.onrender.com',
      'https://stockwise-pro-api.onrender.com',
      /\.onrender\.com$/,
    ]
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
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
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// WebSocket server with CORS
const io = new Server(httpServer, {
  cors: corsOptions,
  pingInterval: config.ws.pingInterval,
  pingTimeout: config.ws.pingTimeout,
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production',
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (config.nodeEnv === 'development') {
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
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: 'ready',
    },
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/experiments', experimentRouter);
app.use('/api/user', userRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'StockWise Pro API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs',
    health: '/health',
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize services
const stockPriceService = new StockPriceService(io);
const alertService = new AlertService();
const emailService = new EmailService();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Subscribe to stock price updates
  socket.on('subscribe:stocks', (tickers: string[]) => {
    console.log(`Client ${socket.id} subscribed to:`, tickers);
    stockPriceService.subscribeClient(socket.id, tickers);
  });

  // Unsubscribe from stock price updates
  socket.on('unsubscribe:stocks', (tickers: string[]) => {
    console.log(`Client ${socket.id} unsubscribed from:`, tickers);
    stockPriceService.unsubscribeClient(socket.id, tickers);
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    stockPriceService.removeClient(socket.id);
  });

  // Ping-pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Start real-time price updates
stockPriceService.startPriceUpdates();

// Cron job: Check price alerts every minute
cron.schedule(config.cron.alertCheckInterval, async () => {
  console.log('Checking price alerts...');
  try {
    const triggeredAlerts = await alertService.checkAlerts();
    
    for (const alert of triggeredAlerts) {
      // Send email notification
      await emailService.sendPriceAlert(alert);
      
      // Notify via WebSocket if user is online
      io.to(`user:${alert.userId}`).emit('alert:triggered', {
        ticker: alert.ticker,
        targetPrice: alert.targetPrice,
        condition: alert.condition,
      });
      
      console.log(`Alert triggered: ${alert.ticker} at $${alert.targetPrice}`);
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
  }
});

// Cron job: Update cached stock prices every 5 minutes
cron.schedule(config.cron.priceUpdateInterval, async () => {
  console.log('Updating cached stock prices...');
  try {
    await stockPriceService.updateCachedPrices();
    console.log('Cached prices updated successfully');
  } catch (error) {
    console.error('Error updating cached prices:', error);
  }
});

// Initial cache update on startup
stockPriceService.updateCachedPrices().catch(console.error);

// Start server
httpServer.listen(config.port, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 StockWise Pro API Server                          ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(36)}║
║   Port: ${config.port.toString().padEnd(43)}║
║   Database: ${(config.databaseUrl ? 'Connected' : 'Not Configured').padEnd(36)}║
║   Email: ${(config.smtp.enabled ? 'Enabled' : 'Disabled').padEnd(40)}║
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
  
  // Stop cron jobs
  stockPriceService.stopPriceUpdates();
  
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
