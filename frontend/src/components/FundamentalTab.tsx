"use client";

import React from 'react';
import type { FundamentalsResponse } from '@/lib/stock.api';

interface Props {
  data: FundamentalsResponse | undefined;
  isLoading: boolean;
}

function formatLargeNumber(val: number | null | undefined): string {
  if (val == null) return '—';
  if (Math.abs(val) >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9) return `₹${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`;
  if (Math.abs(val) >= 1e6) return `₹${(val / 1e6).toFixed(2)}M`;
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card2 rounded-xl border border-border px-3.5 py-3 min-w-0">
      <div className="text-[10px] text-muted tracking-wide uppercase mb-1">{label}</div>
      <div className="text-[15px] font-semibold truncate">{value}</div>
    </div>
  );
}

function BarChart({ data, labelKey, revenueKey, profitKey }: {
  data: { period: string; total_revenue: number | null; net_income: number | null }[];
  labelKey: string;
  revenueKey: string;
  profitKey: string;
}) {
  if (!data || data.length === 0) {
    return <div className="text-muted text-sm text-center p-4">No financial data available.</div>;
  }

  // Reverse so oldest is on left
  const reversed = [...data].reverse();
  const maxVal = Math.max(
    ...reversed.map(d => Math.max(Math.abs(d.total_revenue ?? 0), Math.abs(d.net_income ?? 0)))
  );

  return (
    <div className="flex gap-2 items-end h-[160px] overflow-x-auto">
      {reversed.map((item, idx) => {
        const revH = maxVal > 0 ? ((Math.abs(item.total_revenue ?? 0)) / maxVal) * 140 : 0;
        const profH = maxVal > 0 ? ((Math.abs(item.net_income ?? 0)) / maxVal) * 140 : 0;
        return (
          <div key={idx} className="flex flex-col items-center gap-1 flex-1 min-w-[48px]">
            <div className="flex gap-0.5 items-end h-[140px]">
              <div
                className="w-3 bg-lime/60 rounded-t-sm transition-all"
                style={{ height: `${revH}px` }}
                title={`Revenue: ${formatLargeNumber(item.total_revenue)}`}
              />
              <div
                className="w-3 bg-green/60 rounded-t-sm transition-all"
                style={{ height: `${profH}px` }}
                title={`Profit: ${formatLargeNumber(item.net_income)}`}
              />
            </div>
            <div className="text-[9px] text-muted text-center leading-tight">{item.period}</div>
          </div>
        );
      })}
    </div>
  );
}

function ShareholdingBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? (value * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11.5px] text-muted min-w-[140px]">{label}</span>
      <div className="flex-1 h-2 bg-dim rounded-full overflow-hidden">
        <div className="h-full bg-lime rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-[12px] font-medium min-w-[50px] text-right">
        {value != null ? `${(value * 100).toFixed(1)}%` : '—'}
      </span>
    </div>
  );
}

export default function FundamentalTab({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="text-muted text-sm animate-pulse">Loading fundamental data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 text-muted text-sm">
        No fundamental data available for this stock.
      </div>
    );
  }

  const o = data.overview;

  const overviewMetrics = [
    { label: 'P/E Ratio', value: o.pe_ratio != null ? o.pe_ratio.toFixed(2) : '—' },
    { label: 'P/B Ratio', value: o.pb_ratio != null ? o.pb_ratio.toFixed(2) : '—' },
    { label: 'ROE', value: o.roe != null ? `${(o.roe * 100).toFixed(1)}%` : '—' },
    { label: 'Dividend Yield', value: o.dividend_yield != null ? `${(o.dividend_yield * 100).toFixed(2)}%` : '—' },
    { label: 'Market Cap', value: formatLargeNumber(o.market_cap) },
    { label: 'Day High', value: o.day_high != null ? `₹${o.day_high.toLocaleString('en-IN')}` : '—' },
    { label: 'Day Low', value: o.day_low != null ? `₹${o.day_low.toLocaleString('en-IN')}` : '—' },
    { label: '52W High', value: o['52_week_high'] != null ? `₹${o['52_week_high'].toLocaleString('en-IN')}` : '—' },
    { label: '52W Low', value: o['52_week_low'] != null ? `₹${o['52_week_low'].toLocaleString('en-IN')}` : '—' },
    { label: 'Beta', value: o.beta != null ? o.beta.toFixed(2) : '—' },
    { label: 'Book Value', value: o.book_value != null ? `₹${o.book_value.toFixed(2)}` : '—' },
    { label: 'EPS', value: o.earnings_per_share != null ? `₹${o.earnings_per_share.toFixed(2)}` : '—' },
  ];

  const sh = data.shareholding;
  const cal = data.calendar;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Overview Metrics */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="text-[12px] text-muted font-medium tracking-wide uppercase mb-3">Overview</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {overviewMetrics.map(m => <MetricCard key={m.label} label={m.label} value={m.value} />)}
        </div>
      </div>

      {/* Revenue & Profit Chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] text-muted font-medium tracking-wide uppercase">Revenue & Profit (Quarterly)</div>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-lime/60 rounded-sm inline-block" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green/60 rounded-sm inline-block" /> Profit</span>
          </div>
        </div>
        <BarChart
          data={data.quarterly_financials}
          labelKey="period"
          revenueKey="total_revenue"
          profitKey="net_income"
        />
      </div>

      {/* Shareholding Pattern */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="text-[12px] text-muted font-medium tracking-wide uppercase mb-3">Shareholding Pattern</div>
        <div className="flex flex-col gap-2.5">
          <ShareholdingBar label="Institutional Holders" value={sh.pct_held_by_institutions} />
          <ShareholdingBar label="Insider Holdings" value={sh.pct_held_by_insiders} />
          <ShareholdingBar label="Float Shares" value={sh.float_shares_pct} />
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="text-[12px] text-muted font-medium tracking-wide uppercase mb-3">Upcoming Events</div>
        {cal.next_earnings_date ? (
          <div className="bg-card2 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[18px]">📅</span>
              <span className="text-[13px] font-semibold">Next Earnings</span>
            </div>
            <div className="text-xl font-bold text-lime mb-1">{cal.next_earnings_date}</div>
            {(cal.earnings_low != null || cal.earnings_high != null) && (
              <div className="text-[12px] text-muted">
                Expected EPS: ₹{cal.earnings_low?.toFixed(2) ?? '—'} – ₹{cal.earnings_high?.toFixed(2) ?? '—'}
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted text-sm text-center p-3">No upcoming events scheduled.</div>
        )}
      </div>
    </div>
  );
}
