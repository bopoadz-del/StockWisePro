import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { calculateRSI, computeStockScore } from './engine';
import { resolveWeights, WEIGHT_PRESETS } from './weights';
import { UnknownTickerError } from './types';
import type { FmpEnrichment, HistoricalBar, ScoreDataProviders, YahooQuoteSummary } from './types';

const yahooAapl = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/yahoo-aapl.json'), 'utf8')
) as YahooQuoteSummary;

const fmpAapl = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/fmp-aapl.json'), 'utf8')
) as FmpEnrichment;

function series(start: number, days: number, dailyReturn: number): HistoricalBar[] {
  const bars: HistoricalBar[] = [];
  let price = start;
  const startDate = new Date('2024-01-02T00:00:00Z');
  for (let i = 0; i < days; i++) {
    price = price * (1 + dailyReturn);
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);
    bars.push({ date: date.toISOString().split('T')[0], close: Math.round(price * 100) / 100 });
  }
  return bars;
}

function providers(overrides: Partial<ScoreDataProviders> = {}): ScoreDataProviders {
  return {
    getQuoteSummary: async () => yahooAapl,
    getHistory: async () => series(150, 252, 0.0012),
    getFmpEnrichment: async () => null,
    ...overrides,
  };
}

describe('OpenBox web scoring engine', () => {
  it('scores without an FMP key and only reports yahoo as a source', async () => {
    const result = await computeStockScore('AAPL', { providers: providers() });

    expect(result.ticker).toBe('AAPL');
    expect(result.sources).toEqual(['yahoo']);
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
    expect(result.action).toMatch(/buy|hold|sell/);
    expect(result.pillars.valuation).toBeGreaterThan(0);
    expect(result.pillars.momentum).not.toBe(50);
    expect(result.quote.price).toBe(190);
    expect(result.breakdown.length).toBeGreaterThan(8);
  });

  it('uses FMP enrichment when provided and lists fmp as a source', async () => {
    const yahooOnly = await computeStockScore('AAPL', {
      providers: providers({
        getQuoteSummary: async () => ({
          ...yahooAapl,
          financialData: {
            ...yahooAapl.financialData,
            returnOnAssets: undefined,
            revenueGrowth: undefined,
          },
        }),
        getFmpEnrichment: async () => null,
      }),
    });

    const withFmp = await computeStockScore('AAPL', {
      providers: providers({
        getQuoteSummary: async () => ({
          ...yahooAapl,
          financialData: {
            ...yahooAapl.financialData,
            returnOnAssets: undefined,
            revenueGrowth: undefined,
          },
        }),
        getFmpEnrichment: async () => fmpAapl,
      }),
    });

    expect(withFmp.sources).toEqual(['yahoo', 'fmp']);
    expect(withFmp.metrics.roa).toBeCloseTo(0.3, 5);
    expect(withFmp.metrics.revenueGrowth).toBeCloseTo(0.09, 5);
    expect(yahooOnly.sources).toEqual(['yahoo']);
    expect(yahooOnly.warnings.some((w) => w.includes('ROA'))).toBe(true);
    expect(withFmp.warnings.some((w) => w.includes('ROA'))).toBe(false);
  });

  it('still scores from chart history when quoteSummary is missing', async () => {
    const result = await computeStockScore('AAPL', {
      providers: providers({
        getQuoteSummary: async () => ({
          price: {
            shortName: 'Apple Inc.',
            quoteType: 'EQUITY',
            regularMarketPrice: 190,
          },
        }),
      }),
    });

    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.sources).toEqual(['yahoo']);
    expect(result.warnings.some((w) => w.includes('quoteSummary') || w.includes('defaulted'))).toBe(true);
    expect(result.pillars.momentum).not.toBe(50);
  });

  it('returns a clear unknown-ticker error', async () => {
    await expect(
      computeStockScore('ZZZZNOTATICKER', {
        providers: providers({
          getQuoteSummary: async () => null,
          getHistory: async () => [],
          getFmpEnrichment: async () => null,
        }),
      })
    ).rejects.toBeInstanceOf(UnknownTickerError);

    try {
      await computeStockScore('NOPE', {
        providers: {
          getQuoteSummary: async () => null,
          getHistory: async () => [],
          getFmpEnrichment: async () => null,
        },
      });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownTickerError);
      expect((error as UnknownTickerError).message).toMatch(/Unknown ticker: NOPE/);
    }
  });

  it('computes momentum from real price history instead of a constant 50', async () => {
    const rising = await computeStockScore('AAPL', {
      providers: providers({ getHistory: async () => series(100, 252, 0.002) }),
    });
    const falling = await computeStockScore('AAPL', {
      providers: providers({ getHistory: async () => series(200, 252, -0.002) }),
    });

    expect(rising.pillars.momentum).not.toBe(50);
    expect(falling.pillars.momentum).not.toBe(50);
    expect(rising.pillars.momentum).toBeGreaterThan(falling.pillars.momentum);
    expect(rising.breakdown.find((r) => r.pillar === 'momentum' && r.metric === 'Multi-timeframe')).toBeTruthy();
  });

  it('applies web UI weight presets', async () => {
    const value = await computeStockScore('AAPL', {
      preset: 'value',
      providers: providers(),
    });
    const growth = await computeStockScore('AAPL', {
      preset: 'growth',
      providers: providers(),
    });

    expect(value.weights).toEqual(WEIGHT_PRESETS.value);
    expect(growth.weights).toEqual(WEIGHT_PRESETS.growth);
    expect(value.preset).toBe('value');
    expect(resolveWeights('quality').profitability).toBe(45);
  });

  it('warns when a pillar metric is missing and still returns a score', async () => {
    const thinSummary: YahooQuoteSummary = {
      price: {
        shortName: 'Thin Corp',
        quoteType: 'EQUITY',
        regularMarketPrice: { raw: 42 },
      },
      summaryDetail: {
        previousClose: { raw: 40 },
        marketCap: { raw: 1000000000 },
      },
      summaryProfile: { sector: 'Industrials' },
    };

    const result = await computeStockScore('THIN', {
      providers: providers({
        getQuoteSummary: async () => thinSummary,
        getHistory: async () => series(40, 40, 0.001),
      }),
    });

    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('defaulted'))).toBe(true);
    expect(result.sources).toEqual(['yahoo']);
  });
});

describe('RSI helper', () => {
  it('returns undefined until 15 closes are available', () => {
    expect(calculateRSI([1, 2, 3])).toBeUndefined();
    expect(calculateRSI(Array.from({ length: 15 }, (_, i) => 10 + i))).toBeGreaterThan(50);
  });
});
