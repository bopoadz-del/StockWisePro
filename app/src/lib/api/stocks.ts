import { apiClient } from './client';
import type { ScoringWeights } from '@/types';

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  pe: number;
  volume: number;
  avgVolume: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  eps: number;
  sector?: string;
  industry?: string;
}

export interface KeyMetrics {
  peRatio: number;
  priceToBookRatio: number;
  priceToSalesRatio: number;
  roe: number;
  roa: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  dividendYield: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  profitMargin?: number;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ScoreAction = 'buy' | 'hold' | 'sell';
export type ScorePreset = 'balanced' | 'value' | 'growth' | 'quality';

export interface PillarScores {
  valuation: number;
  profitability: number;
  growth: number;
  financialHealth: number;
  momentum: number;
}

export interface ScoreBreakdownRule {
  pillar: keyof PillarScores;
  metric: string;
  detail: string;
  points: number;
  max: number;
  defaulted?: boolean;
}

export interface StockScore {
  ticker: string;
  name: string;
  finalScore: number;
  action: ScoreAction;
  pillars: PillarScores;
  weights: ScoringWeights;
  preset?: ScorePreset;
  sources: Array<'yahoo' | 'fmp'>;
  warnings: string[];
  breakdown: ScoreBreakdownRule[];
  quote: StockQuote;
  metrics: KeyMetrics;
  sparkline: number[];
}

export interface ScreenerRow extends StockQuote {
  score: number;
  signal: ScoreAction;
  pillars?: PillarScores;
  sources?: Array<'yahoo' | 'fmp'>;
  warnings?: string[];
  sparkline?: number[];
}

function weightQuery(weights?: Partial<ScoringWeights>, preset?: ScorePreset): string {
  const params = new URLSearchParams();
  if (preset) params.set('preset', preset);
  if (weights) {
    (Object.keys(weights) as Array<keyof ScoringWeights>).forEach((key) => {
      const value = weights[key];
      if (typeof value === 'number') params.set(key, String(value));
    });
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const stocksApi = {
  search: (query: string) =>
    apiClient.get<{ symbol: string; name: string }[]>(`/stocks/search?q=${encodeURIComponent(query)}`),

  getQuote: (ticker: string) =>
    apiClient.get<StockQuote>(`/stocks/quote/${ticker}`),

  getBatchQuotes: (symbols: string[]) =>
    apiClient.get<StockQuote[]>(`/stocks/quotes?symbols=${symbols.join(',')}`),

  getKeyMetrics: (ticker: string) =>
    apiClient.get<KeyMetrics>(`/stocks/metrics/${ticker}`),

  getHistorical: (ticker: string, from: string, to: string) =>
    apiClient.get<HistoricalPrice[]>(`/stocks/historical/${ticker}?from=${from}&to=${to}`),

  getIndices: () =>
    apiClient.get<StockQuote[]>('/stocks/indices'),

  getTrending: () =>
    apiClient.get<StockQuote[]>('/stocks/trending'),

  getScreener: (weights?: Partial<ScoringWeights>, preset?: ScorePreset) =>
    apiClient.get<ScreenerRow[]>(`/stocks/screener${weightQuery(weights, preset)}`),

  getScore: (ticker: string, weights?: Partial<ScoringWeights>, preset?: ScorePreset) =>
    apiClient.get<StockScore>(`/stocks/${encodeURIComponent(ticker)}/score${weightQuery(weights, preset)}`),

  postScore: (ticker: string, body: { weights?: Partial<ScoringWeights>; preset?: ScorePreset }) =>
    apiClient.post<StockScore>(`/stocks/${encodeURIComponent(ticker)}/score`, body),

  getBatchScores: (tickers: string[], weights?: Partial<ScoringWeights>, preset?: ScorePreset) =>
    apiClient.post<{ scores: StockScore[]; errors: Array<{ ticker: string; error: string }> }>(
      '/stocks/scores',
      { tickers, weights, preset }
    ),
};
