"use client";

import React, { useEffect, useRef, memo } from 'react';

// Format Yahoo Finance symbol to TradingView symbol
// RELIANCE.NS -> NSE:RELIANCE
// TCS.BO -> BSE:TCS
function formatSymbol(symbol: string): string {
  if (!symbol) return 'BSE:RELIANCE';
  const upper = symbol.toUpperCase();
  
  // TradingView blocks live NSE data in their free embeddable public widgets.
  // We must route all Indian .NS queries to BSE instead, which remains free and unrestricted.
  if (upper.endsWith('.NS')) {
    return 'BSE:' + upper.replace('.NS', '');
  }
  if (upper.endsWith('.BO')) {
    return 'BSE:' + upper.replace('.BO', '');
  }
  
  // For global stocks without a suffix (e.g., AAPL), TradingView auto-resolves the exchange
  return upper;
}

function TradingViewWidget({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Prevent duplicate scripts in Strict Mode Development
    if (container.current && container.current.innerHTML !== '') {
      container.current.innerHTML = '';
    }

    const formattedSymbol = formatSymbol(symbol);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: "D",
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      backgroundColor: "#12141B",
      gridColor: "rgba(255, 255, 255, 0.06)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      studies: [
        "Volume@tv-basicstudies",
        "RSI@tv-basicstudies"
      ]
    });
      
    if (container.current) {
      container.current.appendChild(script);
    }
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
      <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }}></div>
    </div>
  );
}

export default memo(TradingViewWidget);
