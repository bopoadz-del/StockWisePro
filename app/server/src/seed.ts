import { prisma } from './config/database';
import bcrypt from 'bcrypt';

const STOCKS = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { ticker: 'V', name: 'Visa Inc.', sector: 'Financials' },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Create demo organization
    const org = await prisma.organization.create({
      data: {
        name: 'Demo Organization',
        slug: 'demo-org',
        plan: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date('2027-01-01'),
        maxUsers: 100,
        maxApiCalls: 100000,
        maxWebhooks: 50,
      },
    });
    console.log('✅ Created organization:', org.name);

    // Create demo user
    const passwordHash = await bcrypt.hash('demo123456', 10);
    const user = await prisma.user.create({
      data: {
        email: 'demo@alphaspectrum.app',
        passwordHash,
        firstName: 'Demo',
        lastName: 'User',
        organizationId: org.id,
        role: 'OWNER',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    console.log('✅ Created user:', user.email);

    // Create stocks
    for (const stock of STOCKS) {
      await prisma.stock.upsert({
        where: { ticker: stock.ticker },
        create: {
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
        },
        update: {},
      });
    }
    console.log(`✅ Created ${STOCKS.length} stocks`);

    // Create demo watchlist
    const watchlist = await prisma.watchlist.create({
      data: {
        name: 'My Watchlist',
        description: 'Default watchlist',
        organizationId: org.id,
        createdBy: user.id,
        isDefault: true,
      },
    });

    // Add some stocks to watchlist
    for (const stock of STOCKS.slice(0, 5)) {
      await prisma.watchlistItem.create({
        data: {
          watchlistId: watchlist.id,
          ticker: stock.ticker,
          addedBy: user.id,
        },
      });
    }
    console.log('✅ Created demo watchlist');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\nDemo credentials:');
    console.log('  Email: demo@alphaspectrum.app');
    console.log('  Password: demo123456');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
