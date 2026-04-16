"use client";

import React from 'react';
import type { TechnicalSummary } from '@/lib/stock.api';

interface Props {
  summary: TechnicalSummary;
}

const verdictStyles = {
  BULLISH: { color: 'text-green', bg: 'bg-green/10', icon: '▲' },
  BEARISH: { color: 'text-red', bg: 'bg-red/10', icon: '▼' },
  NEUTRAL: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: '●' },
};

export default function TechnicalSummaryGauge({ summary }: Props) {
  const total = summary.bullish + summary.bearish + summary.neutral;
  const style = verdictStyles[summary.verdict];
  const bullishPct = total > 0 ? (summary.bullish / total) * 100 : 0;
  const bearishPct = total > 0 ? (summary.bearish / total) * 100 : 0;

  return (
    <div className="bg-card2 rounded-xl border border-border p-4">
      <div className="text-[11px] text-muted font-medium tracking-wide uppercase mb-2.5">Technical Summary</div>
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-2xl font-bold ${style.color}`}>{style.icon}</span>
        <div>
          <div className={`text-lg font-bold ${style.color}`}>{summary.verdict}</div>
          <div className="text-[11px] text-muted">{total} signals analyzed</div>
        </div>
      </div>
      {/* Gauge bar */}
      <div className="h-2 bg-dim rounded-full overflow-hidden flex">
        <div className="h-full bg-green transition-all" style={{ width: `${bullishPct}%` }} />
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${100 - bullishPct - bearishPct}%` }} />
        <div className="h-full bg-red transition-all" style={{ width: `${bearishPct}%` }} />
      </div>
      {/* Legend */}
      <div className="flex justify-between mt-2 text-[10.5px]">
        <span className="text-green">{summary.bullish} Bullish</span>
        <span className="text-amber-400">{summary.neutral} Neutral</span>
        <span className="text-red">{summary.bearish} Bearish</span>
      </div>
    </div>
  );
}
