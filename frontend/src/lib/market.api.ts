import { apiFetch } from './api-client';

export interface IndexData {
  name: string;
  ticker: string;
  price: number | null;
  change_pct: number | null;
  up: boolean | null;
  day_high: number | null;
  day_low: number | null;
  market_state: string;
  error?: boolean;
}

export interface IndicesResponse {
  indices: IndexData[];
}

export interface MoversData {
  sym: string;
  vol: string;
  chg: string;
  up: boolean;
}

export interface MoversResponse {
  movers: MoversData[];
}

export const marketApi = {
  getIndices: (): Promise<IndicesResponse> =>
    apiFetch<IndicesResponse>('/api/v1/indices'),
    
  getMovers: (): Promise<MoversResponse> =>
    apiFetch<MoversResponse>('/api/v1/movers'),
};
