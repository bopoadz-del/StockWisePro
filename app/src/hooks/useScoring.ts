import { useState, useCallback, useMemo } from 'react';
import type { ScoringWeights } from '@/types';
import { useLocalStorage } from './useLocalStorage';

const defaultWeights: ScoringWeights = {
  valuation: 25,
  profitability: 25,
  growth: 20,
  financialHealth: 15,
  momentum: 15,
};

export function useScoring() {
  const [weights, setWeights] = useLocalStorage<ScoringWeights>('scoring-weights', defaultWeights);
  const [isCustomized, setIsCustomized] = useState(false);

  const updateWeight = useCallback((key: keyof ScoringWeights, value: number) => {
    setWeights((prev) => {
      const newWeights = { ...prev, [key]: value };
      setIsCustomized(true);
      return newWeights;
    });
  }, [setWeights]);

  const resetWeights = useCallback(() => {
    setWeights(defaultWeights);
    setIsCustomized(false);
  }, [setWeights]);

  const totalWeight = useMemo(() => {
    return Object.values(weights).reduce((sum, w) => sum + w, 0);
  }, [weights]);

  const isValid = useMemo(() => {
    return totalWeight === 100;
  }, [totalWeight]);

  const normalizedWeights = useMemo(() => {
    if (totalWeight === 0) return defaultWeights;
    const factor = 100 / totalWeight;
    return {
      valuation: Math.round(weights.valuation * factor),
      profitability: Math.round(weights.profitability * factor),
      growth: Math.round(weights.growth * factor),
      financialHealth: Math.round(weights.financialHealth * factor),
      momentum: Math.round(weights.momentum * factor),
    };
  }, [weights, totalWeight]);

  const presets = useMemo(() => ({
    balanced: defaultWeights,
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
  }), []);

  const applyPreset = useCallback((presetName: keyof typeof presets) => {
    setWeights(presets[presetName]);
    setIsCustomized(true);
  }, [presets, setWeights]);

  return {
    weights,
    normalizedWeights,
    updateWeight,
    resetWeights,
    totalWeight,
    isValid,
    isCustomized,
    presets,
    applyPreset,
  };
}
