"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function PeerComparisonTable({ slots }: ComponentProps) {
  const compareData = slots.compare || [];
  if (compareData.length < 2) return null;
  
  const columns = compareData;

  const getMetric = (col: any, metric: string) => {
    if (!col) return { val: "—", raw: 0 };
    switch (metric) {
      case "Price": return { val: col.stock_data?.current_price ? `₹${col.stock_data.current_price}` : "—", raw: col.stock_data?.current_price || 0 };
      case "PE Ratio": return { val: col.fundamentals?.pe_ratio ? col.fundamentals.pe_ratio.toFixed(1) : "—", raw: col.fundamentals?.pe_ratio || 999 };
      case "RSI": return { val: col.technicals?.rsi_14 ? col.technicals.rsi_14.toFixed(1) : "—", raw: col.technicals?.rsi_14 || 0 };
      case "Mkt Cap": return { val: col.stock_data?.market_cap ? `₹${(col.stock_data.market_cap / 1e7).toFixed(0)}Cr` : "—", raw: col.stock_data?.market_cap || 0 };
      case "Debt/Eq": return { val: col.fundamentals?.debt_to_equity ? col.fundamentals.debt_to_equity.toFixed(2) : "—", raw: col.fundamentals?.debt_to_equity || 999 };
      default: return { val: "—", raw: 0 };
    }
  };

  const metrics = [
    { label: "Price", highlight: "none" },
    { label: "PE Ratio", highlight: "lowest" }, // lower is better
    { label: "RSI", highlight: "none" },
    { label: "Mkt Cap", highlight: "highest" }, // higher is better
    { label: "Debt/Eq", highlight: "lowest" },  // lower is better
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 overflow-x-auto">
      <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-4">Peer Comparison</h3>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="pb-3 text-xs text-zinc-500 font-medium border-b border-white/5 w-1/4">Metric</th>
            {columns.map((col, i) => (
              <th key={i} className={`pb-3 text-sm font-semibold border-b border-white/5 ${i === 0 ? "text-lime" : "text-white"} text-center`}>
                {col?.symbol?.replace(".NS", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, rowIdx) => {
            const rawVals = columns.map(c => getMetric(c, m.label).raw);
            const validVals = rawVals.filter(v => v !== 0 && v !== 999);
            
            let winningIdx = -1;
            if (validVals.length > 0) {
              if (m.highlight === "highest") {
                const max = Math.max(...validVals);
                winningIdx = rawVals.indexOf(max);
              } else if (m.highlight === "lowest") {
                const min = Math.min(...validVals);
                winningIdx = rawVals.indexOf(min);
              }
            }

            return (
              <tr key={m.label} className={rowIdx !== metrics.length - 1 ? "border-b border-white/5" : ""}>
                <td className="py-3 text-xs text-zinc-400 font-medium">{m.label}</td>
                {columns.map((col, i) => {
                  const { val } = getMetric(col, m.label);
                  const isWinner = i === winningIdx;
                  return (
                    <td key={i} className="py-3 text-center">
                      <span className={`text-sm ${isWinner ? "text-green-400 font-semibold bg-green-400/10 px-2 py-0.5 rounded" : "text-zinc-300"}`}>
                        {val}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
