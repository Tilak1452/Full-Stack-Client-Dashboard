// frontend/src/lib/artifact-assembler.ts
// Core logic for the dynamic component assembly system.
// No React imports here — pure TypeScript utility functions only.

import { ComponentName, LayoutType, SlotData } from "./artifact-types";

// Maps layout type -> skeleton component name (used by ArtifactRenderer)
export const SKELETON_MAP: Record<LayoutType, string> = {
  hero_price:          "SkeletonHeroPrice",
  technical_focus:     "SkeletonTechnicalFocus",
  investment_thesis:   "SkeletonInvestmentThesis",
  three_way_compare:   "SkeletonThreeWayCompare",
  event_news_focus:    "SkeletonNewsEvent",
  financials_timeline: "SkeletonFinancialsTimeline",
  market_screener:     "SkeletonInvestmentThesis",   // reuse until dedicated skeleton added
  education_explainer: "SkeletonHeroPrice",           // reuse until dedicated skeleton added
  portfolio_snapshot:  "SkeletonInvestmentThesis",    // reuse until dedicated skeleton added
};

// Enforces render order rules:
// - VerdictBanner:top ALWAYS renders first
// - HeroMetric ALWAYS renders second (if present)
// - Everything else in original LLM order
export function resolveRenderOrder(components: ComponentName[]): ComponentName[] {
  const order: ComponentName[] = [];
  const added = new Set<ComponentName>();

  if (components.includes("VerdictBanner:top")) {
    order.push("VerdictBanner:top");
    added.add("VerdictBanner:top");
  }
  if (components.includes("HeroMetric")) {
    order.push("HeroMetric");
    added.add("HeroMetric");
  }
  for (const comp of components) {
    if (!added.has(comp)) {
      order.push(comp);
      added.add(comp);
    }
  }
  return order;
}

// Helper: Check if fundamentals has at least 3 valid non-null metrics
function hasMeaningfulFundamentals(s: SlotData): boolean {
  if (!s.fundamentals) return false;
  let validCount = 0;
  const f = s.fundamentals as any;
  const keysToCheck = ["pe_ratio", "eps", "roe", "debt_to_equity", "net_margin", "dividend_yield", "book_value", "price_to_book"];
  for (const k of keysToCheck) {
    if (f[k] !== null && f[k] !== undefined && f[k] !== "NaN" && !Number.isNaN(f[k])) validCount++;
  }
  return validCount >= 3;
}

// Helper: Check if technicals has core indicators
function hasMeaningfulTechnicals(s: SlotData): boolean {
  if (!s.technicals) return false;
  const t = s.technicals as any;
  // Require at least RSI or MACD to consider it meaningful
  return (t.rsi !== null && !Number.isNaN(t.rsi)) || (t.macd !== null && !Number.isNaN(t.macd));
}

// Helper: Check if compare data has valid entries
function hasMeaningfulCompare(s: SlotData): boolean {
  const c = s.compare as any;
  if (!c || !c.peers || c.peers.length === 0) return false;
  return true;
}

// Helper: Check if shareholding data is valid
function hasMeaningfulShareholding(s: SlotData): boolean {
  if (!s.fundamentals) return false;
  const f = s.fundamentals as any;
  return f.promoter_holding !== null || f.fii_holding !== null;
}

// Returns true if this component has enough slot data to render meaningfully.
// Used to decide: show real component OR show mini skeleton placeholder.
export function isComponentReady(component: ComponentName, slots: SlotData): boolean {
  const checks: Partial<Record<ComponentName, (s: SlotData) => boolean>> = {
    "HeroMetric":               (s) => s.price !== null,
    "MiniPriceCard":            (s) => s.price !== null,
    "MetricGrid:2col":          (s) => hasMeaningfulTechnicals(s) || hasMeaningfulFundamentals(s),
    "MetricGrid:3col":          (s) => hasMeaningfulTechnicals(s) || hasMeaningfulFundamentals(s),
    "MetricGrid:4col":          (s) => s.price !== null,
    "TechnicalGauges":          (s) => hasMeaningfulTechnicals(s),
    "SupportResistanceBar":     (s) => hasMeaningfulTechnicals(s),
    "SignalRow":                (s) => hasMeaningfulTechnicals(s) || hasMeaningfulFundamentals(s),
    "SignalRow:expanded":       (s) => hasMeaningfulTechnicals(s),
    "FundamentalGrid":          (s) => hasMeaningfulFundamentals(s),
    "RevenueProfitChart":       (s) => s.financials !== null,
    "BarChart:macd":            (s) => hasMeaningfulTechnicals(s),
    "BarChart:revenue":         (s) => s.financials !== null,
    "BarChart:profit":          (s) => s.financials !== null,
    "ProgressBar:shareholding": (s) => hasMeaningfulShareholding(s),
    "ShareholdingProgress":     (s) => hasMeaningfulShareholding(s),
    "NewsItem:3":               (s) => s.news !== null,
    "NewsItem:5":               (s) => s.news !== null,
    "NewsFeed":                 (s) => s.news !== null,
    "VerdictBanner":            (s) => s.verdict !== null || hasMeaningfulTechnicals(s),
    "VerdictBanner:top":        (s) => s.verdict !== null || hasMeaningfulTechnicals(s),
    "VerdictCard":              (s) => s.verdict !== null,
    "ExpandSection:technical":  (s) => hasMeaningfulTechnicals(s),
    "ExpandSection:risk":       (s) => hasMeaningfulFundamentals(s),
    "ExpandableRiskPanel":      (s) => hasMeaningfulFundamentals(s),
    "CompareColumns:2":         (s) => hasMeaningfulCompare(s),
    "CompareColumns:3":         (s) => hasMeaningfulCompare(s),
    "PeerComparisonTable":      (s) => hasMeaningfulCompare(s),
    "SegmentStrengthBars":      (s) => hasMeaningfulCompare(s),
    "RankedList":               (_) => true,
    "TimelineRow:4q":           (s) => s.financials !== null,
    "TimelineRow:8q":           (s) => s.financials !== null,
  };
  const check = checks[component];
  return check ? check(slots) : true;
}

// Splits "MetricGrid:3col" -> "3col"
export function extractVariant(component: ComponentName): string | undefined {
  const parts = component.split(":");
  return parts.length > 1 ? parts[1] : undefined;
}

// Splits "MetricGrid:3col" -> "MetricGrid"
export function extractBaseName(component: ComponentName): string {
  return component.split(":")[0];
}
