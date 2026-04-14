"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from '@/components/TopBar';
import { IcSearch, IcPlus, IcTrash } from '@/components/Icons';
import { stockApi } from '@/lib/stock.api';

const WATCHLIST_KEY = 'finsight_watchlist';

export default function WatchlistPage() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [newSym, setNewSym] = useState('');

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
    const up = data ? data.current_price >= data.previous_close : true;
    const diff = data ? data.current_price - data.previous_close : 0;
    const chgPct = data && data.previous_close > 0 ? (diff / data.previous_close) * 100 : 0;
    
    return {
      sym,
      name: data ? data.exchange : '—',
      price: data ? data.current_price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—',
      chg: data ? `${up ? '+' : ''}${chgPct.toFixed(2)}%` : '—',
      up
    };
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Watchlist" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
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

        <div className="bg-card border border-border rounded-2xl p-5 overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px] whitespace-nowrap">
            <thead>
              <tr>
                {['Symbol', 'Exchange', 'Price', 'Change', 'Action'].map(h => (
                  <th key={h} className="text-left text-[10.5px] text-muted font-medium pb-3 px-2.5 tracking-[0.04em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {watchlistRows.map((s) => (
                <tr key={s.sym} className="border-t border-border group hover:bg-card2/30 transition-colors">
                  <td className="p-3 px-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[34px] h-[34px] rounded-[9px] bg-dim flex items-center justify-center text-[9px] font-bold text-muted uppercase">
                        {s.sym.slice(0, 4)}
                      </div>
                      <div className="text-[13.5px] font-semibold">{s.sym}</div>
                    </div>
                  </td>
                  <td className="p-3 px-2.5 text-[12.5px] text-muted">{s.name}</td>
                  <td className="p-3 px-2.5 text-sm font-medium">₹{s.price}</td>
                  <td className="p-3 px-2.5">
                    <span className={`text-[12.5px] font-semibold px-2.5 py-1 rounded-md ${
                      s.price === '—' ? 'text-muted bg-dim' : s.up ? 'text-green bg-green/10' : 'text-red bg-red/10'
                    }`}>
                      {s.chg}
                    </span>
                  </td>
                  <td className="p-3 px-2.5">
                    <button 
                      onClick={() => handleRemove(s.sym)} 
                      className="flex items-center gap-1 bg-red/10 border-none rounded-md px-2 py-1.5 cursor-pointer text-[11.5px] text-red hover:bg-red/20 transition-colors"
                    >
                      <IcTrash c="#f87171" s={13} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {symbols.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted text-sm">
                    Your watchlist is empty. Add a symbol above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
