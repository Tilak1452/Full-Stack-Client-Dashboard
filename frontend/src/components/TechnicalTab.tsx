"use client";

import React from 'react';
import IndicatorCard from './IndicatorCard';
import SupportResistanceBar from './SupportResistanceBar';
import TechnicalSummaryGauge from './TechnicalSummaryGauge';
import type { EnrichedHistoryResponse } from '@/lib/stock.api';

interface IntervalOption {
  label: string;
  interval: string;
  period: string;
}

interface Props {
  data: EnrichedHistoryResponse | undefined;
  isLoading: boolean;
  currentPrice: number;
  intervals: readonly IntervalOption[];
  activeInterval: IntervalOption;
  onIntervalChange: (interval: IntervalOption) => void;
}

function getIndicatorCards(data: EnrichedHistoryResponse, currentPrice: number) {
  const ind = data.latest_indicators;
  type Signal = 'bullish' | 'bearish' | 'neutral';

  const rsiSignal: Signal = ind.rsi < 30 ? 'bullish' : ind.rsi > 70 ? 'bearish' : 'neutral';
  const smaSignal: Signal = currentPrice > ind.sma ? 'bullish' : 'bearish';
  const emaSignal: Signal = currentPrice > ind.ema ? 'bullish' : 'bearish';
  const macdSignal: Signal = ind.macd > ind.macd_signal ? 'bullish' : 'bearish';
  const bbSignal: Signal = currentPrice > ind.bb_upper ? 'bearish' : currentPrice < ind.bb_lower ? 'bullish' : 'neutral';
  const stochSignal: Signal = ind.stoch_k < 20 ? 'bullish' : ind.stoch_k > 80 ? 'bearish' : 'neutral';
  const atrPct = currentPrice > 0 ? (ind.atr / currentPrice) * 100 : 0;
  const atrSignal: Signal = atrPct > 3 ? 'bearish' : atrPct > 1.5 ? 'neutral' : 'bullish';
  const mfiSignal: Signal = ind.mfi < 20 ? 'bullish' : ind.mfi > 80 ? 'bearish' : 'neutral';

  return [
    {
      name: 'RSI (14)',
      value: ind.rsi.toFixed(1),
      interpretation: ind.rsi < 30 ? 'Oversold — potential reversal up' : ind.rsi > 70 ? 'Overbought — potential pullback' : 'Neutral zone (30–70)',
      signal: rsiSignal,
    },
    {
      name: 'SMA (20)',
      value: `₹${ind.sma.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      interpretation: currentPrice > ind.sma ? 'Price above SMA — bullish trend' : 'Price below SMA — bearish trend',
      signal: smaSignal,
    },
    {
      name: 'EMA (20)',
      value: `₹${ind.ema.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      interpretation: currentPrice > ind.ema ? 'Price above EMA — bullish momentum' : 'Price below EMA — bearish momentum',
      signal: emaSignal,
    },
    {
      name: 'MACD',
      value: ind.macd.toFixed(2),
      interpretation: ind.macd > ind.macd_signal ? `MACD > Signal (${ind.macd_signal.toFixed(2)}) — bullish crossover` : `MACD < Signal (${ind.macd_signal.toFixed(2)}) — bearish crossover`,
      signal: macdSignal,
    },
    {
      name: 'Bollinger Bands',
      value: `${ind.bb_upper.toFixed(0)} / ${ind.bb_middle.toFixed(0)} / ${ind.bb_lower.toFixed(0)}`,
      interpretation: currentPrice > ind.bb_upper ? 'Above upper band — overbought' : currentPrice < ind.bb_lower ? 'Below lower band — oversold' : 'Within bands — normal',
      signal: bbSignal,
    },
    {
      name: 'Stochastic',
      value: `%K: ${ind.stoch_k.toFixed(1)} / %D: ${ind.stoch_d.toFixed(1)}`,
      interpretation: ind.stoch_k < 20 ? 'Oversold territory' : ind.stoch_k > 80 ? 'Overbought territory' : 'Mid-range',
      signal: stochSignal,
    },
    {
      name: 'ATR (14)',
      value: `₹${ind.atr.toFixed(2)}`,
      interpretation: `${atrPct.toFixed(1)}% of price — ${atrPct > 3 ? 'High' : atrPct > 1.5 ? 'Medium' : 'Low'} volatility`,
      signal: atrSignal,
    },
    {
      name: 'MFI (14)',
      value: ind.mfi.toFixed(1),
      interpretation: ind.mfi < 20 ? 'Oversold — money flowing out' : ind.mfi > 80 ? 'Overbought — heavy buying pressure' : 'Healthy money flow',
      signal: mfiSignal,
    },
  ];
}

export default function TechnicalTab({ data, isLoading, currentPrice, intervals, activeInterval, onIntervalChange }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="text-muted text-sm animate-pulse">Loading technical indicators...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 text-muted text-sm">
        No technical data available for this interval.
      </div>
    );
  }

  const indicatorCards = getIndicatorCards(data, currentPrice);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Interval Switcher */}
      <div className="flex gap-1.5 flex-wrap">
        {intervals.map(opt => (
          <button
            key={opt.label}
            onClick={() => onIntervalChange(opt)}
            className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer transition-all duration-150 border-none ${
              activeInterval.label === opt.label
                ? 'bg-lime text-black'
                : 'bg-card2 text-muted hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary + Support & Resistance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <TechnicalSummaryGauge summary={data.summary} />
        <SupportResistanceBar pivots={data.pivot_points} currentPrice={currentPrice} />
      </div>

      {/* 8 Indicator Cards in 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {indicatorCards.map(card => (
          <IndicatorCard key={card.name} {...card} />
        ))}
      </div>
    </div>
  );
}
