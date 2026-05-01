import { apiFetch } from './api-client';

export interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EnrichedCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi: number;
  sma: number;
  ema: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  stoch_k: number;
  stoch_d: number;
  atr: number;
  mfi: number;
}

export interface LatestIndicators {
  rsi: number;
  sma: number;
  ema: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  stoch_k: number;
  stoch_d: number;
  atr: number;
  mfi: number;
}

export interface PivotPoints {
  pivot: number | null;
  s1: number | null;
  s2: number | null;
  r1: number | null;
  r2: number | null;
}

export interface TechnicalSummary {
  verdict: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bullish: number;
  bearish: number;
  neutral: number;
}

export interface EnrichedHistoryResponse {
  symbol: string;
  period: string;
  interval: string;
  candles: EnrichedCandle[];
  latest_indicators: LatestIndicators;
  pivot_points: PivotPoints;
  summary: TechnicalSummary;
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

// Fundamentals types
export interface FundamentalsOverview {
  pe_ratio: number | null;
  pb_ratio: number | null;
  roe: number | null;
  dividend_yield: number | null;
  market_cap: number | null;
  day_high: number | null;
  day_low: number | null;
  '52_week_high': number | null;
  '52_week_low': number | null;
  beta: number | null;
  book_value: number | null;
  earnings_per_share: number | null;
}

export interface QuarterlyFinancial {
  period: string;
  total_revenue: number | null;
  net_income: number | null;
  gross_profit?: number | null;
  operating_income?: number | null;
  ebitda?: number | null;
  eps?: number | null;
}

export interface DividendRecord {
  date: string;
  amount: number | null;
}

export interface CorporateActions {
  dividends: DividendRecord[];
  splits: unknown[];
}

export interface ShareholdingData {
  pct_held_by_institutions: number | null;
  pct_held_by_insiders: number | null;
  float_shares_pct: number | null;
  number_of_institutions: number | null;
}

export interface EarningsCalendar {
  next_earnings_date: string | null;
  earnings_low: number | null;
  earnings_high: number | null;
  revenue_low: number | null;
  revenue_high: number | null;
}

export interface FundamentalsResponse {
  symbol: string;
  overview: FundamentalsOverview;
  quarterly_financials: QuarterlyFinancial[];
  annual_financials: QuarterlyFinancial[];
  shareholding: ShareholdingData;
  calendar: EarningsCalendar;
  corporate_actions?: CorporateActions;
}

export const stockApi = {
  getFullData: (symbol: string): Promise<FullStockData> =>
    apiFetch<FullStockData>(`/api/v1/stock/${encodeURIComponent(symbol)}`),

  getHistory: (
    symbol: string,
    period: string = '1mo',
    interval: string = '1d'
  ): Promise<StockHistoryResponse> =>
    apiFetch<StockHistoryResponse>(
      `/api/v1/stock/${encodeURIComponent(symbol)}/history?period=${period}&interval=${interval}`
    ),

  getHistoryWithIndicators: (
    symbol: string,
    interval: string,
    period: string
  ): Promise<EnrichedHistoryResponse> =>
    apiFetch<EnrichedHistoryResponse>(
      `/api/v1/stock/${encodeURIComponent(symbol)}/history?interval=${interval}&period=${period}&include_indicators=true`
    ),

  getFundamentals: (symbol: string): Promise<FundamentalsResponse> =>
    apiFetch<FundamentalsResponse>(
      `/api/v1/stock/${encodeURIComponent(symbol)}/fundamentals`
    ),
};
