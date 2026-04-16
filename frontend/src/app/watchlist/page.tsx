"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { IcSearch, IcPlus, IcTrash } from '@/components/Icons';
import { stockApi } from '@/lib/stock.api';

const WATCHLIST_KEY = 'finsight_watchlist';

/** Derive the exchange badge text from a Yahoo-format symbol */
function getExchangeBadge(sym: string): string {
  if (sym.endsWith('.NS')) return 'NSE';
  if (sym.endsWith('.BO')) return 'BSE';
  return '';
}

/** Strip the exchange suffix to get a clean ticker name */
function getCleanTicker(sym: string): string {
  return sym.replace(/\.(NS|BO)$/i, '');
}

export default function WatchlistPage() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [newSym, setNewSym] = useState('');
  const router = useRouter();

  // Initial load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_KEY);
      if (saved) setSymbols(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load watchlist', e);
    }
  }, []);

  // Update localStorage when symbols change
  const saveSymbols = (updated: string[]) => {
    setSymbols(updated);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
  };

  const handleAdd = () => {
    const clean = newSym.trim().toUpperCase();
    if (clean && !symbols.includes(clean)) {
      saveSymbols([...symbols, clean]);
      setNewSym('');
    }
  };

  const handleRemove = (sym: string) => {
    saveSymbols(symbols.filter(s => s !== sym));
  };

  // Fetch prices for all symbols
  const { data: priceData = {}, isLoading } = useQuery({
    queryKey: ['watchlist-prices', symbols],
    queryFn: async () => {
      const results: Record<string, any> = {};
      await Promise.allSettled(
        symbols.map(async sym => {
          try {
            const data = await stockApi.getFullData(sym);
            results[sym] = data;
          } catch (e) {
             console.warn(`Failed to fetch ${sym}`, e);
          }
        })
      );
      return results;
    },
    enabled: symbols.length > 0,
    staleTime: 60_000,
  });

  const watchlistRows = symbols.map(sym => {
    const data = priceData[sym];
    const currentPrice = data?.current_price ?? null;
    const previousClose = data?.previous_close ?? 0;
    const up = currentPrice !== null ? currentPrice >= previousClose : true;
    const diff = currentPrice !== null ? currentPrice - previousClose : 0;
    const chgPct = previousClose > 0 && currentPrice !== null
      ? (diff / previousClose) * 100
      : 0;

    return {
      sym,
      ticker: getCleanTicker(sym),
      exchange: getExchangeBadge(sym),
      price: currentPrice,
      diff: Math.abs(diff),
      chgPct: Math.abs(chgPct),
      up,
    };
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Watchlist" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        {/* Add symbol input */}
        <div className="bg-card border border-border rounded-2xl p-4 flex gap-2.5 mb-1">
          <div className="flex items-center gap-2 bg-card2 border border-border rounded-[10px] px-3.5 py-2 flex-1 max-w-[320px]">
            <IcSearch c="#636B7A" />
            <input 
              value={newSym} 
              onChange={e => setNewSym(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add symbol… e.g. RELIANCE.NS" 
              className="bg-transparent border-none outline-none text-text text-[13px] w-full" 
            />
          </div>
          <button 
            onClick={handleAdd}
            className="flex items-center gap-1.5 bg-lime border-none rounded-[10px] px-4 py-[9px] text-[13px] font-semibold text-black cursor-pointer hover:opacity-90 transition-opacity"
          >
            <IcPlus c="#000" />Add to watchlist
          </button>
        </div>

        {/* Watchlist card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-border">
            <span className="text-[13px] text-muted font-medium">Default ({symbols.length})</span>
          </div>

          {/* Rows */}
          {watchlistRows.length === 0 && (
            <div className="px-5 py-12 text-center text-muted text-sm">
              Your watchlist is empty. Add a symbol above or use the <span className="text-lime">"Add to watchlist"</span> button on any stock analysis page.
            </div>
          )}

          {watchlistRows.map((row) => (
            <div
              key={row.sym}
              onClick={() => router.push(`/stock/${row.sym}`)}
              className="group flex items-center px-5 py-3.5 border-b border-border last:border-b-0 cursor-pointer hover:bg-card2/40 transition-colors"
            >
              {/* Left: Ticker + Exchange badge */}
              <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-[14px] font-semibold text-text">{row.ticker}</span>
                {row.exchange && (
                  <span className="text-[9px] font-bold text-muted bg-dim rounded px-1.5 py-0.5 tracking-wider uppercase">
                    {row.exchange}
                  </span>
                )}
              </div>

              {/* Middle: Fluctuation amount */}
              <div className="min-w-[80px] text-right">
                <span className={`text-[13px] font-medium ${row.price === null ? 'text-muted' : row.up ? 'text-green' : 'text-red'}`}>
                  {row.price !== null ? row.diff.toFixed(2) : '—'}
                </span>
              </div>

              {/* Middle: Percentage + Arrow */}
              <div className="min-w-[100px] text-right">
                <span className={`text-[13px] font-semibold ${row.price === null ? 'text-muted' : row.up ? 'text-green' : 'text-red'}`}>
                  {row.price !== null ? `${row.chgPct.toFixed(2)}%` : '—'}
                  {row.price !== null && (
                    <span className="ml-1.5 text-[11px]">{row.up ? '▲' : '▼'}</span>
                  )}
                </span>
              </div>

              {/* Right: Current price */}
              <div className="flex-1 text-right">
                <span className={`text-[14px] font-semibold ${row.price === null ? 'text-muted' : row.up ? 'text-green' : 'text-red'}`}>
                  {row.price !== null ? row.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                </span>
              </div>

              {/* Action: Remove (visible on hover only) */}
              <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemove(row.sym); }}
                  className="flex items-center gap-1 bg-red/10 border-none rounded-md px-2 py-1.5 cursor-pointer text-[11px] text-red hover:bg-red/20 transition-colors"
                >
                  <IcTrash c="#f87171" s={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
