export default function TrustBar() {
  return (
    <section className="bg-[#0e0e13] py-16 px-8 border-y border-white/5">
      <div className="max-w-7xl mx-auto grid gap-8 md:grid-cols-3 grid-cols-1">
        {/* Stat 1 */}
        <div className="text-center font-mono-brand">
          <p className="text-[#C8FF00] text-3xl font-bold">1,200+</p>
          <p className="text-[#bacac2] text-xs uppercase tracking-widest mt-2">Active Stocks</p>
        </div>
        {/* Stat 2 */}
        <div className="text-center font-mono-brand">
          <p className="text-[#C8FF00] text-3xl font-bold">98.7%</p>
          <p className="text-[#bacac2] text-xs uppercase tracking-widest mt-2">System Uptime</p>
        </div>
        {/* Stat 3 */}
        <div className="text-center font-mono-brand">
          <p className="text-[#C8FF00] text-3xl font-bold">&lt; 200ms</p>
          <p className="text-[#bacac2] text-xs uppercase tracking-widest mt-2">Data Latency</p>
        </div>
      </div>
    </section>
  );
}
