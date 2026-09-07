import { describe, expect, it } from 'vitest';
import {
  CANONICAL_INVESTOR_IDS,
  INVESTOR_BOOKS,
  isMissingPricesError,
  isUnknownInvestorError,
  resolveInvestor,
  resolveInvestorId,
  sizeHoldings,
  sumWeights,
} from './investorAllocations';

const ALIASES: Record<string, string> = {
  buffett: 'warren_buffett',
  dalio: 'ray_dalio',
  wood: 'cathie_wood',
  lynch: 'peter_lynch',
  graham: 'benjamin_graham',
  soros: 'george_soros',
  druckenmiller: 'stanley_druckenmiller',
  ackman: 'bill_ackman',
  templeton: 'john_templeton',
  marks: 'howard_marks',
  simons: 'jim_simons',
  icahn: 'carl_icahn',
};

describe('investor book', () => {
  it('resolves all 12 canonical ids', () => {
    expect(CANONICAL_INVESTOR_IDS).toHaveLength(12);
    for (const id of CANONICAL_INVESTOR_IDS) {
      const book = resolveInvestor(id);
      expect(book.id).toBe(id);
      expect(book.holdings.length).toBeGreaterThan(0);
    }
  });

  it('resolves short ids and snake_case aliases to the same book', () => {
    for (const [shortId, alias] of Object.entries(ALIASES)) {
      expect(resolveInvestorId(shortId)).toBe(shortId);
      expect(resolveInvestorId(alias)).toBe(shortId);
      expect(resolveInvestor(alias).id).toBe(resolveInvestor(shortId).id);
    }
  });

  it('keeps every book summing to ~100%', () => {
    for (const id of CANONICAL_INVESTOR_IDS) {
      const sum = sumWeights(INVESTOR_BOOKS[id].holdings);
      expect(sum).toBeCloseTo(1, 3);
    }
  });

  it('rejects an unknown investor', () => {
    try {
      resolveInvestor('not_a_legend');
      throw new Error('expected unknown investor to throw');
    } catch (error) {
      expect(isUnknownInvestorError(error)).toBe(true);
    }
    expect(resolveInvestorId('not_a_legend')).toBeNull();
  });
});

describe('sizeHoldings', () => {
  const prices = {
    AAPL: 200,
    BAC: 40,
    AXP: 250,
    KO: 60,
    CVX: 150,
    OXY: 50,
    KHC: 35,
    MCO: 400,
    CB: 250,
    V: 280,
  };

  it('sizes whole shares from live prices instead of a placeholder divisor', () => {
    const result = sizeHoldings(INVESTOR_BOOKS.buffett, 10_000, prices);

    const apple = result.holdings.find((h) => h.ticker === 'AAPL');
    expect(apple).toBeDefined();
    expect(apple!.price).toBe(200);
    expect(apple!.weight).toBe(0.502);
    expect(apple!.shares).toBe(Math.floor((10_000 * 0.502) / 200));
    expect(apple!.allocated).toBe(apple!.shares * 200);
    expect(apple!.shares).not.toBe(Math.floor((10_000 * 0.502) / 100));
  });

  it('returns residual cash as budget minus allocated whole-share dollars', () => {
    const result = sizeHoldings(INVESTOR_BOOKS.buffett, 10_000, prices);
    const spent = result.holdings.reduce((sum, h) => sum + h.shares * h.price, 0);

    expect(result.totalAllocated).toBeCloseTo(spent, 2);
    expect(result.residualCash).toBeCloseTo(10_000 - spent, 2);
    expect(result.residualCash).toBeGreaterThanOrEqual(0);
    expect(result.totalAllocated + result.residualCash).toBeCloseTo(10_000, 2);
  });

  it('fails when a required price is missing', () => {
    try {
      sizeHoldings(INVESTOR_BOOKS.buffett, 10_000, { AAPL: 200 });
      throw new Error('expected missing prices to throw');
    } catch (error) {
      expect(isMissingPricesError(error)).toBe(true);
    }
  });
});
