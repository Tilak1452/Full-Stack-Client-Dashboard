"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  streamAgent,
  type AgentSSEEvent,
  type ChunkEventData,
} from '@/lib/ai.api';
import Link from 'next/link';

const SENTIMENT_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  BULLISH: { bg: 'bg-green-500/15', text: 'text-green', icon: '🟢' },
  BEARISH: { bg: 'bg-red-500/15', text: 'text-red', icon: '🔴' },
  MIXED:   { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: '🟡' },
  NEUTRAL: { bg: 'bg-gray-500/15', text: 'text-gray-400', icon: '🟡' },
};

interface InsightsData {
  overall_sentiment?: string;
  confidence?: number;
  market_summary?: string;
  key_themes?: string[];
  fii_dii_signal?: string;
  top_story_impact_level?: string;
}

export default function AIInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const fetchInsights = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();

    setLoading(true);
    setError('');
    setRawText('');
    setData(null);

    let accumulated = '';

    abortRef.current = streamAgent(
      { query: 'Market sentiment dashboard mode. Return a JSON object with these exact keys: overall_sentiment (BULLISH/BEARISH/MIXED), confidence (0-1), market_summary (start with a specific number or event, not "The market"), key_themes (array of 3 short themes), fii_dii_signal (string about FII/DII activity), top_story_impact_level (HIGH/MEDIUM/LOW). Today\'s Indian market sentiment analysis.' },
      (event: AgentSSEEvent) => {
        if (event.type === 'chunk') {
          const { text } = event.data as unknown as ChunkEventData;
          accumulated += text;
          setRawText(accumulated);
        } else if (event.type === 'error') {
          setError((event.data as { message: string }).message);
        }
      },
      () => {
        setLoading(false);
        // Try to parse as JSON (dashboard mode), fallback to raw text display
        try {
          const parsed = JSON.parse(accumulated);
          if (parsed.overall_sentiment) {
            setData(parsed);
            return;
          }
        } catch {
          // Not JSON — use raw text
        }
        // Auto-detect sentiment from text
        const textLower = accumulated.toLowerCase();
        const sentiment = textLower.includes('bullish') ? 'BULLISH'
          : textLower.includes('bearish') ? 'BEARISH'
          : textLower.includes('mixed') ? 'MIXED' : 'NEUTRAL';
        setData({
          overall_sentiment: sentiment,
          market_summary: accumulated.slice(0, 300),
        });
      },
      (err) => {
        setLoading(false);
        setError(err.message);
      }
    );
  }, []);

  useEffect(() => {
    fetchInsights();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchInsights]);

  const sentimentKey = data?.overall_sentiment?.toUpperCase() || 'NEUTRAL';
  const style = SENTIMENT_STYLE[sentimentKey] || SENTIMENT_STYLE.NEUTRAL;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex justify-between items-center bg-card2 border border-border px-3 py-2 rounded-xl mb-1 -mx-2 -mt-2">
        <div className="text-sm font-semibold">AI Insights</div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] bg-lime/10 text-lime px-2 py-1 rounded-md font-semibold tracking-wide">LIVE</div>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="text-[10px] text-muted hover:text-lime cursor-pointer bg-transparent border-none disabled:opacity-50 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col gap-2">
          <div className="bg-card2 rounded-[11px] p-3 border border-border animate-pulse">
            <div className="h-3 bg-dim rounded w-3/4 mb-2" />
            <div className="h-3 bg-dim rounded w-1/2" />
          </div>
          <div className="text-[10px] text-muted text-center">Analysing market sentiment...</div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-500/10 rounded-[11px] p-3 border border-red-500/20 text-[12px] text-red">
          {error}
        </div>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          {/* Sentiment badge */}
          <div className={`${style.bg} rounded-[11px] p-3 border border-border`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px]">{style.icon}</span>
              <span className={`text-[13px] font-bold ${style.text}`}>{sentimentKey}</span>
              {data.confidence && (
                <span className="text-[10px] text-muted ml-auto">{Math.round(data.confidence * 100)}% confidence</span>
              )}
            </div>
          </div>

          {/* Market summary */}
          {data.market_summary && (
            <div className="bg-card2 rounded-[11px] p-[11px_13px] border border-border">
              <p className="text-[11.5px] text-muted m-0 leading-[1.6]">
                {data.market_summary.slice(0, 200)}
                {data.market_summary.length > 200 ? '…' : ''}
              </p>
            </div>
          )}

          {/* Key themes */}
          {data.key_themes && data.key_themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.key_themes.slice(0, 3).map((theme, i) => (
                <span key={i} className="text-[10px] bg-dim text-muted px-2 py-1 rounded-md">
                  {theme}
                </span>
              ))}
            </div>
          )}

          {/* FII/DII signal */}
          {data.fii_dii_signal && (
            <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
              <div className="text-[10px] text-blue-400 font-medium">FII/DII Signal</div>
              <div className="text-[11px] text-text mt-0.5">{data.fii_dii_signal}</div>
            </div>
          )}

          {/* Impact level */}
          {data.top_story_impact_level && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted">Top Story Impact:</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                data.top_story_impact_level === 'HIGH' ? 'bg-red-500/20 text-red' :
                data.top_story_impact_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {data.top_story_impact_level}
              </span>
            </div>
          )}
        </>
      )}

      {/* Ask AI link */}
      <Link href="/ai-research" className="mt-auto bg-lime-dim border border-lime/20 text-lime rounded-[10px] p-2.5 text-[12.5px] cursor-pointer font-medium text-center no-underline hover:opacity-80">
        Ask AI Research Agent →
      </Link>
    </div>
  );
}
