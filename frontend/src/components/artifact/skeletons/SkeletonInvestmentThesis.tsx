import { Shimmer } from "./Shimmer";

export function SkeletonInvestmentThesis() {
  return (
    <div>
      {/* Hero row */}
      <div className="flex items-center gap-2 mb-2">
        <Shimmer width="80px" height="14px" />
        <Shimmer width="70px" height="20px" rounded="rounded-full" />
        <div className="ml-auto"><Shimmer width="100px" height="10px" /></div>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <Shimmer width="140px" height="32px" rounded="rounded-lg" />
        <Shimmer width="90px" height="22px" rounded="rounded-full" />
      </div>
      <Shimmer width="180px" height="10px" className="mb-4" />

      {/* Verdict banner */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 flex gap-3 mb-3">
        <Shimmer width="80px" height="22px" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer width="95%" height="9px" />
          <Shimmer width="80%" height="9px" />
        </div>
      </div>

      {/* MetricGrid:3col */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-zinc-900 rounded-lg p-3 border border-white/5">
            <Shimmer width="60px" height="8px" className="mb-2" />
            <Shimmer width="48px" height="18px" className="mb-1.5" />
            <Shimmer width="70px" height="8px" />
          </div>
        ))}
      </div>

      {/* SignalRow */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="120px" height="9px" className="mb-3" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
            <Shimmer width={`${70+i*10}px`} height="9px" />
            <Shimmer width={`${55+i*8}px`} height="9px" />
          </div>
        ))}
      </div>

      {/* ProgressBar */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="130px" height="9px" className="mb-3" />
        {["Promoter","FII","DII","Public"].map(l => (
          <div key={l} className="flex items-center gap-3 py-1.5">
            <Shimmer width="48px" height="9px" />
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full">
              <Shimmer width="65%" height="6px" rounded="rounded-full" />
            </div>
            <Shimmer width="36px" height="9px" />
          </div>
        ))}
      </div>

      {/* Expand trigger */}
      <Shimmer width="150px" height="10px" className="mt-2 mb-4" />

      {/* Generate button */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-3">
        <Shimmer width="60%" height="12px" className="mx-auto" />
      </div>
    </div>
  );
}
