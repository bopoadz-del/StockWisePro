export {
  computeOpenBoxScore,
} from './engine';

export {
  checkEthics,
  type EthicsResult,
} from './ethics';

export {
  computePeerDelta,
  scorePeRelative,
  scorePeBlended,
  scorePeROEAdjusted,
  type PeerResult,
} from './peers';

export {
  checkDominance,
  type DominanceResult,
} from './dominance';

export {
  analyzeRisks,
  type RiskFlags,
  type RiskMetrics,
} from './risks';

export {
  generateNarrative,
  type NarrativeResult,
} from './narrative';

export {
  type ScoringInput,
  type OpenBoxScore,
  type ScoreRule,
  type StockFundamentals,
  type HistoricalPrice,
  type ScoringWeights,
  type PiotroskiResult,
  type AltmanResult,
  DEFAULT_WEIGHTS,
  ETF_WEIGHTS,
} from './types';
