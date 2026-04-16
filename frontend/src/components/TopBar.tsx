"use client";

import React, { useState } from 'react';
import { IcSearch, IcBell } from './Icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function TopBar({ title }: { title: string }) {
  const [q, setQ] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && q.trim()) {
      router.push(`/stock/${q.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="px-6 h-[58px] flex items-center border-b border-border gap-3.5 shrink-0">
      <div className="font-semibold text-[17px] flex-1 tracking-[-0.02em]">{title}</div>
      
      <div className="flex items-center gap-2 bg-card border border-border rounded-[10px] px-3.5 py-[7px] w-[230px]">
        <IcSearch c="#636B7A" />
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          onKeyDown={handleSearch}
          placeholder="Search symbol… TCS.NS" 
          className="bg-transparent border-none outline-none text-text text-[12.5px] w-full"
        />
      </div>
      
      <div className="relative cursor-pointer">
        <IcBell c="#636B7A" />
        <div className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] bg-red rounded-full" />
      </div>
      
      <div className="flex items-center gap-2.5 cursor-pointer px-2.5 py-1.5 rounded-[10px] border border-border ml-2">
        <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-purple to-pink flex items-center justify-center text-[12px] font-bold text-white uppercase">
          {user?.name?.[0] || 'U'}
        </div>
        <div>
          <div className="text-[12.5px] font-medium leading-[1.2]">{user?.name || 'User'}</div>
          <div className="text-[10.5px] text-lime leading-[1.2]">Pro Plan</div>
        </div>
      </div>
    </div>
  );
}
