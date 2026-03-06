import { prisma } from './config/database';

const popularStocks = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    price: 195.89,
    change: 2.45,
    changePercent: 1.27,
    marketCap: 3050000000000,
    peRatio: 30.2,
    volume: 54200000,
    sector: 'Technology',
    score: 78,
    signal: 'buy',
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    price: 420.55,
    change: 5.32,
    changePercent: 1.28,
    marketCap: 3120000000000,
    peRatio: 36.8,
    volume: 22100000,
    sector: 'Technology',
    score: 85,
    signal: 'buy',
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 175.98,
    change: -1.23,
    changePercent: -0.69,
    marketCap: 2180000000000,
    peRatio: 25.4,
    volume: 18900000,
    sector: 'Technology',
    score: 82,
    signal: 'buy',
  },
  {
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    price: 178.35,
    change: 3.12,
    changePercent: 1.78,
    marketCap: 1850000000000,
    peRatio: 58.9,
    volume: 38900000,
    sector: 'Consumer Cyclical',
    score: 71,
    signal: 'hold',
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    price: 248.50,
    change: -8.75,
    changePercent: -3.40,
    marketCap: 790000000000,
    peRatio: 72.5,
    volume: 98700000,
    sector: 'Consumer Cyclical',
    score: 45,
    signal: 'hold',
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 875.28,
    change: 15.42,
    changePercent: 1.79,
    marketCap: 2150000000000,
    peRatio: 72.8,
    volume: 45200000,
    sector: 'Technology',
    score: 68,
    signal: 'hold',
  },
  {
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    price: 505.68,
    change: 7.89,
    changePercent: 1.58,
    marketCap: 1290000000000,
    peRatio: 26.4,
    volume: 15200000,
    sector: 'Technology',
    score: 88,
    signal: 'buy',
  },
  {
    ticker: 'BRK.B',
    name: 'Berkshire Hathaway Inc.',
    price: 412.15,
    change: 1.85,
    changePercent: 0.45,
    marketCap: 890000000000,
    peRatio: 9.2,
    volume: 3200000,
    sector: 'Financials',
    score: 91,
    signal: 'buy',
  },
  {
    ticker: 'JPM',
    name: 'JPMorgan Chase & Co.',
    price: 195.42,
    change: -0.58,
    changePercent: -0.30,
    marketCap: 560000000000,
    peRatio: 11.8,
    volume: 8900000,
    sector: 'Financials',
    score: 86,
    signal: 'buy',
  },
  {
    ticker: 'V',
    name: 'Visa Inc.',
    price: 285.78,
    change: 2.15,
    changePercent: 0.76,
    marketCap: 620000000000,
    peRatio: 32.5,
    volume: 4200000,
    sector: 'Financials',
    score: 79,
    signal: 'buy',
  },
  {
    ticker: 'WMT',
    name: 'Walmart Inc.',
    price: 165.32,
    change: 0.89,
    changePercent: 0.54,
    marketCap: 445000000000,
    peRatio: 25.8,
    volume: 5600000,
    sector: 'Consumer Defensive',
    score: 74,
    signal: 'hold',
  },
  {
    ticker: 'JNJ',
    name: 'Johnson & Johnson',
    price: 152.18,
    change: -1.24,
    changePercent: -0.81,
    marketCap: 366000000000,
    peRatio: 15.2,
    volume: 6200000,
    sector: 'Healthcare',
    score: 72,
    signal: 'hold',
  },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Seed cached stocks
    console.log('Seeding cached stocks...');
    for (const stock of popularStocks) {
      await prisma.cachedStock.upsert({
        where: { ticker: stock.ticker },
        update: {
          ...stock,
          lastUpdated: new Date(),
        },
        create: {
          ...stock,
          lastUpdated: new Date(),
        },
      });
    }
    console.log(`✅ Seeded ${popularStocks.length} stocks\n`);

    console.log('✨ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
