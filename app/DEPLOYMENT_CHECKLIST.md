# StockWise Pro - Render Deployment Checklist

## ✅ Files Created for Deployment

### 1. Render Configuration
- [x] `render.yaml` - Blueprint for automated deployment
- [x] `.env.production` - Frontend production environment
- [x] `.env.example` - Environment variable template

### 2. Backend Server (`/server/`)
- [x] `package.json` - Dependencies and scripts
- [x] `tsconfig.json` - TypeScript configuration
- [x] `Dockerfile` - Container configuration
- [x] `.dockerignore` - Docker build exclusions
- [x] `.env.example` - Backend environment template
- [x] `README.md` - Backend documentation

### 3. Backend Source (`/server/src/`)
- [x] `index.ts` - Main server entry (production-ready)
- [x] `config/index.ts` - Centralized configuration
- [x] `config/database.ts` - Database connection
- [x] `seed.ts` - Database seeding script

### 4. Backend Routes (`/server/src/routes/`)
- [x] `auth.ts` - Authentication (register/login)
- [x] `stocks.ts` - Stock data API
- [x] `watchlist.ts` - Watchlist CRUD
- [x] `alerts.ts` - Price alerts
- [x] `portfolio.ts` - Portfolio management
- [x] `experiments.ts` - Formula experiments
- [x] `user.ts` - User profile

### 5. Backend Services (`/server/src/services/`)
- [x] `stockPriceService.ts` - WebSocket price updates
- [x] `alertService.ts` - Price alert checking
- [x] `emailService.ts` - Email notifications

### 6. Backend Middleware (`/server/src/middleware/`)
- [x] `auth.ts` - JWT authentication
- [x] `errorHandler.ts` - Error handling

### 7. Database (`/server/prisma/`)
- [x] `schema.prisma` - Database schema

### 8. Frontend API Integration (`/src/lib/api/`)
- [x] `client.ts` - API client with auth
- [x] `auth.ts` - Authentication API
- [x] `stocks.ts` - Stocks API
- [x] `watchlist.ts` - Watchlist API
- [x] `alerts.ts` - Alerts API

### 9. Frontend Contexts (`/src/contexts/`)
- [x] `AuthContext.tsx` - Authentication state

### 10. Frontend Hooks (`/src/hooks/`)
- [x] `useWebSocket.ts` - WebSocket connection

### 11. CI/CD
- [x] `.github/workflows/deploy.yml` - GitHub Actions workflow

### 12. Documentation
- [x] `README.md` - Project documentation
- [x] `DEPLOY.md` - Deployment guide
- [x] `DEPLOYMENT_CHECKLIST.md` - This file

---

## 🚀 Quick Deploy Steps

### Option 1: Blueprint Deploy (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/stockwise-pro.git
   git push -u origin main
   ```

2. **Deploy on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **"New +"** → **"Blueprint"**
   - Connect your GitHub repo
   - Click **"Apply"**
   - Done! 🎉

### Option 2: Manual Deploy

1. **Create PostgreSQL Database**
   - Render Dashboard → "New +" → "PostgreSQL"
   - Name: `stockwise-pro-db`
   - Plan: Free
   - Copy the Internal Database URL

2. **Create Backend Service**
   - Render Dashboard → "New +" → "Web Service"
   - Connect GitHub repo
   - Name: `stockwise-pro-api`
   - Runtime: Node
   - Build: `cd server && npm install && npm run build`
   - Start: `cd server && npm start`
   - Add env vars (see below)

3. **Create Frontend Site**
   - Render Dashboard → "New +" → "Static Site"
   - Connect GitHub repo
   - Name: `stockwise-pro-web`
   - Build: `npm install && npm run build`
   - Publish: `dist`
   - Add env vars (see below)

---

## 📋 Required Environment Variables

### Backend (`stockwise-pro-api`)

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=<from PostgreSQL service>
JWT_SECRET=<generate: openssl rand -base64 32>
FMP_API_KEY=W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ
CLIENT_URL=https://stockwise-pro-web.onrender.com
```

### Frontend (`stockwise-pro-web`)

```bash
VITE_API_URL=https://stockwise-pro-api.onrender.com/api
VITE_WS_URL=wss://stockwise-pro-api.onrender.com
```

---

## 🔧 Post-Deploy Setup

### 1. Run Database Migrations

In Render Dashboard:
1. Go to your backend service
2. Click **"Shell"** tab
3. Run:
   ```bash
   cd server
   npx prisma migrate deploy
   npm run db:seed
   ```

### 2. Verify Deployment

- **Health Check**: `https://your-api.onrender.com/health`
- **Frontend**: `https://your-web.onrender.com`
- **API Test**: `https://your-api.onrender.com/api/stocks/quote/AAPL`

---

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check database URL format
postgresql://username:password@host:port/database

# Test connection
npx prisma db pull
```

### CORS Errors
- Verify `CLIENT_URL` matches frontend URL exactly
- No trailing slash
- Use `https://` not `http://`

### WebSocket Not Connecting
- Use `wss://` (secure) not `ws://`
- Check that backend is running
- Verify WebSocket URL in browser console

### Build Fails
```bash
# Test build locally
cd server
npm install
npm run build
```

---

## 📊 Service URLs After Deploy

| Service | URL Pattern |
|---------|-------------|
| Frontend | `https://stockwise-pro-web.onrender.com` |
| Backend API | `https://stockwise-pro-api.onrender.com/api` |
| WebSocket | `wss://stockwise-pro-api.onrender.com` |
| Health | `https://stockwise-pro-api.onrender.com/health` |

---

## 🔄 Updating After Deploy

### Automatic (Recommended)
1. Push changes to GitHub
2. Render auto-deploys

### Manual
1. Go to service in Render Dashboard
2. Click **"Manual Deploy"**
3. Select **"Deploy latest commit"**

---

## 📈 Scaling

### Upgrade Database
- Go to PostgreSQL service
- Click **"Settings"**
- Change plan to Starter ($7/mo) or higher

### Upgrade Backend
- Go to Web Service
- Click **"Settings"**
- Change plan for more RAM/CPU

---

## 🎉 You're Ready to Deploy!

Click the button below to deploy instantly:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Or follow the manual steps above.

---

## 📞 Support

- Render Docs: https://render.com/docs
- Prisma Docs: https://www.prisma.io/docs
- FMP API: https://site.financialmodelingprep.com/developer/docs
