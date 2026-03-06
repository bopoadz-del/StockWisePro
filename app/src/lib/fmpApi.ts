// Financial Modeling Prep API Integration
const FMP_API_KEY = 'W0ZNDulEbCUkYvy20BcDJIjN91dn4lTJ';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

export interface FMPStockQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  exchange: string;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
}

export interface FMPIncomeStatement {
  date: string;
  symbol: string;
  revenue: number;
  netIncome: number;
  grossProfit: number;
  eps: number;
}

export interface FMPBalanceSheet {
  date: string;
  symbol: string;
  totalAssets: number;
  totalLiabilities: number;
  totalStockholdersEquity: number;
  longTermDebt: number;
}

export interface FMPKeyMetrics {
  symbol: string;
  date: string;
  peRatio: number;
  priceToBookRatio: number;
  priceToSalesRatio: number;
  roe: number;
  roa: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  dividendYield: number;
  payoutRatio: number;
}

export interface FMPHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Fetch real-time stock quote
export async function fetchStockQuote(symbol: string): Promise<FMPStockQuote | null> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/quote/${symbol}?apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch quote');
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('FMP API Error:', error);
    return null;
  }
}

// Fetch multiple stock quotes
export async function fetchBatchQuotes(symbols: string[]): Promise<FMPStockQuote[]> {
  try {
    const symbolString = symbols.join(',');
    const response = await fetch(
      `${FMP_BASE_URL}/quote/${symbolString}?apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch batch quotes');
    return await response.json();
  } catch (error) {
    console.error('FMP API Error:', error);
    return [];
  }
}

// Fetch income statement
export async function fetchIncomeStatement(
  symbol: string,
  limit: number = 4
): Promise<FMPIncomeStatement[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/income-statement/${symbol}?limit=${limit}&apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch income statement');
    return await response.json();
  } catch (error) {
    console.error('FMP API Error:', error);
    return [];
  }
}

// Fetch balance sheet
export async function fetchBalanceSheet(
  symbol: string,
  limit: number = 4
): Promise<FMPBalanceSheet[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/balance-sheet-statement/${symbol}?limit=${limit}&apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch balance sheet');
    return await response.json();
  } catch (error) {
    console.error('FMP API Error:', error);
    return [];
  }
}

// Fetch key metrics
export async function fetchKeyMetrics(symbol: string): Promise<FMPKeyMetrics | null> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/key-metrics/${symbol}?limit=1&apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch key metrics');
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('FMP API Error:', error);
    return null;
  }
}

// Fetch historical prices
export async function fetchHistoricalPrices(
  symbol: string,
  from: string,
  to: string
): Promise<FMPHistoricalPrice[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/historical-price-full/${symbol}?from=${from}&to=${to}&apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to fetch historical prices');
    const data = await response.json();
    return data.historical || [];
  } catch (error) {
    console.error('FMP API Error:', error);
    return [];
  }
}

// Search stocks
export async function searchStocks(query: string): Promise<{ symbol: string; name: string }[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/search?query=${query}&limit=10&apikey=${FMP_API_KEY}`
    );
    if (!response.ok) throw new Error('Failed to search stocks');
    return await response.json();
  } catch (error) {
    console.error('FMP API Error:', error);
    return [];
  }
}

// Fetch market indices
export async function fetchMarketIndices(): Promise<FMPStockQuote[]> {
  const indices = ['^GSPC', '^IXIC', '^DJI', '^RUT'];
  return fetchBatchQuotes(indices);
}

// Calculate comprehensive score from FMP data
export function calculateFMPScore(
  quote: FMPStockQuote,
  metrics: FMPKeyMetrics | null
): {
  score: number;
  breakdown: {
    valuation: number;
    profitability: number;
    financialHealth: number;
    momentum: number;
  };
} {
  if (!metrics) {
    return {
      score: 50,
      breakdown: { valuation: 50, profitability: 50, financialHealth: 50, momentum: 50 },
    };
  }

  // Valuation score (lower P/E, P/B, P/S is better)
  const peScore = Math.max(0, Math.min(100, (30 - (metrics.peRatio || 30)) * 3.33));
  const pbScore = Math.max(0, Math.min(100, (5 - (metrics.priceToBookRatio || 5)) * 20));
  const psScore = Math.max(0, Math.min(100, (10 - (metrics.priceToSalesRatio || 10)) * 10));
  const valuationScore = (peScore + pbScore + psScore) / 3;

  // Profitability score
  const roeScore = Math.min(100, ((metrics.roe || 0) * 100) * 2);
  const roaScore = Math.min(100, ((metrics.roa || 0) * 100) * 5);
  const profitabilityScore = (roeScore + roaScore) / 2;

  // Financial Health score
  const debtScore = Math.max(0, Math.min(100, (1 - (metrics.debtToEquity || 1)) * 100));
  const currentScore = Math.min(100, ((metrics.currentRatio || 1) - 1) * 50);
  const financialHealthScore = (debtScore + currentScore) / 2;

  // Momentum score (based on price vs moving averages)
  const priceVs50 = quote.price / (quote.priceAvg50 || quote.price);
  const priceVs200 = quote.price / (quote.priceAvg200 || quote.price);
  const momentumScore = Math.min(100, ((priceVs50 + priceVs200) / 2 - 1) * 200 + 50);

  // Weighted final score
  const score = Math.round(
    valuationScore * 0.25 +
    profitabilityScore * 0.25 +
    financialHealthScore * 0.25 +
    momentumScore * 0.25
  );

  return {
    score,
    breakdown: {
      valuation: Math.round(valuationScore),
      profitability: Math.round(profitabilityScore),
      financialHealth: Math.round(financialHealthScore),
      momentum: Math.round(momentumScore),
    },
  };
}
