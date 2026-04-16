"use client";

import React from 'react';
import type { PivotPoints } from '@/lib/stock.api';

interface Props {
  pivots: PivotPoints;
  currentPrice: number;
}

export default function SupportResistanceBar({ pivots, currentPrice }: Props) {
  const { s2, s1, pivot, r1, r2 } = pivots;
  if (s2 == null || r2 == null) return null;

  const allLevels = [s2, s1, pivot, r1, r2].filter(v => v !== null) as number[];
  const min = Math.min(...allLevels, currentPrice) - 10;
  const max = Math.max(...allLevels, currentPrice) + 10;
  const range = max - min || 1;

  const pct = (val: number) => ((val - min) / range) * 100;

  const levels = [
    { label: 'S2', val: s2!, color: '#F87171' },
    { label: 'S1', val: s1!, color: '#FB923C' },
    { label: 'P', val: pivot!, color: '#636B7A' },
    { label: 'R1', val: r1!, color: '#34D399' },
    { label: 'R2', val: r2!, color: '#4ADE80' },
  ];

  return (
    <div className="bg-card2 rounded-xl border border-border p-4">
      <div className="text-[11px] text-muted font-medium tracking-wide uppercase mb-3">Support & Resistance</div>
      <div className="relative h-8 bg-dim rounded-lg overflow-hidden">
        {/* Level markers */}
        {levels.map(l => (
          <div
            key={l.label}
            className="absolute top-0 h-full w-[2px]"
            style={{ left: `${pct(l.val)}%`, backgroundColor: l.color }}
          />
        ))}
        {/* Current price marker */}
        <div
          className="absolute top-[-2px] h-[calc(100%+4px)] w-[3px] bg-lime rounded-sm z-10"
          style={{ left: `${pct(currentPrice)}%` }}
        />
      </div>
      {/* Labels below */}
      <div className="relative h-8 mt-1">
        {levels.map(l => (
          <div
            key={l.label}
            className="absolute text-center"
            style={{ left: `${pct(l.val)}%`, transform: 'translateX(-50%)' }}
          >
            <div className="text-[9px] font-bold" style={{ color: l.color }}>{l.label}</div>
            <div className="text-[10px] text-muted">₹{l.val.toLocaleString('en-IN')}</div>
          </div>
        ))}
        <div
          className="absolute text-center"
          style={{ left: `${pct(currentPrice)}%`, transform: 'translateX(-50%)' }}
        >
          <div className="text-[9px] font-bold text-lime">CMP</div>
          <div className="text-[10px] text-lime">₹{currentPrice.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>
  );
}
