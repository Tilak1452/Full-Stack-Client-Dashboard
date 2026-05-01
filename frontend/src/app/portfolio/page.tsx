   "use client";

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { portfolioApi, HoldingItem } from '@/lib/portfolio.api';
import { AddToPortfolioModal } from '@/components/AddToPortfolioModal';
import { SellHoldingModal } from '@/components/SellHoldingModal';
import { TopBar } from '@/components/TopBar';
import { PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['#d1ff4c', '#bb86fc', '#3b82f6', '#ffb74d', '#ff6b6b', '#4dd0e1', '#ab47bc', '#66bb6a'];

export default function PortfolioPage() {
  const queryClient = useQueryClient();

  // Modal states
  const [buyModal, setBuyModal] = useState<{open: boolean; symbol: string; price: number}>({open: false, symbol: '', price: 0});
  const [sellModal, setSellModal] = useState<{open: boolean; holding: HoldingItem | null}>({open: false, holding: null});
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const { data: portfolios = [], isLoading: portfoliosLoading, error: portfoliosError, refetch: refetchPortfolios } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfolioApi.list,
  });

  // Auto-select first portfolio if none selected
  React.useEffect(() => {
    if (portfolios.length > 0 && selectedPortfolioId === null) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  const portfolioId = selectedPortfolioId ?? (portfolios.length > 0 ? portfolios[0]?.id : null);

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch } = useQuery({
    queryKey: ['portfolio-summary', portfolioId],
    queryFn: () => portfolioApi.getSummary(portfolioId!),
    enabled: !!portfolioId,
  });

  const isLoading = portfoliosLoading || summaryLoading;
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
              onClick={() => {
                refetchPortfolios();
                if (portfolioId) refetch();
              }}
              className="mt-3 text-lime text-sm hover:opacity-80 cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use pre-calculated values from backend (no N+1 API calls!)
  const holdings = summary?.holdings ?? [];
  const totalInvested = summary?.total_invested ?? 0;
  const totalCurrentValue = summary?.total_current_value ?? totalInvested;
  const totalUnrealizedPL = summary?.total_unrealized_pl ?? 0;
  const totalUnrealizedPLPct = summary?.total_unrealized_pl_pct ?? 0;
  const totalRealizedPL = summary?.total_realized_pl ?? 0;

  const enrichedHoldings = holdings.map(h => {
    const costBasis = h.cost_basis ?? h.quantity * h.average_price;
    const currentValue = h.current_value ?? costBasis;
    const unrealizedPL = h.unrealized_pl ?? 0;
    const unrealizedPLPct = h.unrealized_pl_pct ?? 0;
    const ltp = h.current_price ?? h.average_price;

    return {
      id: h.id,
      sym: h.symbol,
      qty: h.quantity,
      avg: h.average_price,
      ltp,
      val: currentValue,
      costBasis,
      gain: unrealizedPL,
      pct: unrealizedPLPct.toFixed(2),
      up: unrealizedPL >= 0,
      realizedPL: h.realized_pl ?? 0,
      hasPriceData: h.current_price != null,
      raw: h,
    };
  });

  const alloc = enrichedHoldings.map((h, i) => ({
    name: h.sym.replace('.NS', ''),
    valRaw: h.val,
    v: totalCurrentValue > 0 ? ((h.val / totalCurrentValue) * 100).toFixed(1) : '0.0',
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Portfolio" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        {/* Portfolio Selection & Actions */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedPortfolioId || ''}
              onChange={(e) => setSelectedPortfolioId(parseInt(e.target.value))}
              className="px-4 py-2 bg-card2 border border-border rounded-xl text-text text-[13px] outline-none focus:border-lime/40 cursor-pointer min-w-[200px]"
            >
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                const name = window.prompt("Enter new portfolio name:");
                if (name && name.trim()) {
                  try {
                    const newPortfolio = await portfolioApi.create({ name: name.trim() });
                    await refetchPortfolios();
                    setSelectedPortfolioId(newPortfolio.id);
                  } catch (e: any) {
                    alert("Failed to create portfolio: " + e.message);
                  }
                }
              }}
              className="bg-card2 border border-border rounded-xl px-4 py-2 text-[13px] text-muted hover:text-text cursor-pointer transition-colors"
            >
              + Create new portfolio
            </button>
          </div>
          <button
            onClick={() => {}}
            className="bg-lime/10 border border-lime/20 text-lime rounded-xl px-4 py-2 text-[13px] font-semibold cursor-pointer hover:bg-lime/20 transition-colors"
          >
            Portfolio Analyse
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total value', val: `₹${totalCurrentValue.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: 'text-text' },
            { label: 'Total invested', val: `₹${totalInvested.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: 'text-text' },
            { label: 'Unrealized P&L', val: `${totalUnrealizedPL >= 0 ? '+' : ''}₹${totalUnrealizedPL.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: totalUnrealizedPL >= 0 ? 'text-green' : 'text-red' },
            { label: 'Unrealized %', val: `${totalUnrealizedPLPct >= 0 ? '+' : ''}${totalUnrealizedPLPct.toFixed(2)}%`, color: totalUnrealizedPLPct >= 0 ? 'text-lime' : 'text-red' },
            { label: 'Realized P&L', val: `${totalRealizedPL >= 0 ? '+' : ''}₹${totalRealizedPL.toLocaleString('en-IN', {maximumFractionDigits:2})}`, color: totalRealizedPL >= 0 ? 'text-green' : 'text-red' },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
              <div className="text-[11px] text-muted mb-1.5 tracking-[0.04em]">{c.label}</div>
              <div className={`text-[20px] font-semibold tracking-[-0.03em] ${c.color}`}>{c.val}</div>
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
            <table className="w-full border-collapse whitespace-nowrap min-w-[750px]">
              <thead>
                <tr>
                  {['Symbol', 'Qty', 'Avg Cost', 'LTP', 'Mkt Value', 'Unrealized P&L', 'Return', 'Realized', 'Actions'].map(h => (
                    <th key={h} className="text-left text-[10.5px] text-muted font-medium p-[0_8px_10px] tracking-[0.04em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enrichedHoldings.map((h) => (
                  <tr key={h.sym} className="border-t border-border group">
                    <td className="p-3 px-2">
                      <div className="text-[13px] font-semibold">{h.sym}</div>
                    </td>
                    <td className="p-3 px-2 text-[13px] text-muted">{h.qty}</td>
                    <td className="p-3 px-2 text-[13px]">₹{h.avg.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                    <td className="p-3 px-2 text-[13px]">
                      {h.hasPriceData 
                        ? `₹${h.ltp.toLocaleString('en-IN', {maximumFractionDigits:2})}`
                        : <span className="text-muted text-[11px]">Updating...</span>
                      }
                    </td>
                    <td className="p-3 px-2 text-[13px]">₹{h.val.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                    <td className={`p-3 px-2 text-[13px] ${h.up ? 'text-green' : 'text-red'}`}>
                      {h.up ? '+' : ''}₹{h.gain.toLocaleString('en-IN', {maximumFractionDigits:2})}
                    </td>
                    <td className="p-3 px-2">
                      <span className={`text-xs font-semibold px-2 py-[3px] rounded-md ${h.up ? 'text-green bg-green/10' : 'text-red bg-red/10'}`}>
                        {h.up ? '+' : ''}{h.pct}%
                      </span>
                    </td>
                    <td className="p-3 px-2 text-[13px]">
                      {h.realizedPL !== 0 ? (
                        <span className={h.realizedPL >= 0 ? 'text-green' : 'text-red'}>
                          {h.realizedPL >= 0 ? '+' : ''}₹{h.realizedPL.toLocaleString('en-IN', {maximumFractionDigits:2})}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3 px-2">
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setBuyModal({open: true, symbol: h.sym, price: h.ltp})}
                          className="text-[10px] bg-lime/10 text-lime border border-lime/20 px-2 py-1 rounded-md font-semibold cursor-pointer hover:bg-lime/20 transition-colors"
                        >
                          Buy More
                        </button>
                        <button
                          onClick={() => setSellModal({open: true, holding: h.raw})}
                          className="text-[10px] bg-red/10 text-red border border-red/20 px-2 py-1 rounded-md font-semibold cursor-pointer hover:bg-red/20 transition-colors"
                        >
                          Sell
                        </button>
                      </div>
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

      {/* Buy More Modal */}
      <AddToPortfolioModal
        isOpen={buyModal.open}
        symbol={buyModal.symbol}
        currentPrice={buyModal.price}
        onClose={() => setBuyModal({open: false, symbol: '', price: 0})}
      />

      {/* Sell Modal */}
      {sellModal.holding && portfolioId && (
        <SellHoldingModal
          isOpen={sellModal.open}
          symbol={sellModal.holding.symbol}
          availableQuantity={sellModal.holding.quantity}
          currentPrice={sellModal.holding.current_price ?? sellModal.holding.average_price}
          averageCost={sellModal.holding.average_price}
          portfolioId={portfolioId}
          onClose={() => setSellModal({open: false, holding: null})}
        />
      )}
    </div>
  );
}
