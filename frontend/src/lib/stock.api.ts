import { apiFetch } from './api-client';

export interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FullStockData {
  symbol: string;
  current_price: number;
  currency: string;
  exchange: string;
  market_state: string;
  previous_close: number;
  day_high: number;
  day_low: number;
  volume: number;
  market_cap: number | null;
  pe_ratio: number | null;
  rsi: number | null;
  sma: number | null;
  ema: number | null;
  timestamp: string;
}

export interface StockHistoryResponse {
  symbol: string;
  period: string;
  interval: string;
  candles: HistoricalCandle[];
}

export const stockApi = {
  getFullData: (symbol: string): Promise<FullStockData> =>
    apiFetch<FullStockData>(`/api/v1/stock/${encodeURIComponent(symbol)}`),

  getHistory: (
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y' = '1mo',
    interval: '1m' | '5m' | '1h' | '1d' | '1wk' = '1d'
  ): Promise<StockHistoryResponse> =>
    apiFetch<StockHistoryResponse>(
      `/api/v1/stock/${encodeURIComponent(symbol)}/history?period=${period}&interval=${interval}`
    ),
};
