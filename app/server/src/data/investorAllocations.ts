/**
 * Illustrative model portfolios for the 12 investors advertised in the UI.
 * These are static books (not live 13F filings). Weights are fractions that
 * sum to 1.0 and are the single source of truth for frontend + backend.
 */

export interface InvestorHoldingSpec {
  ticker: string;
  name: string;
  weight: number;
}

export interface InvestorBook {
  id: string;
  name: string;
  holdings: InvestorHoldingSpec[];
}

export interface UnknownInvestorError extends Error {
  name: 'UnknownInvestorError';
  investor: string;
}

export interface MissingPricesError extends Error {
  name: 'MissingPricesError';
  missing: string[];
}

export function createUnknownInvestorError(investor: string): UnknownInvestorError {
  const error = new Error(`Unknown investor: ${investor}`) as UnknownInvestorError;
  error.name = 'UnknownInvestorError';
  error.investor = investor;
  return error;
}

export function createMissingPricesError(missing: string[]): MissingPricesError {
  const error = new Error(`Unable to fetch prices for: ${missing.join(', ')}`) as MissingPricesError;
  error.name = 'MissingPricesError';
  error.missing = missing;
  return error;
}

export function isUnknownInvestorError(error: unknown): error is UnknownInvestorError {
  return error instanceof Error && error.name === 'UnknownInvestorError';
}

export function isMissingPricesError(error: unknown): error is MissingPricesError {
  return error instanceof Error && error.name === 'MissingPricesError';
}

export interface SizedHolding {
  ticker: string;
  name: string;
  weight: number;
  price: number;
  shares: number;
  allocated: number;
}

export interface SizedPortfolio {
  investor: string;
  investorName: string;
  budget: number;
  holdings: SizedHolding[];
  totalAllocated: number;
  residualCash: number;
}

/** Canonical short ids used by the frontend `investors` array. */
export const CANONICAL_INVESTOR_IDS = [
  'buffett',
  'dalio',
  'wood',
  'lynch',
  'graham',
  'soros',
  'druckenmiller',
  'ackman',
  'templeton',
  'marks',
  'simons',
  'icahn',
] as const;

export type CanonicalInvestorId = (typeof CANONICAL_INVESTOR_IDS)[number];

/**
 * Maps every id that appears in the codebase (short UI ids + snake_case
 * backend aliases + hyphenated variants) onto a canonical book id.
 */
const INVESTOR_ALIASES: Record<string, CanonicalInvestorId> = {
  buffett: 'buffett',
  warren_buffett: 'buffett',
  'warren-buffett': 'buffett',
  warrenbuffett: 'buffett',

  dalio: 'dalio',
  ray_dalio: 'dalio',
  'ray-dalio': 'dalio',
  raydalio: 'dalio',

  wood: 'wood',
  cathie_wood: 'wood',
  'cathie-wood': 'wood',
  cathiewood: 'wood',

  lynch: 'lynch',
  peter_lynch: 'lynch',
  'peter-lynch': 'lynch',
  peterlynch: 'lynch',

  graham: 'graham',
  benjamin_graham: 'graham',
  'benjamin-graham': 'graham',
  benjamimgraham: 'graham',
  ben_graham: 'graham',
  'ben-graham': 'graham',

  soros: 'soros',
  george_soros: 'soros',
  'george-soros': 'soros',
  georgesoros: 'soros',

  druckenmiller: 'druckenmiller',
  stanley_druckenmiller: 'druckenmiller',
  'stanley-druckenmiller': 'druckenmiller',
  stanleydruckenmiller: 'druckenmiller',

  ackman: 'ackman',
  bill_ackman: 'ackman',
  'bill-ackman': 'ackman',
  billackman: 'ackman',

  templeton: 'templeton',
  john_templeton: 'templeton',
  'john-templeton': 'templeton',
  johntempleton: 'templeton',

  marks: 'marks',
  howard_marks: 'marks',
  'howard-marks': 'marks',
  howardmarks: 'marks',

  simons: 'simons',
  jim_simons: 'simons',
  'jim-simons': 'simons',
  jimsimons: 'simons',

  icahn: 'icahn',
  carl_icahn: 'icahn',
  'carl-icahn': 'icahn',
  carlicahn: 'icahn',
};

export const INVESTOR_BOOKS: Record<CanonicalInvestorId, InvestorBook> = {
  buffett: {
    id: 'buffett',
    name: 'Warren Buffett',
    holdings: [
      { ticker: 'AAPL', name: 'Apple Inc.', weight: 0.502 },
      { ticker: 'BAC', name: 'Bank of America', weight: 0.089 },
      { ticker: 'AXP', name: 'American Express', weight: 0.072 },
      { ticker: 'KO', name: 'Coca-Cola', weight: 0.068 },
      { ticker: 'CVX', name: 'Chevron', weight: 0.054 },
      { ticker: 'OXY', name: 'Occidental Petroleum', weight: 0.065 },
      { ticker: 'KHC', name: 'Kraft Heinz', weight: 0.05 },
      { ticker: 'MCO', name: "Moody's", weight: 0.04 },
      { ticker: 'CB', name: 'Chubb Limited', weight: 0.035 },
      { ticker: 'V', name: 'Visa Inc.', weight: 0.025 },
    ],
  },
  dalio: {
    id: 'dalio',
    name: 'Ray Dalio',
    holdings: [
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF', weight: 0.3 },
      { ticker: 'TLT', name: 'iShares 20+ Year Treasury', weight: 0.4 },
      { ticker: 'VGIT', name: 'Vanguard Intermediate Treasury', weight: 0.15 },
      { ticker: 'GLD', name: 'SPDR Gold Trust', weight: 0.075 },
      { ticker: 'DBC', name: 'Invesco DB Commodity Tracking', weight: 0.075 },
    ],
  },
  wood: {
    id: 'wood',
    name: 'Cathie Wood',
    holdings: [
      { ticker: 'TSLA', name: 'Tesla Inc.', weight: 0.098 },
      { ticker: 'COIN', name: 'Coinbase Global', weight: 0.072 },
      { ticker: 'ROKU', name: 'Roku Inc.', weight: 0.065 },
      { ticker: 'SQ', name: 'Block Inc.', weight: 0.058 },
      { ticker: 'ZM', name: 'Zoom Video', weight: 0.052 },
      { ticker: 'PATH', name: 'UiPath', weight: 0.12 },
      { ticker: 'CRSP', name: 'CRISPR Therapeutics', weight: 0.11 },
      { ticker: 'HOOD', name: 'Robinhood Markets', weight: 0.105 },
      { ticker: 'SHOP', name: 'Shopify', weight: 0.105 },
      { ticker: 'PLTR', name: 'Palantir Technologies', weight: 0.11 },
      { ticker: 'TWLO', name: 'Twilio', weight: 0.105 },
    ],
  },
  lynch: {
    id: 'lynch',
    name: 'Peter Lynch',
    holdings: [
      { ticker: 'PG', name: 'Procter & Gamble', weight: 0.12 },
      { ticker: 'WMT', name: 'Walmart Inc.', weight: 0.1 },
      { ticker: 'HD', name: 'Home Depot', weight: 0.09 },
      { ticker: 'MCD', name: "McDonald's", weight: 0.08 },
      { ticker: 'NKE', name: 'Nike Inc.', weight: 0.07 },
      { ticker: 'F', name: 'Ford Motor', weight: 0.1 },
      { ticker: 'DIS', name: 'Walt Disney', weight: 0.1 },
      { ticker: 'TGT', name: 'Target', weight: 0.09 },
      { ticker: 'SBUX', name: 'Starbucks', weight: 0.09 },
      { ticker: 'LOW', name: "Lowe's Companies", weight: 0.08 },
      { ticker: 'COST', name: 'Costco Wholesale', weight: 0.08 },
    ],
  },
  graham: {
    id: 'graham',
    name: 'Benjamin Graham',
    holdings: [
      { ticker: 'BRK.B', name: 'Berkshire Hathaway', weight: 0.15 },
      { ticker: 'JPM', name: 'JPMorgan Chase', weight: 0.12 },
      { ticker: 'XOM', name: 'Exxon Mobil', weight: 0.1 },
      { ticker: 'CVX', name: 'Chevron', weight: 0.09 },
      { ticker: 'INTC', name: 'Intel Corp', weight: 0.08 },
      { ticker: 'WFC', name: 'Wells Fargo', weight: 0.1 },
      { ticker: 'BAC', name: 'Bank of America', weight: 0.09 },
      { ticker: 'PFE', name: 'Pfizer', weight: 0.09 },
      { ticker: 'IBM', name: 'IBM', weight: 0.08 },
      { ticker: 'T', name: 'AT&T', weight: 0.05 },
      { ticker: 'VZ', name: 'Verizon', weight: 0.05 },
    ],
  },
  soros: {
    id: 'soros',
    name: 'George Soros',
    holdings: [
      { ticker: 'QQQ', name: 'Invesco QQQ Trust', weight: 0.18 },
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF', weight: 0.15 },
      { ticker: 'IWM', name: 'iShares Russell 2000', weight: 0.12 },
      { ticker: 'EEM', name: 'iShares MSCI Emerging Markets', weight: 0.1 },
      { ticker: 'TLT', name: 'iShares 20+ Year Treasury', weight: 0.08 },
      { ticker: 'GLD', name: 'SPDR Gold Trust', weight: 0.1 },
      { ticker: 'EWZ', name: 'iShares MSCI Brazil', weight: 0.09 },
      { ticker: 'FXI', name: 'iShares China Large-Cap', weight: 0.08 },
      { ticker: 'HYG', name: 'iShares iBoxx High Yield', weight: 0.05 },
      { ticker: 'BIL', name: 'SPDR Bloomberg 1-3 Month T-Bill', weight: 0.05 },
    ],
  },
  druckenmiller: {
    id: 'druckenmiller',
    name: 'Stanley Druckenmiller',
    holdings: [
      { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 0.14 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 0.12 },
      { ticker: 'GOOGL', name: 'Alphabet', weight: 0.1 },
      { ticker: 'AMZN', name: 'Amazon', weight: 0.09 },
      { ticker: 'META', name: 'Meta Platforms', weight: 0.08 },
      { ticker: 'TSM', name: 'Taiwan Semiconductor', weight: 0.1 },
      { ticker: 'AVGO', name: 'Broadcom', weight: 0.09 },
      { ticker: 'AMD', name: 'Advanced Micro Devices', weight: 0.08 },
      { ticker: 'NFLX', name: 'Netflix', weight: 0.07 },
      { ticker: 'CRM', name: 'Salesforce', weight: 0.06 },
      { ticker: 'AAPL', name: 'Apple Inc.', weight: 0.07 },
    ],
  },
  ackman: {
    id: 'ackman',
    name: 'Bill Ackman',
    holdings: [
      { ticker: 'HLT', name: 'Hilton Worldwide', weight: 0.18 },
      { ticker: 'CMG', name: 'Chipotle Mexican Grill', weight: 0.16 },
      { ticker: 'QSR', name: 'Restaurant Brands', weight: 0.14 },
      { ticker: 'LOW', name: "Lowe's Companies", weight: 0.12 },
      { ticker: 'GOOGL', name: 'Alphabet', weight: 0.1 },
      { ticker: 'UBER', name: 'Uber Technologies', weight: 0.1 },
      { ticker: 'AAPL', name: 'Apple Inc.', weight: 0.08 },
      { ticker: 'HHH', name: 'Howard Hughes Holdings', weight: 0.07 },
      { ticker: 'NKE', name: 'Nike Inc.', weight: 0.05 },
    ],
  },
  templeton: {
    id: 'templeton',
    name: 'John Templeton',
    holdings: [
      { ticker: 'VEA', name: 'Vanguard FTSE Developed Markets', weight: 0.25 },
      { ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets', weight: 0.2 },
      { ticker: 'IEFA', name: 'iShares Core MSCI EAFE', weight: 0.18 },
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF', weight: 0.15 },
      { ticker: 'VXUS', name: 'Vanguard Total International Stock', weight: 0.12 },
      { ticker: 'EEM', name: 'iShares MSCI Emerging Markets', weight: 0.05 },
      { ticker: 'IEMG', name: 'iShares Core MSCI Emerging Markets', weight: 0.05 },
    ],
  },
  marks: {
    id: 'marks',
    name: 'Howard Marks',
    holdings: [
      { ticker: 'PGHY', name: 'Invesco Global Short Term High Yield', weight: 0.2 },
      { ticker: 'SJNK', name: 'SPDR Bloomberg Short Term High Yield', weight: 0.18 },
      { ticker: 'BKLN', name: 'Invesco Senior Loan ETF', weight: 0.15 },
      { ticker: 'HYG', name: 'iShares iBoxx High Yield', weight: 0.12 },
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF', weight: 0.1 },
      { ticker: 'JNK', name: 'SPDR Bloomberg High Yield Bond', weight: 0.1 },
      { ticker: 'SRLN', name: 'SPDR Blackstone Senior Loan', weight: 0.08 },
      { ticker: 'USHY', name: 'iShares Broad USD High Yield', weight: 0.07 },
    ],
  },
  simons: {
    id: 'simons',
    name: 'Jim Simons',
    holdings: [
      { ticker: 'NVDA', name: 'NVIDIA Corp', weight: 0.08 },
      { ticker: 'META', name: 'Meta Platforms', weight: 0.07 },
      { ticker: 'AMZN', name: 'Amazon', weight: 0.07 },
      { ticker: 'GOOGL', name: 'Alphabet', weight: 0.06 },
      { ticker: 'MSFT', name: 'Microsoft', weight: 0.06 },
      { ticker: 'AAPL', name: 'Apple Inc.', weight: 0.06 },
      { ticker: 'AVGO', name: 'Broadcom', weight: 0.06 },
      { ticker: 'JPM', name: 'JPMorgan Chase', weight: 0.06 },
      { ticker: 'UNH', name: 'UnitedHealth Group', weight: 0.06 },
      { ticker: 'LLY', name: 'Eli Lilly', weight: 0.06 },
      { ticker: 'XOM', name: 'Exxon Mobil', weight: 0.05 },
      { ticker: 'JNJ', name: 'Johnson & Johnson', weight: 0.05 },
      { ticker: 'V', name: 'Visa Inc.', weight: 0.05 },
      { ticker: 'HD', name: 'Home Depot', weight: 0.05 },
      { ticker: 'PG', name: 'Procter & Gamble', weight: 0.05 },
      { ticker: 'COST', name: 'Costco Wholesale', weight: 0.05 },
      { ticker: 'WMT', name: 'Walmart Inc.', weight: 0.06 },
    ],
  },
  icahn: {
    id: 'icahn',
    name: 'Carl Icahn',
    holdings: [
      { ticker: 'IEP', name: 'Icahn Enterprises', weight: 0.55 },
      { ticker: 'CVI', name: 'CVR Energy', weight: 0.12 },
      { ticker: 'OXY', name: 'Occidental Petroleum', weight: 0.1 },
      { ticker: 'SWX', name: 'Southwest Gas', weight: 0.08 },
      { ticker: 'XRX', name: 'Xerox Holdings', weight: 0.05 },
      { ticker: 'NFE', name: 'New Fortress Energy', weight: 0.05 },
      { ticker: 'LNG', name: 'Cheniere Energy', weight: 0.05 },
    ],
  },
};

const WEIGHT_SUM_TOLERANCE = 0.001;

export function normalizeInvestorId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

export function resolveInvestorId(raw: string): CanonicalInvestorId | null {
  const key = normalizeInvestorId(raw);
  return INVESTOR_ALIASES[key] ?? null;
}

export function resolveInvestor(raw: string): InvestorBook {
  const id = resolveInvestorId(raw);
  if (!id) {
    throw createUnknownInvestorError(raw);
  }
  return INVESTOR_BOOKS[id];
}

export function listInvestorBooks(): InvestorBook[] {
  return CANONICAL_INVESTOR_IDS.map((id) => INVESTOR_BOOKS[id]);
}

export function getInvestorHoldings(raw: string): InvestorHoldingSpec[] {
  return resolveInvestor(raw).holdings;
}

export function allocationMap(book: InvestorBook): Record<string, number> {
  return Object.fromEntries(book.holdings.map((h) => [h.ticker, h.weight]));
}

export function sumWeights(holdings: InvestorHoldingSpec[]): number {
  return holdings.reduce((sum, h) => sum + h.weight, 0);
}

export function assertBookComplete(book: InvestorBook): void {
  const sum = sumWeights(book.holdings);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(`Investor book ${book.id} weights sum to ${sum}, expected ~1.0`);
  }
}

/**
 * Size a model book using whole shares at the provided prices.
 * Residual cash is budget minus the dollars actually spent on whole shares.
 */
export function sizeHoldings(
  book: InvestorBook,
  budget: number,
  prices: Record<string, number>
): SizedPortfolio {
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('Budget must be a positive number');
  }

  const missing = book.holdings
    .filter((h) => {
      const price = prices[h.ticker] ?? prices[h.ticker.toUpperCase()];
      return !Number.isFinite(price) || price <= 0;
    })
    .map((h) => h.ticker);

  if (missing.length > 0) {
    throw createMissingPricesError(missing);
  }

  const holdings: SizedHolding[] = book.holdings.map((h) => {
    const price = prices[h.ticker] ?? prices[h.ticker.toUpperCase()];
    const shares = Math.floor((budget * h.weight) / price);
    const allocated = roundMoney(shares * price);
    return {
      ticker: h.ticker,
      name: h.name,
      weight: h.weight,
      price,
      shares,
      allocated,
    };
  });

  const totalAllocated = roundMoney(holdings.reduce((sum, h) => sum + h.allocated, 0));
  const residualCash = roundMoney(budget - totalAllocated);

  return {
    investor: book.id,
    investorName: book.name,
    budget,
    holdings,
    totalAllocated,
    residualCash,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

for (const id of CANONICAL_INVESTOR_IDS) {
  assertBookComplete(INVESTOR_BOOKS[id]);
}
