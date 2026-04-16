"use client";

import React from 'react';

interface IndicatorCardProps {
  name: string;
  value: string;
  interpretation: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}

const signalColors = {
  bullish: { bg: 'bg-green/10', text: 'text-green', border: 'border-green/20' },
  bearish: { bg: 'bg-red/10', text: 'text-red', border: 'border-red/20' },
  neutral: { bg: 'bg-amber-400/10', text: 'text-amber-400', border: 'border-amber-400/20' },
};

export default function IndicatorCard({ name, value, interpretation, signal }: IndicatorCardProps) {
  const colors = signalColors[signal];
  return (
    <div className="bg-card2 rounded-xl border border-border p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted font-medium tracking-wide uppercase">{name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${colors.bg} ${colors.text} ${colors.border} border`}>
          {signal.toUpperCase()}
        </span>
      </div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted leading-snug">{interpretation}</div>
    </div>
  );
}
