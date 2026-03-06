# AlphaSpectrum 🚀

AI-powered stock analysis and portfolio management platform with real-time data, investor portfolio mimicry, and advanced scoring algorithms.

![AlphaSpectrum](https://img.shields.io/badge/AlphaSpectrum-v1.0.0-gold)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)

## 🌐 Live Demo

**Frontend**: https://763y7kempky2u.ok.kimi.link

## ✨ Features

### 📊 Stock Analysis
- **Real-time Data**: Live stock prices via FMP API
- **Stock Screener**: Advanced filtering, sorting, and search
- **Scoring System**: Customizable weighted scoring algorithm
- **Stock Comparison**: Side-by-side comparison tool
- **Price Alerts**: Get notified when stocks hit target prices

### 💼 Portfolio Management
- **Track Holdings**: Monitor your investments
- **Mimic Investors**: Copy strategies from 12 legendary investors
  - Warren Buffett, Ray Dalio, Cathie Wood, Peter Lynch, and more
- **Portfolio Analytics**: View P&L and allocation

### 🔬 Experiment Workspace
- **Formula Lab**: Test custom scoring formulas
- **Backtesting**: Validate strategies with historical data
- **Save Experiments**: Store and rerun your formulas

### 📱 Mobile App
- **React Native + Expo**: Cross-platform iOS/Android app
- **Full Feature Parity**: All web features on mobile
- **Real-time Updates**: Live price streaming
- **Push Notifications**: Price alerts and market updates

### 📈 Analytics & Tracking
- **User Behavior**: Track feature usage and interactions
- **Session Analytics**: Page views, time spent, actions
- **Stock Interactions**: Most viewed stocks, watchlist activity
- **Dashboard**: Visualize collected data

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend      │────▶│   Database      │
│   (React)       │◄────│   (Node.js)     │◄────│  (PostgreSQL)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │               ┌───────┴───────┐
        │               │  External APIs │
        │               │  • FMP API     │
        │               │  • SMTP Email  │
        │               └───────────────┘
        │
┌───────┴───────┐
│  Mobile App   │
│ (React Native)│
└───────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/alphaspectrum.git
cd alphaspectrum

# Install frontend dependencies
cd app
npm install

# Install backend dependencies
cd backend
npm install

# Install mobile dependencies
cd ../mobile
npm install
```

### 2. Environment Setup

Create `.env` files:

**Backend** (`app/backend/.env`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/alphaspectrum
JWT_SECRET=your-super-secret-key
FMP_API_KEY=W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FRONTEND_URL=http://localhost:5173
PORT=3001
NODE_ENV=development
```

**Frontend** (`app/.env`):
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=ws://localhost:3001
```

### 3. Database Setup

```bash
cd app/backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start Development

**Terminal 1 - Backend**:
```bash
cd app/backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd app
npm run dev
```

**Terminal 3 - Mobile** (optional):
```bash
cd app/mobile
npm start
```

### 5. Open in Browser

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api/health

## 📁 Project Structure

```
app/
├── src/                    # Frontend source
│   ├── components/         # React components
│   ├── sections/           # Page sections
│   ├── contexts/           # React contexts
│   ├── lib/                # Utilities & data
│   └── App.tsx             # Main app
├── backend/                # Backend source
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── index.ts        # Server entry
│   └── prisma/             # Database schema
├── mobile/                 # React Native app
│   ├── screens/            # App screens
│   ├── services/           # API services
│   └── App.tsx             # Mobile app entry
└── dist/                   # Built frontend
```

## 🛠️ Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- shadcn/ui components
- Framer Motion animations
- Recharts for data visualization
- Socket.io client for real-time updates

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- JWT authentication
- Socket.io for WebSocket
- node-cron for scheduling
- Nodemailer for emails

### Mobile
- React Native with Expo
- TypeScript
- React Navigation
- AsyncStorage
- Socket.io client

### External APIs
- Financial Modeling Prep (FMP) API for stock data
- SMTP for email notifications

## 🚢 Deployment

### Render (Recommended)

1. **Push to GitHub**:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy via Blueprint**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repo
   - Render will auto-create services from `render.yaml`

3. **Set Environment Variables**:
   - Add your `DATABASE_URL`, `JWT_SECRET`, `FMP_API_KEY`

4. **Done!** Your app will be live at:
   - Frontend: `https://alphaspectrum-web.onrender.com`
   - Backend: `https://alphaspectrum-api.onrender.com`

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

## 📊 Testing with 20 Users

The app includes built-in analytics tracking:

1. **Enable Tracking**: Already enabled by default
2. **View Dashboard**: Login and click "Analytics" button
3. **Collect Data**: Share app with 20 test users
4. **Export Results**: Query PostgreSQL or use API

```sql
-- View all analytics events
SELECT * FROM "AnalyticsEvent" ORDER BY "createdAt" DESC;

-- Top viewed stocks
SELECT "data"->>'ticker', COUNT(*) 
FROM "AnalyticsEvent" 
WHERE "eventType" = 'stock_interaction'
GROUP BY "data"->>'ticker';
```

## 📱 Mobile App Build

### Android
```bash
cd app/mobile
eas build --platform android
```

### iOS
```bash
cd app/mobile
eas build --platform ios
```

Download builds from [EAS Dashboard](https://expo.dev/builds).

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret for JWT signing | ✅ |
| `FMP_API_KEY` | Financial Modeling Prep API key | ✅ |
| `SMTP_HOST` | Email SMTP host | ⚠️ |
| `SMTP_USER` | Email username | ⚠️ |
| `SMTP_PASS` | Email password | ⚠️ |
| `FRONTEND_URL` | Frontend URL for CORS | ✅ |

## 📝 API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

### Stocks
- `GET /api/stocks` - List all stocks
- `GET /api/stocks/:ticker` - Get stock details
- `GET /api/stocks/search?q=query` - Search stocks

### Watchlist
- `GET /api/watchlist` - Get watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/:id` - Remove from watchlist

### Portfolio
- `GET /api/portfolio` - Get portfolio
- `POST /api/portfolio/mimic` - Mimic investor

See full API docs at `/api/health` when server is running.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Financial Modeling Prep](https://financialmodelingprep.com) for stock data
- [shadcn/ui](https://ui.shadcn.com) for UI components
- [Render](https://render.com) for hosting
- [Expo](https://expo.dev) for mobile development

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/alphaspectrum/issues)
- **Docs**: See `DEPLOYMENT_GUIDE.md` and `PROJECT_SUMMARY.md`
- **Email**: support@alphaspectrum.app

---

**Built with ❤️ using React, Node.js, and AI**

*Last Updated: March 2024*
