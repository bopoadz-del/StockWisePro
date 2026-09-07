import { computeStockScore } from './engine';
import type { ScoreOptions, StockScoreResult } from './types';
import { UnknownTickerError } from './types';
import { resolveWeights } from './weights';

export { computeStockScore } from './engine';
export { calculateRSI } from './engine';
export { getHistoricalPrices, getQuoteSummary, yahooSearch, normalizeYahooTicker, clearYahooCaches } from './yahoo';
export { getFmpEnrichment, isFmpEnabled } from './fmp';
export { resolveWeights, WEIGHT_PRESETS, DEFAULT_WEIGHTS, actionFromScore } from './weights';
export { UnknownTickerError, ScoreDataError } from './types';
export type {
  ActionBand,
  DataSource,
  ScoreOptions,
  ScoringWeights,
  StockScoreResult,
  WeightPreset,
  PillarScores,
  StockQuoteView,
  KeyMetricsView,
} from './types';

const SCORE_TTL_MS = 5 * 60 * 1000;
const scoreCache = new Map<string, { data: StockScoreResult; expires: number }>();

function cacheKey(ticker: string, options: ScoreOptions): string {
  const weights = resolveWeights(options.preset, options.weights);
  return `${ticker.toUpperCase()}:${options.preset || 'custom'}:${JSON.stringify(weights)}`;
}

export function clearScoreCache(): void {
  scoreCache.clear();
}

export async function scoreTicker(ticker: string, options: ScoreOptions = {}): Promise<StockScoreResult> {
  const key = cacheKey(ticker, options);
  const cached = scoreCache.get(key);
  if (cached && Date.now() < cached.expires && !options.providers) {
    return cached.data;
  }

  const result = await computeStockScore(ticker, options);
  if (!options.providers) {
    scoreCache.set(key, { data: result, expires: Date.now() + SCORE_TTL_MS });
  }
  return result;
}

export const DEFAULT_SCREENER_TICKERS = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'META',
  'TSLA',
  'JPM',
  'JNJ',
  'XOM',
  'UNH',
  'V',
];

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function scoreTickers(
  tickers: string[],
  options: ScoreOptions = {},
  concurrency = 3
): Promise<{ scores: StockScoreResult[]; errors: Array<{ ticker: string; error: string }> }> {
  const unique = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))).slice(0, 20);
  const errors: Array<{ ticker: string; error: string }> = [];

  const results = await mapPool(unique, concurrency, async (ticker) => {
    try {
      return await scoreTicker(ticker, options);
    } catch (error) {
      const message = error instanceof UnknownTickerError ? error.message : 'Failed to score ticker';
      errors.push({ ticker, error: message });
      return null;
    }
  });

  return {
    scores: results.filter((row): row is StockScoreResult => row !== null),
    errors,
  };
}
