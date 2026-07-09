/**
 * OpenBox Scoring Engine v2.0
 * Ported from stockwisepro-bot with major fixes:
 * 
 * FIX 1: Sector-relative P/E scoring (utilities no longer unfairly penalized)
 * FIX 2: Forward P/E blending (earnings growth trajectory captured)
 * FIX 3: ROE-adjusted valuation (quality compounders properly scored)
 * FIX 4: Multi-timeframe momentum (1m/3m/6m/12m composite)
 * FIX 5: Sharpe ratio + max drawdown in Market Dynamics
 * FIX 6: Forward EPS growth weighting in earnings score
 */

import {
  ScoringInput,
  OpenBoxScore,
  ScoreRule,
  StockFundamentals,
  HistoricalPrice,
  ScoringWeights,
  DEFAULT_WEIGHTS,
  ETF_WEIGHTS,
  PiotroskiResult,
  AltmanResult,
} from './types';

import { checkEthics } from './ethics';
import { checkDominance } from './dominance';
import { computePeerDelta, scorePeBlended, scorePeROEAdjusted } from './peers';
import { analyzeRisks } from './risks';
import { generateNarrative } from './narrative';

// ─── Helpers ───────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeDivide(a: number, b: number, fallback = 0): number {
  if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return fallback;
  return a / b;
}

function toNumOpt(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
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
  const excessReturns = returns.map(r => r - riskFreeRate / 252);
  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const variance = excessReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / excessReturns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (mean / stdDev) * Math.sqrt(252);
}

function calculateMaxDrawdown(prices: number[]): { maxDrawdown: number; peak: number; trough: number } {
  let peak = prices[0] || 0;
  let maxDD = 0;
  let trough = peak;

  for (const price of prices) {
    if (price > peak) {
      peak = price;
      trough = peak;
    } else if (price < trough) {
      trough = price;
      const dd = (peak - trough) / peak;
      if (dd > maxDD) maxDD = dd;
    }
  }

  return { maxDrawdown: maxDD, peak, trough };
}

function calculateRSI(prices: number[], period = 14): number | undefined {
  if (prices.length < period + 1) return undefined;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

// ─── Piotroski F-Score ─────────────────────────────────────────────────

function computePiotroski(m: StockFundamentals): PiotroskiResult {
  let score = 0;

  // Profitability
  if ((m.netIncome ?? 0) > 0) score++;
  if ((m.operatingCashflow ?? 0) > 0) score++;
  if ((m.operatingCashflow ?? 0) > (m.netIncome ?? 0)) score++;
  if ((m.revenueGrowth ?? 0) > 0) score++;

  // Leverage & Liquidity
  if ((m.debtToEquity ?? 0) < 50) score++;
  if ((m.currentRatio ?? 0) > 1) score++;

  // Efficiency
  if ((m.profitMargin ?? 0) > 0.1) score++;
  if ((m.sharesOutstanding ?? 0) > 0) score++;
  if ((m.roe ?? 0) > 0.15) score++;

  return { raw: score, score: Math.round(score * 10) };
}

// ─── Altman Z-Score ────────────────────────────────────────────────────

function computeAltman(m: StockFundamentals): AltmanResult {
  const A = safeDivide(m.totalRevenue ?? 0, m.totalAssets ?? 1);
  const B = safeDivide(m.retainedEarnings ?? 0, m.totalAssets ?? 1);
  const C = safeDivide(m.ebitda ?? 0, m.totalAssets ?? 1);
  const D = safeDivide(m.marketCap ?? 0, m.totalLiabilities ?? 1);
  const E = safeDivide(m.totalRevenue ?? 0, m.totalAssets ?? 1);

  const z = 1.2 * A + 1.4 * B + 3.3 * C + 0.6 * D + 1.0 * E;

  let zone: AltmanResult['zone'] = 'safe';
  if (z < 1.8) zone = 'distress';
  else if (z < 3.0) zone = 'grey';

  let score = 50;
  if (z > 3) score = 100;
  else if (z > 2) score = 80;
  else if (z > 1.8) score = 60;
  else if (z > 1) score = 30;
  else score = 0;

  return { raw: z, score, zone };
}

// ─── Return on Invested Capital ────────────────────────────────────────

function computeROIC(m: StockFundamentals): number {
  const investedCapital = (m.totalAssets ?? 0) - (m.currentLiabilities ?? 0);
  return safeDivide(m.operatingIncome ?? 0, investedCapital, 0);
}

// ─── Main Scoring Function ─────────────────────────────────────────────

export function computeOpenBoxScore(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  experimental = false
): OpenBoxScore {
  const { ticker, fundamentals: dks, historicalPrices } = input;
  const m = dks;
  const breakdown: ScoreRule[] = [];

  // ── Is ETF? ──────────────────────────────────────────────────────
  const isETF = !!m.expenseRatio || m.fundCategory !== undefined;
  const w = isETF ? ETF_WEIGHTS : weights;

  // ── Prices for momentum calculations ─────────────────────────────
  const closes = historicalPrices.map(p => p.close);
  const volumes = historicalPrices.map(p => p.volume);
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  const avgVolume = closes.length > 0 ? totalVolume / closes.length : 0;

  // ── Multi-timeframe momentum (FIX 4) ────────────────────────────
  const mom1m = safeDivide(closes[closes.length - 1] - closes[Math.max(0, closes.length - 21)], closes[Math.max(0, closes.length - 21)]);
  const mom3m = safeDivide(closes[closes.length - 1] - closes[Math.max(0, closes.length - 63)], closes[Math.max(0, closes.length - 63)]);
  const mom6m = safeDivide(closes[closes.length - 1] - closes[Math.max(0, closes.length - 126)], closes[Math.max(0, closes.length - 126)]);
  const mom12m = safeDivide(closes[closes.length - 1] - closes[0], closes[0]);
  // Fama-French: skip 1m, use 2-12m
  const mom12_1 = safeDivide(closes[closes.length - 1] - closes[Math.max(0, closes.length - 231)], closes[Math.max(0, closes.length - 231)]);

  // ── Sharpe Ratio (FIX 5) ────────────────────────────────────────
  const logReturns = computeLogReturns(closes);
  const sharpe = logReturns.length >= 2 ? calculateSharpeRatio(logReturns) : 0;

  // ── Max Drawdown (FIX 5) ────────────────────────────────────────
  const maxDD = calculateMaxDrawdown(closes);

  // ── RSI ──────────────────────────────────────────────────────────
  const rsi = calculateRSI(closes);

  // ── Dominance & Peer ─────────────────────────────────────────────
  const dominance = checkDominance(ticker, m.sector);
  const peer = computePeerDelta(m.trailingPE ?? 0, m.sector, m.industry);

  // ── Ethics ───────────────────────────────────────────────────────
  const ethics = checkEthics(ticker, m.sector, m.industry, m.name);

  // ── Piotroski & Altman ──────────────────────────────────────────
  const piotroski = computePiotroski(m);
  const altman = computeAltman(m);
  const roic = computeROIC(m);

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 1: FUNDAMENTALS (max 30)
  // ═══════════════════════════════════════════════════════════════

  // FIX 1 & 2: Use blended P/E scoring (sector-relative + forward P/E)
  const trailingPE = m.trailingPE ?? 0;
  const forwardPE = m.forwardPE;
  const roe = m.roe ?? 0;

  let peScore: number;
  if (roe > 0.15 && trailingPE > 0) {
    // FIX 3: ROE-adjusted valuation for quality compounders
    peScore = clamp(scorePeROEAdjusted(trailingPE, roe, m.sector, m.industry) / 100 * 10, 0, 10);
  } else if (trailingPE > 0) {
    // FIX 1 & 2: Sector-relative + forward P/E blending
    peScore = clamp(scorePeBlended(trailingPE, forwardPE, m.sector, m.industry) / 100 * 10, 0, 10);
  } else {
    peScore = 5;
  }

  breakdown.push({ pillar: 'Fundamentals', metric: 'P/E Ratio', detail: `trailing ${trailingPE.toFixed(1)}${forwardPE ? ` / forward ${forwardPE.toFixed(1)}` : ''}${m.sector ? ` (${m.sector})` : ''}`, points: Math.round(peScore), max: 10 });

  // P/B Score (0-10)
  const pbScore = clamp(10 - ((m.priceToBook ?? 5) - 1) * 2, 0, 10);
  breakdown.push({ pillar: 'Fundamentals', metric: 'P/B Ratio', detail: `${(m.priceToBook ?? 0).toFixed(1)}x`, points: Math.round(pbScore), max: 10 });

  // FIX 6: Blended earnings growth (forward-weighted)
  const trailingEps = m.epsTrailing;
  const forwardEps = m.epsForward;
  const forwardGrowth = trailingEps && forwardEps && trailingEps !== 0
    ? (forwardEps - trailingEps) / Math.abs(trailingEps)
    : 0;
  const earnGrowth = m.earningsGrowth ?? 0;
  const blendedEarningsGrowth = forwardGrowth !== 0
    ? earnGrowth * 0.4 + forwardGrowth * 0.6  // weight forward more
    : earnGrowth;
  const earnScore = clamp(blendedEarningsGrowth / 0.50 * 10, 0, 10);

  breakdown.push({ pillar: 'Fundamentals', metric: 'Earnings Growth', detail: `trailing ${(earnGrowth * 100).toFixed(0)}%${forwardGrowth !== 0 ? ` / forward ${(forwardGrowth * 100).toFixed(0)}%` : ''}`, points: Math.round(earnScore), max: 10 });

  // FCF Yield (0-5)
  const fcfYield = m.marketCap && m.freeCashflow
    ? (m.freeCashflow / m.marketCap) * 100
    : m.operatingCashflow && m.marketCap
      ? (m.operatingCashflow / m.marketCap) * 100
      : 0;
  const fcfScore = clamp(fcfYield / 8 * 5, 0, 5);
  breakdown.push({ pillar: 'Fundamentals', metric: 'FCF Yield', detail: `${fcfYield.toFixed(1)}%`, points: Math.round(fcfScore), max: 5 });

  // Dividend Yield (0-5)
  const divScore = clamp((m.dividendYield ?? 0) / 0.05 * 5, 0, 5);
  breakdown.push({ pillar: 'Fundamentals', metric: 'Dividend Yield', detail: `${((m.dividendYield ?? 0) * 100).toFixed(1)}%`, points: Math.round(divScore), max: 5 });

  // Piotroski F-Score (0-5)
  const pioScore = clamp(piotroski.raw / 9 * 5, 0, 5);
  breakdown.push({ pillar: 'Fundamentals', metric: 'Piotroski F-Score', detail: `${piotroski.raw}/9`, points: Math.round(pioScore), max: 5 });

  // ROE (0-5)
  const roeScore = clamp((m.roe ?? 0) / 0.30 * 5, 0, 5);
  breakdown.push({ pillar: 'Fundamentals', metric: 'ROE', detail: `${((m.roe ?? 0) * 100).toFixed(1)}%`, points: Math.round(roeScore), max: 5 });

  // Profit Margin (0-5)
  const marginScore = clamp((m.profitMargin ?? 0) / 0.25 * 5, 0, 5);
  breakdown.push({ pillar: 'Fundamentals', metric: 'Profit Margin', detail: `${((m.profitMargin ?? 0) * 100).toFixed(1)}%`, points: Math.round(marginScore), max: 5 });

  const pillarFundamentals = peScore + pbScore + earnScore + fcfScore + divScore + pioScore + roeScore + marginScore;

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 2: MARKET DYNAMICS (max 15)
  // ═══════════════════════════════════════════════════════════════

  // FIX 4: Multi-timeframe momentum score
  const compositeMomentum = mom1m * 0.10 + mom3m * 0.20 + mom6m * 0.30 + mom12_1 * 0.40;
  const momScore = clamp((compositeMomentum + 0.4) / 0.8 * 25, 0, 25);
  breakdown.push({ pillar: 'Market Dynamics', metric: 'Momentum (1m/3m/6m/12m)', detail: `${(mom1m * 100).toFixed(0)}% / ${(mom3m * 100).toFixed(0)}% / ${(mom6m * 100).toFixed(0)}% / ${(mom12_1 * 100).toFixed(0)}%`, points: Math.round(momScore), max: 25 });

  // FIX 5: Sharpe ratio score (0-10)
  const sharpeScore = clamp(sharpe / 2.5 * 100 * 0.10, 0, 10);
  breakdown.push({ pillar: 'Market Dynamics', metric: 'Sharpe Ratio', detail: `${sharpe.toFixed(2)}`, points: Math.round(sharpeScore), max: 10 });

  // FIX 5: Max drawdown score (0-10)
  const ddScore = clamp(100 - maxDD.maxDrawdown * 200, 0, 100) * 0.10;
  breakdown.push({ pillar: 'Market Dynamics', metric: 'Max Drawdown', detail: `${(maxDD.maxDrawdown * 100).toFixed(1)}%`, points: Math.round(ddScore), max: 10 });

  // Volatility/Beta (0-20)
  const volScore = clamp((1 - Math.min((m.beta ?? 1), 2)) / 1 * 20, 0, 20);
  breakdown.push({ pillar: 'Market Dynamics', metric: 'Beta/Volatility', detail: `beta ${(m.beta ?? 0).toFixed(2)}`, points: Math.round(volScore), max: 20 });

  // Volume Liquidity (0-15)
  const volLiqScore = clamp(Math.log10(avgVolume + 1) / 8 * 15, 0, 15);
  breakdown.push({ pillar: 'Market Dynamics', metric: 'Volume Liquidity', detail: `${(avgVolume / 1e6).toFixed(1)}M avg`, points: Math.round(volLiqScore), max: 15 });

  // RSI (0-15)
  const rsiScore = rsi !== undefined ? clamp((70 - Math.abs(rsi - 50)) / 70 * 15, 0, 15) : 7.5;
  breakdown.push({ pillar: 'Market Dynamics', metric: 'RSI', detail: rsi !== undefined ? `${rsi.toFixed(0)}` : 'N/A', points: Math.round(rsiScore), max: 15 });

  // Price vs 200d MA (0-15)
  const ma200 = m.twoHundredDayAverage ?? 0;
  const trendScore = ma200 > 0
    ? clamp(((m.price - ma200) / ma200) * 100 * 1.5, -15, 15)
    : 0;
  breakdown.push({ pillar: 'Market Dynamics', metric: 'vs 200d MA', detail: ma200 > 0 ? `${((m.price - ma200) / ma200 * 100).toFixed(1)}%` : 'N/A', points: Math.round(trendScore + 15) / 2, max: 15 });

  const pillarMarketDynamics = momScore + sharpeScore + ddScore + volScore + volLiqScore + rsiScore + Math.max(0, trendScore);

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 3: BALANCE SHEET (max 15)
  // ═══════════════════════════════════════════════════════════════

  // Current Ratio (0-25)
  const crScore = clamp(((m.currentRatio ?? 1) - 0.5) / 2 * 25, 0, 25);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'Current Ratio', detail: `${(m.currentRatio ?? 0).toFixed(2)}`, points: Math.round(crScore), max: 25 });

  // Interest Coverage proxy via operating income / total debt
  const intCov = safeDivisionScore((m.operatingIncome ?? 0), (m.totalDebt ?? 1), 25);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'Interest Coverage', detail: `${safeDivide((m.operatingIncome ?? 0), (m.totalDebt ?? 0), 0).toFixed(1)}x`, points: Math.round(intCov), max: 25 });

  // Cash/Debt (0-25)
  const cashDebtScore = clamp(((m.totalCash ?? 0) / Math.max((m.totalDebt ?? 1), 1)) / 1 * 25, 0, 25);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'Cash/Debt', detail: `${safeDivide((m.totalCash ?? 0), (m.totalDebt ?? 0), 0).toFixed(1)}x`, points: Math.round(cashDebtScore), max: 25 });

  // Debt/Equity (0-25)
  const deScore = clamp(25 - ((m.debtToEquity ?? 0) / 100 * 12.5), 0, 25);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'D/E Ratio', detail: `${(m.debtToEquity ?? 0).toFixed(0)}%`, points: Math.round(deScore), max: 25 });

  // Altman Z-Score (0-10)
  const altScore = clamp(altman.score / 100 * 10, 0, 10);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'Altman Z-Score', detail: `z=${altman.raw.toFixed(1)} (${altman.zone})`, points: Math.round(altScore), max: 10 });

  // ROIC (0-10)
  const roicScore = clamp(roic / 0.20 * 10, 0, 10);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'ROIC', detail: `${(roic * 100).toFixed(1)}%`, points: Math.round(roicScore), max: 10 });

  // CFO / Net Income (0-5)
  const cfoNiScore = clamp(safeDivide((m.operatingCashflow ?? 0), (m.netIncome ?? 1), 0) * 5, 0, 5);
  breakdown.push({ pillar: 'Balance Sheet', metric: 'CFO/Net Income', detail: `${safeDivide((m.operatingCashflow ?? 0), (m.netIncome ?? 0), 0).toFixed(1)}x`, points: Math.round(cfoNiScore), max: 5 });

  const pillarBalanceSheet = crScore + intCov + cashDebtScore + deScore + altScore + roicScore + cfoNiScore;

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 4: LEADERSHIP (max 15)
  // ═══════════════════════════════════════════════════════════════

  // Analyst Rating score (0-30)
  // Derive from consensus if available, otherwise use earnings trajectory
  const consensusScore = m.epsForward && m.epsTrailing
    ? clamp((m.epsForward / Math.max(m.epsTrailing, 0.01)) * 15, 0, 30)
    : 15;
  breakdown.push({ pillar: 'Leadership', metric: 'Earnings Trajectory', detail: `EPS ${(m.epsTrailing ?? 0).toFixed(2)} -> ${(m.epsForward ?? 0).toFixed(2)}`, points: Math.round(consensusScore), max: 30 });

  // Institutional confidence proxy via market cap (0-30)
  const instScore = clamp(Math.log10((m.marketCap ?? 1e9) + 1) / 12 * 30, 0, 30);
  breakdown.push({ pillar: 'Leadership', metric: 'Market Cap Tier', detail: `$${((m.marketCap ?? 0) / 1e9).toFixed(1)}B`, points: Math.round(instScore), max: 30 });

  // Revenue growth (0-20)
  const revGrowthScore = clamp((m.revenueGrowth ?? 0) / 0.30 * 20, 0, 20);
  breakdown.push({ pillar: 'Leadership', metric: 'Revenue Growth', detail: `${((m.revenueGrowth ?? 0) * 100).toFixed(0)}%`, points: Math.round(revGrowthScore), max: 20 });

  // Margin stability via profit margin (0-20)
  const marginStabilityScore = clamp((m.profitMargin ?? 0) / 0.20 * 20, 0, 20);
  breakdown.push({ pillar: 'Leadership', metric: 'Margin Stability', detail: `${((m.profitMargin ?? 0) * 100).toFixed(1)}%`, points: Math.round(marginStabilityScore), max: 20 });

  const pillarLeadership = consensusScore + instScore + revGrowthScore + marginStabilityScore;

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 5: INNOVATION (max 15)
  // ═══════════════════════════════════════════════════════════════

  // R&D proxy via earnings growth + revenue growth combined (0-40)
  const innovationScore = clamp(((m.earningsGrowth ?? 0) + (m.revenueGrowth ?? 0)) / 0.60 * 40, 0, 40);
  breakdown.push({ pillar: 'Innovation', metric: 'Growth Innovation', detail: `earn ${((m.earningsGrowth ?? 0) * 100).toFixed(0)}% + rev ${((m.revenueGrowth ?? 0) * 100).toFixed(0)}%`, points: Math.round(innovationScore), max: 40 });

  // Sector growth (0-30)
  const sectorGrowthScore = clamp((m.revenueGrowth ?? 0) / 0.20 * 30, 0, 30);
  breakdown.push({ pillar: 'Innovation', metric: 'Sector Growth', detail: `${((m.revenueGrowth ?? 0) * 100).toFixed(0)}%`, points: Math.round(sectorGrowthScore), max: 30 });

  // Market position (0-30)
  const mktPosScore = clamp(Math.log10((m.marketCap ?? 1e9) + 1) / 12 * 30, 0, 30);
  breakdown.push({ pillar: 'Innovation', metric: 'Market Position', detail: `$${((m.marketCap ?? 0) / 1e9).toFixed(1)}B`, points: Math.round(mktPosScore), max: 30 });

  const pillarInnovation = innovationScore + sectorGrowthScore + mktPosScore;

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 6: ETHICS (max 10, pass/fail)
  // ═══════════════════════════════════════════════════════════════

  const pillarEthics = ethics.pass ? 10 : 0;
  breakdown.push({ pillar: 'Ethics', metric: 'Ethics Filter', detail: ethics.pass ? 'PASS' : `FAIL: ${ethics.violations.join(', ')}`, points: pillarEthics, max: 10 });

  // ── Raw totals ────────────────────────────────────────────────────
  const rawTotal =
    pillarFundamentals +
    pillarMarketDynamics +
    pillarBalanceSheet +
    pillarLeadership +
    pillarInnovation +
    pillarEthics;

  // Normalize to 100
  const fundamentalsNorm = (pillarFundamentals / 60) * (w.fundamentals || 30);
  const marketNorm = (pillarMarketDynamics / 120) * (w.marketDynamics || 15);
  const balanceNorm = (pillarBalanceSheet / 125) * (w.balanceSheet || 15);
  const leadershipNorm = (pillarLeadership / 100) * (w.leadership || 15);
  const innovationNorm = (pillarInnovation / 100) * (w.innovation || 15);
  const ethicsNorm = (pillarEthics / 10) * (w.ethics || 10);

  let finalScore = fundamentalsNorm + marketNorm + balanceNorm + leadershipNorm + innovationNorm + ethicsNorm;

  // ── Adjustments ───────────────────────────────────────────────────
  if (peer.peerDelta !== 0) {
    finalScore += peer.peerDelta;
  }
  if (dominance.dominanceBonus) {
    finalScore += dominance.dominanceBonus;
  }

  // Clamp
  finalScore = clamp(finalScore, 0, 100);

  // ── Risk Flags ────────────────────────────────────────────────────
  const riskFlags = analyzeRisks(
    {
      operatingCashflow: m.operatingCashflow,
      debtToEquity: m.debtToEquity,
      margin: m.profitMargin,
      currentRatio: m.currentRatio,
      altmanZRaw: altman.raw,
      piotroskiRaw: piotroski.raw,
    },
    isETF
  );

  // ── Experimental bonus ────────────────────────────────────────────
  if (experimental) {
    const fcfPerShare = safeDivide(m.freeCashflow ?? m.operatingCashflow, m.sharesOutstanding);
    if (fcfPerShare && fcfPerShare > (m.epsTrailing ?? 0) * 1.2) {
      finalScore = clamp(finalScore + 2, 0, 100);
    }
  }

  // ── Narrative ─────────────────────────────────────────────────────
  const { sentence } = generateNarrative(
    (pillarFundamentals / 60) * 100,
    (pillarMarketDynamics / 120) * 100,
    (pillarBalanceSheet / 125) * 100
  );

  return {
    finalScore: Math.round(finalScore),
    pillars: {
      fundamentals: Math.round((pillarFundamentals / 60) * 100),
      marketDynamics: Math.round((pillarMarketDynamics / 120) * 100),
      balanceSheet: Math.round((pillarBalanceSheet / 125) * 100),
      leadership: Math.round((pillarLeadership / 100) * 100),
      innovation: Math.round((pillarInnovation / 100) * 100),
      ethics: pillarEthics * 10,
    },
    riskFlags: riskFlags.flags,
    narrative: sentence,
    ethicsPass: ethics.pass,
    adjustments: {
      peerDelta: peer.peerDelta,
      dominanceBonus: dominance.dominanceBonus,
    },
    breakdown,
    isETF,
    sector: m.sector,
    industry: m.industry,
  };
}

// Helper for safe division with score capping
function safeDivisionScore(numerator: number, denominator: number, maxScore: number): number {
  const ratio = safeDivide(numerator, denominator, 0);
  if (ratio >= 5) return maxScore;
  if (ratio >= 2) return maxScore * 0.8;
  if (ratio >= 1) return maxScore * 0.6;
  if (ratio >= 0.5) return maxScore * 0.4;
  return maxScore * 0.2;
}
