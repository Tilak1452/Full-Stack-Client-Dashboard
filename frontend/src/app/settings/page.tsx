"use client";

import React from 'react';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  const { user } = useAuth();
  const InputCls = "bg-card2 border border-border rounded-[10px] p-[10px_14px] text-text text-[13px] outline-none font-sans w-full focus:border-border-hi transition-colors";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto p-5 md:p-[22px] grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        <div className="flex flex-col gap-3.5">
          <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
            <div className="text-sm font-semibold mb-4">Profile</div>
            {[
              ['Full name', user?.name || ''],
              ['Email', user?.email || ''],
              ['Phone', '+91 98765 43210']
            ].map(([l, v]) => (
              <div key={l} className="mb-3.5">
                <div className="text-[11.5px] text-muted mb-1.5 tracking-[0.04em]">{l}</div>
                <input defaultValue={v} className={InputCls} />
              </div>
            ))}
            <button className="bg-lime border-none rounded-[10px] px-5 py-2.5 text-[13px] font-semibold text-black cursor-pointer mt-1 hover:opacity-90">
              Save profile
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
            <div className="text-sm font-semibold mb-4">Plan</div>
            <div className="bg-gradient-to-br from-lime-dim to-purple/10 border border-lime/20 rounded-xl p-[16px_18px] mb-3.5">
              <div className="text-[11px] text-lime tracking-[0.08em] mb-1 font-semibold">CURRENT PLAN</div>
              <div className="text-xl font-semibold">
                Pro <span className="text-[13px] text-muted font-normal ml-1">₹999/month</span>
              </div>
              <div className="text-xs text-muted mt-1.5">AI queries: 342 / 500 used this month</div>
            </div>
            <button className="bg-transparent border border-border rounded-[10px] px-5 py-2.5 text-[13px] text-muted cursor-pointer hover:text-text hover:border-muted transition-colors">
              Upgrade to Team →
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
            <div className="text-sm font-semibold mb-4">API keys</div>
            {[
              ['Groq API key', 'gsk_••••••••••••••••••••'],
              ['Alpha Vantage', '••••••••••••••••'],
              ['NewsAPI', '••••••••••••••••']
            ].map(([l, v]) => (
              <div key={l} className="mb-3.5">
                <div className="text-[11.5px] text-muted mb-1.5 tracking-[0.04em]">{l}</div>
                <input defaultValue={v} type="password" className={InputCls} />
              </div>
            ))}
            <button className="bg-lime border-none rounded-[10px] px-5 py-2.5 text-[13px] font-semibold text-black cursor-pointer mt-1 hover:opacity-90">
              Update keys
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
            <div className="text-sm font-semibold mb-4">Notifications</div>
            {[
              ['Email alerts on price trigger', true],
              ['Daily portfolio summary', true],
              ['AI market insights (weekly)', false],
              ['News sentiment alerts', true]
            ].map(([l, on], i) => (
              <div key={i} className="flex items-center justify-between mb-3.5 last:mb-0">
                <span className="text-[13px] text-text">{l}</span>
                <button className={`w-[38px] h-[22px] rounded-full border-none cursor-pointer relative transition-colors ${
                  on ? 'bg-lime' : 'bg-dim'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all duration-200 ${
                    on ? 'left-[19px]' : 'left-[3px]'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
