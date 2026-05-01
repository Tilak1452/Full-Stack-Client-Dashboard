import { Shimmer } from "./Shimmer";

export function SkeletonNewsEvent() {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <Shimmer width="100px" height="22px" className="mb-2" />
          <Shimmer width="80px" height="16px" rounded="rounded-full" />
        </div>
        <div className="text-right">
          <Shimmer width="70px" height="11px" className="mb-1" />
          <Shimmer width="50px" height="9px" />
        </div>
      </div>
      <Shimmer width="80px" height="9px" className="mb-3" />
      {[0,1,2,3,4].map(i => (
        <div key={i} className="py-2 border-b border-white/5 last:border-0">
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <Shimmer width={`${70+i*5}%`} height="10px" />
            <Shimmer width="80px" height="16px" rounded="rounded-full" />
          </div>
          <Shimmer width="80px" height="8px" />
        </div>
      ))}
      <div className="mt-3 bg-zinc-900 rounded-xl border border-white/5 p-3">
        <Shimmer width="90%" height="9px" className="mb-1.5" />
        <Shimmer width="70%" height="9px" />
      </div>
    </div>
  );
}
