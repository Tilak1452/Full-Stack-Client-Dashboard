"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IcGrid, IcChart, IcBrain, IcBrief, IcBkmrk, IcNews, IcBell, IcGear
} from './Icons';

const NAV = [
  { id: 'dashboard', path: '/dashboard', Icon: IcGrid, label: 'Dashboard' },
  { id: 'stock', path: '/stock/RELIANCE.NS', Icon: IcChart, label: 'Stock Analysis' },
  { id: 'ai', path: '/ai-research', Icon: IcBrain, label: 'AI Research' },
  { id: 'portfolio', path: '/portfolio', Icon: IcBrief, label: 'Portfolio' },
  { id: 'watchlist', path: '/watchlist', Icon: IcBkmrk, label: 'Watchlist' },
  { id: 'news', path: '/news', Icon: IcNews, label: 'News' },
  { id: 'alerts', path: '/alerts', Icon: IcBell, label: 'Alerts' },
  { id: 'settings', path: '/settings', Icon: IcGear, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 bg-sidebar border-r border-border flex flex-col items-center py-[18px] gap-0.5 shrink-0">
      <Link href="/dashboard" className="mb-6 block">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-gradient-to-br from-lime to-[#7aaa00]">
          <span className="text-[18px] font-extrabold text-black tracking-[-1px]">F</span>
        </div>
      </Link>
      
      {NAV.map(({ id, path, Icon, label }) => {
        // active if pathname matches path or is active 'stock'
        const isOn = pathname.startsWith(`/${id}`) || (pathname === '/' && id === 'dashboard') || pathname === path;
        
        return (
          <Link
            key={id}
            href={path}
            title={label}
            className={`w-11 h-11 rounded-xl border-none cursor-pointer flex items-center justify-center relative transition-all duration-150 ${isOn ? 'bg-lime-dim' : 'bg-transparent'}`}
          >
            {isOn && (
              <div className="absolute -left-[10px] w-[3px] h-5 bg-lime rounded-r-[3px]" />
            )}
            <Icon c={isOn ? '#C8FF00' : '#636B7A'} s={18} />
          </Link>
        );
      })}
      
      <div className="mt-auto">
        <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold text-white cursor-pointer bg-gradient-to-br from-purple to-pink">
          A
        </div>
      </div>
    </div>
  );
}
