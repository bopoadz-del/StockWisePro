#!/bin/bash

# AlphaSpectrum Enterprise - Environment Setup Script
# This script helps generate secure keys and set up the development environment

set -e

echo "🚀 AlphaSpectrum Enterprise - Environment Setup"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to generate a random string
generate_random_string() {
    local length=$1
    openssl rand -base64 $((length * 3 / 4)) | tr -d '\n' | cut -c1-$length
}

# Function to generate a 32-character key
generate_32_char_key() {
    openssl rand -base64 24 | tr -d '\n' | cut -c1-32
}

# Check if we're in the right directory
if [ ! -d "app/server" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo "📁 Setting up environment files..."
echo ""

# ============================================
# Backend Environment
# ============================================
echo -e "${YELLOW}Backend Environment (app/server/.env)${NC}"

if [ -f "app/server/.env" ]; then
    echo -e "${YELLOW}⚠️  app/server/.env already exists. Overwrite? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Skipping backend .env"
    else
        BACKEND_SETUP=true
    fi
else
    BACKEND_SETUP=true
fi

if [ "$BACKEND_SETUP" = true ]; then
    # Generate secure keys
    JWT_SECRET=$(generate_random_string 64)
    ENCRYPTION_KEY=$(generate_32_char_key)
    
    cat > app/server/.env << EOF
# ============================================
# AlphaSpectrum Enterprise - Development Environment
# Auto-generated on $(date)
# ============================================

# Database (PostgreSQL)
DATABASE_URL="postgresql://alphaspectrum:alphaspectrum@localhost:5432/alphaspectrum_dev"

# Redis
REDIS_URL="redis://localhost:6379/0"

# JWT Configuration
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
JWT_ISSUER="alphaspectrum"
JWT_AUDIENCE="alphaspectrum-api"

# Encryption Key (32 characters)
ENCRYPTION_KEY="$ENCRYPTION_KEY"

# Server
NODE_ENV="development"
PORT=3001
CLIENT_URL="http://localhost:5173"
API_URL="http://localhost:3001"

# Security
BCRYPT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
PASSWORD_HISTORY_SIZE=5
MFA_ENABLED=true
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# WebSocket
WS_PING_INTERVAL=30000
WS_PING_TIMEOUT=5000

# Logging
LOG_LEVEL="debug"
LOG_FORMAT="pretty"

# External APIs (add your keys)
ALPHA_VANTAGE_API_KEY=""
TWELVE_DATA_API_KEY=""
FMP_API_KEY="W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ"

# Email (optional)
SMTP_HOST=""
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="noreply@alphaspectrum.local"
EMAIL_FROM_NAME="AlphaSpectrum"

# Features
FEATURE_WEBHOOKS=true
FEATURE_API_KEYS=true
FEATURE_SSO=false
FEATURE_AUDIT_LOGS=true
FEATURE_BULK_OPERATIONS=true

# Sentry
SENTRY_DSN=""
EOF

    echo -e "${GREEN}✅ Created app/server/.env${NC}"
    echo "   - JWT Secret: ${JWT_SECRET:0:20}..."
    echo "   - Encryption Key: ${ENCRYPTION_KEY:0:20}..."
fi

echo ""

# ============================================
# Frontend Environment
# ============================================
echo -e "${YELLOW}Frontend Environment (app/.env)${NC}"

if [ -f "app/.env" ]; then
    echo -e "${YELLOW}⚠️  app/.env already exists. Overwrite? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Skipping frontend .env"
    else
        FRONTEND_SETUP=true
    fi
else
    FRONTEND_SETUP=true
fi

if [ "$FRONTEND_SETUP" = true ]; then
    cat > app/.env << EOF
# ============================================
# AlphaSpectrum Frontend - Development Environment
# Auto-generated on $(date)
# ============================================

VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_FMP_API_KEY=W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ
VITE_APP_ENV=development
VITE_APP_NAME="AlphaSpectrum"
EOF

    echo -e "${GREEN}✅ Created app/.env${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ Environment setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the generated .env files"
echo "  2. Add your external API keys (Alpha Vantage, Twelve Data, etc.)"
echo "  3. Set up the database: docker-compose up -d postgres redis"
echo "  4. Run migrations: cd app/server && npx prisma migrate dev"
echo "  5. Start the backend: cd app/server && npm run dev"
echo "  6. Start the frontend: cd app && npm run dev"
echo ""
echo -e "${YELLOW}🔐 Important: Keep your .env files secure and never commit them!${NC}"
