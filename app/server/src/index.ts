import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
  const avKeySet = !!process.env.ALPHA_VANTAGE_API_KEY;
  
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: 'ready',
      alphaVantage: avKeySet ? 'configured' : 'not_configured',
    },
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Test Alpha Vantage API connection
app.get('/api/test/alphavantage', async (req, res) => {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'ALPHA_VANTAGE_API_KEY not set',
        env: process.env.NODE_ENV,
        keys: Object.keys(process.env).filter(k => k.includes('ALPHA') || k.includes('API'))
      });
    }
    
    // Test call to Alpha Vantage
    const axios = require('axios');
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: 'AAPL',
        apikey: apiKey,
      },
      timeout: 10000,
    });
    
    res.json({
      keyConfigured: true,
      keyPrefix: apiKey.substring(0, 4) + '...',
      apiResponse: response.data,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Alpha Vantage API test failed',
      message: error.message,
      response: error.response?.data,
    });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/experiments', experimentRouter);
app.use('/api/user', userRouter);

// Analytics endpoint (accepts and discards - frontend analytics are local-only)
app.post('/api/analytics', (req, res) => {
  // Analytics are stored locally in browser, server just accepts them
  res.status(200).json({ received: true });
});

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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Subscribe to stock price updates
  socket.on('subscribe:stocks', (tickers: string[]) => {
    console.log(`Client ${socket.id} subscribed to:`, tickers);
  });

  // Unsubscribe from stock price updates
  socket.on('unsubscribe:stocks', (tickers: string[]) => {
    console.log(`Client ${socket.id} unsubscribed from:`, tickers);
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
║   🚀 StockWise Pro API Server                          ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(36)}║
║   Port: ${config.port.toString().padEnd(43)}║
║   Database: ${(config.databaseUrl ? 'Connected' : 'Not Configured').padEnd(36)}║
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
