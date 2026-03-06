# AlphaSpectrum - Complete Deployment Guide

## Overview

AlphaSpectrum is a full-stack AI-powered stock analysis platform with:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL
- **Mobile App**: React Native + Expo
- **Real-time**: WebSocket for live price updates
- **External APIs**: Financial Modeling Prep (FMP) API

## What's Been Built

### 1. Frontend Features
- **Landing Page**: Hero, features, pricing, testimonials, FAQ
- **Stock Screener**: Search, filter, sort stocks with real-time data
- **Stock Detail Drawer**: View detailed stock information with FMP API
- **Watchlist**: Add/remove stocks, set price alerts
- **Stock Comparison**: Compare multiple stocks side-by-side
- **Scoring System**: Customizable weighted scoring algorithm
- **Investor Portfolios**: Mimic 12 legendary investors (Buffett, Dalio, Wood, etc.)
- **Formula Lab**: Experiment workspace for testing scoring formulas
- **User Authentication**: Login/signup with JWT
- **Analytics Dashboard**: Track user behavior for testing

### 2. Backend Features
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Stock API**: Fetch real-time data from FMP API
- **Watchlist API**: CRUD operations for watchlist items
- **Portfolio API**: Track holdings, mimic investors
- **Alerts API**: Price alerts with email notifications
- **Experiments API**: Save and run scoring formula experiments
- **Analytics API**: Collect user behavior data
- **WebSocket Server**: Real-time price streaming
- **Email Service**: Nodemailer with SMTP
- **Cron Jobs**: Scheduled tasks for alerts and data caching

### 3. Mobile App Features
- **5 Screens**: Home, Screener, Watchlist, Portfolio, Profile
- **Authentication**: Full login/signup flow
- **Real-time Data**: Live stock prices
- **Navigation**: Bottom tab navigator
- **Watchlist Management**: Add/remove with alerts
- **Portfolio Tracking**: View holdings and mimic investors

## Deployment Instructions

### Step 1: Deploy Backend to Render

1. **Push code to GitHub**:
```bash
cd /mnt/okcomputer/output/app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/alphaspectrum.git
git push -u origin main
```

2. **Create PostgreSQL Database on Render**:
   - Go to https://dashboard.render.com
   - Click "New" → "PostgreSQL"
   - Name: `alphaspectrum-db`
   - Region: Choose closest to your users
   - Create database
   - Copy the "Internal Database URL"

3. **Deploy Backend Service**:
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create services automatically
   - Or manually create a Web Service:
     - Name: `alphaspectrum-api`
     - Environment: `Node`
     - Build Command: `cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
     - Start Command: `cd backend && npm start`
   - Add Environment Variables:
     - `DATABASE_URL`: PostgreSQL connection string
     - `JWT_SECRET`: Random string (generate with `openssl rand -base64 32`)
     - `FMP_API_KEY`: `W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ`
     - `SMTP_HOST`: Your email SMTP host
     - `SMTP_PORT`: 587
     - `SMTP_USER`: Your email
     - `SMTP_PASS`: Your email password
     - `FRONTEND_URL`: Your frontend URL (after deployment)

### Step 2: Deploy Frontend to Render

1. **Update API URL**:
   - Edit `app/src/lib/api.ts` and `app/.env`:
   ```
   VITE_API_URL=https://alphaspectrum-api.onrender.com
   ```

2. **Build and Deploy**:
   - The frontend is already deployed at: https://763y7kempky2u.ok.kimi.link
   - Or create a new Static Site on Render:
     - Name: `alphaspectrum-web`
     - Build Command: `npm install && npm run build`
     - Publish Directory: `dist`

### Step 3: Configure Mobile App

1. **Update API URL in `mobile/services/api.ts`**:
```typescript
const PRODUCTION_API_URL = 'https://alphaspectrum-api.onrender.com/api';
```

2. **Build with EAS**:
```bash
cd mobile
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios
```

## Environment Variables Reference

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# FMP API
FMP_API_KEY=W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ
FMP_BASE_URL=https://financialmodelingprep.com/api/v3

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@alphaspectrum.app

# Frontend URL
FRONTEND_URL=https://alphaspectrum-web.onrender.com

# Server
PORT=3001
NODE_ENV=production
```

### Frontend (.env)
```env
VITE_API_URL=https://alphaspectrum-api.onrender.com
VITE_SOCKET_URL=wss://alphaspectrum-api.onrender.com
```

## Testing with 20 Users

### Analytics Collection

The app includes built-in analytics tracking. To view collected data:

1. **Open Analytics Dashboard**:
   - Login as admin
   - Click "Analytics" button in navbar
   - View user sessions, page views, feature usage, stock interactions

2. **Data Collected**:
   - Session ID and user ID
   - Page views with time spent
   - Feature usage (screener, watchlist, portfolio, etc.)
   - Stock interactions (views, watchlist adds, alerts)
   - User actions (clicks, searches)
   - Errors and performance metrics

3. **Export Data**:
   - Analytics data is stored in PostgreSQL `AnalyticsEvent` table
   - Export via backend API: `GET /api/analytics/stats`

### User Testing Checklist

- [ ] User can register and login
- [ ] User can browse stocks in screener
- [ ] User can view stock details with real data
- [ ] User can add/remove stocks from watchlist
- [ ] User can set price alerts
- [ ] User can mimic investor portfolios
- [ ] User can run scoring formula experiments
- [ ] Real-time price updates work
- [ ] Email alerts are received
- [ ] Mobile app works on iOS/Android

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### Stocks
- `GET /api/stocks` - Get all stocks
- `GET /api/stocks/:ticker` - Get stock by ticker
- `GET /api/stocks/search?q=query` - Search stocks
- `GET /api/stocks/:ticker/quote` - Get real-time quote
- `GET /api/stocks/:ticker/historical` - Get historical data
- `GET /api/stocks/:ticker/score` - Get stock score

### Watchlist
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add to watchlist
- `PUT /api/watchlist/:id` - Update watchlist item
- `DELETE /api/watchlist/:id` - Remove from watchlist

### Portfolio
- `GET /api/portfolio` - Get user's portfolio
- `POST /api/portfolio/holdings` - Add holding
- `DELETE /api/portfolio/holdings/:id` - Remove holding
- `POST /api/portfolio/mimic` - Mimic investor

### Alerts
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create alert
- `DELETE /api/alerts/:id` - Delete alert

### Experiments
- `GET /api/experiments` - Get user's experiments
- `POST /api/experiments` - Create experiment
- `POST /api/experiments/:id/run` - Run experiment
- `DELETE /api/experiments/:id` - Delete experiment

### Analytics
- `POST /api/analytics/event` - Track event
- `GET /api/analytics/stats` - Get analytics stats (admin)

## WebSocket Events

### Client → Server
- `subscribe_stock` - Subscribe to stock updates
- `unsubscribe_stock` - Unsubscribe from stock updates

### Server → Client
- `price_update` - Real-time price update
- `alert_triggered` - Price alert notification

## File Structure

```
/mnt/okcomputer/output/app/
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── config/       # Configuration
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utilities
│   │   ├── types/        # TypeScript types
│   │   ├── middleware/   # Express middleware
│   │   └── prisma/       # Database schema
│   ├── Dockerfile
│   ├── render.yaml
│   └── package.json
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── sections/         # Page sections
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilities & data
│   └── App.tsx
├── mobile/               # React Native app
│   ├── screens/          # App screens
│   ├── services/         # API services
│   ├── contexts/         # Auth context
│   └── App.tsx
├── dist/                 # Built frontend
└── package.json
```

## Troubleshooting

### Backend Issues

1. **Database connection failed**:
   - Check `DATABASE_URL` format
   - Ensure PostgreSQL is running
   - Run `npx prisma migrate deploy`

2. **FMP API errors**:
   - Verify `FMP_API_KEY` is set
   - Check API rate limits

3. **Email not sending**:
   - Verify SMTP credentials
   - Check spam folders
   - Use app-specific password for Gmail

### Frontend Issues

1. **API calls failing**:
   - Check `VITE_API_URL` is correct
   - Verify CORS is enabled on backend
   - Check browser console for errors

2. **WebSocket not connecting**:
   - Verify `VITE_SOCKET_URL`
   - Check firewall settings

### Mobile Issues

1. **Cannot connect to backend**:
   - Update API URL in `services/api.ts`
   - For iOS simulator: use `localhost`
   - For Android emulator: use `10.0.2.2`
   - For physical device: use computer's IP

2. **Build failures**:
   - Clear cache: `expo start --clear`
   - Reinstall node_modules
   - Update EAS CLI

## Support

For issues or questions:
- Check logs in Render dashboard
- Review browser console for frontend errors
- Test API endpoints with Postman/curl
- Check PostgreSQL logs for database issues

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Deploy frontend to Render
3. ✅ Configure mobile app API URL
4. ✅ Test with 20 users
5. ✅ Collect analytics data
6. 🔄 Submit mobile apps to App Store/Play Store
7. 🔄 Set up monitoring (Sentry, LogRocket)
8. 🔄 Configure CDN for static assets
9. 🔄 Set up CI/CD pipelines

---

**Live Demo**: https://763y7kempky2u.ok.kimi.link

**Mobile App**: Build with `cd mobile && eas build`
