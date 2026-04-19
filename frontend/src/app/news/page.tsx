"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '@/components/TopBar';
import { newsApi, SentimentLabel } from '@/lib/news.api';
import { streamAgent, type AgentSSEEvent, type ChunkEventData } from '@/lib/ai.api';

// ─── AI News Synthesis Banner ─────────────────────────────────────────────
function AiNewsBanner() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSynthesis = () => {
    if (text && expanded) { setExpanded(false); return; }
    if (text) { setExpanded(true); return; }
    setLoading(true);
    setExpanded(true);
    let accumulated = '';
    abortRef.current = streamAgent(
      { query: 'Summarize the top 10 latest Indian stock market news headlines with sentiment analysis (positive/negative/neutral) for each. Focus on NSE/BSE market-moving events.' },
      (event: AgentSSEEvent) => {
        if (event.type === 'chunk') {
          const { text: t } = event.data as unknown as ChunkEventData;
          accumulated += t;
          setText(accumulated);
        }
      },
      () => setLoading(false),
      () => { setText('Unable to synthesize news. Try again.'); setLoading(false); }
    );
  };

  return (
    <div className="bg-gradient-to-r from-purple/5 to-lime/5 border border-purple/20 rounded-2xl p-4">
      <button
        onClick={fetchSynthesis}
        className="w-full flex items-center justify-between cursor-pointer bg-transparent border-none text-left"
        disabled={loading}
      >
        <span className="text-[13px] font-semibold flex items-center gap-2">
          🤖 AI News Synthesis
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple/15 text-purple font-medium">Agent-Powered</span>
        </span>
        <span className="text-[11px] text-muted">
          {loading ? 'Synthesizing...' : expanded ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>
      {expanded && (
        <div className="mt-3 text-[12px] text-text leading-[1.7] whitespace-pre-line border-t border-border/50 pt-3">
          {loading && !text ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple animate-pulse" />
              <span className="text-muted animate-pulse">Analyzing latest market news...</span>
            </div>
          ) : (
            text.split('**').map((part, j) =>
              j % 2 === 1
                ? <strong key={j} className="text-lime">{part}</strong>
                : <span key={j}>{part}</span>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const [filter, setFilter] = useState<'all' | SentimentLabel>('all');

  const { data: newsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: () => newsApi.getLatest(30),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const allArticles = newsResponse?.articles ?? [];
  const filtered = filter === 'all' ? allArticles : allArticles.filter(n => n.sentiment === filter);

  const positiveCount = allArticles.filter(a => a.sentiment === 'positive').length;
  const neutralCount = allArticles.filter(a => a.sentiment === 'neutral').length;
  const negativeCount = allArticles.filter(a => a.sentiment === 'negative').length;
  const total = allArticles.length || 1;
  const positivePct = Math.round((positiveCount / total) * 100);
  const neutralPct = Math.round((neutralCount / total) * 100);
  const negativePct = 100 - positivePct - neutralPct;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="News & Sentiment" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex items-center justify-center">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="News & Sentiment" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px]">
          <div className="rounded-2xl bg-card border border-red/20 p-6 text-center">
            <p className="text-red text-sm">
              {error instanceof Error ? error.message : 'Failed to load data'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-lime text-sm hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="News & Sentiment" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        <div className="flex flex-wrap gap-2 mb-2">
          {['all', 'positive', 'neutral', 'negative'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f as 'all' | SentimentLabel)} 
              className={`px-4 py-[7px] rounded-full border text-[12.5px] font-medium capitalize cursor-pointer transition-colors ${
                filter === f 
                  ? 'bg-lime-dim border-lime text-lime' 
                  : 'bg-transparent border-border text-muted hover:border-muted/50'
              }`}
            >
              {f}
            </button>
          ))}
          {allArticles.length > 0 && (
          <div className="ml-auto bg-card border border-border rounded-full px-4 py-[7px] text-xs text-muted self-center">
            Sentiment: <span className="text-green font-medium">{positivePct}% positive</span> · <span className="text-muted">{neutralPct}% neutral</span> · <span className="text-red font-medium">{negativePct}% negative</span>
          </div>
          )}
        </div>

        {/* AI News Synthesis Banner */}
        <AiNewsBanner />

        <div className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <div className="text-center p-4 text-muted text-sm">No news found.</div>
          )}
          {filtered.map((n, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:bg-card2 transition-colors" onClick={() => window.open(n.url, '_blank')}>
              <div className="flex gap-2.5 items-start">
                <div className="flex-1">
                  <div className="flex gap-1.5 items-center mb-2 flex-wrap">
                    <span className="text-[10.5px] bg-dim text-muted px-[7px] py-[2px] rounded-[5px] font-medium">{n.source}</span>
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-md capitalize tracking-wide font-medium ${
                      n.sentiment === 'positive' ? 'bg-green/10 text-green' : 
                      n.sentiment === 'negative' ? 'bg-red/10 text-red' : 
                      'bg-dim text-muted'
                    }`}>
                      {n.sentiment}
                    </span>
                    <span className="text-[10.5px] text-muted ml-auto">{formatTime(n.published_at)}</span>
                  </div>
                  <div className="text-[14.5px] font-medium leading-[1.5] mb-2">{n.title}</div>
                  <div className="text-[12.5px] text-muted leading-[1.65]">
                    <span className="text-lime font-medium mr-1">AI summary:</span>{n.summary}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
