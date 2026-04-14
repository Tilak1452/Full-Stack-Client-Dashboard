import { apiFetch } from './api-client';

export interface TechnicalSignal {
  indicator: string;
  value: string;
  interpretation: string;
}

export interface SentimentSignal {
  source: string;
  score: string;
  interpretation: string;
}

export type Verdict = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface AnalyzeResponse {
  verdict: Verdict;
  confidence: number;
  reasoning_summary: string;
  technical_signals: TechnicalSignal[];
  sentiment_signals: SentimentSignal[];
  risk_assessment: string;
}

export const aiApi = {
  analyze: (question: string): Promise<AnalyzeResponse> =>
    apiFetch<AnalyzeResponse>('/api/v1/analyze', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};
