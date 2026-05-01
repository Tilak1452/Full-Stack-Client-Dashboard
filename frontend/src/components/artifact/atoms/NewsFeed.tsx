"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function NewsFeed({ slots }: ComponentProps) {
  const news = slots.news;
  if (!news || news.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-4">Latest News</h3>
      <div className="space-y-4">
        {news.map((item: any, idx: number) => {
          const sentimentClass = item.sentiment_label === "POSITIVE" ? "text-green-400" 
            : item.sentiment_label === "NEGATIVE" ? "text-red-400" 
            : "text-zinc-400";
            
          return (
            <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
              <div className="flex gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white group-hover:text-lime transition-colors line-clamp-2 mb-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-zinc-500">{item.publisher}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">{new Date(item.published_at * 1000).toLocaleDateString()}</span>
                    {item.sentiment_label && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className={`font-medium ${sentimentClass}`}>{item.sentiment_label}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
