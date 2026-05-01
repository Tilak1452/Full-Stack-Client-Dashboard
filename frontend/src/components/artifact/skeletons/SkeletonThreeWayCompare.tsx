import { Shimmer } from "./Shimmer";

export function SkeletonThreeWayCompare() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-forwards">
      
      {/* Compare Columns Skeleton */}
      <div className="mb-3">
        <div className="grid mb-2" style={{ gridTemplateColumns: "100px repeat(3, 1fr)", gap: "6px" }}>
          <div />
          <div className="rounded-lg p-2 border border-white/5 bg-zinc-900 flex justify-center">
            <Shimmer width="60px" height="14px" />
          </div>
          <div className="rounded-lg p-2 border border-white/5 bg-zinc-900 flex justify-center">
            <Shimmer width="60px" height="14px" />
          </div>
          <div className="rounded-lg p-2 border border-white/5 bg-zinc-900 flex justify-center">
            <Shimmer width="60px" height="14px" />
          </div>
        </div>
        
        {/* 5 Rows of Metrics */}
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid items-center mb-1" style={{ gridTemplateColumns: "100px repeat(3, 1fr)", gap: "6px" }}>
            <Shimmer width="70px" height="12px" />
            <div className="bg-zinc-900 border border-white/5 rounded-lg p-2 flex justify-center">
              <Shimmer width="40px" height="12px" />
            </div>
            <div className="bg-zinc-900 border border-white/5 rounded-lg p-2 flex justify-center">
              <Shimmer width="40px" height="12px" />
            </div>
            <div className="bg-zinc-900 border border-white/5 rounded-lg p-2 flex justify-center">
              <Shimmer width="40px" height="12px" />
            </div>
          </div>
        ))}
      </div>

      {/* Bar Chart Skeletons */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="120px" height="12px" className="mb-3" />
        <div className="flex items-end gap-1 h-12">
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div className="w-full rounded-sm bg-zinc-800" style={{ height: `${Math.random() * 60 + 20}%` }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
