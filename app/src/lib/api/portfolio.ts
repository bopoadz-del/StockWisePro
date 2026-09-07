import { apiClient } from './client';

export interface MimicHolding {
  ticker: string;
  name: string;
  weight: number;
  price: number;
  shares: number;
  allocated: number;
}

export interface MimicResult {
  investor: string;
  investorName: string;
  budget: number;
  holdings: MimicHolding[];
  totalAllocated: number;
  residualCash: number;
}

export const portfolioApi = {
  previewMimic: (investor: string, budget: number) =>
    apiClient.post<MimicResult>('/portfolio/mimic', { investor, budget }),

  mimicPortfolio: (portfolioId: string, investor: string, budget: number) =>
    apiClient.post<MimicResult>(`/portfolio/${portfolioId}/mimic`, { investor, budget }),
};
