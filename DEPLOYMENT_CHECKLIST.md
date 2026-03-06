# AlphaSpectrum - Deployment Checklist

## Pre-Deployment Verification

### ✅ Frontend
- [x] React 18 + TypeScript + Vite setup
- [x] All components built and tested
- [x] Build succeeds without errors
- [x] Deployed to: https://763y7kempky2u.ok.kimi.link

### ✅ Backend
- [x] Node.js + Express + TypeScript setup
- [x] All API routes implemented
- [x] Prisma schema defined
- [x] Services implemented (StockPrice, Alert, Email)
- [x] WebSocket server configured
- [x] Dockerfile created
- [x] render.yaml configured

### ✅ Mobile App
- [x] React Native + Expo setup
- [x] All 7 screens implemented
- [x] Navigation configured
- [x] API services created
- [x] Auth context implemented
- [x] EAS configuration ready

### ✅ Database
- [x] PostgreSQL schema with Prisma
- [x] All models defined (User, Stock, Watchlist, etc.)
- [x] Migration files ready

### ✅ Analytics
- [x] Analytics tracking system implemented
- [x] Dashboard component created
- [x] Events stored in localStorage and sent to backend

---

## Render Deployment Steps

### 1. Create PostgreSQL Database

```bash
# Go to Render Dashboard
# Click "New" → "PostgreSQL"
# Name: alphaspectrum-db
# Region: Select closest to users
# Plan: Starter ($7/month) or higher
# Click "Create Database"
# Copy the "Internal Database URL"
```

### 2. Deploy Backend (Blueprint Method)

```bash
# Push code to GitHub first
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/alphaspectrum.git
git push -u origin main

# In Render Dashboard:
# 1. Click "New" → "Blueprint"
# 2. Connect your GitHub repository
# 3. Render will read render.yaml and create services
# 4. Set environment variables when prompted
```

### 3. Environment Variables for Backend

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | `openssl rand -base64 32` | ✅ |
| `FMP_API_KEY` | `W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ` | ✅ |
| `SMTP_HOST` | Your SMTP host (e.g., smtp.gmail.com) | ⚠️ For email alerts |
| `SMTP_PORT` | 587 | ⚠️ For email alerts |
| `SMTP_USER` | Your email address | ⚠️ For email alerts |
| `SMTP_PASS` | Your email app password | ⚠️ For email alerts |
| `FRONTEND_URL` | https://your-frontend.onrender.com | ⚠️ For CORS |
| `PORT` | 3001 | ✅ (auto-set) |
| `NODE_ENV` | production | ✅ (auto-set) |

### 4. Deploy Frontend

```bash
# Option 1: Use existing deployment
# Already deployed at: https://763y7kempky2u.ok.kimi.link

# Option 2: Deploy to Render Static Site
# 1. Update VITE_API_URL in app/.env
# 2. In Render Dashboard: New → Static Site
# 3. Connect repository
# 4. Build Command: npm install && npm run build
# 5. Publish Directory: dist
```

### 5. Update Frontend API URL

```bash
# Edit app/.env
VITE_API_URL=https://alphaspectrum-api.onrender.com

# Edit app/src/lib/api.ts
const API_BASE_URL = 'https://alphaspectrum-api.onrender.com';

# Rebuild and redeploy
npm run build
```

### 6. Configure Mobile App

```bash
# Edit app/mobile/services/api.ts
const PRODUCTION_API_URL = 'https://alphaspectrum-api.onrender.com/api';

# Build with EAS
cd app/mobile
eas login
eas build --platform android
eas build --platform ios
```

---

## Post-Deployment Verification

### Backend Health Check

```bash
# Test API is running
curl https://alphaspectrum-api.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":"2024-03-07T..."}
```

### Authentication Test

```bash
# Register a test user
curl -X POST https://alphaspectrum-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST https://alphaspectrum-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Stock API Test

```bash
# Get all stocks
curl https://alphaspectrum-api.onrender.com/api/stocks

# Get specific stock
curl https://alphaspectrum-api.onrender.com/api/stocks/AAPL

# Search stocks
curl "https://alphaspectrum-api.onrender.com/api/stocks/search?q=apple"
```

### Frontend Test

1. Open https://763y7kempky2u.ok.kimi.link
2. Verify page loads without errors
3. Check browser console for API errors
4. Test stock screener functionality
5. Verify real-time data loads

---

## Testing with 20 Users

### Setup Test Environment

1. **Create Test Accounts**:
```bash
for i in {1..20}; do
  curl -X POST https://alphaspectrum-api.onrender.com/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"user$i@test.com\",\"password\":\"password123\",\"name\":\"Test User $i\"}"
done
```

2. **Share Test Credentials**:
```
Test User 1: user1@test.com / password123
Test User 2: user2@test.com / password123
...
Test User 20: user20@test.com / password123
```

3. **Testing Tasks for Users**:
- [ ] Register/Login
- [ ] Browse stock screener
- [ ] View stock details
- [ ] Add stocks to watchlist
- [ ] Set price alerts
- [ ] Mimic an investor portfolio
- [ ] Run a formula experiment
- [ ] Update profile settings

### Collect Feedback

1. **Analytics Dashboard**:
   - Login as admin
   - Click "Analytics" button
   - View collected data

2. **Database Queries**:
```sql
-- View all events
SELECT * FROM "AnalyticsEvent" ORDER BY "createdAt" DESC;

-- View feature usage
SELECT "eventType", COUNT(*) as count 
FROM "AnalyticsEvent" 
GROUP BY "eventType" 
ORDER BY count DESC;

-- View stock interactions
SELECT "data"->>'ticker' as ticker, COUNT(*) as views
FROM "AnalyticsEvent"
WHERE "eventType" = 'stock_interaction'
GROUP BY "data"->>'ticker'
ORDER BY views DESC
LIMIT 10;
```

3. **Export Data**:
```bash
# Export to CSV
psql $DATABASE_URL -c "COPY (SELECT * FROM \"AnalyticsEvent\") TO STDOUT WITH CSV HEADER" > analytics.csv
```

---

## Mobile App Distribution

### Android

1. **Build APK**:
```bash
cd app/mobile
eas build --platform android --profile preview
```

2. **Download APK**:
   - Go to EAS Dashboard
   - Download the APK file
   - Share with testers

3. **Google Play Store** (optional):
   - Create developer account ($25)
   - Build AAB: `eas build --platform android --profile production`
   - Upload to Play Console

### iOS

1. **Build IPA**:
```bash
cd app/mobile
eas build --platform ios --profile preview
```

2. **TestFlight** (optional):
   - Enroll in Apple Developer Program ($99/year)
   - Build for production
   - Upload to App Store Connect
   - Distribute via TestFlight

---

## Monitoring & Maintenance

### Logs

- **Render Dashboard**: View service logs
- **PostgreSQL**: Query logs in database
- **Mobile**: Use Sentry or Crashlytics

### Common Issues

| Issue | Solution |
|-------|----------|
| Database connection failed | Check DATABASE_URL, ensure PostgreSQL is running |
| FMP API errors | Verify API key, check rate limits |
| Email not sending | Check SMTP credentials, verify spam folders |
| CORS errors | Update FRONTEND_URL in backend env |
| WebSocket not connecting | Check VITE_SOCKET_URL, verify firewall |

### Updates

1. **Backend Update**:
```bash
git add .
git commit -m "Update backend"
git push origin main
# Render will auto-deploy
```

2. **Frontend Update**:
```bash
npm run build
# Re-deploy to Render or update existing deployment
```

3. **Mobile Update**:
```bash
cd app/mobile
eas build --platform all
# Submit new build to stores
```

---

## Cost Estimation (Render)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| PostgreSQL | Starter | $7 |
| Backend | Starter | $7 |
| Frontend | Static (Free) | $0 |
| **Total** | | **$14/month** |

For production with more traffic:
- PostgreSQL: Standard ($25/month)
- Backend: Standard ($25/month)
- **Total: $50/month**

---

## Support Contacts

- **Render**: https://render.com/docs
- **Prisma**: https://prisma.io/docs
- **Expo**: https://docs.expo.dev
- **FMP API**: https://site.financialmodelingprep.com/developer/docs

---

## Success Criteria

✅ **Deployment Complete When**:
1. Backend API responds to health check
2. Frontend loads and displays data
3. User can register and login
4. Stock screener shows real data
5. Watchlist functionality works
6. Mobile app builds successfully
7. Analytics data is being collected

---

**Ready to Deploy! 🚀**

Start with Step 1: Create PostgreSQL Database on Render
