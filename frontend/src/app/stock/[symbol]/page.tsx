"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { IcSearch } from '@/components/Icons';
import { TopBar } from '@/components/TopBar';
import { stockApi } from '@/lib/stock.api';
import { aiApi } from '@/lib/ai.api';
import { useWebSocketPrice } from '@/lib/useWebSocketPrice';

function formatMarketCap(val: number | null | undefined): string {
  if (val == null) return 'N/A';
  if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `₹${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6)  return `₹${(val / 1e6).toFixed(2)}M`;
  return `₹${val.toFixed(0)}`;
}

export default function StockPage() {
  const params = useParams();
  const rawSymbol = typeof params.symbol === 'string' ? params.symbol : 'RELIANCE.NS';
  const decodedSymbol = decodeURIComponent(rawSymbol);
  const symbol = decodedSymbol ? decodedSymbol.toUpperCase().trim() : 'RELIANCE.NS';
  const [sym, setSym] = useState(symbol);
  
  type Timeframe = '1M' | '3M' | '6M' | '1Y' | 'ALL';
  const [tf, setTf] = useState<Timeframe>('1M');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const router = useRouter();

  const periodMap = {
    '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', 'ALL': '5y'
  } as const;

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && sym.trim()) {
      router.push(`/stock/${sym.trim().toUpperCase()}`);
    }
  };

  const ChartTip = ({ active, payload, label, prefix = '₹', mult = 1 }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1A1D26] border border-border rounded-[10px] px-3.5 py-2.5">
        <div className="text-muted text-[11px] mb-1">{label}</div>
        <div className="text-lime font-semibold text-[15px]">{prefix}{(payload[0].value * mult).toLocaleString('en-IN', {maximumFractionDigits: 2})}</div>
      </div>
    );
  };

  const { data: stockData, isLoading: stockLoading, error: stockError, refetch: refetchStock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => stockApi.getFullData(symbol),
    enabled: symbol.length > 0,
    staleTime: 60_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['stock-history', symbol, periodMap[tf]],
    queryFn: () => stockApi.getHistory(symbol, periodMap[tf], '1d'),
    enabled: symbol.length > 0,
    staleTime: 5 * 60_000,
  });

  const { data: aiAnalysis, isLoading: aiLoading, refetch: fetchAi } = useQuery({
    queryKey: ['stock-analysis', symbol],
    queryFn: () => aiApi.analyze(
      `Perform a comprehensive financial analysis of ${symbol}. Include investment thesis, key risk factors, and interpretation of current technical indicators (RSI, SMA, EMA). Be specific and data-driven.`
    ),
    enabled: false,
    staleTime: 10 * 60_000,
  });

  const { price: livePrice } = useWebSocketPrice(symbol);

  const currentPrice = livePrice ?? stockData?.current_price ?? null;
  const previousClose = stockData?.previous_close ?? 0;
  const chgPct = previousClose > 0 && currentPrice !== null 
    ? (((currentPrice - previousClose) / previousClose) * 100).toFixed(2)
    : '0.00';
  const up = currentPrice !== null ? currentPrice >= previousClose : true;

  const chartData = (historyData?.candles ?? []).map((candle: any) => {
    const d = new Date(candle.date);
    return {
      d: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
      v: candle.close,
    };
  });

  const metrics = stockData ? [
    { label: 'Market Cap',   val: formatMarketCap(stockData.market_cap) },
    { label: 'P/E Ratio',    val: stockData.pe_ratio?.toFixed(2) ?? 'N/A' },
    { label: 'Day High',     val: stockData.day_high ? `₹${stockData.day_high.toFixed(2)}` : 'N/A' },
    { label: 'Day Low',      val: stockData.day_low ? `₹${stockData.day_low.toFixed(2)}` : 'N/A' },
    { label: 'RSI (14)',     val: stockData.rsi?.toFixed(1) ?? 'N/A' },
    { label: 'SMA (20)',     val: stockData.sma?.toFixed(2) ?? 'N/A' },
    { label: 'EMA (20)',     val: stockData.ema?.toFixed(2) ?? 'N/A' },
    { label: 'Exchange',     val: stockData.exchange ?? 'N/A' },
  ] : [];

  const handleAnalyzeClick = () => {
    setShowAiPanel(!showAiPanel);
    if (!showAiPanel && !aiAnalysis) {
      fetchAi();
    }
  };

  const isLoading = stockLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Stock Analysis" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex items-center justify-center">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (stockError && !stockData) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Stock Analysis" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px]">
          <div className="rounded-2xl bg-card border border-red/20 p-6 text-center">
            <p className="text-red text-sm">
              {stockError instanceof Error ? stockError.message : 'Failed to load data'}
            </p>
            <button
              onClick={() => { refetchStock(); }}
              className="mt-3 text-lime text-sm hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Stock Analysis" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        {/* Symbol search bar */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3.5">
          <div className="flex items-center gap-2 bg-card2 border border-border rounded-[10px] px-3.5 py-2 flex-1 max-w-[320px]">
            <IcSearch c="#636B7A" />
            <input 
              value={sym} 
              onChange={e => setSym(e.target.value)} 
              onKeyDown={handleSearch}
              className="bg-transparent border-none outline-none text-text text-[13px] w-full" 
            />
          </div>
          <button 
            onClick={() => sym.trim() && router.push(`/stock/${sym.trim().toUpperCase()}`)} 
            className="bg-lime border-none rounded-[10px] px-5 py-[9px] text-[13px] font-semibold text-black cursor-pointer"
          >
            Analyze
          </button>
          <div className="ml-auto flex gap-2">
            {['Compare', 'Add to watchlist'].map(a => (
              <button key={a} className="bg-card2 border border-border rounded-[9px] px-3.5 py-2 text-xs text-muted cursor-pointer hover:text-text">
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Price header */}
        <div className="grid grid-cols-1 gap-3.5">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-end gap-4 mb-[18px]">
              <div>
                <div className="text-[11px] text-muted tracking-[0.05em] uppercase mb-1.5">{symbol.split('.')[0]}</div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tracking-[-0.04em]">₹{currentPrice?.toLocaleString('en-IN', {maximumFractionDigits: 2}) ?? '—'}</span>
                  <span className={`text-[15px] font-medium ${up ? 'text-green' : 'text-red'}`}>{up ? '+' : ''}{chgPct}%</span>
                  <span className="text-[13px] text-muted">today</span>
                </div>
              </div>
              <div className="flex gap-1 ml-auto">
                {(['1M', '3M', '6M', '1Y', 'ALL'] as Timeframe[]).map(t => (
                  <button key={t} onClick={() => setTf(t)} className={`px-[11px] py-1.5 rounded-lg border-none cursor-pointer text-[11.5px] font-medium transition-all duration-150 ${tf === t ? 'bg-lime text-black' : 'bg-transparent text-muted'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="lgStock" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8FF00" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#C8FF00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tick={{ fill: '#636B7A', fontSize: 10.5 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#636B7A', fontSize: 10.5 }} axisLine={false} tickLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
                  <Tooltip content={<ChartTip prefix="₹" mult={1} />} />
                  <Area dataKey="v" stroke="#C8FF00" strokeWidth={2} fill="url(#lgStock)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Metrics + AI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Key metrics */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3.5">Key financials</div>
            <div className="grid grid-cols-2 gap-2.5">
              {metrics.map(m => (
                <div key={m.label} className="bg-card2 rounded-[10px] px-3.5 py-3">
                  <div className="text-[10.5px] text-muted mb-[5px] tracking-[0.04em]">{m.label}</div>
                  <div className="text-base font-semibold">{m.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical indicators */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3.5">Technical indicators</div>
            <div className="flex flex-col gap-2.5">
              {[
                { name: 'RSI (14)', val: stockData?.rsi ? stockData.rsi.toFixed(1) : 'N/A', note: stockData?.rsi && stockData.rsi > 70 ? 'Overbought' : stockData?.rsi && stockData.rsi < 30 ? 'Oversold' : 'Neutral zone', color: '#FBBF24', pct: stockData?.rsi ? stockData.rsi : 0 },
                { name: 'MA 20',    val: stockData?.sma ? `₹${stockData.sma.toFixed(2)}` : 'N/A', note: currentPrice && stockData?.sma && currentPrice > stockData.sma ? 'Price above MA — bullish' : 'Price below MA — bearish', color: '#4ADE80', pct: 100 },
                { name: 'EMA 20',   val: stockData?.ema ? `₹${stockData.ema.toFixed(2)}` : 'N/A', note: '', color: '#4ADE80', pct: 100 },
              ].map(ind => (
                <div key={ind.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[12.5px] font-medium">{ind.name}</span>
                    <span className="text-[12px] font-semibold" style={{ color: ind.color }}>{ind.val}</span>
                  </div>
                  <div className="h-1 bg-dim rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.min(100, ind.pct)}%`, backgroundColor: ind.color }} />
                  </div>
                  {ind.note && <div className="text-[10.5px] text-muted mt-1">{ind.note}</div>}
                </div>
              ))}
            </div>

            <button 
              onClick={handleAnalyzeClick} 
              className="mt-3.5 w-full bg-lime-dim border border-lime/20 text-lime rounded-[10px] p-2.5 text-[13px] cursor-pointer font-medium hover:opacity-80 transition-opacity flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={aiLoading}
            >
              {aiLoading ? 'Generating Analysis...' : showAiPanel ? 'Hide AI Analysis Report' : 'Generate AI Analysis Report'}
            </button>
            
            {showAiPanel && aiAnalysis && (
              <div className="mt-3 bg-card2 rounded-[11px] p-3.5 border border-border">
                <div className="text-[11px] text-muted leading-[1.7]">
                   <strong className={`text-[12px] ${aiAnalysis.verdict === 'BULLISH' ? 'text-lime' : aiAnalysis.verdict === 'BEARISH' ? 'text-red' : 'text-amber'}`}>
                      {symbol.split('.')[0]} — {aiAnalysis.verdict} (Confidence: {aiAnalysis.confidence}%)
                   </strong>
                   <br />
                   {aiAnalysis.reasoning_summary}
                   <br/><br/>
                   <strong>Risk:</strong> {aiAnalysis.risk_assessment}
                </div>
              </div>
            )}
            {showAiPanel && !aiAnalysis && !aiLoading && (
              <div className="mt-3 text-red text-center text-sm p-3">Failed to load AI Analysis.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
