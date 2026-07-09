/**
 * Scoring API Route
 * Provides OpenBox scoring via REST endpoint.
 * Fetches stock data from Alpha Vantage + Twelve Data, runs scoring engine.
 */

import { Router } from 'express';
import { z } from 'zod';
import { computeOpenBoxScore, DEFAULT_WEIGHTS, ETF_WEIGHTS } from '../services/scoring';
import type { ScoringWeights, StockFundamentals, HistoricalPrice } from '../services/scoring';
import { alphaVantageService } from '../services/alphaVantageService';
import { twelveDataService } from '../services/twelveDataService';
import { prisma } from '../config/database';

const router = Router();

// Helper: fetch fundamentals from Alpha Vantage OVERVIEW endpoint
async function fetchFundamentals(ticker: string): Promise<StockFundamentals | null> {
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
    if (!data || data.Symbol === undefined || data.Symbol === null) {
      return null;
    }

    // Parse numeric fields safely
    const parseNum = (val: unknown): number | undefined => {
      if (val === undefined || val === null || val === 'None' || val === '') return undefined;
      const n = typeof val === 'string' ? parseFloat(val) : Number(val);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      ticker: ticker.toUpperCase(),
      price: 0, // Will be filled from quote
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
      revenuePerShare: parseNum(data.RevenuePerShareTTM),
      epsTrailing: parseNum(data.EPS),
      epsForward: parseNum(data.ForwardEPS),
      pegRatio: parseNum(data.PEGRatio),
      // ETF-specific fields
      expenseRatio: parseNum(data.ExpenseRatio),
      fundFamily: data.FundFamily || undefined,
      fundCategory: data.FundCategory || undefined,
      fundStdDev: parseNum(data.FundStandardDeviation),
      fundSharpe: parseNum(data.FundSharpeRatio),
      fundBeta: parseNum(data.FundBeta),
      ytdReturn: parseNum(data.YTDReturn),
      oneYearReturn: parseNum(data.OneYearReturn),
      threeYearReturn: parseNum(data.ThreeYearReturn),
      fiveYearReturn: parseNum(data.FiveYearReturn),
      tenYearReturn: parseNum(data.TenYearReturn),
    };
  } catch (error: any) {
    console.error(`Error fetching fundamentals for ${ticker}:`, error.message);
    return null;
  }
}

// Helper: fetch price + historical data
async function fetchPriceData(ticker: string): Promise<{
  quote: { price: number; volume: number } | null;
  historical: HistoricalPrice[];
}> {
  // Try Twelve Data first (better rate limits)
  const quote = await twelveDataService.getQuote(ticker);
  const historical = await twelveDataService.getHistoricalPrices(ticker);

  if (quote && historical.length > 0) {
    return {
      quote: { price: quote.price, volume: quote.volume },
      historical: historical.map(h => ({
        date: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume,
      })),
    };
  }

  // Fallback to Alpha Vantage
  const avQuote = await alphaVantageService.getQuote(ticker);
  const avHistorical = await alphaVantageService.getHistoricalPrices(ticker);

  return {
    quote: avQuote ? { price: avQuote.price, volume: avQuote.volume } : null,
    historical: avHistorical.map(h => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
    })),
  };
}

// ─── POST /api/score ───────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const schema = z.object({
      ticker: z.string().min(1).max(10).transform(s => s.toUpperCase()),
      weights: z.object({
        fundamentals: z.number().min(0).max(100).optional(),
        marketDynamics: z.number().min(0).max(100).optional(),
        balanceSheet: z.number().min(0).max(100).optional(),
        leadership: z.number().min(0).max(100).optional(),
        innovation: z.number().min(0).max(100).optional(),
        ethics: z.number().min(0).max(100).optional(),
      }).optional(),
      experimental: z.boolean().optional(),
    });

    const { ticker, weights: customWeights, experimental } = schema.parse(req.body);

    // Fetch data in parallel
    const [fundamentals, priceData] = await Promise.all([
      fetchFundamentals(ticker),
      fetchPriceData(ticker),
    ]);

    if (!fundamentals) {
      return res.status(404).json({
        error: 'Fundamentals not found',
        message: `Could not fetch fundamental data for ${ticker}. The ticker may be invalid or the API rate limit may have been reached.`,
      });
    }

    if (priceData.historical.length < 30) {
      return res.status(404).json({
        error: 'Insufficient price data',
        message: `Need at least 30 days of price history for ${ticker}, got ${priceData.historical.length}.`,
      });
    }

    // Merge price into fundamentals
    if (priceData.quote) {
      fundamentals.price = priceData.quote.price;
    }

    // Build weights
    const weights: ScoringWeights = customWeights
      ? {
          fundamentals: customWeights.fundamentals ?? DEFAULT_WEIGHTS.fundamentals,
          marketDynamics: customWeights.marketDynamics ?? DEFAULT_WEIGHTS.marketDynamics,
          balanceSheet: customWeights.balanceSheet ?? DEFAULT_WEIGHTS.balanceSheet,
          leadership: customWeights.leadership ?? DEFAULT_WEIGHTS.leadership,
          innovation: customWeights.innovation ?? DEFAULT_WEIGHTS.innovation,
          ethics: customWeights.ethics ?? DEFAULT_WEIGHTS.ethics,
        }
      : DEFAULT_WEIGHTS;

    // Run scoring engine
    const result = computeOpenBoxScore(
      {
        ticker,
        fundamentals,
        historicalPrices: priceData.historical,
      },
      weights,
      experimental ?? false
    );

    // Store score history in database (async, don't await)
    storeScoreHistory(ticker, result.finalScore, result.pillars).catch(console.error);

    res.json({
      ticker,
      score: result.finalScore,
      grade: scoreToGrade(result.finalScore),
      pillars: result.pillars,
      narrative: result.narrative,
      ethicsPass: result.ethicsPass,
      riskFlags: result.riskFlags,
      adjustments: result.adjustments,
      isETF: result.isETF,
      breakdown: result.breakdown,
      fundamentals: {
        price: fundamentals.price,
        marketCap: fundamentals.marketCap,
        trailingPE: fundamentals.trailingPE,
        forwardPE: fundamentals.forwardPE,
        priceToBook: fundamentals.priceToBook,
        beta: fundamentals.beta,
        dividendYield: fundamentals.dividendYield,
        roe: fundamentals.roe,
        profitMargin: fundamentals.profitMargin,
        revenueGrowth: fundamentals.revenueGrowth,
        earningsGrowth: fundamentals.earningsGrowth,
        sector: fundamentals.sector,
        industry: fundamentals.industry,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Score error:', error);
    res.status(500).json({ error: 'Failed to compute score', message: error.message });
  }
});

// ─── GET /api/score/:ticker ────────────────────────────────────────

router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    const [fundamentals, priceData] = await Promise.all([
      fetchFundamentals(ticker),
      fetchPriceData(ticker),
    ]);

    if (!fundamentals) {
      return res.status(404).json({
        error: 'Fundamentals not found',
        message: `Could not fetch fundamental data for ${ticker}.`,
      });
    }

    if (priceData.historical.length < 30) {
      return res.status(404).json({
        error: 'Insufficient price data',
        message: `Need at least 30 days of price history for ${ticker}, got ${priceData.historical.length}.`,
      });
    }

    if (priceData.quote) {
      fundamentals.price = priceData.quote.price;
    }

    const result = computeOpenBoxScore({
      ticker,
      fundamentals,
      historicalPrices: priceData.historical,
    });

    storeScoreHistory(ticker, result.finalScore, result.pillars).catch(console.error);

    res.json({
      ticker,
      score: result.finalScore,
      grade: scoreToGrade(result.finalScore),
      pillars: result.pillars,
      narrative: result.narrative,
      ethicsPass: result.ethicsPass,
      riskFlags: result.riskFlags,
      adjustments: result.adjustments,
      isETF: result.isETF,
      breakdown: result.breakdown,
      fundamentals: {
        price: fundamentals.price,
        marketCap: fundamentals.marketCap,
        trailingPE: fundamentals.trailingPE,
        forwardPE: fundamentals.forwardPE,
        priceToBook: fundamentals.priceToBook,
        beta: fundamentals.beta,
        dividendYield: fundamentals.dividendYield,
        roe: fundamentals.roe,
        profitMargin: fundamentals.profitMargin,
        revenueGrowth: fundamentals.revenueGrowth,
        earningsGrowth: fundamentals.earningsGrowth,
        sector: fundamentals.sector,
        industry: fundamentals.industry,
      },
    });
  } catch (error: any) {
    console.error('Score GET error:', error);
    res.status(500).json({ error: 'Failed to compute score', message: error.message });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────

function scoreToGrade(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

async function storeScoreHistory(
  ticker: string,
  score: number,
  pillars: OpenBoxScore['pillars']
): Promise<void> {
  try {
    // Check if ScoreHistory table exists in Prisma schema
    // If not, this silently fails
    await prisma.$executeRaw`
      INSERT INTO score_history (ticker, score, fundamentals, market_dynamics, balance_sheet, leadership, innovation, ethics, created_at)
      VALUES (${ticker}, ${score}, ${pillars.fundamentals}, ${pillars.marketDynamics}, ${pillars.balanceSheet}, ${pillars.leadership}, ${pillars.innovation}, ${pillars.ethics}, NOW())
    `.catch(() => {
      // Table may not exist yet - silently ignore
    });
  } catch {
    // Silently ignore DB errors for score history
  }
}

export default router;
