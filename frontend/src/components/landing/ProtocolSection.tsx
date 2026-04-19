export default function ProtocolSection() {
  return (
    <section className="py-32 px-8 md:px-24 bg-[#1b1b20] overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Section eyebrow + headline */}
        <div className="text-center mb-24">
          <h2 className="font-mono-brand text-[#C8FF00] text-sm uppercase tracking-[0.3em] mb-4">
            The Methodology
          </h2>
          <p className="font-inter text-4xl md:text-5xl font-bold tracking-tight text-[#e4e1e9]">
            The Wealth Protocol
          </p>
        </div>

        {/* 3-Step row */}
        <div className="relative flex flex-col md:flex-row justify-between items-center gap-12 font-inter">
          {/* Connecting line — desktop only */}
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8FF00]/30 to-transparent -translate-y-1/2" />

          {/* Step 1 — Analyze */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-xs group">
            <div className="w-16 h-16 rounded-full bg-[#131318] border border-[#C8FF00] flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(200,255,0,0.2)] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[#C8FF00]">analytics</span>
            </div>
            <h4 className="text-xl font-bold mb-2 text-[#e4e1e9]">1. Analyze</h4>
            <p className="text-[#bacac2] text-sm">
              Our AI scans 10,000+ data points across global markets to identify institutional-grade setups.
            </p>
          </div>

          {/* Step 2 — Build */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-xs group">
            <div className="w-16 h-16 rounded-full bg-[#131318] border border-[#D2BBFF] flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(210,187,255,0.2)] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[#D2BBFF]">architecture</span>
            </div>
            <h4 className="text-xl font-bold mb-2 text-[#e4e1e9]">2. Build</h4>
            <p className="text-[#bacac2] text-sm">
              Construct diversified portfolios customized to your specific risk tolerance and return objectives.
            </p>
          </div>

          {/* Step 3 — Optimize */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-xs group">
            <div className="w-16 h-16 rounded-full bg-[#131318] border border-[#C8FF00] flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(200,255,0,0.2)] group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[#C8FF00]">tune</span>
            </div>
            <h4 className="text-xl font-bold mb-2 text-[#e4e1e9]">3. Optimize</h4>
            <p className="text-[#bacac2] text-sm">
              Continuously monitor and calibrate positions to maximize Alpha while managing downside risk.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
