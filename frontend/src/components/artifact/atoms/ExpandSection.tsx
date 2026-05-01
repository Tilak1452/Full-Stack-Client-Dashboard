"use client";
import { useState } from "react";
import { ComponentProps } from "@/lib/artifact-types";

interface ExpandSectionProps extends ComponentProps { variant: "technical" | "risk"; }

export function ExpandSection({ slots, variant }: ExpandSectionProps) {
  const [open, setOpen] = useState(false);
  const tech = slots.technicals; const fund = slots.fundamentals;
  const label = variant === "technical" ? "Full Technical Details" : "Risk Factors";

  const rows = variant === "technical" ? [
    { label: "SMA-20",      value: tech?.sma_20 != null ? `₹${Number(tech.sma_20).toLocaleString("en-IN")}` : "—" },
    { label: "SMA-50",      value: tech?.sma_50 != null ? `₹${Number(tech.sma_50).toLocaleString("en-IN")}` : "—" },
    { label: "EMA-12",      value: tech?.ema_12 != null ? `₹${Number(tech.ema_12).toLocaleString("en-IN")}` : "—" },
    { label: "EMA-26",      value: tech?.ema_26 != null ? `₹${Number(tech.ema_26).toLocaleString("en-IN")}` : "—" },
    { label: "Support",     value: tech?.key_levels?.support != null ? `₹${Number(tech.key_levels.support).toLocaleString("en-IN")}` : "N/A" },
    { label: "Resistance",  value: tech?.key_levels?.resistance != null ? `₹${Number(tech.key_levels.resistance).toLocaleString("en-IN")}` : "N/A" },
  ] : [
    { label: "Valuation Risk", value: fund?.pe_ratio ? (Number(fund.pe_ratio) > 40 ? "High — Premium PE" : "Moderate") : "N/A" },
    { label: "Debt Risk",      value: fund?.debt_to_equity ? (Number(fund.debt_to_equity) > 2 ? "High — High Debt" : "Moderate") : "N/A" },
    { label: "Return on Eq.",  value: fund?.roe ? `${(Number(fund.roe) * 100).toFixed(1)}%` : "N/A" },
    { label: "Dividend",       value: fund?.dividend_yield ? `${(Number(fund.dividend_yield) * 100).toFixed(1)}%` : "N/A" },
  ];

  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="text-xs text-lime hover:underline flex items-center gap-1 mb-2">
        <span>{open ? "▲" : "▼"}</span> {open ? "Hide" : "Show"} {label}
      </button>
      {open && (
        <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex justify-between py-1.5 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
              <span className="text-xs text-zinc-500">{r.label}</span>
              <span className="text-xs text-zinc-300">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
