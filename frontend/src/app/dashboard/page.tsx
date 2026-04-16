"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '@/components/TopBar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { portfolioHistory, aiInsightsData } from '@/lib/mock';
import { marketApi } from '@/lib/market.api';
import { newsApi } from '@/lib/news.api';
import { stockApi } from '@/lib/stock.api';
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

export default function DashboardPage() {
  const [tf, setTf] = useState('6M');

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
                  ₹6,53,480
                  <span className="text-[13.5px] text-green ml-2.5 font-medium">+18.2% YTD</span>
                </div>
              </div>
              <div className="flex gap-[3px]">
                {['1M', '3M', '6M', '1Y', 'ALL'].map(t => (
                  <button key={t} onClick={() => setTf(t)} className={`px-[11px] py-1.5 rounded-lg border-none cursor-pointer text-[11.5px] font-medium transition-all duration-150 ${tf === t ? 'bg-lime text-black' : 'bg-transparent text-muted'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioHistory}>
                  <defs>
                    <linearGradient id="lgLime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8FF00" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#C8FF00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="m" tick={{ fill: '#636B7A', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#636B7A', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 0.4', 'dataMax + 0.2']} />
                  <Tooltip content={<ChartTip />} />
                  <Area dataKey="v" stroke="#C8FF00" strokeWidth={2} fill="url(#lgLime)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2.5">
            <div className="flex justify-between items-center bg-card2 border border-border px-3 py-2 rounded-xl mb-1 -mx-2 -mt-2">
              <div className="text-sm font-semibold">AI Insights</div>
              <div className="text-[10px] bg-lime/10 text-lime px-2 py-1 rounded-md font-semibold tracking-wide">LIVE</div>
            </div>
            {aiInsightsData.map((ins, i) => (
              <div key={i} className="bg-card2 rounded-[11px] p-[11px_13px] border border-border">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[11px] font-bold" style={{ background: `${ins.color}22`, color: ins.color }}>{ins.icon}</div>
                  <span className="text-[12.5px] font-semibold">{ins.title}</span>
                </div>
                <p className="text-[11.5px] text-muted m-0 leading-[1.6]">{ins.body}</p>
              </div>
            ))}
            <Link href="/ai-research" className="mt-auto bg-lime-dim border border-lime/20 text-lime rounded-[10px] p-2.5 text-[12.5px] cursor-pointer font-medium text-center no-underline hover:opacity-80">
              Ask AI Research Agent →
            </Link>
          </div>
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

          {/* News preview */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3.5">
              <div className="text-sm font-semibold">Market news</div>
              <Link href="/news" className="text-[11px] text-muted hover:text-lime no-underline">View all</Link>
            </div>
            {newsPreview.length === 0 ? (
               <div className="text-center p-4 text-muted text-[12px]">Loading news...</div>
            ) : (
            <div className="flex flex-col gap-[11px]">
              {newsPreview.map((n, i) => (
                <div key={i} className={`pb-2.5 cursor-pointer hover:opacity-80 ${i < 3 ? 'border-b border-border' : ''}`} onClick={() => window.open(n.url, '_blank')}>
                  <div className="flex gap-[6px] items-center mb-[5px]">
                    <span className="text-[10px] bg-dim text-muted px-1.5 py-0.5 rounded-[5px] font-medium">{n.source}</span>
                    <span className={`text-[10px] ${n.sentiment === 'positive' ? 'text-green' : n.sentiment === 'negative' ? 'text-red' : 'text-muted'}`}>● {n.sentiment}</span>
                    <span className="text-[10px] text-muted ml-auto">{formatTime(n.published_at)}</span>
                  </div>
                  <div className="text-[12px] text-text leading-[1.5]">{n.title}</div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
