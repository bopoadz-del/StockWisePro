import type { ScoringWeights, WeightPreset } from './types';

export const DEFAULT_WEIGHTS: ScoringWeights = {
  valuation: 25,
  profitability: 25,
  growth: 20,
  financialHealth: 15,
  momentum: 15,
};

export const WEIGHT_PRESETS: Record<WeightPreset, ScoringWeights> = {
  balanced: DEFAULT_WEIGHTS,
  value: {
    valuation: 40,
    profitability: 25,
    growth: 10,
    financialHealth: 15,
    momentum: 10,
  },
  growth: {
    valuation: 10,
    profitability: 20,
    growth: 45,
    financialHealth: 10,
    momentum: 15,
  },
  quality: {
    valuation: 15,
    profitability: 45,
    growth: 15,
    financialHealth: 20,
    momentum: 5,
  },
};

export function resolveWeights(
  preset?: WeightPreset,
  override?: Partial<ScoringWeights>
): ScoringWeights {
  const base = preset && WEIGHT_PRESETS[preset] ? { ...WEIGHT_PRESETS[preset] } : { ...DEFAULT_WEIGHTS };
  const merged: ScoringWeights = {
    valuation: override?.valuation ?? base.valuation,
    profitability: override?.profitability ?? base.profitability,
    growth: override?.growth ?? base.growth,
    financialHealth: override?.financialHealth ?? base.financialHealth,
    momentum: override?.momentum ?? base.momentum,
  };

  const total = Object.values(merged).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };

  if (total === 100) return merged;

  const factor = 100 / total;
  const normalized: ScoringWeights = {
    valuation: merged.valuation * factor,
    profitability: merged.profitability * factor,
    growth: merged.growth * factor,
    financialHealth: merged.financialHealth * factor,
    momentum: merged.momentum * factor,
  };

  return normalized;
}

export function actionFromScore(score: number): 'buy' | 'hold' | 'sell' {
  if (score >= 70) return 'buy';
  if (score >= 40) return 'hold';
  return 'sell';
}
