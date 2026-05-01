"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function ShareholdingProgress({ slots }: ComponentProps) {
  const shareholding = slots.fundamentals?.shareholding_pattern;

  // Fallback to dummy data if no real data is available yet
  const categories = shareholding?.promoter ? [
    { label: "Promoter", pct: parseFloat(shareholding.promoter), color: "bg-lime" },
    { label: "FII",      pct: parseFloat(shareholding.fii), color: "bg-blue-400" },
    { label: "DII",      pct: parseFloat(shareholding.dii), color: "bg-purple-400" },
    { label: "Public",   pct: parseFloat(shareholding.public), color: "bg-zinc-500" },
  ] : [
    { label: "Promoter", pct: 72.4, color: "bg-lime" },
    { label: "FII",      pct: 13.2, color: "bg-blue-400" },
    { label: "DII",      pct:  8.8, color: "bg-purple-400" },
    { label: "Public",   pct:  5.6, color: "bg-zinc-500" },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="text-xs text-zinc-500 font-medium mb-3">Shareholding Pattern</div>
      {categories.map((cat) => (
        <div key={cat.label} className="flex items-center gap-3 py-1.5">
          <span className="text-xs text-zinc-400 w-14 shrink-0">{cat.label}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${cat.pct}%` }} />
          </div>
          <span className="text-xs text-zinc-300 font-medium w-10 text-right">{cat.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
