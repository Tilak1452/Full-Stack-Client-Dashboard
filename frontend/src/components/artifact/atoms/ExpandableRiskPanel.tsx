"use client";
import { ComponentProps } from "@/lib/artifact-types";
import { useState } from "react";

export function ExpandableRiskPanel({ slots }: ComponentProps) {
  const [open, setOpen] = useState(false);
  const fund = slots.fundamentals;
  
  if (!fund) return null;

  const risks = [];
  if (fund.debt_to_equity && fund.debt_to_equity > 1.5) risks.push(`High Debt to Equity ratio (${fund.debt_to_equity.toFixed(2)})`);
  if (fund.roe && fund.roe < 0.1) risks.push(`Low Return on Equity (${(fund.roe * 100).toFixed(1)}%)`);
  if (fund.pe_ratio && fund.pe_ratio > 50) risks.push(`High Valuation (P/E ${fund.pe_ratio.toFixed(1)})`);

  if (risks.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm font-medium text-white">Risk Factors Identified ({risks.length})</span>
        </div>
        <span className="text-zinc-500 text-xs">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2 pt-3 border-t border-white/5">
          {risks.map((risk, idx) => (
            <div key={idx} className="flex gap-2 items-start text-xs text-zinc-300">
              <span className="text-red-500 mt-0.5">⚠</span>
              <span>{risk}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
