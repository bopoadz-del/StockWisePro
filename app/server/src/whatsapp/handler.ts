/**
 * WhatsApp Message Handler
 * Ported from stockwise-whatsapp — now calls OpenBox scoring engine DIRECTLY
 * instead of making HTTP API calls. This eliminates network latency and
 * removes the dependency on the API being deployed.
 */

import { parseIntent, extractTicker } from './intent';
import { computeOpenBoxScore, OpenBoxScore } from '../services/scoring';
import { explainScore, isLlmEnabled } from './ollama';
import { formatScore, formatExplain, deterministicExplain, HELP_TEXT, notFound, tempError } from './format';
import { twelveDataService } from '../services/twelveDataService';

export interface HandlerResult {
  text: string;
  score?: OpenBoxScore;
}

export async function handleMessage(body: string): Promise<HandlerResult> {
  const intent = parseIntent(body);

  if (intent.type === 'help' || intent.type === 'unknown') {
    return { text: HELP_TEXT };
  }

  // Resolve ticker
  let ticker = intent.ticker || null;
  if (!ticker && intent.query) {
    if (!looksLikeCompanyName(intent.query)) return { text: HELP_TEXT };
    ticker = await searchTicker(intent.query);
  }
  if (!ticker) {
    return { text: notFound(intent.query || body.trim()) };
  }

  // Get score DIRECTLY from the scoring engine (no HTTP call!)
  const score = await getScoreLocal(ticker);
  if (!score) {
    // Distinguish "no such ticker" from transient error
    const resolved = await searchTicker(ticker);
    return { text: resolved ? tempError(ticker) : notFound(ticker) };
  }

  if (intent.type === 'explain') {
    const narrative = isLlmEnabled() ? await explainScore(score) : null;
    return {
      text: formatExplain(score, narrative || deterministicExplain(score)),
      score,
    };
  }

  // Default: score with quote
  const quote = await getQuoteLocal(ticker);
  return {
    text: formatScore(score, quote ? { price: quote.price, name: quote.name, changesPercentage: quote.change } : null),
    score,
  };
}

// ─── Direct Scoring (no HTTP call) ───────────────────────────────────

async function getScoreLocal(ticker: string): Promise<OpenBoxScore | null> {
  try {
    const fundamentals = await fetchFundamentalsLocal(ticker);
    if (!fundamentals) return null;

    const prices = await fetchPriceLocal(ticker);
    if (prices.length < 30) return null;

    return computeOpenBoxScore({
      ticker,
      fundamentals,
      historicalPrices: prices,
    });
  } catch {
    return null;
  }
}

// ─── Quote via Twelve Data ────────────────────────────────────────────

async function getQuoteLocal(ticker: string): Promise<{ price: number; name?: string; change?: number } | null> {
  try {
    const quote = await twelveDataService.getQuote(ticker);
    if (!quote) return null;
    return {
      price: quote.price,
      name: quote.name,
      change: quote.change,
    };
  } catch {
    return null;
  }
}

// ─── Search ticker by company name ────────────────────────────────────

async function searchTicker(query: string): Promise<string | null> {
  try {
    const results = await twelveDataService.search(query);
    if (results && results.length > 0) {
      return results[0].symbol.toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Fetch fundamentals (reuses scoring route logic) ──────────────────

import type { StockFundamentals, HistoricalPrice } from '../services/scoring';

async function fetchFundamentalsLocal(ticker: string): Promise<StockFundamentals | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const axios = require('axios');
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'OVERVIEW',
        symbol: ticker.toUpperCase().replace(/-/g, '.'),
        apikey: apiKey,
      },
      timeout: 15000,
    });

    const data = response.data;
    if (!data || !data.Symbol) return null;

    const parseNum = (val: unknown): number | undefined => {
      if (val === undefined || val === null || val === 'None' || val === '') return undefined;
      const n = typeof val === 'string' ? parseFloat(val) : Number(val);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      ticker: ticker.toUpperCase(),
      price: 0,
      name: data.Name || undefined,
      sector: data.Sector || undefined,
      industry: data.Industry || undefined,
      marketCap: parseNum(data.MarketCapitalization),
      trailingPE: parseNum(data.PERatio),
      forwardPE: parseNum(data.ForwardPE),
      priceToBook: parseNum(data.PriceToBookRatio),
      beta: parseNum(data.Beta),
      dividendYield: parseNum(data.DividendYield),
      avgVolume: parseNum(data.AverageVolume),
      fiftyTwoWeekHigh: parseNum(data['52WeekHigh']),
      fiftyTwoWeekLow: parseNum(data['52WeekLow']),
      twoHundredDayAverage: parseNum(data['200DayMovingAverage']),
      fiftyDayAverage: parseNum(data['50DayMovingAverage']),
      revenueGrowth: parseNum(data.QuarterlyRevenueGrowthYOY),
      earningsGrowth: parseNum(data.QuarterlyEarningsGrowthYOY),
      profitMargin: parseNum(data.ProfitMargin),
      roe: parseNum(data.ReturnOnEquityTTM),
      operatingCashflow: parseNum(data.OperatingCashflowTTM),
      freeCashflow: parseNum(data.FreeCashFlow),
      totalDebt: parseNum(data.TotalDebt),
      totalCash: parseNum(data.CashAndCashEquivalentsAtCarryingValue),
      currentRatio: parseNum(data.CurrentRatio),
      debtToEquity: parseNum(data.DebtToEquityRatio),
      totalRevenue: parseNum(data.TotalRevenue),
      ebitda: parseNum(data.EBITDA),
      operatingIncome: parseNum(data.OperatingIncomeTTM),
      netIncome: parseNum(data.NetIncomeTTM),
      grossProfit: parseNum(data.GrossProfitTTM),
      totalAssets: parseNum(data.TotalAssets),
      totalLiabilities: parseNum(data.TotalLiabilities),
      currentAssets: parseNum(data.CurrentAssets),
      currentLiabilities: parseNum(data.CurrentLiabilities),
      retainedEarnings: parseNum(data.RetainedEarnings),
      sharesOutstanding: parseNum(data.SharesOutstanding),
      bookValue: parseNum(data.BookValue),
      epsTrailing: parseNum(data.EPS),
      epsForward: parseNum(data.ForwardEPS),
      pegRatio: parseNum(data.PEGRatio),
    };
  } catch {
    return null;
  }
}

async function fetchPriceLocal(ticker: string): Promise<HistoricalPrice[]> {
  try {
    const hist = await twelveDataService.getHistoricalPrices(ticker);
    return hist.map(h => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
    }));
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function looksLikeCompanyName(query: string): boolean {
  const q = query.trim();
  if (q.length < 2 || q.length > 40) return false;
  if (/\d/.test(q)) return false;
  if (!/^[a-zA-Z][a-zA-Z .&'-]*$/.test(q)) return false;
  return q.split(/\s+/).length <= 3;
}
