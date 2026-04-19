"use client";

import React from 'react';

const STATIC_STOCKS = [
  { symbol: 'RELIANCE.NS', value: '+2.4%', direction: 'positive' },
  { symbol: 'NIFTY 50', value: '22,345.20 (+0.8%)', direction: 'positive' },
  { symbol: 'SENSEX', value: '73,651.35 (+0.7%)', direction: 'positive' },
  { symbol: 'TCS.NS', value: '-1.2%', direction: 'negative' },
  { symbol: 'HDFCBANK.NS', value: '+0.4%', direction: 'positive' },
  { symbol: 'INFY.NS', value: '-0.5%', direction: 'negative' },
];

export default function TickerTape() {
  return (
    <div className="ticker-wrap font-mono-brand text-xs tracking-tighter py-2">
      <div className="ticker-animate space-x-12">
        {/* Render twice for seamless loop */}
        {[...STATIC_STOCKS, ...STATIC_STOCKS].map((stock, i) => (
          <div key={i} className="flex gap-2 min-w-max">
            <span className="text-[#bacac2]">{stock.symbol}</span>
            <span className={stock.direction === 'positive' ? 'text-[#C8FF00]' : 'text-[#ffb4ab]'}>
              {stock.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
