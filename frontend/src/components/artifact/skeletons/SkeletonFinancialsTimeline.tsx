import { Shimmer } from "./Shimmer";

export function SkeletonFinancialsTimeline() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Shimmer width="150px" height="13px" />
        <Shimmer width="80px" height="9px" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {["Revenue","Profit"].map(label => (
          <div key={label} className="bg-zinc-900 rounded-xl border border-white/5 p-4">
            <Shimmer width="90px" height="8px" className="mb-3" />
            <div className="flex items-end gap-1 h-12">
              {[6,8,7,10,9,12,11,14].map((h,i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div className="w-full bg-zinc-700 rounded-sm shimmer-animate" style={{height:`${(h/14)*100}%`,opacity:i>5?1:0.5}} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid mb-2" style={{gridTemplateColumns:"70px repeat(3,1fr)",gap:"6px"}}>
        {["Quarter","Revenue","Net Profit","YoY"].map(h => <Shimmer key={h} width="60px" height="8px" />)}
      </div>
      {[0,1,2,3,4].map(i => (
        <div key={i} className="grid items-center mb-1" style={{gridTemplateColumns:"70px repeat(3,1fr)",gap:"6px"}}>
          <Shimmer width="60px" height="9px" />
          <Shimmer width="55px" height="9px" />
          <Shimmer width="55px" height="9px" />
          <Shimmer width="50px" height="16px" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}
