"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  IcGrid, IcChart, IcBrain, IcBrief, IcBkmrk, IcNews, IcBell, IcGear, IcLogout
} from './Icons';

const NAV = [
  { id: 'dashboard', path: '/dashboard', Icon: IcGrid, label: 'Dashboard' },
  { id: 'stock', path: '/stock/RELIANCE.NS', Icon: IcChart, label: 'Stock Analysis' },
  { id: 'ai', path: '/ai-research', Icon: IcBrain, label: 'AI Research' },
  { id: 'portfolio', path: '/portfolio', Icon: IcBrief, label: 'Portfolio' },
  { id: 'watchlist', path: '/watchlist', Icon: IcBkmrk, label: 'Watchlist' },
  { id: 'news', path: '/news', Icon: IcNews, label: 'News' },
  { id: 'settings', path: '/settings', Icon: IcGear, label: 'Settings' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (pathname.startsWith('/auth')) {
    return null;
  }

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
      
      <div className="mt-auto flex flex-col items-center w-full mb-4 px-2">
        <button
          onClick={logout}
          className="w-10 h-10 rounded-[10px] bg-red/10 border border-red/20 cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-red hover:shadow-[0_0_12px_rgba(255,0,0,0.4)] group"
          title="Sign out"
        >
          <IcLogout className="text-red group-hover:text-white transition-colors duration-150" s={18} c="currentColor" />
        </button>
      </div>
    </div>
  );
}
