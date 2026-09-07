import axios from 'axios';
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
].join(',');

export interface YahooSearchHit {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
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

export async function getQuoteSummary(ticker: string): Promise<YahooQuoteSummary | null> {
  const upper = normalizeYahooTicker(ticker);
  const cached = cacheGet(quoteSummaryCache, upper);
  if (cached !== undefined) return cached;

  try {
    const res = await axios.get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(upper)}`, {
      params: { modules: QUOTE_MODULES },
      timeout: 12000,
      headers: YAHOO_HEADERS,
    });

    const result = res.data?.quoteSummary?.result?.[0] as YahooQuoteSummary | undefined;
    if (!result) {
      cacheSet(quoteSummaryCache, upper, null, QUOTE_SUMMARY_TTL_MS);
      return null;
    }

    cacheSet(quoteSummaryCache, upper, result, QUOTE_SUMMARY_TTL_MS);
    return result;
  } catch (error) {
    console.warn('Yahoo quoteSummary failed', { ticker: upper, error: String(error) });
    return null;
  }
}

export async function getHistoricalPrices(ticker: string, range: '3mo' | '1y' | '2y' = '1y'): Promise<HistoricalBar[]> {
  const upper = normalizeYahooTicker(ticker);
  const cacheKey = `${upper}:${range}`;
  const cached = cacheGet(historyCache, cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}`, {
      params: { interval: '1d', range },
      timeout: 10000,
      headers: YAHOO_HEADERS,
    });

    const result = res.data?.chart?.result?.[0];
    if (!result) {
      cacheSet(historyCache, cacheKey, [], HISTORY_TTL_MS);
      return [];
    }

    const timestamps: number[] = result.timestamp || [];
    const closes: Array<number | null> = result.indicators?.quote?.[0]?.close || [];
    const data: HistoricalBar[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] as number,
      }))
      .filter((bar) => typeof bar.close === 'number' && Number.isFinite(bar.close));

    cacheSet(historyCache, cacheKey, data, HISTORY_TTL_MS);
    return data;
  } catch (error) {
    console.warn('Yahoo historical prices failed', { ticker: upper, error: String(error) });
    return [];
  }
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
