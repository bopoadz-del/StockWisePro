/**
 * Peer comparison using sector median P/E.
 * Enhanced with sector-relative scoring for fair valuation across industries.
 */

// Sector median P/E - updated quarterly
const SECTOR_MEDIAN_PE: Record<string, number> = {
  'technology': 28,
  'software': 32,
  'semiconductors': 25,
  'healthcare': 22,
  'pharmaceuticals': 18,
  'finance': 14,
  'banks': 12,
  'energy': 10,
  'oil & gas': 10,
  'consumer': 20,
  'consumer cyclical': 18,
  'consumer defensive': 22,
  'industrials': 18,
  'utilities': 16,
  'real estate': 16,
  'materials': 14,
  'communication services': 20,
  'telecom': 14,
  'entertainment': 24,
};

export interface PeerResult {
  peerDelta: number; // clamped -4 to +4
  sector?: string;
  industry?: string;
  sectorMedianPE?: number;
}

/**
 * Get sector median P/E for a given sector/industry
 */
export function getSectorMedianPE(sector?: string, industry?: string): number {
  const lookupKeys = [
    (industry || '').toLowerCase().trim(),
    (sector || '').toLowerCase().trim(),
  ];

  for (const key of lookupKeys) {
    if (SECTOR_MEDIAN_PE[key]) {
      return SECTOR_MEDIAN_PE[key];
    }
  }

  return 18; // Default fallback
}

/**
 * Compute peer delta based on how P/E compares to sector median.
 * Negative PE = expensive vs peers (penalty)
 * Positive PE = cheap vs peers (bonus)
 */
export function computePeerDelta(
  pe: number,
  sector?: string,
  industry?: string
): PeerResult {
  const median = getSectorMedianPE(sector, industry);

  if (!Number.isFinite(pe) || pe <= 0) {
    return { peerDelta: 0, sector, industry, sectorMedianPE: median };
  }

  const rawDelta = ((median - pe) / median) * 10;
  const peerDelta = Math.max(-4, Math.min(4, Math.round(rawDelta)));

  return { peerDelta, sector, industry, sectorMedianPE: median };
}

/**
 * NEW: Score P/E relative to sector median.
 * A utility with P/E 23 isn't expensive - that's normal for utilities.
 * This replaces the fixed threshold scoring from the original engine.
 * 
 * @param pe - Trailing P/E ratio
 * @param sector - Stock sector
 * @param industry - Stock industry
 * @returns Score 0-100 relative to sector
 */
export function scorePeRelative(pe: number, sector?: string, industry?: string): number {
  const median = getSectorMedianPE(sector, industry);

  if (!pe || pe <= 0) return 50;

  // Score 100 at 0.5x median (very cheap), 50 at 1x median (fair), 0 at 2x median (very expensive)
  const ratio = pe / median;
  return Math.max(0, Math.min(100, 100 - (ratio - 0.5) * 100));
}

/**
 * NEW: Blend trailing and forward P/E for a more accurate valuation score.
 * Forward P/E captures earnings trajectory that trailing P/E misses.
 * 
 * @param trailingPE - Trailing P/E
 * @param forwardPE - Forward P/E
 * @param sector - Stock sector
 * @param industry - Stock industry
 * @returns Score 0-100
 */
export function scorePeBlended(
  trailingPE: number,
  forwardPE: number | undefined,
  sector?: string,
  industry?: string
): number {
  if (!forwardPE || forwardPE <= 0) {
    return scorePeRelative(trailingPE, sector, industry);
  }

  const trailingScore = scorePeRelative(trailingPE, sector, industry);
  const forwardScore = scorePeRelative(forwardPE, sector, industry);

  // Weight forward more when earnings are growing into it
  const isEarningsGrowing = forwardPE < trailingPE * 0.7;
  const forwardWeight = isEarningsGrowing ? 0.7 : 0.5;

  return trailingScore * (1 - forwardWeight) + forwardScore * forwardWeight;
}

/**
 * NEW: ROE-adjusted P/E scoring.
 * A company earning 30% ROE deserves a higher P/E than one earning 5%.
 * Justified P/E ≈ ROE * retention_ratio * 100
 * 
 * @param pe - P/E ratio
 * @param roe - Return on equity (0.30 = 30%)
 * @param sector - Stock sector
 * @param industry - Stock industry
 * @returns Score 0-100
 */
export function scorePeROEAdjusted(
  pe: number,
  roe: number | undefined,
  sector?: string,
  industry?: string
): number {
  if (!roe || roe <= 0 || !pe || pe <= 0) {
    return scorePeRelative(pe, sector, industry);
  }

  const justifiedPE = Math.max(10, roe * 100 * 0.8);
  const ratio = pe / justifiedPE;

  // Score 100 at 0.5x justified, 50 at 1x, 0 at 2x
  return Math.max(0, Math.min(100, 100 - (ratio - 0.5) * 100));
}
