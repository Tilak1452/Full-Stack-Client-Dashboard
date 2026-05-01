import { Shimmer } from "./Shimmer";

export function SkeletonHeroPrice() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Shimmer width="70px" height="14px" />
        <Shimmer width="60px" height="18px" rounded="rounded-full" />
        <div className="ml-auto"><Shimmer width="90px" height="10px" /></div>
      </div>
      <div className="text-center py-6">
        <Shimmer width="160px" height="36px" rounded="rounded-xl" className="mx-auto mb-3" />
        <Shimmer width="100px" height="24px" rounded="rounded-full" className="mx-auto mb-2" />
        <Shimmer width="180px" height="10px" className="mx-auto" />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-4">
        {["H","L","Vol","Prev"].map(l => (
          <div key={l} className="bg-zinc-900 rounded-lg p-3 border border-white/5">
            <Shimmer width="20px" height="8px" className="mb-2" />
            <Shimmer width="50px" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
