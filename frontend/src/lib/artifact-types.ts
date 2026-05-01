// frontend/src/lib/artifact-types.ts
// Single source of truth for all artifact system TypeScript types.
// Import from this file everywhere — never define these types locally.

// ── COMPONENT NAMES ───────────────────────────────────────────────────────────
// Must match EXACTLY what the LLM outputs in the "components" array field.
// Adding a new component requires: adding it here + adding render case in ArtifactRenderer.

export type ComponentName =
  | "HeroMetric"
  | "MiniPriceCard"
  | "MetricGrid:2col"
  | "MetricGrid:3col"
  | "MetricGrid:4col"
  | "TechnicalGauges"
  | "SupportResistanceBar"
  | "SignalRow"
  | "SignalRow:expanded"
  | "FundamentalGrid"
  | "RevenueProfitChart"
  | "BarChart:macd"
  | "BarChart:revenue"
  | "BarChart:profit"
  | "ProgressBar:shareholding"
  | "ShareholdingProgress"
  | "NewsItem:3"
  | "NewsItem:5"
  | "NewsFeed"
  | "RankedList"
  | "CompareColumns:2"
  | "CompareColumns:3"
  | "PeerComparisonTable"
  | "SegmentStrengthBars"
  | "VerdictBanner"
  | "VerdictBanner:top"
  | "VerdictCard"
  | "TimelineRow:4q"
  | "TimelineRow:8q"
  | "ExpandSection:technical"
  | "ExpandSection:risk"
  | "ExpandableRiskPanel";

// LayoutType is deprecated but kept for backwards compatibility with the backend
export type LayoutType = string;

export type ArtifactType =
  | "price_ticker"
  | "technical_gauge"
  | "news_feed"
  | "info_card"
  | "comparison_table"
  | "screener_table"
  | "portfolio_breakdown"
  | "full_analysis"
  | "financial_report";

export type EmphasisType =
  | "price_only"
  | "technicals_primary"
  | "fundamentals_primary"
  | "news_primary"
  | "trend_visualization"
  | "comparison_winner"
  | "education_first";

export type TextLength = "null" | "1_sentence" | "2_sentences" | "3_sentences";

// Parsed from the SSE "artifact_type" event payload
export interface ArtifactDecision {
  type: ArtifactType;
  layout: LayoutType;
  components: ComponentName[];
  emphasis: EmphasisType;
  text_length: TextLength;
}

// Populated by SSE slot_* events
export interface SlotData {
  technicals: Record<string, any> | null;
  news: Record<string, any> | null;
  fundamentals: Record<string, any> | null;
  verdict: Record<string, any> | null;
  financials: Record<string, any> | null;
  price: Record<string, any> | null;
  compare: any[] | null;
}

// Full state of the artifact panel — stored in useState in page.tsx
export interface ArtifactState {
  decision: ArtifactDecision | null;
  symbol: string | null;
  text: string | null;
  slots: SlotData;
  isStreaming: boolean;
}

// Props passed to every atomic component
export interface ComponentProps {
  slots: SlotData;
  emphasis: EmphasisType;
  symbol: string | null;
  isStreaming: boolean;
}

// ── EMPTY HELPERS ─────────────────────────────────────────────────────────────

export const EMPTY_SLOTS: SlotData = {
  technicals: null,
  news: null,
  fundamentals: null,
  verdict: null,
  financials: null,
  price: null,
  compare: null,
};

export const EMPTY_ARTIFACT: ArtifactState = {
  decision: null,
  symbol: null,
  text: null,
  slots: EMPTY_SLOTS,
  isStreaming: false,
};
