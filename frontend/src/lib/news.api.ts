import { apiFetch } from './api-client';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface NewsArticle {
  title: string;
  source: string;
  published_at: string;
  url: string;
  summary: string;
  sentiment: SentimentLabel;
}

export interface NewsResponse {
  articles: NewsArticle[];
  count: number;
}

export const newsApi = {
  getLatest: (limit = 20): Promise<NewsResponse> =>
    apiFetch<NewsResponse>(`/api/v1/news?limit=${limit}`),

  getForSymbol: (symbol: string, limit = 15): Promise<NewsResponse> =>
    apiFetch<NewsResponse>(`/api/v1/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`),
};
