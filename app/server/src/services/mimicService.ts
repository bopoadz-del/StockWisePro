import {
  allocationMap,
  resolveInvestor,
  sizeHoldings,
  type SizedPortfolio,
} from '../data/investorAllocations';

export type PriceLookup = (tickers: string[]) => Promise<Record<string, number>>;

async function defaultPriceLookup(tickers: string[]): Promise<Record<string, number>> {
  const { stockPriceService } = await import('./stockPriceService');
  return stockPriceService.getQuotes(tickers);
}

/**
 * Build a sized mimic portfolio from a known investor id and live/cached prices.
 * `getPrices` is injectable so tests can supply a mocked quote map.
 */
export async function buildMimicPortfolio(
  investorInput: string,
  budget: number,
  getPrices: PriceLookup = defaultPriceLookup
): Promise<SizedPortfolio> {
  const book = resolveInvestor(investorInput);
  const tickers = book.holdings.map((h) => h.ticker);
  const prices = await getPrices(tickers);
  return sizeHoldings(book, budget, prices);
}

export function mimicAllocationSnapshot(investorInput: string): Record<string, number> {
  return allocationMap(resolveInvestor(investorInput));
}
