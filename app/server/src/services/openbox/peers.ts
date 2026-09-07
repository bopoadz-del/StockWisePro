/**
 * Sector-relative P/E helpers, ported from stockwisepro-bot OpenBox.
 */

const SECTOR_MEDIAN_PE: Record<string, number> = {
  technology: 28,
  software: 32,
  semiconductors: 25,
  healthcare: 22,
  pharmaceuticals: 18,
  finance: 14,
  banks: 12,
  energy: 10,
  'oil & gas': 10,
  consumer: 20,
  'consumer cyclical': 18,
  'consumer defensive': 22,
  industrials: 18,
  utilities: 16,
  'real estate': 16,
  materials: 14,
  'communication services': 20,
  telecom: 14,
  entertainment: 24,
};

export function getSectorMedianPE(sector?: string, industry?: string): number {
  const keys = [(industry || '').toLowerCase().trim(), (sector || '').toLowerCase().trim()];
  for (const key of keys) {
    if (SECTOR_MEDIAN_PE[key]) return SECTOR_MEDIAN_PE[key];
  }
  return 18;
}

export function scorePeRelative(pe: number, sector?: string, industry?: string): number {
  const median = getSectorMedianPE(sector, industry);
  if (!pe || pe <= 0) return 50;
  const ratio = pe / median;
  return Math.max(0, Math.min(100, 100 - (ratio - 0.5) * 100));
}

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
  const isEarningsGrowing = forwardPE < trailingPE * 0.7;
  const forwardWeight = isEarningsGrowing ? 0.7 : 0.5;
  return trailingScore * (1 - forwardWeight) + forwardScore * forwardWeight;
}

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
  return Math.max(0, Math.min(100, 100 - (ratio - 0.5) * 100));
}
