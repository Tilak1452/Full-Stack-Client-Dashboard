"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function MiniPriceCard({ slots, symbol }: ComponentProps) {
  const price = slots.price;
  const changeVal = price?.change_pct ?? 0;
  const isPos = changeVal >= 0;

  const changeBg = isPos ? "bg-green-400/10 text-green-400 border-green-400/20"
    : "bg-red-400/10 text-red-400 border-red-400/20";

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4 mb-3 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lime font-semibold text-sm">{symbol ?? "—"}</span>
          <span className="text-xs text-zinc-500">NSE</span>
        </div>
        <p className="text-xs text-zinc-500 truncate max-w-[150px]">{price?.company_name ?? symbol}</p>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold text-white mb-1">
          {price?.current_price != null ? `₹${Number(price.current_price).toLocaleString("en-IN")}` : "—"}
        </div>
        {price?.change_pct != null && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${changeBg}`}>
            {isPos ? "+" : ""}{Number(changeVal).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
