"use client";
import { ComponentProps, EmphasisType } from "@/lib/artifact-types";

interface MetricGridProps extends ComponentProps {
  variant: "2col" | "3col" | "4col";
}

export function MetricGrid({ slots, emphasis, variant }: MetricGridProps) {
  const tech = slots.technicals;
  const fund = slots.fundamentals;
  const price = slots.price;

  const allMetrics = [
    tech?.rsi_14 != null && { label: "RSI (14)", value: Number(tech.rsi_14).toFixed(1), sub: tech.rsi_signal ?? "" },
    fund?.pe_ratio != null && { label: "P/E Ratio", value: `${Number(fund.pe_ratio).toFixed(1)}x`, sub: fund.pe_vs_sector ?? "" },
    tech?.macd_line != null && { label: "MACD", value: `+${Number(tech.macd_line).toFixed(1)}`, sub: `Signal: ${Number(tech.macd_signal ?? 0).toFixed(1)}` },
    fund?.market_cap != null && { label: "Market Cap", value: (() => { const c = Number(fund.market_cap) / 1e7; return c >= 1e4 ? `₹${(c/1e4).toFixed(1)}L Cr` : `₹${c.toFixed(0)} Cr`; })(), sub: fund.market_cap_category ?? "" },
    fund?.eps != null && { label: "EPS (TTM)", value: `₹${Number(fund.eps).toFixed(2)}`, sub: "" },
    fund?.["52w_high"] != null && { label: "52W High", value: `₹${Number(fund["52w_high"]).toLocaleString("en-IN")}`, sub: "" },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  const count = variant === "4col" ? 4 : variant === "3col" ? 3 : 2;
  const metrics = allMetrics.slice(0, count);
  const colClass = { "2col": "grid-cols-2", "3col": "grid-cols-3", "4col": "grid-cols-4" }[variant];
  const emphasisIdx = emphasis === "technicals_primary" ? 0 : emphasis === "fundamentals_primary" ? 1 : -1;

  return (
    <div className={`grid ${colClass} gap-2 mb-4`}>
      {metrics.map((m, i) => (
        <div key={m.label} className={`rounded-lg p-3 border ${i === emphasisIdx ? "bg-zinc-800 border-blue-400/20" : "bg-zinc-900 border-white/5"}`}>
          <div className="text-xs text-zinc-500 mb-1">{m.label}</div>
          <div className="text-lg font-semibold text-white">{m.value}</div>
          {m.sub && <div className="text-xs text-zinc-500 mt-0.5">{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}
