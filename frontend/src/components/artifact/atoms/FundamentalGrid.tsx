"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function FundamentalGrid({ slots }: ComponentProps) {
  const fund = slots.fundamentals;
  if (!fund) return null;

  const data = [
    { label: "P/E Ratio", value: fund.pe_ratio ? `${Number(fund.pe_ratio).toFixed(2)}x` : "—" },
    { label: "Sector P/E", value: fund.sector_pe ? `${Number(fund.sector_pe).toFixed(2)}x` : "—" },
    { label: "EPS (TTM)", value: fund.eps ? `₹${Number(fund.eps).toFixed(2)}` : "—" },
    { label: "ROE", value: fund.roe ? `${(Number(fund.roe) * 100).toFixed(1)}%` : "—" },
    { label: "Debt to Eq", value: fund.debt_to_equity ? Number(fund.debt_to_equity).toFixed(2) : "—" },
    { label: "Div Yield", value: fund.dividend_yield ? `${(Number(fund.dividend_yield) * 100).toFixed(2)}%` : "—" },
    { label: "Book Value", value: fund.book_value ? `₹${Number(fund.book_value).toFixed(1)}` : "—" },
    { label: "P/B Ratio", value: fund.price_to_book ? `${Number(fund.price_to_book).toFixed(2)}x` : "—" },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-3">Key Fundamentals</h3>
      <div className="grid grid-cols-4 gap-y-4 gap-x-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-[10px] text-zinc-500 mb-0.5">{item.label}</span>
            <span className="text-sm font-semibold text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
