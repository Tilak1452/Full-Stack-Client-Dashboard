import { Shimmer } from "./Shimmer";

export function SkeletonTechnicalFocus() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2 items-center">
          <Shimmer width="80px" height="14px" />
          <Shimmer width="70px" height="20px" rounded="rounded-full" />
        </div>
        <Shimmer width="80px" height="10px" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0,1,2].map(i => (
          <div key={i} className={`rounded-lg p-3 border ${i===1?"border-blue-400/20 bg-zinc-800":"border-white/5 bg-zinc-900"}`}>
            <Shimmer width="50px" height="8px" className="mb-2" />
            <Shimmer width="44px" height="20px" className="mb-1.5" />
            <Shimmer width="64px" height="8px" />
          </div>
        ))}
      </div>
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="110px" height="9px" className="mb-3" />
        {["MACD Line","Signal Line","Histogram","Last crossover","Trend","Interpretation"].map(r => (
          <div key={r} className="flex justify-between py-2 border-b border-white/5 last:border-0">
            <Shimmer width="90px" height="9px" />
            <Shimmer width="120px" height="9px" />
          </div>
        ))}
      </div>
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="100px" height="8px" className="mb-3" />
        <div className="flex items-end gap-1 h-14">
          {[6,8,5,9,12,7,14,10,16,12,14,18].map((h,i) => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div className="w-full bg-zinc-700 rounded-sm shimmer-animate" style={{height:`${(h/18)*100}%`,opacity:i>8?1:0.4}} />
            </div>
          ))}
        </div>
      </div>
      <Shimmer width="140px" height="10px" />
    </div>
  );
}
