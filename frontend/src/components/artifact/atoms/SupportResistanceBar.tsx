"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function SupportResistanceBar({ slots }: ComponentProps) {
  const tech = slots.technicals;
  const priceData = slots.price;
  
  if (!tech || !priceData) return null;

  const price = Number(priceData.current_price ?? 0);
  const support = Number(tech.bollinger_lower ?? price * 0.9);
  const resistance = Number(tech.bollinger_upper ?? price * 1.1);

  if (!price || support === resistance) return null;

  const range = resistance - support;
  const positionPct = Math.min(Math.max(((price - support) / range) * 100, 0), 100);

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs text-zinc-500 font-medium">Support & Resistance (Bollinger)</span>
      </div>
      
      <div className="relative mt-6 mb-2">
        {/* The Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-green-500/50 via-zinc-700 to-red-500/50 rounded-full" />
        
        {/* Current Price Marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-1000"
          style={{ left: `${positionPct}%` }}
        >
          <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-zinc-900" />
          <span className="absolute -top-6 text-[10px] font-bold text-white bg-zinc-800 px-1.5 py-0.5 rounded">
            ₹{price.toFixed(0)}
          </span>
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500">Support</span>
            <span className="text-xs font-medium text-green-400">₹{support.toFixed(0)}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-zinc-500">Resistance</span>
            <span className="text-xs font-medium text-red-400">₹{resistance.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
