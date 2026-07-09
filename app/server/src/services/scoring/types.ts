/**
 * OpenBox Scoring Engine - Type Definitions
 * Ported from stockwisepro-bot with enhancements
 */

export interface ScoreRule {
  pillar: string;
  metric: string;
  detail: string;
  points: number;
  max: number;
}

export interface OpenBoxScore {
  finalScore: number;
  pillars: {
    fundamentals: number;
    marketDynamics: number;
    balanceSheet: number;
    leadership: number;
    innovation: number;
    ethics: number;
  };
  riskFlags: string[];
  narrative: string;
  ethicsPass: boolean;
  adjustments: {
    peerDelta: number;
    dominanceBonus: number;
  };
  breakdown?: ScoreRule[];
  isETF?: boolean;
  sector?: string;
  industry?: string;
}

export interface StockFundamentals {
  ticker: string;
  price: number;
  marketCap?: number;
  sector?: string;
  industry?: string;
  name?: string;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  beta?: number;
  dividendYield?: number;
  avgVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  twoHundredDayAverage?: number;
  fiftyDayAverage?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  profitMargin?: number;
  roe?: number;
  operatingCashflow?: number;
  freeCashflow?: number;
  totalDebt?: number;
  totalCash?: number;
  currentRatio?: number;
  debtToEquity?: number;
  totalRevenue?: number;
  ebitda?: number;
  operatingIncome?: number;
  netIncome?: number;
  grossProfit?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  retainedEarnings?: number;
  sharesOutstanding?: number;
  bookValue?: number;
  revenuePerShare?: number;
  epsTrailing?: number;
  epsForward?: number;
  pegRatio?: number;
  // ETF-specific
  expenseRatio?: number;
  fundFamily?: string;
  fundCategory?: string;
  fundStdDev?: number;
  fundSharpe?: number;
  fundBeta?: number;
  ytdReturn?: number;
  oneYearReturn?: number;
  threeYearReturn?: number;
  fiveYearReturn?: number;
  tenYearReturn?: number;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ScoringInput {
  ticker: string;
  fundamentals: StockFundamentals;
  historicalPrices: HistoricalPrice[];
  spyHistoricalPrices?: HistoricalPrice[];
}

export interface ScoringWeights {
  fundamentals: number;
  marketDynamics: number;
  balanceSheet: number;
  leadership: number;
  innovation: number;
  ethics: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  fundamentals: 30,
  marketDynamics: 15,
  balanceSheet: 15,
  leadership: 15,
  innovation: 15,
  ethics: 10,
};

export const ETF_WEIGHTS: ScoringWeights = {
  fundamentals: 35,
  marketDynamics: 18.75,
  balanceSheet: 18.75,
  leadership: 17.5,
  innovation: 0,
  ethics: 10,
};

export interface PiotroskiInput {
  netIncome: number;
  totalAssets: number;
  operatingCashflow: number;
  longTermDebt: number;
  currentAssets: number;
  currentLiabilities: number;
  sharesOutstanding: number;
  grossMargin: number;
  revenue: number;
}

export interface AltmanResult {
  raw: number;
  score: number;
  zone: 'safe' | 'grey' | 'distress';
}

export interface PiotroskiResult {
  raw: number;
  score: number;
}
