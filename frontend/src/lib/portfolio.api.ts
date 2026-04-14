import { apiFetch } from './api-client';

export interface PortfolioListItem {
  id: number;
  name: string;
  created_at: string;
}

export interface HoldingItem {
  id: number;
  portfolio_id: number;
  symbol: string;
  quantity: number;
  average_price: number;
}

export interface PortfolioSummary {
  id: number;
  name: string;
  holdings: HoldingItem[];
  total_invested: number;
}

export interface CreatePortfolioPayload {
  name: string;
}

export interface AddHoldingPayload {
  symbol: string;
  quantity: number;
  average_price: number;
}

export interface RecordTransactionPayload {
  symbol: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

export interface MptOptimizationResult {
  weights: Record<string, number>;
  expected_annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
}

export const portfolioApi = {
  list: (): Promise<PortfolioListItem[]> =>
    apiFetch<PortfolioListItem[]>('/portfolios/'),

  create: (payload: CreatePortfolioPayload): Promise<PortfolioListItem> =>
    apiFetch<PortfolioListItem>('/portfolios/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSummary: (id: number): Promise<PortfolioSummary> =>
    apiFetch<PortfolioSummary>(`/portfolios/${id}/summary`),

  addHolding: (id: number, payload: AddHoldingPayload) =>
    apiFetch(`/portfolios/${id}/holdings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  recordTransaction: (id: number, payload: RecordTransactionPayload) =>
    apiFetch(`/portfolios/${id}/transactions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  optimize: (id: number): Promise<MptOptimizationResult> =>
    apiFetch<MptOptimizationResult>(`/portfolios/${id}/optimize`),
};
