"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function VerdictCard({ slots }: ComponentProps) {
  const verdict = slots.verdict;
  if (!verdict) return null;

  const content = verdict.overall_verdict || verdict.technical || verdict.fundamental || "";
  if (!content) return null;

  // Render markdown-like bullet points natively
  const sections = content.split('\n\n').filter(Boolean);

  return (
    <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl border border-lime/20 p-5 mb-3 shadow-[0_0_15px_rgba(200,255,0,0.05)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-lime animate-pulse" />
        <h3 className="text-sm text-white font-semibold uppercase tracking-wider">AI Verdict</h3>
      </div>
      
      <div className="space-y-3">
        {sections.map((section: string, idx: number) => {
          if (section.startsWith('**') && section.includes('**\n-')) {
            // It's a structured list
            const [titleLine, ...bullets] = section.split('\n');
            const title = titleLine.replace(/\*\*/g, '');
            return (
              <div key={idx} className="mb-2">
                <div className="text-sm font-medium text-lime mb-1">{title}</div>
                <ul className="space-y-1 pl-1">
                  {bullets.map((b, i) => (
                    <li key={i} className="text-sm text-zinc-300 flex items-start">
                      <span className="text-lime mr-2 mt-0.5">•</span>
                      <span>{b.replace(/^- /, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          } else {
            // Normal paragraph
            return (
              <p key={idx} className="text-sm text-zinc-300 leading-relaxed">
                {section.replace(/\*\*/g, '')}
              </p>
            );
          }
        })}
      </div>
    </div>
  );
}
