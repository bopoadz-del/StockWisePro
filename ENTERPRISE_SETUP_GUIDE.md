# AlphaSpectrum Enterprise Setup Guide

## Quick Start

### Local Development

1. **Start all services with Docker Compose:**
```bash
docker-compose up -d
```

2. **Run database migrations:**
```bash
cd app/server
npx prisma migrate dev
npx prisma generate
```

3. **Seed initial data (optional):**
```bash
npx prisma db seed
```

### Environment Setup

Create `.env` file in `app/server`:
```env
# Required
DATABASE_URL=postgresql://alphaspectrum:changeme@localhost:5432/alphaspectrum
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key

# Optional
REDIS_URL=redis://localhost:6379
ALPHA_VANTAGE_API_KEY=your-key
TWELVE_DATA_API_KEY=your-key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Production Deployment

### Option 1: Docker Compose (Single Server)

1. **Clone repository:**
```bash
git clone https://github.com/your-org/alphaspectrum.git
cd alphaspectrum
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with production values
```

3. **Start services:**
```bash
docker-compose -f docker-compose.yml up -d
```

4. **Run migrations:**
```bash
docker-compose exec api npx prisma migrate deploy
```

### Option 2: Kubernetes

1. **Create namespace:**
```bash
kubectl apply -f k8s/namespace.yaml
```

2. **Create secrets:**
```bash
# Edit k8s/secrets.yaml with your values
kubectl apply -f k8s/secrets.yaml
```

3. **Deploy application:**
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

4. **Verify deployment:**
```bash
kubectl get pods -n alphaspectrum
kubectl get svc -n alphaspectrum
kubectl get ingress -n alphaspectrum
```

## Database Management

### Migrations
```bash
# Create migration
cd app/server
npx prisma migrate dev --name migration_name

# Deploy to production
npx prisma migrate deploy

# Generate client
npx prisma generate
```

### Backup & Restore
```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Monitoring & Observability

### Health Checks
- `GET /health` - Basic liveness
- `GET /health/deep` - Comprehensive health check

### Logs
```bash
# Docker Compose
docker-compose logs -f api

# Kubernetes
kubectl logs -f deployment/alphaspectrum-api -n alphaspectrum
```

### Metrics
- API response times
- Database query performance
- Rate limiting metrics
- Webhook delivery stats

## Security Checklist

- [ ] Change default JWT_SECRET (min 32 chars)
- [ ] Change default ENCRYPTION_KEY (exactly 32 chars)
- [ ] Configure CORS origins
- [ ] Enable rate limiting
- [ ] Set up SSL/TLS
- [ ] Configure backup strategy
- [ ] Set up monitoring & alerting
- [ ] Enable audit logging
- [ ] Review API key permissions
- [ ] Set up log aggregation

## Scaling Guide

### Horizontal Scaling
```bash
# Kubernetes - Scale to 10 replicas
kubectl scale deployment alphaspectrum-api --replicas=10 -n alphaspectrum
```

### Database Scaling
- Read replicas for queries
- Connection pooling (PgBouncer)
- Query optimization
- Indexing strategy

### Redis Scaling
- Redis Cluster for large deployments
- Sentinel for high availability

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Check PostgreSQL status
docker-compose ps postgres
# Or
kubectl get pods -n alphaspectrum -l app=postgres
```

**Redis connection errors:**
```bash
# Verify Redis
docker-compose exec redis redis-cli ping
```

**Migration failures:**
```bash
# Reset and reapply (DEV ONLY)
npx prisma migrate reset
```

## Support

- **Documentation:** See `ENTERPRISE_IMPLEMENTATION_SUMMARY.md`
- **API Docs:** Available at `/api/docs` when running
- **Issues:** GitHub Issues
