"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/TopBar';
import { IcSend } from '@/components/Icons';
import {
  streamAgent,
  type AgentSSEEvent,
  type ChunkEventData,
  type ModelEventData,
  type ClassifiedEventData,
  type ErrorEventData,
  type StatusEventData,
} from '@/lib/ai.api';

const SUGGESTIONS = [
  'Should I invest in IT sector?',
  'Analyze RELIANCE for long term',
  'Best mid-cap stocks for 2026',
  'Compare TCS vs INFY fundamentals',
  'Risk analysis: my current portfolio',
];

type Message = {
  role: 'user' | 'ai';
  text: string;
  model?: string;       // "super" or "nano"
  category?: string;    // "stock", "news", etc.
  symbol?: string;      // Extracted ticker if any
};

const CATEGORY_COLORS: Record<string, string> = {
  stock: 'bg-[#C8FF00]/15 text-[#C8FF00]',
  news: 'bg-blue-500/15 text-blue-400',
  portfolio: 'bg-purple-500/15 text-purple-400',
  market: 'bg-orange-500/15 text-orange-400',
  general: 'bg-gray-500/15 text-gray-400',
};

export default function AIPage() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback((text?: string) => {
    const q = text || input;
    if (!q.trim() || isLoading) return;

    // Abort any previous stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    setInput('');
    setIsLoading(true);
    setStatusMsg('Agent initialising...');

    // Add user message + empty AI placeholder
    const userMsg: Message = { role: 'user', text: q };
    const aiPlaceholder: Message = { role: 'ai', text: '' };

    setMsgs(prev => {
      const updated = [...prev, userMsg, aiPlaceholder];

      // Start SSE stream
      const aiIndex = updated.length - 1;

      abortRef.current = streamAgent(
        { query: q },
        (event: AgentSSEEvent) => {
          if (event.type === 'chunk') {
            const { text: chunkText } = event.data as unknown as ChunkEventData;
            setMsgs(prev2 => {
              const copy = [...prev2];
              if (copy[aiIndex]) {
                copy[aiIndex] = { ...copy[aiIndex], text: copy[aiIndex].text + chunkText };
              }
              return copy;
            });
          } else if (event.type === 'model') {
            const { model } = event.data as unknown as ModelEventData;
            setMsgs(prev2 => {
              const copy = [...prev2];
              if (copy[aiIndex]) {
                copy[aiIndex] = { ...copy[aiIndex], model };
              }
              return copy;
            });
          } else if (event.type === 'classified') {
            const { category, symbol } = event.data as unknown as ClassifiedEventData;
            setMsgs(prev2 => {
              const copy = [...prev2];
              if (copy[aiIndex]) {
                copy[aiIndex] = { ...copy[aiIndex], category, symbol: symbol ?? undefined };
              }
              return copy;
            });
          } else if (event.type === 'status') {
            const { message } = event.data as unknown as StatusEventData;
            setStatusMsg(message);
          } else if (event.type === 'error') {
            const { message } = event.data as unknown as ErrorEventData;
            setMsgs(prev2 => {
              const copy = [...prev2];
              if (copy[aiIndex]) {
                copy[aiIndex] = { ...copy[aiIndex], text: `❌ ${message}` };
              }
              return copy;
            });
          }
        },
        () => {
          setIsLoading(false);
          setStatusMsg('');
        },
        (err) => {
          setMsgs(prev2 => {
            const copy = [...prev2];
            if (copy[aiIndex]) {
              copy[aiIndex] = { ...copy[aiIndex], text: `❌ Connection error: ${err.message}` };
            }
            return copy;
          });
          setIsLoading(false);
          setStatusMsg('');
        }
      );

      return updated;
    });
  }, [input, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, isLoading]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="AI Research Agent" />
      <div className="flex-1 flex flex-col p-5 md:p-[22px] gap-3.5 overflow-hidden">

        {/* Suggestions */}
        {msgs.length === 0 && (
          <div className="text-center pt-10">
            <div className="text-[28px] font-semibold tracking-[-0.03em] mb-2">AI Research Agent</div>
            <div className="text-sm text-muted mb-8">Ask anything about markets, stocks, or your portfolio</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-[600px] mx-auto">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="bg-card border border-border rounded-full px-4 py-[9px] text-[12.5px] text-text cursor-pointer hover:bg-card2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-2">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-purple to-pink text-white'
                    : 'bg-gradient-to-br from-lime to-[#7aaa00] text-black'
                }`}
              >
                {m.role === 'user' ? 'A' : 'F'}
              </div>
              <div
                className={`max-w-[72%] rounded-[14px] p-3 px-4 ${
                  m.role === 'user' ? 'bg-dim border border-border border-r-transparent border-y-transparent' : 'bg-card border border-border'
                }`}
              >
                {/* Category + Symbol badge */}
                {m.role === 'ai' && m.category && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-wide uppercase ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.general}`}>
                      {m.category}
                      {m.symbol ? ` — ${m.symbol}` : ''}
                    </span>
                  </div>
                )}

                {/* Message text with thinking dots */}
                <div className="text-[13px] leading-[1.75] text-text whitespace-pre-line">
                  {m.role === 'ai' && m.text === '' && isLoading ? (
                    <div className="flex items-center gap-1.5">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" style={{ animationDelay: '0.15s' }} />
                      <span className="thinking-dot" style={{ animationDelay: '0.3s' }} />
                      {statusMsg && <span className="text-[11px] text-muted ml-2">{statusMsg}</span>}
                    </div>
                  ) : (
                    m.text.split('**').map((part, j) =>
                      j % 2 === 1
                        ? <strong key={j} className="text-lime">{part}</strong>
                        : <span key={j}>{part}</span>
                    )
                  )}
                </div>

                {/* Model badge */}
                {m.role === 'ai' && m.model && m.text && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted">
                      {m.model === 'super' ? '🚀 Nemotron Super' : '⚡ Nemotron Nano'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2.5 bg-card border border-border-hi rounded-[14px] p-2.5 px-3.5 mt-auto shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask the AI agent… e.g. Should I buy RELIANCE now?"
            className="flex-1 bg-transparent border-none outline-none text-text text-[13px] w-full"
            disabled={isLoading}
          />
          <button
            onClick={() => send()}
            disabled={isLoading}
            className="bg-lime border-none rounded-[9px] w-9 h-9 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <IcSend c="#000" s={15} />
          </button>
        </div>

      </div>

      {/* Thinking dots animation */}
      <style jsx>{`
        .thinking-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #C8FF00;
          display: inline-block;
          animation: dot-bounce 1.2s infinite ease-in-out;
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
