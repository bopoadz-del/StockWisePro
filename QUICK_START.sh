#!/bin/bash

# AlphaSpectrum Quick Start Script
# This script helps you deploy the full-stack application

echo "🚀 AlphaSpectrum Quick Start"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -d "app" ]; then
    echo "❌ Error: Please run this script from the /mnt/okcomputer/output directory"
    exit 1
fi

print_info "Step 1: Installing Frontend Dependencies..."
cd app
npm install
print_success "Frontend dependencies installed"

echo ""
print_info "Step 2: Building Frontend..."
npm run build
print_success "Frontend built successfully"

echo ""
print_info "Step 3: Installing Backend Dependencies..."
cd backend
npm install
print_success "Backend dependencies installed"

echo ""
print_info "Step 4: Setting up Database..."
print_warning "Make sure you have PostgreSQL running and DATABASE_URL set"
if [ -z "$DATABASE_URL" ]; then
    print_warning "DATABASE_URL not set. Please set it before continuing."
    echo "Example: export DATABASE_URL=postgresql://user:pass@localhost:5432/alphaspectrum"
fi

# Generate Prisma client
npx prisma generate
print_success "Prisma client generated"

echo ""
print_info "Step 5: Running Database Migrations..."
npx prisma migrate dev --name init
print_success "Database migrations completed"

echo ""
print_info "Step 6: Building Backend..."
npm run build
print_success "Backend built successfully"

echo ""
print_info "Step 7: Installing Mobile App Dependencies..."
cd ../mobile
npm install
print_success "Mobile app dependencies installed"

echo ""
print_success "All dependencies installed and builds completed!"
echo ""
echo "Next steps:"
echo ""
echo "1. 🖥️  Start Backend (in one terminal):"
echo "   cd app/backend && npm run dev"
echo ""
echo "2. 🌐 Start Frontend (in another terminal):"
echo "   cd app && npm run dev"
echo ""
echo "3. 📱 Start Mobile App (in another terminal):"
echo "   cd app/mobile && npm start"
echo ""
echo "4. 🚀 Deploy to Render:"
echo "   - Push code to GitHub"
echo "   - Connect repository to Render"
echo "   - Set environment variables"
echo ""
echo "📖 See DEPLOYMENT_GUIDE.md for detailed instructions"
