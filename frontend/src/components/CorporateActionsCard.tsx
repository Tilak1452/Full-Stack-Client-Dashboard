"use client";
import React from "react";
import type { DividendRecord } from "@/lib/stock.api";

interface Props {
  dividends: DividendRecord[];
  nextEarnings?: string | null;
  earningsLow?: number | null;
  earningsHigh?: number | null;
  revenueLow?: number | null;
  revenueHigh?: number | null;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return `₹${v.toFixed(2)}`;
}

function fmtRev(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `₹${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  return `₹${v.toFixed(0)}`;
}

export default function CorporateActionsCard({ dividends, nextEarnings, earningsLow, earningsHigh, revenueLow, revenueHigh }: Props) {
  const hasDivs = dividends && dividends.length > 0;
  const hasEarnings = nextEarnings;

  return (
    <div className="flex flex-col gap-4">
      {/* Next Earnings */}
      {hasEarnings ? (
        <div className="bg-gradient-to-r from-lime/5 to-lime/0 border border-lime/20 rounded-xl p-4 flex items-start gap-4">
          <div className="text-3xl">📅</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Next Earnings Date</div>
            <div className="text-xl font-bold text-lime">{nextEarnings}</div>
            {(earningsLow != null || earningsHigh != null) && (
              <div className="text-[11.5px] text-muted mt-1">
                EPS estimate: {fmt(earningsLow)} – {fmt(earningsHigh)}
              </div>
            )}
            {(revenueLow != null || revenueHigh != null) && (
              <div className="text-[11.5px] text-muted">
                Revenue estimate: {fmtRev(revenueLow)} – {fmtRev(revenueHigh)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-muted text-[12px] text-center py-2">No upcoming earnings date scheduled</div>
      )}

      {/* Dividend History */}
      {hasDivs ? (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Dividend History</div>
          <div className="flex flex-col gap-1">
            {dividends.slice(0, 8).map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-[12px] text-muted">{d.date ?? "—"}</span>
                <span className="text-[12px] font-semibold text-lime">{fmt(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-muted text-[12px] text-center py-2">No recent dividends declared</div>
      )}
    </div>
  );
}
