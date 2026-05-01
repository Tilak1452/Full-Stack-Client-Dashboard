"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function TechnicalGauges({ slots }: ComponentProps) {
  const tech = slots.technicals;
  if (!tech) return null;

  const rsi = Number(tech.rsi_14 ?? 50);
  const rsiPct = Math.min(Math.max(rsi, 0), 100);
  
  // RSI Color Logic
  const rsiColor = rsi > 70 ? "bg-red-500" : rsi < 30 ? "bg-green-500" : "bg-blue-400";
  const rsiText = rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral";

  // MACD Logic
  const macdVal = Number(tech.macd_line ?? 0);
  const macdSig = Number(tech.macd_signal ?? 0);
  const macdDiff = macdVal - macdSig;
  const macdColor = macdDiff >= 0 ? "text-green-400" : "text-red-400";
  const macdTrend = macdDiff >= 0 ? "Bullish Crossover" : "Bearish Crossover";

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 grid grid-cols-2 gap-4">
      {/* RSI Gauge */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500 font-medium">RSI (14)</span>
          <span className="text-sm font-semibold text-white">{rsi.toFixed(1)}</span>
        </div>
        <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-1">
          <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${rsiColor}`} style={{ width: `${rsiPct}%` }} />
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-zinc-600">0</span>
          <span className={`text-[10px] font-medium ${rsiColor.replace('bg-', 'text-')}`}>{rsiText}</span>
          <span className="text-[10px] text-zinc-600">100</span>
        </div>
      </div>

      {/* MACD Gauge */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-500 font-medium">MACD (12,26)</span>
          <span className={`text-sm font-semibold ${macdColor}`}>{macdDiff > 0 ? "+" : ""}{macdDiff.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 mb-1 h-2">
          {/* Visual indicator of separation */}
          <div className="flex-1 bg-zinc-800 rounded-full h-1 overflow-hidden flex">
             {macdDiff < 0 && <div className="h-full bg-red-500 w-full rounded-full transition-all duration-1000" style={{ transformOrigin: 'right', transform: `scaleX(${Math.min(Math.abs(macdDiff)/5, 1)})` }} />}
             {macdDiff >= 0 && <div className="h-full bg-green-500 w-full rounded-full transition-all duration-1000" style={{ transformOrigin: 'left', transform: `scaleX(${Math.min(Math.abs(macdDiff)/5, 1)})` }} />}
          </div>
        </div>
        <div className="flex justify-center items-center mt-1">
          <span className={`text-[10px] font-medium ${macdColor}`}>{macdTrend}</span>
        </div>
      </div>
    </div>
  );
}
