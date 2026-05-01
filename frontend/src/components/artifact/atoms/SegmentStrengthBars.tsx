"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function SegmentStrengthBars({ slots }: ComponentProps) {
  const compareData = slots.compare || [];
  if (compareData.length < 2) return null;

  // We will compare RSI and Market Cap to create two "Strength" bars.
  const rsiVals = compareData.map(c => Number(c?.technicals?.rsi_14 || 0));
  const mcVals = compareData.map(c => Number(c?.stock_data?.market_cap || 0));

  const totalRsi = rsiVals.reduce((a, b) => a + b, 0) || 1;
  const totalMc = mcVals.reduce((a, b) => a + b, 0) || 1;

  const getColors = (idx: number) => {
    const colors = ["bg-lime", "bg-blue-500", "bg-purple-500"];
    return colors[idx % colors.length];
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-4">Relative Strength</h3>
      
      {/* RSI Momentum Comparison */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
          <span>Momentum (RSI)</span>
        </div>
        <div className="flex w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          {rsiVals.map((val, idx) => (
            <div key={idx} className={`${getColors(idx)} transition-all duration-1000`} style={{ width: `${(val / totalRsi) * 100}%` }} />
          ))}
        </div>
      </div>

      {/* Market Cap Comparison */}
      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
          <span>Scale (Market Cap)</span>
        </div>
        <div className="flex w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          {mcVals.map((val, idx) => (
            <div key={idx} className={`${getColors(idx)} transition-all duration-1000`} style={{ width: `${(val / totalMc) * 100}%` }} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 justify-center">
        {compareData.map((c, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${getColors(idx)}`} />
            <span className="text-[10px] text-zinc-400">{c?.symbol?.replace(".NS", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
