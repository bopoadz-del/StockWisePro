import { scorePeBlended, scorePeROEAdjusted } from './peers';
import { getFmpEnrichment } from './fmp';
import { getHistoricalPrices, getQuoteSummary, normalizeYahooTicker } from './yahoo';
import type {
  DataSource,
  FmpEnrichment,
  KeyMetricsView,
  PillarScores,
  ScoreDataProviders,
  ScoreOptions,
  ScoreRule,
  StockQuoteView,
  StockScoreResult,
  YahooQuoteSummary,
} from './types';
import { UnknownTickerError } from './types';
import { actionFromScore, resolveWeights } from './weights';

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(num, max));
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toNumOpt(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'object' && v !== null && 'raw' in v) {
    return toNumOpt((v as { raw: unknown }).raw);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'longName' in (v as object)) {
    return String((v as { longName?: unknown }).longName || '');
  }
  return '';
}

function asRatio(v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  if (Math.abs(v) > 5) return v / 100;
  return v;
}

function asPct(x: number | undefined): string {
  if (x === undefined || !Number.isFinite(x)) return 'n/a';
  return `${(x * 100).toFixed(Math.abs(x) < 0.1 ? 1 : 0)}%`;
}

function safeDivide(a: number, b: number): number {
  return b !== 0 ? a / b : 0;
}

function computeReturn(prices: number[], days: number): number {
  if (prices.length < days + 1) return 0;
  const curr = prices[prices.length - 1];
  const prev = prices[prices.length - 1 - days];
  return prev > 0 ? (curr - prev) / prev : 0;
}

function computeLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return returns;
}

function calculateSharpeRatio(returns: number[], riskFreeRate = 0.045): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - riskFreeRate / 252);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance = excess.reduce((sum, r) => sum + (r - mean) ** 2, 0) / excess.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (mean / stdDev) * Math.sqrt(252);
}

function calculateMaxDrawdown(prices: number[]): number {
  let peak = prices[0] || 0;
  let maxDD = 0;
  for (const price of prices) {
    if (price > peak) peak = price;
    const dd = peak > 0 ? (peak - price) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export function calculateRSI(prices: number[]): number | undefined {
  if (prices.length < 15) return undefined;
  const closes = prices.slice(-15);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < 15; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function computeSMA(prices: number[], period: number): number | undefined {
  if (prices.length < period) return undefined;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function defaultProviders(): ScoreDataProviders {
  return {
    getQuoteSummary,
    getHistory: (ticker) => getHistoricalPrices(ticker, '1y'),
    getFmpEnrichment,
  };
}

function pickNum(...values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (value !== undefined && Number.isFinite(value)) return value;
  }
  return undefined;
}

function normalizeDebtToEquity(de?: number): number | undefined {
  if (de === undefined) return undefined;
  return de < 10 ? de * 100 : de;
}

function statementNum(row: Record<string, unknown> | undefined, key: string): number {
  return toNumOpt(row?.[key]) ?? 0;
}

function computePiotroski(
  currInc?: Record<string, unknown>,
  prevInc?: Record<string, unknown>,
  currBs?: Record<string, unknown>,
  prevBs?: Record<string, unknown>,
  operatingCashflow?: number
): number {
  if (!currInc || !prevInc || !currBs || !prevBs) return 0;
  let score = 0;

  const currROA = safeDivide(statementNum(currInc, 'netIncome'), statementNum(currBs, 'totalAssets'));
  const prevROA = safeDivide(statementNum(prevInc, 'netIncome'), statementNum(prevBs, 'totalAssets'));
  if (currROA > 0) score++;
  if (currROA > prevROA) score++;
  if ((operatingCashflow ?? 0) > 0) score++;
  if ((operatingCashflow ?? 0) > statementNum(currInc, 'netIncome')) score++;

  const currLeverage = safeDivide(statementNum(currBs, 'totalLiab'), statementNum(currBs, 'totalAssets'));
  const prevLeverage = safeDivide(statementNum(prevBs, 'totalLiab'), statementNum(prevBs, 'totalAssets'));
  if (currLeverage < prevLeverage) score++;

  const currRatio = safeDivide(statementNum(currBs, 'totalCurrentAssets'), statementNum(currBs, 'totalCurrentLiabilities'));
  const prevRatio = safeDivide(statementNum(prevBs, 'totalCurrentAssets'), statementNum(prevBs, 'totalCurrentLiabilities'));
  if (currRatio > prevRatio) score++;

  const currShares = statementNum(currBs, 'commonStockSharesOutstanding');
  const prevShares = statementNum(prevBs, 'commonStockSharesOutstanding');
  if (currShares === 0 || prevShares === 0 || currShares <= prevShares) score++;

  const currMargin = safeDivide(statementNum(currInc, 'operatingIncome'), statementNum(currInc, 'totalRevenue'));
  const prevMargin = safeDivide(statementNum(prevInc, 'operatingIncome'), statementNum(prevInc, 'totalRevenue'));
  if (currMargin > prevMargin) score++;

  const currTurnover = safeDivide(statementNum(currInc, 'totalRevenue'), statementNum(currBs, 'totalAssets'));
  const prevTurnover = safeDivide(statementNum(prevInc, 'totalRevenue'), statementNum(prevBs, 'totalAssets'));
  if (currTurnover > prevTurnover) score++;

  return score;
}

function computeAltmanZ(m: {
  currentAssets?: number;
  currentLiabilities?: number;
  totalAssets?: number;
  retainedEarnings?: number;
  operatingIncome?: number;
  marketCap?: number;
  totalLiabilities?: number;
  revenue?: number;
}): number {
  const ta = m.totalAssets ?? 0;
  const tl = m.totalLiabilities ?? 0;
  if (ta === 0 || tl === 0) return 0;
  const wc = (m.currentAssets ?? 0) - (m.currentLiabilities ?? 0);
  return (
    1.2 * safeDivide(wc, ta) +
    1.4 * safeDivide(m.retainedEarnings ?? 0, ta) +
    3.3 * safeDivide(m.operatingIncome ?? 0, ta) +
    0.6 * safeDivide(m.marketCap ?? 0, tl) +
    1.0 * safeDivide(m.revenue ?? 0, ta)
  );
}

function fmpStatements(enrichment: FmpEnrichment | null): {
  inc?: Record<string, unknown>[];
  bs?: Record<string, unknown>[];
} {
  const income = enrichment?.income || [];
  const balance = enrichment?.balance || [];
  if (income.length < 2 && balance.length < 2) return {};

  return {
    inc: income.map((s) => ({
      totalRevenue: s.revenue,
      operatingIncome: s.operatingIncome,
      netIncome: s.netIncome,
      researchDevelopment: s.researchAndDevelopmentExpenses,
    })),
    bs: balance.map((s) => ({
      totalAssets: s.totalAssets,
      totalLiab: s.totalLiabilities,
      totalCurrentAssets: s.totalCurrentAssets,
      totalCurrentLiabilities: s.totalCurrentLiabilities,
      retainedEarnings: s.retainedEarnings,
      commonStockSharesOutstanding: s.commonStock,
    })),
  };
}

function quoteLooksValid(summary: YahooQuoteSummary | null): boolean {
  if (!summary) return false;
  const price = toNumOpt(summary.price?.regularMarketPrice) ?? toNumOpt(summary.summaryDetail?.previousClose);
  const name = toStr(summary.price?.shortName) || toStr(summary.price?.longName) || toStr(summary.summaryProfile?.longBusinessSummary);
  const quoteType = toStr(summary.price?.quoteType);
  return Boolean(price && price > 0) || Boolean(name) || Boolean(quoteType);
}

export async function computeStockScore(ticker: string, options: ScoreOptions = {}): Promise<StockScoreResult> {
  const upper = normalizeYahooTicker(ticker);
  const providers = options.providers ?? defaultProviders();
  const weights = resolveWeights(options.preset, options.weights);
  const warnings: string[] = [];
  const breakdown: ScoreRule[] = [];
  const sources: DataSource[] = ['yahoo'];

  const [summary, history, fmp] = await Promise.all([
    providers.getQuoteSummary(upper),
    providers.getHistory(upper),
    providers.getFmpEnrichment(upper).catch(() => null),
  ]);

  if (!quoteLooksValid(summary) && history.length === 0) {
    throw new UnknownTickerError(upper);
  }

  const effectiveSummary: YahooQuoteSummary = quoteLooksValid(summary)
    ? summary!
    : {
        price: {
          shortName: upper,
          quoteType: 'EQUITY',
          regularMarketPrice: history[history.length - 1]?.close,
        },
      };

  if (!effectiveSummary.financialData) {
    warnings.push('Fundamentals limited: Yahoo quoteSummary unavailable, using chart snapshot');
  }

  const fd = effectiveSummary.financialData || {};
  const dks = effectiveSummary.defaultKeyStatistics || {};
  const sd = effectiveSummary.summaryDetail || {};
  const profile = effectiveSummary.summaryProfile || {};
  const priceMod = effectiveSummary.price || {};
  const yahooInc = effectiveSummary.incomeStatementHistory?.incomeStatementHistory;
  const yahooBs = effectiveSummary.balanceSheetHistory?.balanceSheetHistory;
  const fmpMapped = fmpStatements(fmp);
  const inc = yahooInc && yahooInc.length >= 2 ? yahooInc : fmpMapped.inc;
  const bs = yahooBs && yahooBs.length >= 2 ? yahooBs : fmpMapped.bs;

  const fmpUsed = Boolean(
    fmp &&
      (fmp.metrics ||
        fmp.rating ||
        (fmp.income && fmp.income.length > 0) ||
        (fmp.balance && fmp.balance.length > 0))
  );
  if (fmpUsed) sources.push('fmp');

  const fmpNum = (key: string): number | undefined => {
    const value = fmp?.metrics?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  };

  const price = toNumOpt(priceMod.regularMarketPrice) ?? toNumOpt(sd.previousClose) ?? 0;
  const previousClose = toNumOpt(sd.previousClose) ?? toNumOpt(priceMod.regularMarketPreviousClose) ?? price;
  const change = toNumOpt(priceMod.regularMarketChange) ?? price - previousClose;
  const changesPercentage =
    toNumOpt(priceMod.regularMarketChangePercent) ??
    (previousClose ? ((price - previousClose) / previousClose) * 100 : 0);
  const shares = toNumOpt(dks.sharesOutstanding);
  const marketCap = toNumOpt(sd.marketCap) ?? (shares ? price * shares : undefined) ?? fmpNum('marketCap') ?? 0;
  const sector = toStr(profile.sector);
  const industry = toStr(profile.industry);
  const name =
    toStr(priceMod.shortName) ||
    toStr(priceMod.longName) ||
    toStr(profile.longBusinessSummary).slice(0, 80) ||
    upper;

  const trailingPE = pickNum(toNumOpt(sd.trailingPE), toNumOpt(dks.trailingPE), fmpNum('peRatio'));
  const forwardPE = toNumOpt(dks.forwardPE);
  const pb = pickNum(toNumOpt(dks.priceToBook), fmpNum('pbRatio'), fmpNum('priceToBookRatio'));
  const ps = pickNum(toNumOpt(sd.priceToSalesTrailing12Months), fmpNum('priceToSalesRatio'));
  const roe = asRatio(pickNum(toNumOpt(fd.returnOnEquity), fmpNum('returnOnEquity'), fmpNum('roe')));
  const roa = asRatio(pickNum(toNumOpt(fd.returnOnAssets), fmpNum('returnOnAssets'), fmpNum('roa')));
  const margin = asRatio(pickNum(toNumOpt(fd.profitMargins), fmpNum('netProfitMargin')));
  const revGrowth = asRatio(pickNum(toNumOpt(fd.revenueGrowth), fmpNum('revenueGrowth')));
  const earnGrowth = asRatio(pickNum(toNumOpt(fd.earningsGrowth), fmpNum('netIncomeGrowth')));
  const currentRatio = pickNum(toNumOpt(fd.currentRatio), fmpNum('currentRatio'));
  const debtToEquity = normalizeDebtToEquity(pickNum(toNumOpt(fd.debtToEquity), fmpNum('debtToEquity')));
  const freeCashflow = pickNum(toNumOpt(fd.freeCashflow), fmpNum('freeCashFlowPerShare'));
  const operatingCashflow = toNumOpt(fd.operatingCashflow);
  const totalDebt = toNumOpt(fd.totalDebt);
  const totalCash = toNumOpt(fd.totalCash);
  const beta = toNumOpt(dks.beta);
  const avgVolume = toNumOpt(sd.averageVolume) ?? toNumOpt(sd.averageDailyVolume10Day);
  const volume = toNumOpt(priceMod.regularMarketVolume);
  const dividendYield = asRatio(pickNum(toNumOpt(sd.dividendYield), fmpNum('dividendYield')));
  const revenue = toNumOpt(inc?.[0]?.totalRevenue);
  const operatingIncome = pickNum(toNumOpt(inc?.[0]?.operatingIncome), toNumOpt(fd.ebitda));
  const totalAssets = toNumOpt(bs?.[0]?.totalAssets);
  const totalLiabilities = toNumOpt(bs?.[0]?.totalLiab);
  const currentAssets = toNumOpt(bs?.[0]?.totalCurrentAssets);
  const currentLiabilities = toNumOpt(bs?.[0]?.totalCurrentLiabilities);
  const retainedEarnings = toNumOpt(bs?.[0]?.retainedEarnings);
  const trailingEps = toNumOpt(dks.trailingEps);
  const forwardEps = toNumOpt(dks.forwardEps);

  const piotroski = computePiotroski(inc?.[0], inc?.[1], bs?.[0], bs?.[1], operatingCashflow);
  const altmanZ = computeAltmanZ({
    currentAssets,
    currentLiabilities,
    totalAssets,
    retainedEarnings,
    operatingIncome,
    marketCap,
    totalLiabilities,
    revenue,
  });

  const rule = (
    pillar: keyof PillarScores,
    metric: string,
    detail: string,
    points: number,
    max: number,
    defaulted = false
  ) => {
    breakdown.push({ pillar, metric, detail, points: r1(points), max, defaulted });
    if (defaulted) warnings.push(`${pillar}.${metric} defaulted: ${detail}`);
  };

  const midpoint = (max: number) => max / 2;

  // ── Valuation ──
  let pePoints: number;
  if (trailingPE && trailingPE > 0) {
    const peScore100 =
      roe && roe > 0.15
        ? scorePeROEAdjusted(trailingPE, roe, sector, industry)
        : scorePeBlended(trailingPE, forwardPE, sector, industry);
    pePoints = (peScore100 / 100) * 45;
    rule(
      'valuation',
      'P/E',
      `trailing ${trailingPE.toFixed(1)}${forwardPE ? ` / forward ${forwardPE.toFixed(1)}` : ''}${sector ? ` (${sector})` : ''}`,
      pePoints,
      45
    );
  } else {
    pePoints = midpoint(45);
    rule('valuation', 'P/E', 'missing trailing P/E', pePoints, 45, true);
  }

  let pbPoints: number;
  if (pb && pb > 0) {
    pbPoints = clamp(100 - ((pb - 1) / 8) * 100, 0, 100) * 0.3;
    rule('valuation', 'P/B', pb.toFixed(2), pbPoints, 30);
  } else {
    pbPoints = midpoint(30);
    rule('valuation', 'P/B', 'missing P/B', pbPoints, 30, true);
  }

  let psPoints: number;
  if (ps && ps > 0) {
    psPoints = clamp(100 - ((ps - 1) / 12) * 100, 0, 100) * 0.15;
    rule('valuation', 'P/S', ps.toFixed(2), psPoints, 15);
  } else {
    psPoints = midpoint(15);
    rule('valuation', 'P/S', 'missing P/S', psPoints, 15, true);
  }

  const fcfYield = marketCap > 0 && freeCashflow ? freeCashflow / marketCap : undefined;
  let fcfPoints: number;
  if (fcfYield !== undefined) {
    fcfPoints = clamp((fcfYield + 0.01) / 0.06 * 10, 0, 10);
    rule('valuation', 'FCF yield', asPct(fcfYield), fcfPoints, 10);
  } else {
    fcfPoints = midpoint(10);
    rule('valuation', 'FCF yield', 'missing free cash flow', fcfPoints, 10, true);
  }

  const valuation = clamp(pePoints + pbPoints + psPoints + fcfPoints, 0, 100);

  // ── Profitability ──
  let roePoints: number;
  if (roe !== undefined) {
    roePoints = clamp(roe / 0.3 * 40, 0, 40);
    rule('profitability', 'ROE', asPct(roe), roePoints, 40);
  } else {
    roePoints = midpoint(40);
    rule('profitability', 'ROE', 'missing ROE', roePoints, 40, true);
  }

  let roaPoints: number;
  if (roa !== undefined) {
    roaPoints = clamp(roa / 0.15 * 25, 0, 25);
    rule('profitability', 'ROA', asPct(roa), roaPoints, 25);
  } else {
    roaPoints = midpoint(25);
    rule('profitability', 'ROA', 'missing ROA', roaPoints, 25, true);
  }

  let marginPoints: number;
  if (margin !== undefined) {
    marginPoints = clamp(margin / 0.3 * 30, 0, 30);
    rule('profitability', 'Profit margin', asPct(margin), marginPoints, 30);
  } else {
    marginPoints = midpoint(30);
    rule('profitability', 'Profit margin', 'missing profit margin', marginPoints, 30, true);
  }

  let qualityBonus = 0;
  if (piotroski >= 7) {
    qualityBonus = 5;
    rule('profitability', 'Piotroski', `${piotroski}/9`, qualityBonus, 5);
  } else if (inc && bs) {
    rule('profitability', 'Piotroski', `${piotroski}/9`, 0, 5);
  }

  const profitability = clamp(roePoints + roaPoints + marginPoints + qualityBonus, 0, 100);

  // ── Growth ──
  let revPoints: number;
  if (revGrowth !== undefined) {
    revPoints = clamp((revGrowth + 0.05) / 0.4 * 50, 0, 50);
    rule('growth', 'Revenue growth', asPct(revGrowth), revPoints, 50);
  } else {
    revPoints = midpoint(50);
    rule('growth', 'Revenue growth', 'missing revenue growth', revPoints, 50, true);
  }

  const forwardGrowth =
    forwardEps && trailingEps && trailingEps !== 0
      ? (forwardEps - trailingEps) / Math.abs(trailingEps)
      : undefined;
  const blendedEarn =
    earnGrowth !== undefined && forwardGrowth !== undefined
      ? earnGrowth * 0.4 + forwardGrowth * 0.6
      : earnGrowth ?? forwardGrowth;

  let earnPoints: number;
  if (blendedEarn !== undefined) {
    earnPoints = clamp((blendedEarn + 0.05) / 0.45 * 50, 0, 50);
    rule(
      'growth',
      'Earnings growth',
      `trailing ${asPct(earnGrowth)}${forwardGrowth !== undefined ? ` / forward ${asPct(forwardGrowth)}` : ''}`,
      earnPoints,
      50
    );
  } else {
    earnPoints = midpoint(50);
    rule('growth', 'Earnings growth', 'missing earnings growth', earnPoints, 50, true);
  }

  const growth = clamp(revPoints + earnPoints, 0, 100);

  // ── Financial health ──
  let crPoints: number;
  if (currentRatio !== undefined && currentRatio > 0) {
    crPoints = clamp((currentRatio - 0.5) / 2.5 * 30, 0, 30);
    rule('financialHealth', 'Current ratio', currentRatio.toFixed(2), crPoints, 30);
  } else {
    crPoints = midpoint(30);
    rule('financialHealth', 'Current ratio', 'missing current ratio', crPoints, 30, true);
  }

  let dePoints: number;
  if (debtToEquity !== undefined && debtToEquity > 0) {
    dePoints = clamp(100 - ((debtToEquity - 50) / 150) * 100, 0, 100) * 0.3;
    rule('financialHealth', 'Debt/Equity', debtToEquity.toFixed(0), dePoints, 30);
  } else {
    dePoints = midpoint(30);
    rule('financialHealth', 'Debt/Equity', 'missing debt/equity', dePoints, 30, true);
  }

  const cashDebt = totalCash && totalDebt ? totalCash / totalDebt : undefined;
  let cashPoints: number;
  if (cashDebt !== undefined) {
    cashPoints = clamp(cashDebt / 1 * 20, 0, 20);
    rule('financialHealth', 'Cash vs debt', `${cashDebt.toFixed(2)}x`, cashPoints, 20);
  } else {
    cashPoints = midpoint(20);
    rule('financialHealth', 'Cash vs debt', 'missing cash or debt', cashPoints, 20, true);
  }

  let solvencyPoints = 0;
  if (altmanZ > 3) {
    solvencyPoints = 10;
    rule('financialHealth', 'Altman Z', altmanZ.toFixed(1), solvencyPoints, 10);
  } else if (altmanZ > 0) {
    solvencyPoints = clamp(((altmanZ - 1.2) / 1.8) * 10, 0, 10);
    rule('financialHealth', 'Altman Z', altmanZ.toFixed(1), solvencyPoints, 10);
  } else {
    solvencyPoints = midpoint(10);
    rule('financialHealth', 'Altman Z', 'insufficient statement data', solvencyPoints, 10, true);
  }

  let coveragePoints = 10;
  if (totalDebt && totalDebt > 0 && operatingIncome) {
    const coverage = operatingIncome / (totalDebt * 0.05);
    coveragePoints = clamp((coverage - 1) / 19 * 10, 0, 10);
    rule('financialHealth', 'Interest coverage', `${coverage.toFixed(1)}x`, coveragePoints, 10);
  } else {
    rule('financialHealth', 'Interest coverage', 'assumed mid-point', coveragePoints, 10, true);
  }

  const financialHealth = clamp(crPoints + dePoints + cashPoints + solvencyPoints + coveragePoints, 0, 100);

  // ── Momentum (real price history — never a hardcoded 50 unless history is missing) ──
  const prices = history.map((bar) => bar.close).filter((p) => p > 0);
  let momentum: number;

  if (prices.length < 15) {
    momentum = 50;
    rule('momentum', 'Price history', 'insufficient history (<15 sessions)', 50, 100, true);
  } else {
    const mom1m = prices.length >= 22 ? computeReturn(prices, 21) : computeReturn(prices, Math.max(1, prices.length - 1));
    const mom3m = prices.length >= 64 ? computeReturn(prices, 63) : mom1m;
    const mom6m = prices.length >= 127 ? computeReturn(prices, 126) : mom3m;
    const mom12_1 = prices.length >= 232 ? computeReturn(prices, 231) : computeReturn(prices, prices.length - 1);
    const composite = mom1m * 0.1 + mom3m * 0.2 + mom6m * 0.3 + mom12_1 * 0.4;
    const momPoints = clamp((composite + 0.4) / 0.8 * 40, 0, 40);

    const rsi = calculateRSI(prices);
    const rsiPoints = rsi !== undefined ? clamp((rsi - 30) / 40 * 100, 0, 100) * 0.15 : 7.5;

    const sharpe = calculateSharpeRatio(computeLogReturns(prices));
    const sharpePoints = clamp((sharpe / 2.5) * 10, 0, 10);
    const maxDD = calculateMaxDrawdown(prices);
    const ddPoints = clamp(100 - maxDD * 200, 0, 100) * 0.1;

    const sma50 = computeSMA(prices, 50);
    const sma200 = computeSMA(prices, Math.min(200, prices.length));
    const latest = prices[prices.length - 1];
    const aboveSma50 = sma50 !== undefined && latest > sma50;
    const aboveSma200 = sma200 !== undefined && latest > sma200;
    const trendAligned = aboveSma50 && aboveSma200 && sma50 !== undefined && sma200 !== undefined && sma50 > sma200;
    const trendPoints = (aboveSma50 ? 8 : 0) + (aboveSma200 ? 7 : 0) + (trendAligned ? 5 : 0);

    const volPoints = clamp(100 - (beta ?? 1) / 3 * 100, 0, 100) * 0.1;

    momentum = clamp(momPoints + rsiPoints + sharpePoints + ddPoints + trendPoints + volPoints, 0, 100);

    rule(
      'momentum',
      'Multi-timeframe',
      `${(mom1m * 100).toFixed(0)}%/${(mom3m * 100).toFixed(0)}%/${(mom6m * 100).toFixed(0)}%/${(mom12_1 * 100).toFixed(0)}%`,
      momPoints,
      40
    );
    rule('momentum', 'RSI', rsi !== undefined ? rsi.toFixed(0) : 'n/a', rsiPoints, 15);
    rule('momentum', 'Sharpe', sharpe.toFixed(2), sharpePoints, 10);
    rule('momentum', 'Max drawdown', `${(maxDD * 100).toFixed(1)}%`, ddPoints, 10);
    rule(
      'momentum',
      'Trend',
      `${aboveSma50 ? '>' : '<'}50DMA, ${aboveSma200 ? '>' : '<'}200DMA`,
      trendPoints,
      20
    );
    rule('momentum', 'Beta', beta !== undefined ? beta.toFixed(2) : 'n/a', volPoints, 10, beta === undefined);
  }

  const pillars: PillarScores = {
    valuation: Math.round(valuation),
    profitability: Math.round(profitability),
    growth: Math.round(growth),
    financialHealth: Math.round(financialHealth),
    momentum: Math.round(momentum),
  };

  const weighted =
    (pillars.valuation * weights.valuation +
      pillars.profitability * weights.profitability +
      pillars.growth * weights.growth +
      pillars.financialHealth * weights.financialHealth +
      pillars.momentum * weights.momentum) /
    100;
  const finalScore = clamp(Math.round(weighted), 0, 100);

  const quote: StockQuoteView = {
    symbol: upper,
    name,
    price,
    change,
    changesPercentage,
    marketCap,
    pe: trailingPE,
    volume,
    avgVolume,
    dayLow: toNumOpt(sd.dayLow) ?? toNumOpt(priceMod.regularMarketDayLow),
    dayHigh: toNumOpt(sd.dayHigh) ?? toNumOpt(priceMod.regularMarketDayHigh),
    yearLow: toNumOpt(sd.fiftyTwoWeekLow),
    yearHigh: toNumOpt(sd.fiftyTwoWeekHigh),
    eps: trailingEps,
    sector: sector || undefined,
    industry: industry || undefined,
  };

  const metrics: KeyMetricsView = {
    peRatio: trailingPE,
    priceToBookRatio: pb,
    priceToSalesRatio: ps,
    roe,
    roa,
    debtToEquity: debtToEquity !== undefined ? debtToEquity / 100 : undefined,
    currentRatio,
    dividendYield,
    revenueGrowth: revGrowth,
    earningsGrowth: blendedEarn,
    profitMargin: margin,
  };

  return {
    ticker: upper,
    name,
    finalScore,
    action: actionFromScore(finalScore),
    pillars,
    weights,
    preset: options.preset,
    sources,
    warnings,
    breakdown,
    quote,
    metrics,
    sparkline: prices.slice(-10),
  };
}

