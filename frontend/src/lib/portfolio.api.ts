import { apiFetch } from './api-client';

export interface PortfolioListItem {
  id: number;
  name: string;
  created_at: string;
}

export interface HoldingItem {
  id: number;
  portfolio_id?: number;
  symbol: string;
  quantity: number;
  average_price: number;
  total_invested?: number;
  cost_basis?: number;
  current_price?: number | null;
  current_value?: number | null;
  unrealized_pl?: number | null;
  unrealized_pl_pct?: number | null;
  realized_pl?: number;
  realized_pl_pct?: number;
  first_purchase_date?: string | null;
  last_price_update?: string | null;
}

export interface PortfolioSummary {
  id: number;
  name: string;
  holdings: HoldingItem[];
  total_invested: number;
  total_holdings: number;
  total_current_value?: number | null;
  total_unrealized_pl?: number | null;
  total_unrealized_pl_pct?: number | null;
  total_realized_pl?: number | null;
  market_value?: number | null;
}

export interface CreatePortfolioPayload {
  name: string;
}

export interface AddHoldingPayload {
  symbol: string;
  quantity: number;
  price: number;
}

export interface RecordTransactionPayload {
  symbol: string;
  transaction_type: 'buy' | 'sell';
  quantity: number;
  price: number;
}

export interface SellHoldingPayload {
  quantity: number;
  price: number;
}

export interface SellResponse {
  status: string;
  message: string;
  realized_pl: number;
  remaining_quantity: number;
}

export interface MptOptimizationResult {
  weights: Record<string, number>;
  expected_annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
}

export const portfolioApi = {
  list: async (): Promise<PortfolioListItem[]> => {
    const list = await apiFetch<PortfolioListItem[]>('/api/v1/portfolios/');
    if (list.length === 0) {
      try {
        const created = await apiFetch<PortfolioListItem>('/api/v1/portfolios/', {
          method: 'POST',
          body: JSON.stringify({ name: 'Portfolio 1' }),
        });
        return [created];
      } catch (e) {
        // If creation fails (e.g. not authenticated), just return empty
        return list;
      }
    }
    return list;
  },

  create: (payload: CreatePortfolioPayload): Promise<PortfolioListItem> =>
    apiFetch<PortfolioListItem>('/api/v1/portfolios/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSummary: (id: number): Promise<PortfolioSummary> =>
    apiFetch<PortfolioSummary>(`/api/v1/portfolios/${id}/summary`),

  addHolding: (id: number, payload: AddHoldingPayload) =>
    apiFetch(`/api/v1/portfolios/${id}/holdings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  recordTransaction: (id: number, payload: RecordTransactionPayload) =>
    apiFetch(`/api/v1/portfolios/${id}/transactions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Buy shares — records a BUY transaction and updates holding */
  buyHolding: (portfolioId: number, symbol: string, quantity: number, price: number) =>
    apiFetch(`/api/v1/portfolios/${portfolioId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        symbol,
        transaction_type: 'buy',
        quantity,
        price,
      }),
    }),

  /** Sell shares — calculates FIFO realized P&L */
  sellHolding: (portfolioId: number, symbol: string, payload: SellHoldingPayload): Promise<SellResponse> =>
    apiFetch<SellResponse>(`/api/v1/portfolios/${portfolioId}/holdings/${encodeURIComponent(symbol)}/sell`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  optimize: (id: number): Promise<MptOptimizationResult> =>
    apiFetch<MptOptimizationResult>(`/api/v1/portfolios/${id}/optimize`),
};
