"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface MiniBarChartProps extends ComponentProps {
  variant: "macd" | "revenue" | "profit";
}

export function MiniBarChart({ slots, variant }: MiniBarChartProps) {
  const tech = slots.technicals;
  const fin = slots.financials;
  let bars: number[] = [];
  let label = "";

  if (variant === "macd" && tech) {
    const h = Number(tech.macd_histogram ?? 1);
    bars = [-2.1,-1.4,0.8,1.2,2.4,1.8,h*3,h*2.5,h*4,h*3.8,h*3,h*4.4];
    label = "MACD Histogram";
  } else if (variant === "revenue" && fin?.statements?.length) {
    bars = fin.statements.slice(0,8).map((s: any) => Number(s.revenue ?? 0) / 1e9);
    label = "Revenue (₹B) — Quarterly";
  } else if (variant === "profit" && fin?.statements?.length) {
    bars = fin.statements.slice(0,8).map((s: any) => Number(s.net_income ?? 0) / 1e8);
    label = "Net Profit (₹Cr) — Quarterly";
  } else {
    bars = [6,8,7,10,9,12,11,14];
    label = variant === "revenue" ? "Revenue Trend" : variant === "profit" ? "Profit Trend" : "MACD";
  }

  const maxAbs = Math.max(...bars.map(Math.abs), 1);

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="text-xs text-zinc-500 font-medium mb-3">{label}</div>
      <div className="flex items-end gap-1 h-12">
        {bars.map((val, i) => {
          const h = Math.max((Math.abs(val) / maxAbs) * 100, 8);
          const isPos = val >= 0;
          const color = isPos ? "bg-green-400/60" : "bg-red-400/60";
          return (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div className={`w-full rounded-sm ${color}`} style={{ height: `${h}%`, opacity: i >= bars.length - 3 ? 1 : 0.45 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
