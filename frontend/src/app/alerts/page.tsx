"use client";

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '@/components/TopBar';
import { IcPlus } from '@/components/Icons';
import { alertsApi, AlertItem } from '@/lib/alerts.api';

export default function AlertsPage() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['alerts-active'],
    queryFn: alertsApi.getActive,
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: alertsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-active'] });
    },
  });

  const toggle = (alert: AlertItem) => {
    if (alert.status === 'active' || alert.status === 'triggered') {
      deleteMutation.mutate(alert.id);
    }
  };

  const getConditionType = (cond: string) => {
    if (cond.includes('rsi') || cond.includes('sma')) return 'indicator';
    if (cond.includes('price')) return 'price';
    return 'custom';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Alerts & Triggers" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex items-center justify-center">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Alerts & Triggers" />
        <div className="flex-1 overflow-y-auto p-5 md:p-[22px]">
          <div className="rounded-2xl bg-card border border-red/20 p-6 text-center">
            <p className="text-red text-sm">
              {error instanceof Error ? error.message : 'Failed to load data'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-lime text-sm hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const triggeredCount = alerts.filter(a => a.status === 'triggered').length;
  const totalCount = alerts.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Alerts & Triggers" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] flex flex-col gap-3.5">
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-1">
          {[
            { l: 'Active alerts', v: activeCount, c: 'text-lime' },
            { l: 'Triggered', v: triggeredCount, c: 'text-amber' },
            { l: 'Total alerts', v: totalCount, c: 'text-text' }
          ].map(c => (
            <div key={c.l} className="bg-card border border-border rounded-2xl p-5">
              <div className="text-[11px] text-muted mb-1.5">{c.l}</div>
              <div className={`text-[26px] font-semibold ${c.c}`}>{c.v}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-semibold">All alerts</div>
            <button className="flex items-center gap-1.5 bg-lime border-none rounded-[9px] px-4 py-2 text-[12.5px] font-semibold text-black cursor-pointer hover:opacity-90">
              <IcPlus c="#000" s={14} />New alert
            </button>
          </div>
          
          <div className="flex flex-col gap-2.5">
            {alerts.map((a) => (
              <div key={a.id} className={`flex items-center gap-3 bg-card2 rounded-[11px] p-[13px_16px] border ${
                a.status === 'triggered' ? 'border-amber/30' : 'border-border'
              }`}>
                <div className="w-9 h-9 rounded-[9px] bg-dim flex items-center justify-center text-[9.5px] font-bold text-muted uppercase shrink-0">
                  {a.symbol.slice(0, 4)}
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold mb-1">{a.symbol}</div>
                  <div className="text-[12px] text-muted">{a.condition} {a.threshold}</div>
                </div>
                <span className={`text-[10px] px-2 py-[3px] rounded-md font-semibold tracking-wide bg-dim text-muted uppercase`}>
                  {getConditionType(a.condition)}
                </span>
                {a.status === 'triggered' && (
                  <span className="text-[10px] px-2 py-[3px] rounded-md font-semibold tracking-wide bg-amber/10 text-amber">
                    triggered
                  </span>
                )}
                
                <button 
                  onClick={() => toggle(a)} 
                  disabled={deleteMutation.isPending}
                  className={`w-[38px] h-[22px] rounded-full border-none cursor-pointer relative transition-colors shrink-0 ml-2 ${
                    a.status === 'active' || a.status === 'triggered' ? 'bg-lime' : 'bg-dim'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all duration-200 ${
                    a.status === 'active' || a.status === 'triggered' ? 'left-[19px]' : 'left-[3px]'
                  }`} />
                </button>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center p-4 text-muted text-sm">No active alerts.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
