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


// ─── NEW: Agent SSE Streaming Types ──────────────────────────────────────────

export interface AgentRequest {
  query: string;
  portfolio_id?: number | null;
  symbol?: string | null;
}

export interface AgentSSEEvent {
  type: 'status' | 'classified' | 'model' | 'chunk' | 'done' | 'error';
  data: Record<string, unknown>;
}

export interface ChunkEventData      { text: string; }
export interface ModelEventData      { model: string; node: string; }
export interface ClassifiedEventData { category: string; symbol: string | null; confidence: number; }
export interface StatusEventData     { message: string; step: number; }
export interface ErrorEventData      { message: string; partial_response: string; }


// ─── NEW: Agent SSE Stream Function ──────────────────────────────────────────

export function streamAgent(
  request: AgentRequest,
  onEvent: (event: AgentSSEEvent) => void,
  onComplete: () => void,
  onError: (err: Error) => void
): AbortController {
  const controller = new AbortController();
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  fetch(`${BASE_URL}/api/v1/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Agent stream failed: ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const typeMatch = rawEvent.match(/^event:\s*(.+)$/m);
          const dataMatch = rawEvent.match(/^data:\s*(.+)$/m);
          if (!typeMatch || !dataMatch) continue;

          const eventType = typeMatch[1].trim() as AgentSSEEvent['type'];
          try {
            const eventData = JSON.parse(dataMatch[1].trim());
            onEvent({ type: eventType, data: eventData });
            if (eventType === 'done' || eventType === 'error') {
              onComplete();
              return;
            }
          } catch {
            // Skip malformed event
          }
        }
      }
      onComplete();
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') onError(err);
    });

  return controller;
}
