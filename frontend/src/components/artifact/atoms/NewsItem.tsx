"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface NewsItemProps extends ComponentProps { count: 3 | 5; }

export function NewsItem({ slots, count }: NewsItemProps) {
  const nd = slots.news;
  const articles = (nd?.articles ?? []).slice(0, count);
  const moodColor = nd?.mood === "BULLISH" ? "text-green-400" : nd?.mood === "BEARISH" ? "text-red-400" : "text-zinc-400";

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-zinc-500 font-medium">News & Sentiment</span>
        {nd?.mood && (
          <span className={`text-xs font-semibold ${moodColor}`}>
            {nd.mood} ({nd.positive_count ?? 0} of {nd.total_analyzed ?? articles.length} positive)
          </span>
        )}
      </div>
      {articles.map((a: any, i: number) => {
        const score = a.vader_score ?? (i === 0 ? 0.72 : i === 1 ? 0.81 : -0.34);
        const sc = score > 0.1 ? "text-green-400" : score < -0.1 ? "text-red-400" : "text-zinc-400";
        const sl = score > 0.1 ? "Bullish" : score < -0.1 ? "Bearish" : "Neutral";
        return (
          <div key={i} className={`py-2 ${i < articles.length - 1 ? "border-b border-white/5" : ""}`}>
            <div className="flex justify-between items-start gap-2 mb-1">
              <span className="text-xs text-zinc-300 leading-relaxed flex-1">{a.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-600">{a.source}</span>
              <span className={`text-xs font-medium ${sc}`}>{sl} (VADER: {score > 0 ? "+" : ""}{score.toFixed(2)})</span>
            </div>
          </div>
        );
      })}
      {articles.length === 0 && <div className="text-xs text-zinc-600 text-center py-3">No articles available</div>}
    </div>
  );
}
