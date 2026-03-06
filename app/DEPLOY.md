# StockWise Pro - Deployment Guide

Complete deployment instructions for StockWise Pro on Render.

## 🚀 Quick Deploy (Render Blueprint)

The easiest way to deploy is using Render's Blueprint feature:

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/stockwise-pro.git
git push -u origin main
```

### 2. Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"Blueprints"** in the sidebar
3. Click **"New Blueprint Instance"**
4. Connect your GitHub repository
5. Render will auto-detect `render.yaml`
6. Click **"Apply"**

Render will automatically create:
- PostgreSQL database
- Backend API server
- Frontend static site

### 3. Configure Secrets (Optional)

After deployment, you can add optional environment variables:

1. Go to your **stockwise-pro-api** service
2. Click **"Environment"** tab
3. Add any optional variables:
   - `SMTP_HOST` - Email server host
   - `SMTP_USER` - Email username
   - `SMTP_PASS` - Email password

## 📋 Manual Deploy (Step by Step)

If you prefer manual deployment:

### Database

1. Create a new **PostgreSQL** service
2. Name: `stockwise-pro-db`
3. Plan: Starter ($7/month)
4. Copy the **Internal Database URL**

### Backend API

1. Create a new **Web Service**
2. Name: `stockwise-pro-api`
3. Runtime: Node
4. Build Command:
   ```bash
   cd server && npm install && npm run build
   ```
5. Start Command:
   ```bash
   cd server && npm start
   ```
6. Add environment variables:
   - `NODE_ENV`: production
   - `PORT`: 10000
   - `DATABASE_URL`: (from database step)
   - `JWT_SECRET`: (generate random string)
   - `FMP_API_KEY`: W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ
   - `CLIENT_URL`: https://your-frontend-url.onrender.com

### Frontend

1. Create a new **Static Site**
2. Name: `stockwise-pro-web`
3. Build Command:
   ```bash
   npm install && npm run build
   ```
4. Publish Directory: `dist`
5. Add environment variables:
   - `VITE_API_URL`: https://your-api-url.onrender.com/api
   - `VITE_WS_URL`: wss://your-api-url.onrender.com

## 🔧 Post-Deployment Setup

### 1. Database Migration

After the first deploy, run migrations:

```bash
# Using Render Shell
cd server
npx prisma migrate deploy
```

Or use the **"Shell"** tab in your API service on Render.

### 2. Seed Database (Optional)

```bash
cd server
npx prisma db seed
```

### 3. Verify Deployment

Check these endpoints:
- API Health: `https://your-api.onrender.com/health`
- API Root: `https://your-api.onrender.com/`
- Frontend: `https://your-frontend.onrender.com`

## 📱 Mobile App Deployment

### Expo Build

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
cd mobile
eas login
```

3. Configure project:
```bash
eas configure
```

4. Build for iOS:
```bash
eas build --platform ios
```

5. Build for Android:
```bash
eas build --platform android
```

### App Store Submission

After building, submit to stores:
- iOS: Use **Transporter** app or **App Store Connect**
- Android: Use **Google Play Console**

## 🔐 Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` or `development` |
| `PORT` | Yes | Server port (10000 on Render) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `FMP_API_KEY` | Yes | Financial Modeling Prep API key |
| `CLIENT_URL` | Yes | Frontend URL for CORS |
| `SMTP_HOST` | No | Email server host |
| `SMTP_PORT` | No | Email server port (587) |
| `SMTP_USER` | No | Email username |
| `SMTP_PASS` | No | Email password |
| `SMTP_FROM` | No | From email address |

### Frontend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL |
| `VITE_WS_URL` | Yes | WebSocket URL |
| `VITE_FMP_API_KEY` | No | FMP API key (optional) |

## 🔄 Continuous Deployment

Render automatically deploys on every push to your connected branch.

To disable auto-deploy:
1. Go to service settings
2. Toggle **"Auto-Deploy"** off

To manually deploy:
1. Go to service
2. Click **"Manual Deploy"**
3. Select **"Deploy Latest Commit"**

## 📊 Monitoring

### Logs

View logs in Render Dashboard:
1. Go to your service
2. Click **"Logs"** tab

### Health Checks

The API has a health endpoint:
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-03-07T12:00:00.000Z",
  "environment": "production",
  "services": {
    "database": "connected",
    "websocket": "ready"
  },
  "version": "1.0.0"
}
```

## 🛠️ Troubleshooting

### Database Connection Issues

1. Check `DATABASE_URL` is correct
2. Verify database is running
3. Check database logs in Render

### CORS Errors

1. Verify `CLIENT_URL` matches your frontend URL
2. Check for trailing slashes
3. Ensure `https://` is used in production

### WebSocket Issues

1. Use `wss://` (not `ws://`) in production
2. Check firewall settings
3. Verify WebSocket URL matches API domain

### Build Failures

1. Check build logs in Render
2. Verify all environment variables are set
3. Ensure `package.json` scripts are correct

## 💰 Cost Estimation (Render)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| PostgreSQL | Starter | $7 |
| Backend API | Starter | $7 |
| Frontend | Free | $0 |
| **Total** | | **$14/month** |

For production with more resources:
| Service | Plan | Monthly Cost |
|---------|------|--------------|
| PostgreSQL | Standard | $20+ |
| Backend API | Standard | $25+ |
| Frontend | Free | $0 |
| **Total** | | **$45+/month** |

## 📞 Support

For deployment issues:
1. Check [Render Docs](https://render.com/docs)
2. Review application logs
3. Open an issue on GitHub

## 📝 Checklist

Before deploying:

- [ ] All code pushed to GitHub
- [ ] `render.yaml` is in root directory
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] FMP API key is valid
- [ ] SMTP settings configured (optional)
- [ ] Domain names decided
- [ ] SSL certificates (auto on Render)

After deploying:

- [ ] Health check passes
- [ ] Database migrations run
- [ ] Frontend loads correctly
- [ ] API responds to requests
- [ ] WebSocket connects
- [ ] Authentication works
- [ ] Email notifications work (if configured)
