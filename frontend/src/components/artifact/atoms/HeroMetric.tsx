"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function HeroMetric({ slots, emphasis, symbol }: ComponentProps) {
  const price = slots.price;
  const fund = slots.fundamentals;
  const verdict = slots.verdict?.technical ?? slots.technicals?.overall_technical_signal ?? "NEUTRAL";
  const changeVal = price?.change_pct ?? 0;
  const isPos = changeVal >= 0;

  const verdictBg = verdict.includes("BUY") ? "bg-lime/10 text-lime border-lime/30"
    : verdict.includes("SELL") ? "bg-red-400/10 text-red-400 border-red-400/30"
    : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";
  const changeBg = isPos ? "bg-green-400/10 text-green-400 border-green-400/20"
    : "bg-red-400/10 text-red-400 border-red-400/20";

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lime font-semibold text-sm">{symbol ?? "—"}</span>
        <span className="text-xs text-zinc-500">NSE</span>
        {slots.verdict || slots.technicals ? (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${verdictBg}`}>
            {verdict.replace(/_/g, " ")}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-zinc-600">
          Live · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-bold text-white">
          {price?.current_price != null ? `₹${Number(price.current_price).toLocaleString("en-IN")}` : "—"}
        </span>
        {price?.change_pct != null && (
          <span className={`text-sm px-2 py-0.5 rounded-full border font-medium ${changeBg}`}>
            {isPos ? "+" : ""}{Number(changeVal).toFixed(1)}% today
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        {price?.company_name ?? symbol} · {fund?.sector ?? "Technology"}
      </p>
    </div>
  );
}
