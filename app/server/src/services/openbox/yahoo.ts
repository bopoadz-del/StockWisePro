import axios from 'axios';
import yahooFinance from 'yahoo-finance2';
import type { HistoricalBar, YahooQuoteSummary } from './types';

const YAHOO_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; StockWisePro/1.0)',
};

const QUOTE_SUMMARY_TTL_MS = 5 * 60 * 1000;
const HISTORY_TTL_MS = 15 * 60 * 1000;
const SEARCH_TTL_MS = 5 * 60 * 1000;

const quoteSummaryCache = new Map<string, { data: YahooQuoteSummary | null; expires: number }>();
const historyCache = new Map<string, { data: HistoricalBar[]; expires: number }>();
const searchCache = new Map<string, { data: YahooSearchHit[]; expires: number }>();

const QUOTE_MODULES = [
  'financialData',
  'defaultKeyStatistics',
  'summaryDetail',
  'summaryProfile',
  'incomeStatementHistory',
  'balanceSheetHistory',
  'cashflowStatementHistory',
  'price',
  'fundProfile',
] as const;

export interface YahooSearchHit {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export interface ChartSnapshot {
  bars: HistoricalBar[];
  meta: {
    symbol: string;
    shortName?: string;
    longName?: string;
    instrumentType?: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    previousClose?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };
}

function cacheGet<T>(map: Map<string, { data: T; expires: number }>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    map.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet<T>(map: Map<string, { data: T; expires: number }>, key: string, data: T, ttl: number): void {
  map.set(key, { data, expires: Date.now() + ttl });
}

export function normalizeYahooTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, '-');
}

function isNotFound(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error);
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || /not found|no data|delisted/i.test(message);
}

function snapshotToSummary(snapshot: ChartSnapshot): YahooQuoteSummary {
  const { meta } = snapshot;
  const last = snapshot.bars[snapshot.bars.length - 1]?.close;
  const price = meta.regularMarketPrice ?? last;
  return {
    price: {
      shortName: meta.shortName || meta.symbol,
      longName: meta.longName || meta.shortName || meta.symbol,
      quoteType: meta.instrumentType || 'EQUITY',
      regularMarketPrice: price,
      regularMarketChange: meta.regularMarketChange,
      regularMarketChangePercent: meta.regularMarketChangePercent,
      regularMarketPreviousClose: meta.previousClose,
    },
    summaryDetail: {
      previousClose: meta.previousClose,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    },
    summaryProfile: {},
  };
}

export async function getChartSnapshot(ticker: string, range: '3mo' | '1y' | '2y' = '1y'): Promise<ChartSnapshot | null> {
  const upper = normalizeYahooTicker(ticker);
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}`, {
      params: { interval: '1d', range },
      timeout: 10000,
      headers: YAHOO_HEADERS,
    });

    const result = res.data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp || [];
    const closes: Array<number | null> = result.indicators?.quote?.[0]?.close || [];
    const bars: HistoricalBar[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] as number,
      }))
      .filter((bar) => typeof bar.close === 'number' && Number.isFinite(bar.close));

    const meta = result.meta || {};
    return {
      bars,
      meta: {
        symbol: meta.symbol || upper,
        shortName: meta.shortName || meta.symbol,
        longName: meta.longName || meta.shortName,
        instrumentType: meta.instrumentType,
        regularMarketPrice: meta.regularMarketPrice,
        regularMarketChange: meta.regularMarketChange,
        regularMarketChangePercent: meta.regularMarketChangePercent,
        previousClose: meta.chartPreviousClose || meta.previousClose,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      },
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    console.warn('Yahoo chart failed', { ticker: upper, error: String(error) });
    return null;
  }
}

async function quoteSummaryFromLibrary(ticker: string): Promise<YahooQuoteSummary | null> {
  try {
    if (typeof yahooFinance.suppressNotices === 'function') {
      yahooFinance.suppressNotices(['yahooSurvey']);
    }
    const result = await yahooFinance.quoteSummary(ticker, {
      modules: [...QUOTE_MODULES],
    });
    return (result || null) as YahooQuoteSummary | null;
  } catch (error) {
    if (isNotFound(error)) return null;
    console.warn('yahoo-finance2 quoteSummary failed, falling back to chart', {
      ticker,
      error: String((error as Error).message || error),
    });
    return null;
  }
}

export async function getQuoteSummary(ticker: string): Promise<YahooQuoteSummary | null> {
  const upper = normalizeYahooTicker(ticker);
  const cached = cacheGet(quoteSummaryCache, upper);
  if (cached !== undefined) return cached;

  const fromLib = await quoteSummaryFromLibrary(upper);
  if (fromLib) {
    cacheSet(quoteSummaryCache, upper, fromLib, QUOTE_SUMMARY_TTL_MS);
    return fromLib;
  }

  const snapshot = await getChartSnapshot(upper, '1y');
  if (!snapshot || (!snapshot.meta.regularMarketPrice && snapshot.bars.length === 0)) {
    cacheSet(quoteSummaryCache, upper, null, QUOTE_SUMMARY_TTL_MS);
    return null;
  }

  const synthesized = snapshotToSummary(snapshot);
  cacheSet(quoteSummaryCache, upper, synthesized, QUOTE_SUMMARY_TTL_MS);
  return synthesized;
}

export async function getHistoricalPrices(ticker: string, range: '3mo' | '1y' | '2y' = '1y'): Promise<HistoricalBar[]> {
  const upper = normalizeYahooTicker(ticker);
  const cacheKey = `${upper}:${range}`;
  const cached = cacheGet(historyCache, cacheKey);
  if (cached) return cached;

  const snapshot = await getChartSnapshot(upper, range);
  const data = snapshot?.bars || [];
  cacheSet(historyCache, cacheKey, data, HISTORY_TTL_MS);
  return data;
}

export async function yahooSearch(query: string, limit = 8): Promise<YahooSearchHit[]> {
  const key = `${query.toLowerCase()}:${limit}`;
  const cached = cacheGet(searchCache, key);
  if (cached) return cached;

  try {
    const res = await axios.get('https://query1.finance.yahoo.com/v1/finance/search', {
      params: {
        q: query,
        quotesCount: limit,
        newsCount: 0,
        listsCount: 0,
        enableFuzzyQuery: true,
      },
      timeout: 8000,
      headers: YAHOO_HEADERS,
    });

    const quotes = res.data?.quotes || [];
    const hits: YahooSearchHit[] = quotes
      .filter((q: { symbol?: string; quoteType?: string; typeDisp?: string }) => {
        const type = (q.quoteType || q.typeDisp || '').toLowerCase();
        return Boolean(q.symbol) && (!type || type === 'equity' || type === 'etf' || type === 'stock');
      })
      .slice(0, limit)
      .map((q: { symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
        type: q.quoteType,
      }));

    cacheSet(searchCache, key, hits, SEARCH_TTL_MS);
    return hits;
  } catch (error) {
    console.warn('Yahoo search failed', { query, error: String(error) });
    return [];
  }
}

export function clearYahooCaches(): void {
  quoteSummaryCache.clear();
  historyCache.clear();
  searchCache.clear();
}
