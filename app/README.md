# StockWise Pro

AI-powered stock analysis and investment platform with real-time data, custom scoring algorithms, and famous investor portfolio mimicry.

## 🚀 Live Demo

- **Web App**: https://stockwise-pro-web.onrender.com
- **API**: https://stockwise-pro-api.onrender.com
- **Health Check**: https://stockwise-pro-api.onrender.com/health

## 📱 Mobile App

The mobile app is built with React Native + Expo and provides:
- Real-time market data
- Stock screening with AI scores
- Watchlist with price alerts
- Portfolio tracking
- User authentication

See [mobile/README.md](./mobile/README.md) for mobile app details.

## ✨ Features

### Core Features
- **AI-Powered Stock Scoring**: Customizable weight factors for buy/hold/sell recommendations
- **Real-time Data**: Live stock prices via WebSocket
- **Famous Investor Portfolios**: Mimic strategies of Warren Buffett, Ray Dalio, etc.
- **Formula Lab**: Experiment with custom scoring algorithms in real-time
- **Watchlist**: Track favorite stocks with price alerts
- **Stock Comparison**: Side-by-side comparison of multiple stocks

### User Features
- **Authentication**: JWT-based auth with email/password
- **Subscription Plans**: Free, Pro, and Elite tiers
- **Price Alerts**: Email and push notifications
- **Portfolio Tracking**: Monitor your investments
- **Analytics**: Track user behavior and feature usage

### Technical Features
- **WebSocket**: Real-time price updates
- **Cron Jobs**: Automated alert checking and price caching
- **Email Notifications**: Price alerts and newsletters
- **Analytics**: User behavior tracking for testing
- **Mobile App**: React Native companion app

## 🏗️ Architecture

```
StockWise Pro
├── Frontend (React + Vite + TypeScript)
│   ├── Live market data
│   ├── Stock screener
│   ├── Formula lab
│   └── User dashboard
├── Backend (Node.js + Express + TypeScript)
│   ├── REST API
│   ├── WebSocket server
│   ├── Cron jobs
│   └── Email service
├── Database (PostgreSQL + Prisma)
│   ├── Users
│   ├── Watchlists
│   ├── Alerts
│   └── Portfolios
└── Mobile App (React Native + Expo)
    ├── iOS/Android
    ├── Real-time sync
    └── Offline support
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **State**: React Context + LocalStorage

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **WebSocket**: Socket.io
- **Auth**: JWT
- **Email**: Nodemailer
- **Cron**: node-cron

### Mobile
- **Framework**: React Native
- **Platform**: Expo
- **Navigation**: React Navigation
- **Storage**: AsyncStorage

### External APIs
- **Financial Modeling Prep**: Stock data and quotes

## 🚀 Deployment

### Render (Recommended)

1. **Create Blueprint Instance**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "Blueprints"
   - Connect your GitHub repo
   - Render will auto-detect `render.yaml`

2. **Configure Environment Variables**:
   - `JWT_SECRET`: Auto-generated
   - `DATABASE_URL`: Auto-configured
   - `FMP_API_KEY`: Your FMP API key
   - `SMTP_*`: Email configuration (optional)

3. **Deploy**:
   - Click "Apply" to deploy all services
   - Services: Database, API, Web

### Manual Deployment

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

## 🧪 Testing with Analytics

The app includes built-in analytics for testing with up to 20 users:

1. **Access Analytics Dashboard**:
   - Click the purple "Analytics" button (bottom-right)
   - View real-time user behavior data

2. **Tracked Events**:
   - Page views
   - Feature usage
   - Stock interactions
   - Search queries
   - Watchlist actions

3. **Session Data**:
   - User sessions stored in localStorage
   - Sent to backend when online
   - View aggregated data in dashboard

## 📊 Data Collection

For the 20-user testing phase, we collect:

- **User Actions**: Feature usage, button clicks
- **Stock Interactions**: Views, searches, watchlist adds
- **Performance**: Page load times, API response times
- **Errors**: Client-side errors and stack traces

All data is anonymized and used only for improving the app.

## 📝 Environment Variables

### Frontend (.env.production)
```env
VITE_API_URL=https://stockwise-pro-api.onrender.com/api
VITE_WS_URL=wss://stockwise-pro-api.onrender.com
VITE_FMP_API_KEY=your_fmp_api_key
```

### Backend (.env)
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
FMP_API_KEY=your_fmp_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

## 🏃 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Setup

1. **Clone and install**:
```bash
git clone <repo-url>
cd app
npm install
cd server && npm install
```

2. **Setup database**:
```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

3. **Start backend**:
```bash
cd server
npm run dev
```

4. **Start frontend** (new terminal):
```bash
npm run dev
```

5. **Start mobile** (optional):
```bash
cd mobile
npm install
npx expo start
```

## 📁 Project Structure

```
app/
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── sections/           # Page sections
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities and API
│   └── App.tsx             # Main app
├── server/                 # Backend source
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── index.ts        # Server entry
│   └── prisma/             # Database schema
├── mobile/                 # React Native app
│   ├── screens/            # App screens
│   ├── contexts/           # Auth context
│   └── App.tsx             # Mobile app entry
├── render.yaml             # Render deployment config
└── README.md               # This file
```

## 🔐 Authentication

The app uses JWT-based authentication:

1. User registers/logs in
2. Server returns JWT token
3. Token stored in localStorage (web) or AsyncStorage (mobile)
4. Token sent with all authenticated API requests
5. Token expires after 7 days

## 📧 Email Notifications

Configure SMTP settings for email alerts:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=alerts@stockwise.pro
```

## 🔄 WebSocket Events

### Client → Server
- `subscribe:stocks` - Subscribe to stock updates
- `unsubscribe:stocks` - Unsubscribe from stock updates
- `ping` - Keep connection alive

### Server → Client
- `price:update` - Real-time price update
- `alert:triggered` - Price alert triggered
- `pong` - Ping response

## 🛣️ API Routes

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset

### Stocks
- `GET /api/stocks/trending` - Get trending stocks
- `GET /api/stocks/indices` - Get market indices
- `GET /api/stocks/quote/:ticker` - Get stock quote
- `GET /api/stocks/search?q=` - Search stocks

### Watchlist
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/:ticker` - Remove from watchlist

### Alerts
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create alert
- `PATCH /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

### Portfolio
- `GET /api/portfolio` - Get user's portfolio
- `POST /api/portfolio` - Add holding
- `PATCH /api/portfolio/:id` - Update holding

## 📝 License

MIT License - See LICENSE file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support, email support@stockwise.pro or open an issue on GitHub.

## 🙏 Acknowledgments

- [Financial Modeling Prep](https://financialmodelingprep.com) for stock data
- [shadcn/ui](https://ui.shadcn.com) for UI components
- [Render](https://render.com) for hosting
