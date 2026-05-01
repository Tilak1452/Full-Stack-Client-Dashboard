"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface SignalRowProps extends ComponentProps {
  expanded?: boolean;
}

export function SignalRow({ slots, emphasis, expanded = false }: SignalRowProps) {
  const tech = slots.technicals;
  const fund = slots.fundamentals;
  type Row = { label: string; value: string; highlight?: boolean };
  const rows: Row[] = [];

  if (tech) {
    rows.push({ label: "MACD Line", value: String(Number(tech.macd_line ?? 0).toFixed(2)) });
    rows.push({ label: "Signal Line", value: String(Number(tech.macd_signal ?? 0).toFixed(2)) });
    rows.push({ label: "Histogram", value: `${Number(tech.macd_histogram ?? 0).toFixed(2)} (${tech.macd_trend === "BULLISH" ? "bullish" : "bearish"})`, highlight: true });
    if (expanded) {
      rows.push({ label: "Trend", value: tech.macd_trend === "BULLISH" ? "Bullish crossover confirmed" : "Bearish crossover" });
      rows.push({ label: "Interpretation", value: tech.rsi_signal === "NEUTRAL" ? "Strong upward momentum signal" : tech.rsi_interpretation ?? "" });
    }
  }
  if (emphasis === "fundamentals_primary" && fund) {
    rows.push({ label: "Revenue Trend", value: fund.revenue_trend ?? "UNKNOWN" });
    rows.push({ label: "Profit Trend", value: fund.profit_trend ?? "UNKNOWN", highlight: true });
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      {emphasis === "technicals_primary" && <div className="text-xs text-zinc-500 font-medium mb-3">MACD — Momentum</div>}
      {rows.map((row, i) => (
        <div key={row.label} className={`flex justify-between items-center py-2 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
          <span className="text-xs text-zinc-400">{row.label}</span>
          <span className={`text-xs font-medium ${row.highlight ? "text-lime" : "text-zinc-200"}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
