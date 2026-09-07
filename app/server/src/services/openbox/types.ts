export type ActionBand = 'buy' | 'hold' | 'sell';
export type DataSource = 'yahoo' | 'fmp';
export type WeightPreset = 'balanced' | 'value' | 'growth' | 'quality';

export interface ScoringWeights {
  valuation: number;
  profitability: number;
  growth: number;
  financialHealth: number;
  momentum: number;
}

export interface PillarScores {
  valuation: number;
  profitability: number;
  growth: number;
  financialHealth: number;
  momentum: number;
}

export interface ScoreRule {
  pillar: keyof PillarScores;
  metric: string;
  detail: string;
  points: number;
  max: number;
  defaulted?: boolean;
}

export interface HistoricalBar {
  date: string;
  close: number;
}

export interface YahooQuoteSummary {
  financialData?: Record<string, unknown>;
  defaultKeyStatistics?: Record<string, unknown>;
  summaryDetail?: Record<string, unknown>;
  summaryProfile?: Record<string, unknown>;
  incomeStatementHistory?: { incomeStatementHistory?: Record<string, unknown>[] };
  balanceSheetHistory?: { balanceSheetHistory?: Record<string, unknown>[] };
  cashflowStatementHistory?: { cashflowStatements?: Record<string, unknown>[] };
  price?: Record<string, unknown>;
  fundProfile?: Record<string, unknown>;
}

export interface FmpKeyMetrics {
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  roe?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  roa?: number;
  debtToEquity?: number;
  currentRatio?: number;
  dividendYield?: number;
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  netProfitMargin?: number;
  freeCashFlowPerShare?: number;
  freeCashFlowYield?: number;
  [key: string]: number | string | undefined;
}

export interface FmpRating {
  rating?: string;
  ratingRecommendation?: string;
}

export interface FmpIncomeStatement {
  date: string;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  researchAndDevelopmentExpenses?: number;
}

export interface FmpBalanceSheet {
  date: string;
  totalAssets?: number;
  totalLiabilities?: number;
  totalCurrentAssets?: number;
  totalCurrentLiabilities?: number;
  retainedEarnings?: number;
  commonStock?: number;
}

export interface FmpEnrichment {
  metrics?: FmpKeyMetrics | null;
  rating?: FmpRating | null;
  income?: FmpIncomeStatement[];
  balance?: FmpBalanceSheet[];
}

export interface StockQuoteView {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  pe?: number;
  volume?: number;
  avgVolume?: number;
  dayLow?: number;
  dayHigh?: number;
  yearLow?: number;
  yearHigh?: number;
  eps?: number;
  sector?: string;
  industry?: string;
}

export interface KeyMetricsView {
  peRatio?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  currentRatio?: number;
  dividendYield?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  profitMargin?: number;
}

export interface StockScoreResult {
  ticker: string;
  name: string;
  finalScore: number;
  action: ActionBand;
  pillars: PillarScores;
  weights: ScoringWeights;
  preset?: WeightPreset;
  sources: DataSource[];
  warnings: string[];
  breakdown: ScoreRule[];
  quote: StockQuoteView;
  metrics: KeyMetricsView;
  sparkline: number[];
}

export interface ScoreOptions {
  weights?: Partial<ScoringWeights>;
  preset?: WeightPreset;
  providers?: ScoreDataProviders;
}

export interface ScoreDataProviders {
  getQuoteSummary(ticker: string): Promise<YahooQuoteSummary | null>;
  getHistory(ticker: string): Promise<HistoricalBar[]>;
  getFmpEnrichment(ticker: string): Promise<FmpEnrichment | null>;
}

export class UnknownTickerError extends Error {
  readonly ticker: string;
  readonly code = 'UNKNOWN_TICKER';

  constructor(ticker: string) {
    super(`Unknown ticker: ${ticker}`);
    this.name = 'UnknownTickerError';
    this.ticker = ticker;
  }
}

export class ScoreDataError extends Error {
  readonly code = 'SCORE_DATA_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ScoreDataError';
  }
}
