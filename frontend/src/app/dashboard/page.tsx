"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '@/components/TopBar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AIInsights from '@/components/AIInsights';
import { marketApi } from '@/lib/market.api';
import { newsApi } from '@/lib/news.api';
import { streamAgent, type AgentSSEEvent, type ChunkEventData } from '@/lib/ai.api';
import { stockApi } from '@/lib/stock.api';
import { portfolioApi } from '@/lib/portfolio.api';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';

function Spark({ data, up }: { data: number[], up: boolean }) {
  if (!data || data.length === 0) return null;
  const mn = Math.min(...data), mx = Math.max(...data), h = 32, w = 64;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - mn) / (mx - mn || 1)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={up ? '#C8FF00' : '#F87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartTip({ active, payload, label, prefix = '₹', mult = 100000 }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D26] border border-border rounded-[10px] px-3.5 py-2.5">
      <div className="text-muted text-[11px] mb-1">{label}</div>
      <div className="text-lime font-semibold text-[15px]">{prefix}{(payload[0].value * mult).toLocaleString('en-IN')}</div>
    </div>
  );
}

const mockSpark = [100, 105, 102, 108, 107];

// ─── AI News Brief: agent-powered latest news synthesis ───────────────────
function DashboardNewsBrief() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let accumulated = '';
    abortRef.current = streamAgent(
      { query: 'Give me the latest Indian stock market news brief. Summarize the top 5 market-moving headlines happening right now with sentiment for each.' },
      (event: AgentSSEEvent) => {
        if (event.type === 'chunk') {
          const { text: t } = event.data as unknown as ChunkEventData;
          accumulated += t;
          setText(accumulated);
        }
      },
      () => setLoading(false),
      () => { setText('Unable to load AI news brief. Please refresh.'); setLoading(false); }
    );
    return () => { abortRef.current?.abort(); };
  }, []);

  if (loading && !text) {
    return (
      <div className="flex items-center gap-2 p-3">
        <div className="w-2 h-2 rounded-full bg-purple animate-pulse" />
        <span className="text-[12px] text-muted animate-pulse">Synthesizing latest market news...</span>
      </div>
    );
  }

  return (
    <div className="text-[12px] text-text leading-[1.7] whitespace-pre-line">
      {text.split('**').map((part, j) =>
        j % 2 === 1
          ? <strong key={j} className="text-lime">{part}</strong>
          : <span key={j}>{part}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [tf, setTf] = useState('6M');

  // ── Real portfolio data ─────────────────────────────────────────
  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfolioApi.list,
    staleTime: 60_000,
  });

  const portfolioId = portfolios.length > 0 ? portfolios[0]?.id : null;

  const { data: portfolioSummary } = useQuery({
    queryKey: ['portfolio-summary', portfolioId],
    queryFn: () => portfolioApi.getSummary(portfolioId!),
    enabled: portfolioId !== null,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // Refresh every 5 min to match background job
  });

  // Build chart data from real holdings
  const portfolioChartData = React.useMemo(() => {
    if (!portfolioSummary?.holdings || portfolioSummary.holdings.length === 0) {
      return [{ m: 'Now', v: 0 }];
    }
    // Show each holding as a data point with its current value contribution
    const holdings = portfolioSummary.holdings;
    const totalValue = portfolioSummary.total_current_value ?? portfolioSummary.total_invested ?? 0;
    const totalInvested = portfolioSummary.total_invested ?? 0;

    // Create a simple historical-looking chart: invested → current
    const points = [
      { m: 'Invested', v: totalInvested },
      { m: 'Current', v: totalValue },
    ];
    return points;
  }, [portfolioSummary]);

  const totalPortfolioValue = portfolioSummary?.total_current_value ?? portfolioSummary?.total_invested ?? 0;
  const totalInvested = portfolioSummary?.total_invested ?? 0;
  const totalPLPct = portfolioSummary?.total_unrealized_pl_pct ?? 0;
  const totalPL = portfolioSummary?.total_unrealized_pl ?? 0;
  const isUp = totalPL >= 0;

  const { data: indicesData } = useQuery({
    queryKey: ['market-indices'],
    queryFn: marketApi.getIndices,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const { data: moversData } = useQuery({
    queryKey: ['market-movers'],
    queryFn: marketApi.getMovers,
    staleTime: 5 * 60_000,
  });

  const { data: newsResponse } = useQuery({
    queryKey: ['news-preview'],
    queryFn: () => newsApi.getLatest(4),
    staleTime: 5 * 60_000,
  });

  const indices = indicesData?.indices ?? [];
  const movers = moversData?.movers ?? [];
  const newsPreview = newsResponse?.articles ?? [];

  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);

  // Load watchlist from localStorage AFTER hydration (client-only)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('finsight_watchlist');
      if (saved) setWatchlistSymbols(JSON.parse(saved));
    } catch {
      // ignore parse errors
    }
  }, []);

  const { data: watchlistPrices = {} } = useQuery({
    queryKey: ['live-prices', watchlistSymbols],
    queryFn: async () => {
      const results: Record<string, any> = {};
      await Promise.allSettled(
        watchlistSymbols.map(async (sym) => {
          try {
            const data = await stockApi.getFullData(sym);
            results[sym] = data;
          } catch {}
        })
      );
      return results;
    },
    enabled: watchlistSymbols.length > 0,
    staleTime: 60_000,
  });

  const computedWatchlist = watchlistSymbols.slice(0, 5).map(sym => {
    const data = watchlistPrices[sym];
    const up = data ? data.current_price >= data.previous_close : true;
    const diff = data ? data.current_price - data.previous_close : 0;
    const chgPct = data && data.previous_close > 0 ? (diff / data.previous_close) * 100 : 0;
    return {
      sym,
      name: data ? data.exchange : '—',
      price: data ? data.current_price.toLocaleString('en-IN', {maximumFractionDigits:2}) : '...',
      chg: data ? `${up ? '+' : ''}${chgPct.toFixed(2)}%` : '...',
      up
    };
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        {/* Indices row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {indices.map(idx => (
            <Link href={`/stock/${idx.ticker}`} key={idx.name} className="bg-card border border-border rounded-2xl p-5 flex justify-between items-center cursor-pointer hover:opacity-90 transition-opacity no-underline text-text">
              <div>
                <div className="text-[10.5px] text-muted mb-1.5 tracking-[0.06em] uppercase">{idx.name}</div>
                <div className="text-xl font-semibold tracking-[-0.03em] leading-none">
                  {idx.error ? 'Error' : `₹${idx.price?.toLocaleString('en-IN', {maximumFractionDigits: 2})}`}
                </div>
                <div className={`text-xs mt-1.5 font-medium ${idx.up ? 'text-green' : 'text-red'}`}>
                  {idx.error ? 'N/A' : `${idx.up ? '+' : ''}${idx.change_pct?.toFixed(2)}%`} today
                </div>
              </div>
              <Spark data={mockSpark} up={!!idx.up} />
            </Link>
          ))}
          {indices.length === 0 && Array.from({length: 4}).map((_, i) => (
             <div key={i} className="bg-card border border-border rounded-2xl p-5 items-center justify-center flex text-muted text-sm">
                Loading...
             </div>
          ))}
        </div>

        {/* Chart + AI row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3.5">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex justify-between items-start mb-[18px]">
              <div>
                <div className="text-[11.5px] text-muted mb-1.5">Portfolio value</div>
                <div className="text-[28px] font-semibold tracking-[-0.04em] leading-none">
                  {totalPortfolioValue > 0
                    ? `₹${totalPortfolioValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}`
                    : '₹0'
                  }
                  {totalPortfolioValue > 0 && (
                    <span className={`text-[13.5px] ml-2.5 font-medium ${isUp ? 'text-green' : 'text-red'}`}>
                      {isUp ? '+' : ''}{totalPLPct.toFixed(2)}%
                    </span>
                  )}
                </div>
                {totalPortfolioValue > 0 && (
                  <div className={`text-[12px] mt-1 ${isUp ? 'text-green' : 'text-red'}`}>
                    {isUp ? '+' : ''}₹{totalPL.toLocaleString('en-IN', {maximumFractionDigits: 2})} unrealized
                  </div>
                )}
              </div>
              <Link href="/portfolio" className="text-[11px] text-muted hover:text-lime no-underline bg-card2 border border-border rounded-lg px-3 py-1.5">
                View portfolio →
              </Link>
            </div>
            <div className="h-[170px]">
              {portfolioSummary && portfolioSummary.holdings.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioChartData}>
                  <defs>
                    <linearGradient id="lgLime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? '#C8FF00' : '#F87171'} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={isUp ? '#C8FF00' : '#F87171'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="m" tick={{ fill: '#636B7A', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#636B7A', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                  <Tooltip content={<ChartTip prefix="₹" mult={1} />} />
                  <Area dataKey="v" stroke={isUp ? '#C8FF00' : '#F87171'} strokeWidth={2} fill="url(#lgLime)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted text-[13px]">
                  {portfolioSummary ? 'No holdings yet — add stocks from the Stock Analysis page' : 'Loading portfolio...'}
                </div>
              )}
            </div>
          </div>

          <AIInsights />

        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Watchlist */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3.5">
              <div className="text-sm font-semibold">Watchlist</div>
              <Link href="/watchlist" className="text-[11px] text-muted hover:text-lime no-underline">View all</Link>
            </div>
            {computedWatchlist.length === 0 ? (
               <div className="text-center p-4 text-muted text-[12px]">Your watchlist is empty.</div>
            ) : (
            <div className="flex flex-col gap-2.5">
              {computedWatchlist.map(s => (
                <Link href={`/stock/${s.sym}`} key={s.sym} className="flex items-center justify-between no-underline text-text hover:bg-card2/50 p-1.5 -mx-1.5 rounded-lg">
                  <div className="flex items-center gap-[9px]">
                    <div className="w-[32px] h-[32px] rounded-lg bg-dim flex items-center justify-center text-[8.5px] font-bold text-muted tracking-[0.03em]">{s.sym.slice(0, 4)}</div>
                    <div>
                      <div className="text-[12.5px] font-medium">{s.sym}</div>
                      <div className="text-[10.5px] text-muted">{s.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12.5px] font-medium">₹{s.price}</div>
                    <div className={`text-[11px] ${s.up ? 'text-green' : 'text-red'}`}>{s.chg}</div>
                  </div>
                </Link>
              ))}
            </div>
            )}
          </div>

          {/* Top Movers */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3.5">Top movers</div>
            <div className="flex flex-col gap-[7px]">
              {movers.length === 0 ? (
                <div className="text-center p-4 text-muted text-[12px]">Loading movers...</div>
              ) : (
                movers.map(m => (
                  <Link href={`/stock/${m.sym}`} key={m.sym} className="flex items-center justify-between p-[8px_10px] rounded-[9px] bg-card2 no-underline text-text hover:opacity-80">
                    <div className="text-[12.5px] font-semibold">{m.sym}</div>
                    <div className="text-[11px] text-muted">Vol {m.vol}</div>
                    <div className={`text-xs font-semibold px-2 py-[3px] rounded-md ${m.up ? 'text-green bg-green/10' : 'text-red bg-red/10'}`}>
                      {m.chg}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* AI News Brief — agent-powered latest news synthesis */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3.5">
              <div className="text-sm font-semibold flex items-center gap-2">🗞️ AI News Brief <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple/15 text-purple font-medium">LIVE</span></div>
              <Link href="/news" className="text-[11px] text-muted hover:text-lime no-underline">RSS feed →</Link>
            </div>
            <DashboardNewsBrief />
          </div>
        </div>

      </div>
    </div>
  );
}
