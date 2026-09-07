import axios from 'axios';
import { config } from '../../config';
import type { FmpBalanceSheet, FmpEnrichment, FmpIncomeStatement, FmpKeyMetrics, FmpRating } from './types';

const BASE_V3 = 'https://financialmodelingprep.com/api/v3';
const BASE_STABLE = 'https://financialmodelingprep.com/stable';

function apiKey(): string {
  return config.apis.financialModelingPrep.key;
}

export function isFmpEnabled(): boolean {
  return Boolean(apiKey());
}

async function getV3<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  if (!isFmpEnabled()) return null;
  try {
    const res = await axios.get<T>(`${BASE_V3}${path}`, {
      params: { ...params, apikey: apiKey() },
      timeout: 10000,
    });
    return res.data;
  } catch (error) {
    console.warn('FMP v3 request failed', { path, error: String(error) });
    return null;
  }
}

async function getStable<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  if (!isFmpEnabled()) return null;
  try {
    const res = await axios.get<T>(`${BASE_STABLE}${path}`, {
      params: { ...params, apikey: apiKey() },
      timeout: 10000,
    });
    return res.data;
  } catch (error) {
    console.warn('FMP stable request failed', { path, error: String(error) });
    return null;
  }
}

export async function getKeyMetrics(symbol: string): Promise<FmpKeyMetrics | null> {
  const data = await getV3<FmpKeyMetrics[]>(`/key-metrics/${symbol.toUpperCase()}`);
  if (data && data.length > 0) return data[0];
  const stable = await getStable<FmpKeyMetrics[]>(`/key-metrics-ttm`, { symbol: symbol.toUpperCase() });
  return stable?.[0] || null;
}

export async function getRatings(symbol: string): Promise<FmpRating | null> {
  const data = await getV3<FmpRating[]>(`/rating/${symbol.toUpperCase()}`);
  if (data && data.length > 0) return data[0];
  const stable = await getStable<FmpRating[]>(`/ratings-snapshot`, { symbol: symbol.toUpperCase() });
  return stable?.[0] || null;
}

export async function getIncomeStatements(symbol: string, limit = 3): Promise<FmpIncomeStatement[]> {
  const data = await getV3<FmpIncomeStatement[]>(`/income-statement/${symbol.toUpperCase()}`, { limit });
  return data || [];
}

export async function getBalanceSheets(symbol: string, limit = 3): Promise<FmpBalanceSheet[]> {
  const data = await getV3<FmpBalanceSheet[]>(`/balance-sheet-statement/${symbol.toUpperCase()}`, { limit });
  return data || [];
}

export async function getFmpEnrichment(ticker: string): Promise<FmpEnrichment | null> {
  if (!isFmpEnabled()) return null;

  const [metrics, rating, income, balance] = await Promise.all([
    getKeyMetrics(ticker).catch(() => null),
    getRatings(ticker).catch(() => null),
    getIncomeStatements(ticker, 3).catch(() => []),
    getBalanceSheets(ticker, 3).catch(() => []),
  ]);

  if (!metrics && !rating && (!income || income.length === 0) && (!balance || balance.length === 0)) {
    return null;
  }

  return {
    metrics,
    rating,
    income: income || [],
    balance: balance || [],
  };
}
