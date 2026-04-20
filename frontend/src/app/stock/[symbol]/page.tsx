"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import TradingViewWidget from '@/components/TradingViewWidget';
import TechnicalTab from '@/components/TechnicalTab';
import FundamentalTab from '@/components/FundamentalTab';
import { AddToPortfolioModal } from '@/components/AddToPortfolioModal';
import { IcSearch } from '@/components/Icons';
import { TopBar } from '@/components/TopBar';
import { stockApi } from '@/lib/stock.api';
import { aiApi, streamAgent, type AgentSSEEvent, type ChunkEventData, type ModelEventData, type ClassifiedEventData } from '@/lib/ai.api';
import { useWebSocketPrice } from '@/lib/useWebSocketPrice';
import { useAuth } from '@/lib/auth-context';

const INTERVALS = [
  { label: '5m',      interval: '5m',  period: '5d'  },
  { label: '15m',     interval: '15m', period: '15d' },
  { label: '1h',      interval: '60m', period: '60d' },
  { label: '1d 1mo',  interval: '1d',  period: '6mo' },
  { label: '1d 1yr',  interval: '1d',  period: '2y'  },
] as const;

type IntervalOption = typeof INTERVALS[number];

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
  
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState<'technical' | 'fundamental'>('technical');
  const [activeInterval, setActiveInterval] = useState<IntervalOption>(INTERVALS[3]); // default: 1d 1mo
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();

  // ─── NEW: Agent streaming state ──────────────────────────────────
  const [agentText, setAgentText] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentModel, setAgentModel] = useState('');
  const [agentCategory, setAgentCategory] = useState('');
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const agentAbortRef = useRef<AbortController | null>(null);

  const { user } = useAuth();
  const watchlistKey = user ? `finsight_watchlist_${user.id}` : 'finsight_watchlist';

  // Check if current symbol is already in watchlist
  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(watchlistKey);
      if (saved) {
        const list: string[] = JSON.parse(saved);
        setInWatchlist(list.includes(symbol));
      } else {
        setInWatchlist(false);
      }
    } catch (e) {
      console.error('Failed to read watchlist', e);
    }
  }, [symbol, user, watchlistKey]);

  const handleWatchlistToggle = useCallback(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(watchlistKey);
      let list: string[] = saved ? JSON.parse(saved) : [];
      if (list.includes(symbol)) {
        list = list.filter(s => s !== symbol);
        setInWatchlist(false);
      } else {
        list.push(symbol);
        setInWatchlist(true);
      }
      localStorage.setItem(watchlistKey, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to update watchlist', e);
    }
  }, [symbol, user, watchlistKey]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && sym.trim()) {
      router.push(`/stock/${sym.trim().toUpperCase()}`);
    }
  };

  // Core stock data (price + basic indicators)
  const { data: stockData, isLoading: stockLoading, error: stockError, refetch: refetchStock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => stockApi.getFullData(symbol),
    enabled: symbol.length > 0,
    staleTime: 60_000,
  });

  // AI analysis (fired manually)
  const { data: aiAnalysis, isLoading: aiLoading, refetch: fetchAi } = useQuery({
    queryKey: ['stock-analysis', symbol],
    queryFn: () => aiApi.analyze(
      `Perform a comprehensive financial analysis of ${symbol}. Include investment thesis, key risk factors, and interpretation of current technical indicators (RSI, SMA, EMA). Be specific and data-driven.`
    ),
    enabled: false,
    staleTime: 10 * 60_000,
  });

  // Technical data with full 8 indicators (fires when technical tab is active)
  const { data: technicalData, isLoading: techLoading } = useQuery({
    queryKey: ['stock-history-indicators', symbol, activeInterval.interval, activeInterval.period],
    queryFn: () => stockApi.getHistoryWithIndicators(symbol, activeInterval.interval, activeInterval.period),
    staleTime: 30_000,
    enabled: activeTab === 'technical' && symbol.length > 0,
  });

  // Fundamentals (lazy-loaded on first tab click)
  const { data: fundamentals, isLoading: fundLoading } = useQuery({
    queryKey: ['stock-fundamentals', symbol],
    queryFn: () => stockApi.getFundamentals(symbol),
    enabled: activeTab === 'fundamental' && symbol.length > 0,
    staleTime: 5 * 60_000,
  });

  const { price: livePrice } = useWebSocketPrice(symbol);

  const currentPrice = livePrice ?? stockData?.current_price ?? null;
  const previousClose = stockData?.previous_close ?? 0;
  const chgPct = previousClose > 0 && currentPrice !== null 
    ? (((currentPrice - previousClose) / previousClose) * 100).toFixed(2)
    : '0.00';
  const up = currentPrice !== null ? currentPrice >= previousClose : true;

  const handleAnalyzeClick = () => {
    setShowAiPanel(!showAiPanel);
    if (!showAiPanel && !aiAnalysis) {
      fetchAi();
    }
  };

  if (stockLoading) {
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
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-lime border-none rounded-[9px] px-3.5 py-2 text-xs text-black font-semibold cursor-pointer hover:brightness-110 transition-all"
            >
              + Add to Portfolio
            </button>
            <button 
              onClick={handleWatchlistToggle}
              className={`border rounded-[9px] px-3.5 py-2 text-xs cursor-pointer transition-all duration-200 ${
                inWatchlist 
                  ? 'bg-green/10 border-green/30 text-green' 
                  : 'bg-card2 border-border text-muted hover:text-text'
              }`}
            >
              {inWatchlist ? '✓ In watchlist' : 'Add to watchlist'}
            </button>
          </div>
        </div>

        {/* Price header + TradingView chart */}
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
            </div>
            <div className="h-[500px] w-full rounded-xl overflow-hidden border border-border">
              <TradingViewWidget symbol={symbol} />
            </div>
          </div>
        </div>

        {/* ═══ Tab Toggle: Technical / Fundamental ═══ */}
        <div className="bg-card border border-border rounded-2xl p-5">
          {/* Tab Bar */}
          <div className="flex gap-1 mb-5 bg-card2 rounded-xl p-1 w-fit">
            {(['technical', 'fundamental'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200 border-none capitalize ${
                  activeTab === tab
                    ? 'bg-lime text-black'
                    : 'bg-transparent text-muted hover:text-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'technical' && (
            <TechnicalTab
              data={technicalData}
              isLoading={techLoading}
              currentPrice={currentPrice ?? 0}
              intervals={INTERVALS}
              activeInterval={activeInterval}
              onIntervalChange={(opt) => setActiveInterval(opt as IntervalOption)}
            />
          )}

          {activeTab === 'fundamental' && (
            <FundamentalTab
              data={fundamentals}
              isLoading={fundLoading}
            />
          )}
        </div>

        {/* AI Analysis Button (Legacy) */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <button 
            onClick={handleAnalyzeClick} 
            className="w-full bg-lime-dim border border-lime/20 text-lime rounded-[10px] p-2.5 text-[13px] cursor-pointer font-medium hover:opacity-80 transition-opacity flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* ─── NEW: Full Agent Analysis (Streaming) ─── */}
          <button
            onClick={() => {
              if (showAgentPanel && agentText) {
                setShowAgentPanel(false);
                return;
              }
              if (agentAbortRef.current) agentAbortRef.current.abort();
              setAgentText('');
              setAgentModel('');
              setAgentCategory('');
              setAgentLoading(true);
              setShowAgentPanel(true);
              agentAbortRef.current = streamAgent(
                { query: `Give me a full trading analysis of ${symbol} with entry, stop loss, targets, and risk assessment.`, symbol },
                (event: AgentSSEEvent) => {
                  if (event.type === 'chunk') {
                    const { text } = event.data as unknown as ChunkEventData;
                    setAgentText(prev => prev + text);
                  } else if (event.type === 'model') {
                    setAgentModel((event.data as unknown as ModelEventData).model);
                  } else if (event.type === 'classified') {
                    setAgentCategory((event.data as unknown as ClassifiedEventData).category);
                  } else if (event.type === 'error') {
                    setAgentText(`❌ ${(event.data as { message: string }).message}`);
                  }
                },
                () => setAgentLoading(false),
                (err) => { setAgentText(`❌ ${err.message}`); setAgentLoading(false); }
              );
            }}
            className="w-full mt-2 bg-gradient-to-r from-purple/20 to-lime/10 border border-purple/30 text-purple rounded-[10px] p-2.5 text-[13px] cursor-pointer font-medium hover:opacity-80 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={agentLoading}
          >
            {agentLoading ? '🤖 Running Agent Analysis...' : showAgentPanel && agentText ? 'Hide Agent Analysis' : '🤖 Run Full Agent Analysis'}
          </button>

          {showAgentPanel && (
            <div className="mt-3 bg-card2 rounded-[11px] p-3.5 border border-border">
              {/* Category + Model badges */}
              {(agentCategory || agentModel) && (
                <div className="flex items-center gap-2 mb-2">
                  {agentCategory && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-wide uppercase bg-purple/15 text-purple">
                      {agentCategory}{agentCategory === 'stock' ? ` — ${symbol}` : ''}
                    </span>
                  )}
                  {agentModel && (
                    <span className="text-[10px] text-muted">
                      {agentModel === 'super' ? '🚀 Nemotron Super' : '⚡ Nemotron Nano'}
                    </span>
                  )}
                </div>
              )}
              {/* Agent response */}
              <div className="text-[11.5px] text-text leading-[1.75] whitespace-pre-line">
                {agentLoading && !agentText ? (
                  <span className="text-muted animate-pulse">Analysing {symbol.split('.')[0]}...</span>
                ) : (
                  agentText.split('**').map((part, j) =>
                    j % 2 === 1
                      ? <strong key={j} className="text-lime">{part}</strong>
                      : <span key={j}>{part}</span>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add to Portfolio Modal */}
        <AddToPortfolioModal
          isOpen={showAddModal}
          symbol={symbol}
          currentPrice={currentPrice ?? 0}
          onClose={() => setShowAddModal(false)}
        />

      </div>
    </div>
  );
}
