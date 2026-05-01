"use client";
import { ComponentProps } from "@/lib/artifact-types";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

export function RevenueProfitChart({ slots }: ComponentProps) {
  const fin = slots.financials;
  if (!fin || !fin.timeline || fin.timeline.length === 0) return null;

  // Transform timeline data
  const data = fin.timeline.map((t: any) => ({
    period: t.period || t.date?.split("-")[0] || "",
    revenue: Number(t.total_revenue || 0) / 1e7, // Convert to Crores
    profit: Number(t.net_income || 0) / 1e7,
  })).reverse(); // Oldest first usually better for charts

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-4">Financial Growth (Cr)</h3>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={2}>
            <XAxis 
              dataKey="period" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "#71717a", fontSize: 10 }} 
              dy={10} 
            />
            <Tooltip
              cursor={{ fill: "#27272a" }}
              contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px" }}
              itemStyle={{ color: "#e4e4e7" }}
            />
            <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={30} />
            <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-zinc-400">Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-400">Net Profit</span>
        </div>
      </div>
    </div>
  );
}
