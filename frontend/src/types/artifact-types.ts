// frontend/src/types/artifact-types.ts

export type ArtifactLayout = 
  | "hero_price" 
  | "technical_focus" 
  | "investment_thesis" 
  | "three_way_compare" 
  | "event_news_focus" 
  | "financials_timeline" 
  | "market_screener" 
  | "education_explainer" 
  | "portfolio_snapshot"
  | "info_card"; // Fallback

export type ArtifactEmphasis = 
  | "price_only" 
  | "technicals_primary" 
  | "fundamentals_primary" 
  | "comparison_winner" 
  | "news_primary" 
  | "trend_visualization" 
  | "education_first";

export type ArtifactTextLength = 
  | "null" 
  | "1_sentence" 
  | "2_sentences" 
  | "3_sentences";

export type ComponentSpec = string; // e.g., "VerdictBanner:top", "MetricGrid:3col"

// Decision payload from backend SSE event
export interface ArtifactDecision {
  type: string;
  layout: ArtifactLayout;
  components: ComponentSpec[];
  emphasis: ArtifactEmphasis;
  text_length: ArtifactTextLength;
}

// Map parsed components to props object for dynamic rendering
export interface ParsedComponent {
  name: string;      // e.g. "VerdictBanner"
  variant?: string;  // e.g. "top"
  props?: any;       // Data injected from phase 4
}
