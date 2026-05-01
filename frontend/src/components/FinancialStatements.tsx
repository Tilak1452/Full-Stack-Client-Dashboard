"use client";
import React from "react";

interface Statement {
  period?: string;
  date?: string;
  revenue?: number | null;
  total_revenue?: number | null;
  net_income?: number | null;
  gross_profit?: number | null;
  operating_income?: number | null;
  ebitda?: number | null;
  eps?: number | null;
}

interface Props {
  quarterly: Statement[];
  annual: Statement[];
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `₹${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `₹${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e7)  return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e6)  return `₹${(v / 1e6).toFixed(2)}M`;
  return `₹${v.toFixed(0)}`;
}

function getLabel(s: Statement) {
  return s.date ?? s.period ?? "—";
}
function getRev(s: Statement) { return s.revenue ?? s.total_revenue ?? null; }

function IncomeChart({ data, label }: { data: Statement[]; label: string }) {
  if (!data || data.length === 0) {
    return <div className="text-muted text-sm text-center py-6">No {label} data available</div>;
  }
  const sorted = [...data].reverse().slice(-8);
  const maxVal = Math.max(...sorted.map(d => Math.max(Math.abs(getRev(d) ?? 0), Math.abs(d.net_income ?? 0))));

  return (
    <div className="flex flex-col gap-3">
      {/* Bar chart */}
      <div className="flex gap-1.5 items-end h-[120px] overflow-x-auto pb-1">
        {sorted.map((item, idx) => {
          const rev = getRev(item);
          const profit = item.net_income;
          const revH = maxVal > 0 ? ((Math.abs(rev ?? 0)) / maxVal) * 100 : 0;
          const profH = maxVal > 0 ? ((Math.abs(profit ?? 0)) / maxVal) * 100 : 0;
          const isLoss = (profit ?? 0) < 0;
          return (
            <div key={idx} className="flex flex-col items-center gap-1 flex-1 min-w-[40px]">
              <div className="flex gap-0.5 items-end h-[100px]">
                <div
                  className="w-3.5 rounded-t-sm transition-all duration-500"
                  style={{ height: `${revH}px`, background: "rgba(200,255,0,0.55)" }}
                  title={`Revenue: ${fmt(rev)}`}
                />
                <div
                  className="w-3.5 rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${profH}px`,
                    background: isLoss ? "rgba(248,113,113,0.65)" : "rgba(110,231,183,0.65)",
                  }}
                  title={`Net Income: ${fmt(profit)}`}
                />
              </div>
              <div className="text-[8.5px] text-muted text-center leading-tight whitespace-nowrap">
                {getLabel(item).slice(-5)}
              </div>
            </div>
          );
        })}
      </div>
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-muted font-medium">Period</th>
              <th className="text-right px-3 py-2 text-muted font-medium">Revenue</th>
              <th className="text-right px-3 py-2 text-muted font-medium">Gross Profit</th>
              <th className="text-right px-3 py-2 text-muted font-medium">EBITDA</th>
              <th className="text-right px-3 py-2 text-muted font-medium">Net Income</th>
              <th className="text-right px-3 py-2 text-muted font-medium">EPS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const income = s.net_income;
              const isLoss = (income ?? 0) < 0;
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-card2/40 transition-colors">
                  <td className="px-3 py-2 text-text font-medium">{getLabel(s)}</td>
                  <td className="px-3 py-2 text-right text-lime">{fmt(getRev(s))}</td>
                  <td className="px-3 py-2 text-right text-muted">{fmt(s.gross_profit)}</td>
                  <td className="px-3 py-2 text-right text-muted">{fmt(s.ebitda)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${isLoss ? "text-red" : "text-green"}`}>
                    {fmt(income)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted">
                    {s.eps != null ? `₹${s.eps.toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "rgba(200,255,0,0.55)" }} />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "rgba(110,231,183,0.65)" }} />
          Net Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "rgba(248,113,113,0.65)" }} />
          Net Loss
        </span>
      </div>
    </div>
  );
}

export default function FinancialStatements({ quarterly, annual }: Props) {
  const [tab, setTab] = React.useState<"quarterly" | "annual">("quarterly");
  const data = tab === "quarterly" ? quarterly : annual;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 bg-card2 rounded-xl p-1 w-fit">
        {(["quarterly", "annual"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-all duration-200 border-none capitalize ${
              tab === t ? "bg-lime text-black" : "bg-transparent text-muted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <IncomeChart data={data} label={tab} />
    </div>
  );
}
