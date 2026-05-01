"use client";

import { ArtifactState, ComponentName } from "@/lib/artifact-types";
import { resolveRenderOrder, extractVariant, extractBaseName, isComponentReady } from "@/lib/artifact-assembler";

import { SkeletonHeroPrice }          from "./skeletons/SkeletonHeroPrice";
import { SkeletonTechnicalFocus }     from "./skeletons/SkeletonTechnicalFocus";
import { SkeletonInvestmentThesis }   from "./skeletons/SkeletonInvestmentThesis";
import { SkeletonNewsEvent }          from "./skeletons/SkeletonNewsEvent";
import { SkeletonFinancialsTimeline } from "./skeletons/SkeletonFinancialsTimeline";
import { SkeletonThreeWayCompare }    from "./skeletons/SkeletonThreeWayCompare";

import { HeroMetric }     from "./atoms/HeroMetric";
import { MetricGrid }     from "./atoms/MetricGrid";
import { SignalRow }      from "./atoms/SignalRow";
import { MiniBarChart }   from "./atoms/MiniBarChart";
import { ProgressBar }    from "./atoms/ProgressBar"; // Keeping old name for import if file isn't renamed
import { ShareholdingProgress } from "./atoms/ProgressBar";
import { NewsItem }       from "./atoms/NewsItem";
import { VerdictBanner }  from "./atoms/VerdictBanner";
import { ExpandSection }  from "./atoms/ExpandSection";
import { CompareColumns } from "./atoms/CompareColumns";
import { MiniPriceCard }  from "./atoms/MiniPriceCard";
import { TechnicalGauges } from "./atoms/TechnicalGauges";
import { SupportResistanceBar } from "./atoms/SupportResistanceBar";
import { FundamentalGrid } from "./atoms/FundamentalGrid";
import { RevenueProfitChart } from "./atoms/RevenueProfitChart";
import { PeerComparisonTable } from "./atoms/PeerComparisonTable";
import { SegmentStrengthBars } from "./atoms/SegmentStrengthBars";
import { VerdictCard }    from "./atoms/VerdictCard";
import { NewsFeed }       from "./atoms/NewsFeed";
import { ExpandableRiskPanel } from "./atoms/ExpandableRiskPanel";

// ── COMPONENT SKELETON SELECTOR ──────────────────────────────────────────────────
function ComponentSkeleton({ component }: { component: ComponentName }) {
  const base = extractBaseName(component);
  
  // Return specific skeletons for our atomic components
  switch (base) {
    case "HeroMetric":    return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-24 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    case "MiniPriceCard": return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-16 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    case "TechnicalGauges":return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-32 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    case "MetricGrid":    return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-20 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    case "VerdictBanner":
    case "VerdictCard":   return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-28 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    case "PeerComparisonTable": return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-48 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    case "SegmentStrengthBars": return <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 h-32 shimmer-animate" style={{background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />;
    default:
      // Generic fallback
      return (
        <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
          <div className="shimmer-animate rounded mb-3" style={{height:"9px",width:"120px",background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />
          <div className="shimmer-animate rounded mb-2" style={{height:"9px",width:"100%",background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />
          <div className="shimmer-animate rounded" style={{height:"9px",width:"75%",background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />
        </div>
      );
  }
}

// ── SINGLE COMPONENT RENDERER ─────────────────────────────────────────────────
function RenderComponent({ component, artifact }: { component: ComponentName; artifact: ArtifactState }) {
  const { slots, decision, symbol, isStreaming } = artifact;
  const emphasis = decision?.emphasis ?? "fundamentals_primary";
  const variant  = extractVariant(component);
  const base     = extractBaseName(component);
  const common   = { slots, emphasis, symbol, isStreaming };

  switch (base) {
    case "HeroMetric":    return <HeroMetric {...common} />;
    case "MetricGrid":    return <MetricGrid {...common} variant={(variant as "2col"|"3col"|"4col") ?? "3col"} />;
    case "SignalRow":     return <SignalRow {...common} expanded={variant === "expanded"} />;
    case "BarChart":      return <MiniBarChart {...common} variant={(variant as "macd"|"revenue"|"profit") ?? "macd"} />;
    case "ProgressBar":   return <ShareholdingProgress {...common} />; // Fallback for old queries
    case "ShareholdingProgress": return <ShareholdingProgress {...common} />;
    case "NewsItem":      return <NewsItem {...common} count={(parseInt(variant ?? "5") as 3|5)} />;
    case "VerdictBanner": return <VerdictBanner {...common} position={variant === "top" ? "top" : "bottom"} />;
    case "ExpandSection": return <ExpandSection {...common} variant={(variant as "technical"|"risk") ?? "technical"} />;
    case "CompareColumns":return <CompareColumns {...common} count={(parseInt(variant ?? "2") as 2|3)} />;
    case "MiniPriceCard": return <MiniPriceCard {...common} />;
    case "TechnicalGauges":return <TechnicalGauges {...common} />;
    case "SupportResistanceBar": return <SupportResistanceBar {...common} />;
    case "FundamentalGrid": return <FundamentalGrid {...common} />;
    case "RevenueProfitChart": return <RevenueProfitChart {...common} />;
    case "PeerComparisonTable": return <PeerComparisonTable {...common} />;
    case "SegmentStrengthBars": return <SegmentStrengthBars {...common} />;
    case "VerdictCard":   return <VerdictCard {...common} />;
    case "NewsFeed":      return <NewsFeed {...common} />;
    case "ExpandableRiskPanel": return <ExpandableRiskPanel {...common} />;
    default:              return null;
  }
}

// ── MAIN EXPORTED COMPONENT ───────────────────────────────────────────────────
export function ArtifactRenderer({ artifact }: { artifact: ArtifactState }) {
  const { decision, slots, text, isStreaming } = artifact;

  // Empty state
  if (!decision) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <div className="text-zinc-700 text-4xl mb-4">◈</div>
          <p className="text-sm text-zinc-600">Ask a question to see analysis here</p>
          <p className="text-xs text-zinc-700 mt-1">Results stream in as data is fetched</p>
        </div>
      </div>
    );
  }

  const { components } = decision;
  const renderOrder = resolveRenderOrder(components);

  return (
    <div className="flex-1 overflow-auto p-5">
      {/* Optional connecting text */}
      {text && text !== "null" && (
        <div className="border-l-2 border-lime pl-3 mb-4">
          <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
        </div>
      )}

      {/* Dynamic components */}
      {renderOrder.map((component, idx) => {
        const ready = isComponentReady(component, slots);
        
        // Component-specific skeleton placeholder
        if (isStreaming && !ready) {
          return <ComponentSkeleton key={`skel-${component}-${idx}`} component={component} />;
        }
        
        if (!ready) return null;
        
        return <RenderComponent key={`${component}-${idx}`} component={component} artifact={artifact} />;
      })}
    </div>
  );
}
