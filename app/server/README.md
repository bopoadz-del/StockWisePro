# StockWise Pro Backend

A production-ready Node.js/Express backend with PostgreSQL, WebSockets, and email notifications.

## Features

- **Authentication**: JWT-based auth with registration, login, password reset
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSocket server for live price updates
- **Email**: Nodemailer for price alerts and notifications
- **API**: RESTful endpoints for stocks, watchlist, alerts, portfolios
- **Cron Jobs**: Scheduled tasks for price checks and caching

## Project Structure

```
server/
├── src/
│   ├── index.ts           # Main server entry
│   ├── routes/            # API routes
│   │   ├── auth.ts
│   │   ├── stocks.ts
│   │   ├── watchlist.ts
│   │   ├── alerts.ts
│   │   ├── portfolio.ts
│   │   ├── experiments.ts
│   │   └── user.ts
│   ├── middleware/        # Express middleware
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   ├── services/          # Business logic
│   │   ├── stockPriceService.ts
│   │   ├── alertService.ts
│   │   └── emailService.ts
│   └── utils/
│       └── prisma.ts
├── prisma/
│   └── schema.prisma      # Database schema
└── package.json
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Set up database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `FMP_API_KEY` | Financial Modeling Prep API key |
| `CLIENT_URL` | Frontend URL for CORS |
| `PORT` | Server port (default: 3001) |
| `SMTP_*` | Email configuration (optional) |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Stocks
- `GET /api/stocks/search?q=QUERY` - Search stocks
- `GET /api/stocks/quote/:ticker` - Get stock quote
- `GET /api/stocks/quotes?symbols=AAPL,MSFT` - Get batch quotes
- `GET /api/stocks/metrics/:ticker` - Get key metrics
- `GET /api/stocks/historical/:ticker` - Get historical prices
- `GET /api/stocks/indices` - Get market indices
- `GET /api/stocks/trending` - Get trending stocks
- `GET /api/stocks/screener` - Get screener data

### Watchlist (Auth required)
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/:ticker` - Remove from watchlist

### Price Alerts (Auth required)
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create alert (Pro/Elite)
- `PATCH /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

### Portfolios (Auth required, Elite only)
- `GET /api/portfolio` - Get portfolios
- `POST /api/portfolio` - Create portfolio
- `GET /api/portfolio/:id/export` - Export as CSV

### User (Auth required)
- `GET /api/user/profile` - Get profile
- `PATCH /api/user/profile` - Update profile
- `POST /api/user/change-password` - Change password
- `GET /api/user/stats` - Get stats

## WebSocket Events

### Client → Server
- `subscribe:stocks` - Subscribe to price updates
  ```json
  ["AAPL", "MSFT", "GOOGL"]
  ```
- `unsubscribe:stocks` - Unsubscribe from price updates

### Server → Client
- `prices:update` - Real-time price updates
  ```json
  [
    { "symbol": "AAPL", "price": 195.50, "change": 2.5, ... }
  ]
  ```
- `alert:triggered` - Price alert notification

## Cron Jobs

- **Every minute**: Check price alerts
- **Every 5 minutes**: Update cached stock prices

## Database Schema

### Models
- `User` - User accounts
- `Session` - Active sessions
- `Subscription` - Plan subscriptions
- `Watchlist` - User watchlists
- `PriceAlert` - Price alerts
- `Portfolio` - User portfolios
- `PortfolioHolding` - Portfolio holdings
- `Experiment` - Saved experiments
- `CachedStock` - Cached stock data
