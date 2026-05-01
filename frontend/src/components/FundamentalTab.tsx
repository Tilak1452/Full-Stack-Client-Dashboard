"use client";

import React, { useState } from 'react';
import type { FundamentalsResponse } from '@/lib/stock.api';
import ShareholdingDonut from './ShareholdingDonut';
import FinancialStatements from './FinancialStatements';
import CorporateActionsCard from './CorporateActionsCard';

interface Props {
  data: FundamentalsResponse | undefined;
  isLoading: boolean;
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtLarge(val: number | null | undefined): string {
  if (val == null) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `₹${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e7)  return `₹${(val / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e6)  return `₹${(val / 1e6).toFixed(2)}M`;
  return `₹${val.toFixed(2)}`;
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</span>
      {subtitle && <span className="text-[10px] text-muted/60">{subtitle}</span>}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

function KpiCard({ label, value, sub, accent, trend }: KpiCardProps) {
  const trendColor = trend === 'up' ? 'text-green' : trend === 'down' ? 'text-red' : '';
  return (
    <div className={`rounded-xl border px-4 py-3 min-w-0 flex flex-col gap-1 transition-colors hover:border-lime/30 ${
      accent ? 'bg-lime/5 border-lime/20' : 'bg-card2 border-border'
    }`}>
      <div className="text-[9.5px] text-muted tracking-[0.08em] uppercase">{label}</div>
      <div className={`text-[15px] font-bold truncate ${trendColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted/70">{sub}</div>}
    </div>
  );
}

function ValuationGauge({ label, value, low, high, fmt }: {
  label: string;
  value: number | null;
  low: number;
  high: number;
  fmt: (v: number) => string;
}) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
  const zone = pct < 33 ? 'green' : pct < 66 ? 'amber' : 'red';
  const zoneColors: Record<string, string> = { green: '#6EE7B7', amber: '#FBBF24', red: '#F87171' };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-semibold" style={{ color: zoneColors[zone] }}>{fmt(value)}</span>
      </div>
      <div className="relative h-2 bg-dim rounded-full overflow-hidden">
        {/* gradient background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to right, #6EE7B7, #FBBF24, #F87171)'
        }} />
        {/* needle */}
        <div
          className="absolute top-0 w-0.5 h-full bg-white rounded-full shadow"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted/50">
        <span>Cheap ≤{fmt(low)}</span>
        <span>Expensive ≥{fmt(high)}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const TABS = ['Overview', 'Financials', 'Shareholding', 'Events'] as const;
type Tab = typeof TABS[number];

export default function FundamentalTab({ data, isLoading }: Props) {
  const [innerTab, setInnerTab] = useState<Tab>('Overview');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-5 bg-dim rounded w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-dim rounded-xl" />
          ))}
        </div>
        <div className="h-40 bg-dim rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-10 text-muted text-sm">
        No fundamental data available for this symbol.
      </div>
    );
  }

  const o = data.overview;
  const sh = data.shareholding;
  const cal = data.calendar;
  const ca = data.corporate_actions;

  const overviewKpis: KpiCardProps[] = [
    { label: 'Market Cap',     value: fmtLarge(o.market_cap),      accent: true },
    { label: 'P/E Ratio',      value: fmtNum(o.pe_ratio),           sub: 'Trailing' },
    { label: 'P/B Ratio',      value: fmtNum(o.pb_ratio) },
    { label: 'ROE',            value: o.roe != null ? `${(o.roe * 100).toFixed(1)}%` : '—', trend: (o.roe ?? 0) > 0.15 ? 'up' : 'down' },
    { label: 'EPS',            value: o.earnings_per_share != null ? `₹${o.earnings_per_share.toFixed(2)}` : '—' },
    { label: 'Book Value',     value: o.book_value != null ? `₹${o.book_value.toFixed(2)}` : '—' },
    { label: 'Beta',           value: fmtNum(o.beta), sub: 'vs NIFTY 50' },
    { label: 'Dividend Yield', value: o.dividend_yield != null ? `${(o.dividend_yield * 100).toFixed(2)}%` : '—', trend: (o.dividend_yield ?? 0) > 0.02 ? 'up' : 'neutral' },
    { label: 'Day High',       value: o.day_high != null ? `₹${o.day_high.toLocaleString('en-IN')}` : '—' },
    { label: 'Day Low',        value: o.day_low != null ? `₹${o.day_low.toLocaleString('en-IN')}` : '—' },
    { label: '52W High',       value: o['52_week_high'] != null ? `₹${o['52_week_high'].toLocaleString('en-IN')}` : '—' },
    { label: '52W Low',        value: o['52_week_low'] != null ? `₹${o['52_week_low'].toLocaleString('en-IN')}` : '—' },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Inner Tab Bar */}
      <div className="flex gap-1 bg-card2 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setInnerTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-all duration-200 border-none whitespace-nowrap ${
              innerTab === t ? 'bg-lime text-black' : 'bg-transparent text-muted hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {innerTab === 'Overview' && (
        <div className="flex flex-col gap-4">
          {/* KPI grid */}
          <div>
            <SectionHeader title="Key Metrics" subtitle="Valuation & profitability snapshot" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {overviewKpis.map(m => <KpiCard key={m.label} {...m} />)}
            </div>
          </div>

          {/* Valuation gauges */}
          <div className="bg-card2 rounded-2xl border border-border p-4">
            <SectionHeader title="Valuation Gauges" subtitle="Relative to sector norms" />
            <div className="flex flex-col gap-4">
              <ValuationGauge label="P/E Ratio" value={o.pe_ratio} low={5} high={60} fmt={v => v.toFixed(1) + '×'} />
              <ValuationGauge label="P/B Ratio" value={o.pb_ratio} low={0.5} high={8} fmt={v => v.toFixed(2) + '×'} />
              <ValuationGauge label="ROE" value={o.roe ? o.roe * 100 : null} low={0} high={40} fmt={v => v.toFixed(1) + '%'} />
              {o.beta != null && (
                <ValuationGauge label="Beta (Volatility)" value={o.beta} low={0} high={2.5} fmt={v => v.toFixed(2)} />
              )}
            </div>
          </div>

          {/* 52-week range bar */}
          {o['52_week_high'] != null && o['52_week_low'] != null && (
            <div className="bg-card2 rounded-2xl border border-border p-4">
              <SectionHeader title="52-Week Price Range" />
              {(() => {
                const lo = o['52_week_low']!;
                const hi = o['52_week_high']!;
                const cur = o.day_high ?? lo; // approximate with day_high if no current price
                const pct = hi > lo ? ((cur - lo) / (hi - lo)) * 100 : 50;
                return (
                  <div className="flex flex-col gap-2">
                    <div className="relative h-3 bg-dim rounded-full overflow-hidden">
                      <div
                        className="absolute h-full rounded-full"
                        style={{ width: `${pct}%`, background: 'linear-gradient(to right, #6EE7B7, #C8FF00)' }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted">
                      <span>₹{lo.toLocaleString('en-IN')} <span className="text-[9px]">52W Low</span></span>
                      <span className="text-lime font-semibold">{pct.toFixed(0)}% of range</span>
                      <span>₹{hi.toLocaleString('en-IN')} <span className="text-[9px]">52W High</span></span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Financials Tab ── */}
      {innerTab === 'Financials' && (
        <div className="flex flex-col gap-2">
          <SectionHeader title="Income Statement" subtitle="Revenue, profit & EBITDA trends" />
          <FinancialStatements
            quarterly={data.quarterly_financials}
            annual={data.annual_financials}
          />
        </div>
      )}

      {/* ── Shareholding Tab ── */}
      {innerTab === 'Shareholding' && (
        <div className="flex flex-col gap-4">
          <SectionHeader title="Shareholding Pattern" subtitle="Ownership distribution" />
          <ShareholdingDonut data={sh} />

          {/* Detailed breakdown bar rows */}
          <div className="bg-card2 rounded-2xl border border-border p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-3">Breakdown</div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Institutional Holders', value: sh.pct_held_by_institutions, color: '#C8FF00' },
                { label: 'Insider Holdings', value: sh.pct_held_by_insiders, color: '#6EE7B7' },
                { label: 'Public Float', value: sh.float_shares_pct, color: '#818CF8' },
              ].map(row => {
                const pct = row.value != null ? row.value * 100 : null;
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="text-[11.5px] text-muted min-w-[160px]">{row.label}</span>
                    <div className="flex-1 h-2 bg-dim rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, pct ?? 0)}%`, background: row.color }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold min-w-[48px] text-right tabular-nums">
                      {pct != null ? `${pct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                );
              })}
              {sh.number_of_institutions != null && (
                <div className="text-[10.5px] text-muted mt-1 pt-2 border-t border-border/40">
                  <span className="text-text font-medium">{sh.number_of_institutions.toLocaleString()}</span> institutions hold this stock
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Events Tab ── */}
      {innerTab === 'Events' && (
        <div className="flex flex-col gap-4">
          <SectionHeader title="Corporate Events" subtitle="Earnings, dividends & upcoming dates" />
          <CorporateActionsCard
            dividends={ca?.dividends ?? []}
            nextEarnings={cal.next_earnings_date}
            earningsLow={cal.earnings_low}
            earningsHigh={cal.earnings_high}
            revenueLow={cal.revenue_low}
            revenueHigh={cal.revenue_high}
          />
        </div>
      )}

    </div>
  );
}
