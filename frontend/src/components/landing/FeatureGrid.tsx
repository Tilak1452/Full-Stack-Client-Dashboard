export default function FeatureGrid() {
  return (
    <section id="capabilities" className="py-32 px-8 md:px-24">
      {/* Section Header */}
      <div className="mb-16">
        <h2 className="text-4xl font-bold text-[#e4e1e9] tracking-tight mb-4 font-inter">
          Sovereign Capabilities
        </h2>
        <div className="w-20 h-1 bg-[#C8FF00]" />
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PortfolioCard />
        <AIResearchCard />
        <LiveTerminalCard />
      </div>
    </section>
  );
}

function PortfolioCard() {
  return (
    <div className="glass-card rounded-2xl p-8 relative overflow-hidden group flex flex-col justify-between" style={{ borderRadius: '0.75rem' }}>
      {/* Icon */}
      <div className="absolute top-0 right-0 p-8">
        <span className="material-symbols-outlined text-[#C8FF00] text-4xl">query_stats</span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full font-inter">
        <h3 className="text-2xl font-bold mb-4">Portfolio</h3>
        <p className="text-[#bacac2] mb-8">
          Deep-dive into risk exposure, sector correlation, and historical performance using institutional models.
        </p>

        {/* Metric rows */}
        <div className="space-y-4 mt-auto">
          <div className="bg-[#1f1f25] p-4 rounded-xl flex items-center justify-between border-l-4 border-[#C8FF00]">
            <span className="font-mono-brand text-sm">Diversification Score</span>
            <span className="text-[#C8FF00] font-bold">88/100</span>
          </div>
          <div className="bg-[#1f1f25] p-4 rounded-xl flex items-center justify-between border-l-4 border-[#D2BBFF]">
            <span className="font-mono-brand text-sm">Risk-Adjusted Return</span>
            <span className="text-[#D2BBFF] font-bold">2.44</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIResearchCard() {
  return (
    <div className="glass-card rounded-2xl p-8 flex flex-col justify-between border-t border-[#D2BBFF]" style={{ borderRadius: '0.75rem' }}>
      {/* AI Header Row */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-[#D2BBFF] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#131318] text-sm">smart_toy</span>
        </div>
        <span className="font-bold text-[#D2BBFF] font-inter">AI Research</span>
      </div>

      {/* Chat Preview */}
      <div className="space-y-4 font-inter">
        {/* User bubble */}
        <div className="bg-[#2a292f] p-3 rounded-lg text-sm text-[#bacac2]">
          "Compare Tata Motors vs Mahindra &amp; Mahindra for the next 12 months?"
        </div>
        {/* AI response bubble */}
        <div className="bg-[#D2BBFF]/10 p-3 rounded-lg text-sm border border-[#D2BBFF]/20">
          <span className="text-[#D2BBFF] font-bold block mb-1 italic">Analyst AI:</span>
          "Based on EV roadmap and commercial volume, Tata Motors shows a 14% higher alpha potential..."
        </div>
      </div>

      {/* Bottom divider + security note */}
      <div className="mt-auto pt-8">
        <div className="h-[1px] bg-white/5 mb-4" />
        <p className="text-xs text-[#bacac2] font-mono-brand">SECURE SESSION ENCRYPTED</p>
      </div>
    </div>
  );
}

function LiveTerminalCard() {
  return (
    <div className="glass-card rounded-2xl p-8 overflow-hidden group border-t border-[#C8FF00] flex flex-col" style={{ borderRadius: '0.75rem' }}>
      <h3 className="text-2xl font-bold mb-4 font-mono-brand tracking-tight">LIVE TERMINAL</h3>

      {/* Terminal readout lines */}
      <div className="font-mono-brand text-[10px] space-y-2 opacity-70 mt-auto">
        <div className="flex justify-between">
          <span>FETCH_NIFTY50_RT</span>
          <span className="text-[#C8FF00]">OK</span>
        </div>
        <div className="flex justify-between">
          <span>LATENCY_MS</span>
          <span className="text-[#C8FF00]">142</span>
        </div>
        <div className="flex justify-between">
          <span>WS_STREAM_CONNECT</span>
          <span className="text-[#C8FF00]">ACTIVE</span>
        </div>
        <div className="h-[1px] bg-white/10 my-4" />
        <div className="text-[#e4e1e9]">SCANNING ORDER BOOKS...</div>
        <div className="text-[#D2BBFF]">WHALE MOVEMENT DETECTED: HDFCBANK</div>
      </div>
    </div>
  );
}
