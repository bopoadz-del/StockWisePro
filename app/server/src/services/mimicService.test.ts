import { describe, expect, it } from 'vitest';
import { CANONICAL_INVESTOR_IDS, isUnknownInvestorError } from '../data/investorAllocations';
import { buildMimicPortfolio } from './mimicService';

function mockPrices(tickers: string[]): Record<string, number> {
  return Object.fromEntries(tickers.map((ticker, index) => [ticker, 20 + index * 5]));
}

describe('buildMimicPortfolio', () => {
  it('builds a sized book for every canonical and alias id', async () => {
    const aliases = [
      'warren_buffett',
      'ray_dalio',
      'cathie_wood',
      'peter_lynch',
      'benjamin_graham',
      'george_soros',
      'stanley_druckenmiller',
      'bill_ackman',
      'john_templeton',
      'howard_marks',
      'jim_simons',
      'carl_icahn',
    ];

    for (const id of [...CANONICAL_INVESTOR_IDS, ...aliases]) {
      const result = await buildMimicPortfolio(id, 25_000, async (tickers) => mockPrices(tickers));
      expect(CANONICAL_INVESTOR_IDS).toContain(result.investor);
      expect(result.holdings.length).toBeGreaterThan(0);
      expect(result.holdings.every((h) => h.price > 0 && Number.isInteger(h.shares))).toBe(true);
      expect(result.totalAllocated + result.residualCash).toBeCloseTo(25_000, 2);
    }
  });

  it('uses mocked prices for share math and leftover cash', async () => {
    const result = await buildMimicPortfolio('dalio', 10_000, async () => ({
      SPY: 500,
      TLT: 90,
      VGIT: 60,
      GLD: 180,
      DBC: 22,
    }));

    const spy = result.holdings.find((h) => h.ticker === 'SPY');
    expect(spy?.shares).toBe(Math.floor((10_000 * 0.3) / 500));
    expect(spy?.allocated).toBe((spy?.shares ?? 0) * 500);
    expect(result.residualCash).toBeCloseTo(10_000 - result.totalAllocated, 2);
  });

  it('throws a clear unknown-investor error', async () => {
    await expect(
      buildMimicPortfolio('made_up_investor', 5000, async () => ({}))
    ).rejects.toSatisfy((error) => isUnknownInvestorError(error));
  });
});
