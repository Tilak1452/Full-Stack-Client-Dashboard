"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { portfolioApi } from '@/lib/portfolio.api';
import { stockApi } from '@/lib/stock.api';
import { TopBar } from '@/components/TopBar';
import { PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['#d1ff4c', '#bb86fc', '#3b82f6', '#ffb74d', '#ff6b6b'];

export default function PortfolioPage() {
  const { data: portfolios = [], isLoading: portfoliosLoading, error: portfoliosError } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfolioApi.list,
  });

  const portfolioId = portfolios.length > 0 ? portfolios[0]?.id : null;

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch } = useQuery({
    queryKey: ['portfolio-summary', portfolioId],
    queryFn: () => portfolioApi.getSummary(portfolioId!),
    enabled: portfolioId !== null,
  });

  const symbols = summary?.holdings.map(h => h.symbol) ?? [];

  const { data: livePrices = {}, isLoading: pricesLoading } = useQuery({
    queryKey: ['live-prices', symbols],
    queryFn: async () => {
      const results: Record<string, number> = {};
      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const data = await stockApi.getFullData(sym);
            results[sym] = data.current_price;
          } catch {
            // price unavailable for this symbol
          }
        })
      );
      return results;
    },
    enabled: symbols.length > 0,
    staleTime: 60_000,
  });

  const isLoading = portfoliosLoading || summaryLoading || (symbols.length > 0 && pricesLoading);
  const error = portfoliosError || summaryError;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Portfolio" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex items-center justify-center">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Portfolio" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px]">
          <div className="rounded-2xl bg-card border border-red/20 p-6 text-center">
            <p className="text-red text-sm">
              {error instanceof Error ? error.message : 'No portfolios available or failed to load data.'}
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

  const enrichedHoldings = (summary?.holdings ?? []).map(holding => {
    const livePrice = livePrices[holding.symbol] ?? holding.average_price;
    const currentValue = livePrice * holding.quantity;
    const invested = holding.average_price * holding.quantity;
    const gain = currentValue - invested;
    const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
    return {
      sym: holding.symbol,
      qty: holding.quantity,
      avg: holding.average_price,
      ltp: livePrice,
      val: currentValue,
      gain: gain,
      pct: gainPct.toFixed(2),
      up: gain >= 0,
    };
  });

  const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.val, 0);
  const totalInvested = summary?.total_invested ?? 0;
  const totalGain = totalValue - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const totalPct = totalReturn.toFixed(2);

  const alloc = enrichedHoldings.map((h, i) => ({
    name: h.sym.replace('.NS', ''),
    valRaw: h.val,
    v: totalValue > 0 ? ((h.val / totalValue) * 100).toFixed(1) : '0.0',
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Portfolio" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total value', val: `₹${totalValue.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: 'text-text' },
            { label: 'Total invested', val: `₹${totalInvested.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: 'text-text' },
            { label: 'Total gain', val: `${totalGain >= 0 ? '+' : ''}₹${totalGain.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: totalGain >= 0 ? 'text-green' : 'text-red' },
            { label: 'Return', val: `${totalReturn >= 0 ? '+' : ''}${totalPct}%`, color: totalReturn >= 0 ? 'text-lime' : 'text-red' },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
              <div className="text-[11px] text-muted mb-1.5 tracking-[0.04em]">{c.label}</div>
              <div className={`text-[22px] font-semibold tracking-[-0.03em] ${c.color}`}>{c.val}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3.5">
          {/* Holdings table */}
          <div className="bg-card border border-border rounded-2xl p-5 overflow-x-auto">
            <div className="text-sm font-semibold mb-3.5">Holdings</div>
            {enrichedHoldings.length === 0 ? (
              <div className="text-center p-4 text-muted text-sm">No holdings found.</div>
            ) : (
            <table className="w-full border-collapse whitespace-nowrap min-w-[600px]">
              <thead>
                <tr>
                  {['Symbol', 'Qty', 'Avg cost', 'LTP', 'Mkt value', 'P&L', 'Return'].map(h => (
                    <th key={h} className="text-left text-[10.5px] text-muted font-medium p-[0_8px_10px] tracking-[0.04em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enrichedHoldings.map((h) => (
                  <tr key={h.sym} className="border-t border-border">
                    <td className="p-3 px-2">
                      <div className="text-[13px] font-semibold">{h.sym}</div>
                    </td>
                    <td className="p-3 px-2 text-[13px] text-muted">{h.qty}</td>
                    <td className="p-3 px-2 text-[13px]">₹{h.avg.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                    <td className="p-3 px-2 text-[13px]">₹{h.ltp.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                    <td className="p-3 px-2 text-[13px]">₹{h.val.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                    <td className={`p-3 px-2 text-[13px] ${h.up ? 'text-green' : 'text-red'}`}>
                      {h.up ? '+' : ''}{h.gain < 0 ? '-₹' + Math.abs(h.gain).toLocaleString('en-IN', {maximumFractionDigits:2}) : '₹' + h.gain.toLocaleString('en-IN', {maximumFractionDigits:2})}
                    </td>
                    <td className="p-3 px-2">
                      <span className={`text-xs font-semibold px-2 py-[3px] rounded-md ${h.up ? 'text-green bg-green/10' : 'text-red bg-red/10'}`}>
                        {h.up ? '+' : ''}{h.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          {/* Allocation pie */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center">
            <div className="text-sm font-semibold self-start mb-2.5">Allocation</div>
            {alloc.length > 0 ? (
            <>
              <PieChart width={200} height={170}>
                <Pie data={alloc} dataKey="valRaw" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {alloc.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div className="w-full flex flex-col gap-2">
                {alloc.map(a => (
                  <div key={a.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="text-[12.5px] text-muted flex-1">{a.name}</span>
                    <span className="text-[13px] font-semibold">{a.v}%</span>
                  </div>
                ))}
              </div>
            </>
            ) : (
               <div className="text-center p-4 text-muted text-sm mt-4">Empty</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
