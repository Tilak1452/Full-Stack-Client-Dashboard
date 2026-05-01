"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface VerdictBannerProps extends ComponentProps { position?: "top" | "bottom"; }

export function VerdictBanner({ slots, position = "bottom" }: VerdictBannerProps) {
  const signal = slots.verdict?.technical ?? slots.technicals?.overall_technical_signal ?? "NEUTRAL";
  const isBuy  = signal.includes("BUY") || signal === "BULLISH";
  const isSell = signal.includes("SELL") || signal === "BEARISH";

  const bg   = isBuy ? "bg-green-400/5 border-green-400/20" : isSell ? "bg-red-400/5 border-red-400/20" : "bg-zinc-800/50 border-zinc-600/20";
  const tc   = isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-zinc-400";
  const badge = isBuy ? "bg-green-400/10 text-green-400 border-green-400/30" : isSell ? "bg-red-400/10 text-red-400 border-red-400/30" : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";

  const reasons: string[] = [];
  const tech = slots.technicals; const fund = slots.fundamentals; const news = slots.news;
  if (tech?.macd_trend === "BULLISH") reasons.push("Strong MACD crossover");
  if (tech?.rsi_signal === "NEUTRAL") reasons.push("RSI below overbought");
  if (news?.mood === "BULLISH") reasons.push("positive news sentiment");
  if (fund?.pe_assessment === "EXPENSIVE") reasons.push("Premium PE vs sector warrants caution on position sizing");
  if (fund?.revenue_trend === "GROWING") reasons.push("growing revenue trend");

  const text = reasons.join(". ") + (reasons.length ? "." : "") || fund?.brief_text || tech?.brief_text || "";

  return (
    <div className={`rounded-xl border p-4 mb-3 flex items-start gap-3 ${bg}`}>
      <span className={`text-xs px-3 py-1 rounded-full border font-semibold shrink-0 mt-0.5 ${badge}`}>
        {signal.replace(/_/g, " ")}
      </span>
      {text && <p className={`text-xs leading-relaxed ${tc} opacity-80`}>{text}</p>}
    </div>
  );
}
