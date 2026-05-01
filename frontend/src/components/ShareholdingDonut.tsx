"use client";
import React from "react";
import type { ShareholdingData } from "@/lib/stock.api";

const COLORS = ["#C8FF00", "#6EE7B7", "#818CF8", "#F472B6", "#FB923C"];

interface Slice {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  let cumulative = 0;
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;

  return (
    <svg viewBox="0 0 140 140" className="w-[130px] h-[130px] shrink-0">
      {slices.map((s, i) => {
        const pct = s.value / total;
        const offset = circumference * (1 - cumulative - pct);
        const dashLen = circumference * pct - 2;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={16}
            strokeDasharray={`${dashLen < 0 ? 0 : dashLen} ${circumference}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
        cumulative += pct;
        return el;
      })}
      <circle cx={cx} cy={cy} r={42} fill="var(--card2, #0f1117)" />
    </svg>
  );
}

interface Props {
  data: ShareholdingData;
  /** Optional Finnhub-style top holders */
  topHolders?: { name: string; pct: number }[];
}

export default function ShareholdingDonut({ data, topHolders }: Props) {
  const inst = data.pct_held_by_institutions != null ? data.pct_held_by_institutions * 100 : null;
  const insider = data.pct_held_by_insiders != null ? data.pct_held_by_insiders * 100 : null;
  const floatPct = data.float_shares_pct != null ? data.float_shares_pct * 100 : null;

  const slices: Slice[] = [
    { label: "Institutional", value: inst ?? 0, color: COLORS[0] },
    { label: "Insiders", value: insider ?? 0, color: COLORS[1] },
    { label: "Float / Public", value: floatPct ? 100 - (inst ?? 0) - (insider ?? 0) : 0, color: COLORS[2] },
  ].filter(s => s.value > 0);

  const hasData = slices.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasData ? (
        <div className="flex items-center gap-5 flex-wrap">
          <DonutChart slices={slices} />
          <div className="flex flex-col gap-2.5 flex-1 min-w-[160px]">
            {slices.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-[12px] text-muted flex-1">{s.label}</span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {s.value.toFixed(1)}%
                </span>
              </div>
            ))}
            {data.number_of_institutions != null && (
              <div className="text-[10.5px] text-muted mt-1">
                {data.number_of_institutions.toLocaleString()} institutions hold this stock
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-muted text-sm text-center py-4">Shareholding data unavailable</p>
      )}

      {topHolders && topHolders.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Top Institutional Holders</div>
          {topHolders.slice(0, 5).map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 text-[11.5px] text-text truncate">{h.name}</div>
              <div className="w-24 h-1.5 bg-dim rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, h.pct * 100)}%`, background: COLORS[0] }}
                />
              </div>
              <div className="text-[11px] font-medium tabular-nums w-10 text-right">
                {(h.pct * 100).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
