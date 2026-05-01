"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface CompareColumnsProps extends ComponentProps { count: 2 | 3; }

export function CompareColumns({ slots, count }: CompareColumnsProps) {
  const compareData = slots.compare || [];
  
  // Create padded array to guarantee 'count' columns even if data is still streaming
  const columns = Array.from({ length: count }, (_, i) => compareData[i] || null);

  const getMetric = (col: any, metric: string) => {
    if (!col) return "—";
    switch (metric) {
      case "Price": return col.stock_data?.current_price ? `₹${col.stock_data.current_price}` : "—";
      case "PE Ratio": return col.fundamentals?.pe_ratio ? col.fundamentals.pe_ratio.toFixed(1) : "—";
      case "RSI": return col.technicals?.rsi_14 ? col.technicals.rsi_14.toFixed(1) : "—";
      case "Revenue": 
        const rev = col.financials?.statements?.[0]?.revenue;
        return rev ? `₹${(rev / 10000000).toFixed(1)}Cr` : "—";
      case "Trend": return col.technicals?.trend || "—";
      default: return "—";
    }
  };

  const metricLabels = ["Price", "PE Ratio", "RSI", "Revenue", "Trend"];

  return (
    <div className="mb-3">
      <div className="grid mb-2" style={{ gridTemplateColumns: `100px repeat(${count}, 1fr)`, gap: "6px" }}>
        <div />
        {columns.map((col, i) => (
          <div key={i} className={`rounded-lg p-2 text-center border ${i === 0 ? "border-lime/20 bg-zinc-800" : "border-white/5 bg-zinc-900"}`}>
            <div className={`text-xs font-semibold ${i === 0 ? "text-lime" : "text-zinc-300"} truncate`}>
              {col?.symbol?.replace(".NS", "") || `Stock ${String.fromCharCode(65 + i)}`}
            </div>
          </div>
        ))}
      </div>
      {metricLabels.map((m) => (
        <div key={m} className="grid items-center mb-1" style={{ gridTemplateColumns: `100px repeat(${count}, 1fr)`, gap: "6px" }}>
          <span className="text-xs text-zinc-500 truncate">{m}</span>
          {columns.map((col, i) => (
            <div key={i} className="bg-zinc-900 border border-white/5 rounded-lg p-2 text-center truncate">
              <span className={`text-xs ${i === 0 ? "text-zinc-300" : "text-zinc-400"}`}>{getMetric(col, m)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
