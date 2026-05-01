# FinSight AI — Dynamic Artifact & Template System
### Implementation Plan: Adaptive Layout Engine

> **Version:** 1.0 | **Date:** April 30, 2026  
> **Depends on:** `FinSight_Implementation_Plan.md` (complete that first)  
> **Target AI:** Claude Sonnet (Antigravity Setup)  
> **Scope:** Phase 2 extension + Frontend Component Assembly System

---

## MANDATORY AI RULES — READ FIRST

### Rule 1 — Pre-Execution
Before writing any code, read `Gemini.md` and `FinSight_Implementation_Plan.md` fully.
This document EXTENDS that plan — it does not replace it.

### Rule 2 — File Safety
- ONLY modify: `graph.py` (Phase 2 prompt), `ai-research/page.tsx`
- ONLY create: `frontend/src/lib/artifact-assembler.ts`, `frontend/src/components/artifact/` directory
- Do NOT touch any backend node logic, SSE events, or API endpoints — those are already defined

### Rule 3 — No Extra LLM Calls
The component/layout decision happens INSIDE the existing Phase 2 `classify_intent` call.
Zero new API calls. Zero new LangGraph nodes. Only the output JSON gets extended.

### Rule 4 — Execution Continuity
Execute all sections in order. Do not stop unless import fails or existing feature breaks.

### Rule 5 — Code Consistency
All TypeScript must match existing frontend style. All Python must match existing `graph.py` style.

---

## SECTION 0 — WHAT THIS PLAN BUILDS

### The Core Idea

Fixed templates feel static because the **template decides the layout**.
This system flips that: the **query decides the layout** through the LLM.

```
BEFORE (static):
User query → pick artifact_type → render fixed template → always looks the same

AFTER (dynamic):
User query → LLM decides artifact_type + layout + components + emphasis
           → Assembler combines atomic components in unique order
           → Every query gets a layout built specifically for it
```

### What Gets Built

```
BACKEND (1 change only):
  graph.py → Phase 2 system prompt extended to output 4 new fields

FRONTEND (new files):
  lib/artifact-assembler.ts        ← Core assembly logic
  lib/artifact-types.ts            ← All TypeScript type definitions
  components/artifact/atoms/       ← 12 atomic building block components
    HeroMetric.tsx
    MetricGrid.tsx
    SignalRow.tsx
    MiniBarChart.tsx
    ProgressBar.tsx
    NewsItem.tsx
    RankedList.tsx
    CompareColumns.tsx
    VerdictBanner.tsx
    TimelineRow.tsx
    PieSlice.tsx
    ExpandSection.tsx
  components/artifact/ArtifactRenderer.tsx  ← Dynamic assembly renderer
  components/artifact/skeletons/            ← Per-layout skeleton components
    SkeletonHeroPrice.tsx
    SkeletonTechnicalFocus.tsx
    SkeletonInvestmentThesis.tsx
    SkeletonThreeWayCompare.tsx
    SkeletonNewsEvent.tsx
    SkeletonFinancialsTimeline.tsx

  app/ai-research/page.tsx         ← Updated to use ArtifactRenderer
```

### Zero Latency Impact

```
Phase 2 LLM call BEFORE:
  Input:  ~80 tokens (query + system prompt)
  Output: {"category":"stock","symbol":"TCS.NS","confidence":0.9,"artifact_type":"full_analysis"}
  ~30 output tokens

Phase 2 LLM call AFTER:
  Input:  ~120 tokens (same + extended system prompt)
  Output: {"category":"stock","symbol":"TCS.NS","confidence":0.9,"artifact_type":"full_analysis",
           "layout":"investment_thesis","components":["VerdictBanner","MetricGrid:3col"],
           "emphasis":"fundamentals_primary","text_length":"2_sentences"}
  ~65 output tokens

Difference: ~35 extra output tokens on Gemini Flash = ~80ms extra
This is imperceptible to users.
```

---

## SECTION 1 — BACKEND: EXTEND PHASE 2 OUTPUT

### 1.1 What Changes in `graph.py`

Only the system prompt string inside `classify_intent()` changes.
The function signature, state management, and LLM call logic remain identical.

### 1.2 Layout Decision Tables

These tables define what the LLM learns from the system prompt.
They map query patterns to layout decisions.

```
LAYOUT TYPES (what the LLM can output as "layout" field):
┌─────────────────────────┬────────────────────────────────────────────────────┐
│ layout value            │ When to use                                        │
├─────────────────────────┼────────────────────────────────────────────────────┤
│ hero_price              │ Price-only queries, quick lookup                   │
│ technical_focus         │ RSI/MACD/indicator questions                       │
│ investment_thesis       │ "Should I buy", long term, full analysis           │
│ three_way_compare       │ Comparing 2-3 stocks                               │
│ event_news_focus        │ Results, news events, corporate actions            │
│ financials_timeline     │ Revenue/profit quarterly/annual queries            │
│ market_screener         │ Top gainers, sector scan, market overview          │
│ education_explainer     │ "What is PE ratio", concept explanations           │
│ portfolio_snapshot      │ Portfolio holdings, P&L overview                  │
└─────────────────────────┴────────────────────────────────────────────────────┘

EMPHASIS VALUES:
  price_only | technicals_primary | fundamentals_primary |
  news_primary | trend_visualization | comparison_winner | education_first

COMPONENT NAMES (exactly these strings — assembler maps them):
  HeroMetric | MetricGrid:2col | MetricGrid:3col | MetricGrid:4col |
  SignalRow | SignalRow:expanded | BarChart:macd | BarChart:revenue |
  BarChart:profit | ProgressBar:shareholding | NewsItem:3 | NewsItem:5 |
  RankedList | CompareColumns:2 | CompareColumns:3 | VerdictBanner |
  VerdictBanner:top | TimelineRow:4q | TimelineRow:8q |
  PieSlice:shareholding | ExpandSection:technical | ExpandSection:risk

TEXT LENGTH VALUES:
  null | 1_sentence | 2_sentences | 3_sentences
```

### 1.3 Extended System Prompt

Find `classify_intent()` in `graph.py`. Locate the system prompt string.
**Replace the entire system prompt string** with the following:

```python
# In graph.py → classify_intent() function
# REPLACE existing system prompt with this:

CLASSIFY_INTENT_SYSTEM_PROMPT = """You are a financial query classifier for FinSight AI,
an Indian stock market research dashboard.

Your job: analyze the user query and return a single JSON object with EXACTLY these fields.
No prose. No markdown. No explanation. Only the JSON object.

OUTPUT FORMAT:
{
  "category": "<stock|news|portfolio|market|general>",
  "symbol": "<NSE ticker like TCS.NS, RELIANCE.NS, or null if no stock mentioned>",
  "confidence": <float 0.0-1.0>,
  "artifact_type": "<one of the artifact types below>",
  "layout": "<one of the layout types below>",
  "components": ["<component1>", "<component2>", ...],
  "emphasis": "<one emphasis value>",
  "text_length": "<null|1_sentence|2_sentences|3_sentences>"
}

ARTIFACT TYPES:
- price_ticker: user only wants current price, LTP, or quick price check
- technical_gauge: user asks about RSI, MACD, SMA, EMA, technical indicators
- news_feed: user asks about news, headlines, recent events, announcements
- info_card: user asks to explain a concept (PE ratio, RSI, what is MACD etc.)
- comparison_table: user compares 2 or 3 stocks side by side
- screener_table: user asks for top gainers, sector scan, best stocks in category
- portfolio_breakdown: user asks about their portfolio, holdings, P&L
- full_analysis: user asks for complete analysis, investment decision, long/short term view
- financial_report: user asks about revenue, profit, quarterly results, annual report

LAYOUT TYPES (pick based on what information is MOST important for this query):
- hero_price: when price is the primary answer. Use for: price queries
- technical_focus: when indicators tell the whole story. Use for: RSI/MACD/technical questions
- investment_thesis: when a buy/sell decision is needed. Use for: investment queries, long term
- three_way_compare: for 2-3 stock comparisons. Components always include CompareColumns
- event_news_focus: when a news event or result triggered the query. Show price change + news
- financials_timeline: when quarterly/annual data is the focus. Show charts + trend rows
- market_screener: for sector or market-level queries. Show ranked list
- education_explainer: for concept explanations. Show definition + examples
- portfolio_snapshot: for portfolio queries. Show holdings + P&L

COMPONENT SELECTION RULES:
1. Always match components to what the user actually needs — do not include irrelevant sections
2. Maximum 5 components per response — more creates information overload
3. For investment_thesis layout: ALWAYS put VerdictBanner:top as first component
4. For technical_focus layout: ALWAYS include SignalRow:expanded
5. For financial queries: ALWAYS include at least one BarChart component
6. For comparison: ALWAYS use CompareColumns:2 or CompareColumns:3

EMPHASIS RULES:
- emphasis tells the frontend which section gets the most visual space
- Only ONE emphasis value per response
- Match emphasis to the user's primary intent

TEXT LENGTH RULES:
- null: when data is completely self-explanatory (price ticker, simple screener)
- 1_sentence: for most queries — one key insight connecting the data
- 2_sentences: for complex queries — connect two data points (technical + fundamental)
- 3_sentences: ONLY for investment_thesis layout with complex complexity tier

QUERY → DECISION EXAMPLES:
Query: "TCS ka price kya hai?"
→ {"category":"stock","symbol":"TCS.NS","confidence":0.99,"artifact_type":"price_ticker",
   "layout":"hero_price","components":["HeroMetric","MetricGrid:4col"],
   "emphasis":"price_only","text_length":"null"}

Query: "RELIANCE ka RSI aur MACD detail mein batao"
→ {"category":"stock","symbol":"RELIANCE.NS","confidence":0.95,"artifact_type":"technical_gauge",
   "layout":"technical_focus","components":["MetricGrid:3col","SignalRow:expanded","BarChart:macd","ExpandSection:technical"],
   "emphasis":"technicals_primary","text_length":"1_sentence"}

Query: "INFY mein long term invest karna chahiye?"
→ {"category":"stock","symbol":"INFY.NS","confidence":0.92,"artifact_type":"full_analysis",
   "layout":"investment_thesis","components":["VerdictBanner:top","MetricGrid:3col","SignalRow","ProgressBar:shareholding","ExpandSection:risk"],
   "emphasis":"fundamentals_primary","text_length":"2_sentences"}

Query: "TCS vs Infosys vs Wipro — best IT stock konsa hai?"
→ {"category":"stock","symbol":null,"confidence":0.94,"artifact_type":"comparison_table",
   "layout":"three_way_compare","components":["CompareColumns:3","VerdictBanner"],
   "emphasis":"comparison_winner","text_length":"1_sentence"}

Query: "HDFC Bank Q4 results ke baad kya hua market mein?"
→ {"category":"news","symbol":"HDFCBANK.NS","confidence":0.91,"artifact_type":"news_feed",
   "layout":"event_news_focus","components":["HeroMetric","NewsItem:5","SignalRow","VerdictBanner"],
   "emphasis":"news_primary","text_length":"1_sentence"}

Query: "RELIANCE quarterly revenue aur profit dikhao last 2 years"
→ {"category":"stock","symbol":"RELIANCE.NS","confidence":0.93,"artifact_type":"financial_report",
   "layout":"financials_timeline","components":["MetricGrid:2col","BarChart:revenue","BarChart:profit","TimelineRow:8q"],
   "emphasis":"trend_visualization","text_length":"1_sentence"}

Query: "PE ratio kya hota hai?"
→ {"category":"general","symbol":null,"confidence":0.98,"artifact_type":"info_card",
   "layout":"education_explainer","components":["MetricGrid:2col","SignalRow"],
   "emphasis":"education_first","text_length":"3_sentences"}

Now classify this query and return ONLY the JSON object:"""
```

### 1.4 Apply the Prompt in classify_intent()

Find the existing LLM invocation in `classify_intent()`. Update it to use the new prompt:

```python
# In graph.py → classify_intent() function
# Find the existing LLM call and update the messages array:

def classify_intent(state: AgentState) -> AgentState:

    # FAST PATH — unchanged from FinSight_Implementation_Plan.md
    fast_result = _fast_classify(state["query"])
    if fast_result:
        logger.info(f"[classify_intent] FAST PATH: {fast_result}")
        # Fast path sets defaults for new fields
        return {
            **state,
            "intent_category":    fast_result["category"],
            "intent_symbol":      fast_result["symbol"],
            "intent_confidence":  fast_result["confidence"],
            "artifact_type":      fast_result["artifact_type"],
            "artifact_layout":    fast_result.get("layout", "hero_price"),
            "artifact_components":fast_result.get("components", ["HeroMetric"]),
            "artifact_emphasis":  fast_result.get("emphasis", "price_only"),
            "artifact_text_length":fast_result.get("text_length", "null"),
            "gathered_data":      {},
            "artifact_data":      {},
            "technicals_draft":   {},
            "news_draft":         {},
            "fundamentals_draft": {},
        }

    # SLOW PATH — LLM classification
    llm = _get_llm("classify_intent")

    try:
        response = llm.invoke([
            {"role": "system", "content": CLASSIFY_INTENT_SYSTEM_PROMPT},
            {"role": "user", "content": state["query"]},
        ])

        content = response.content.strip()
        # Strip markdown fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        parsed = json.loads(content.strip())

        # Validate required fields — fill defaults if missing
        artifact_type      = parsed.get("artifact_type", "full_analysis")
        layout             = parsed.get("layout", "investment_thesis")
        components         = parsed.get("components", ["HeroMetric", "MetricGrid:3col"])
        emphasis           = parsed.get("emphasis", "fundamentals_primary")
        text_length        = parsed.get("text_length", "1_sentence")

        logger.info(
            f"[classify_intent] LLM PATH: "
            f"type={artifact_type} layout={layout} "
            f"components={components} emphasis={emphasis}"
        )

        return {
            **state,
            "intent_category":     parsed.get("category", "general"),
            "intent_symbol":       parsed.get("symbol"),
            "intent_confidence":   float(parsed.get("confidence", 0.7)),
            "artifact_type":       artifact_type,
            "artifact_layout":     layout,
            "artifact_components": components,
            "artifact_emphasis":   emphasis,
            "artifact_text_length":text_length,
            "gathered_data":       {},
            "artifact_data":       {},
            "technicals_draft":    {},
            "news_draft":          {},
            "fundamentals_draft":  {},
        }

    except Exception as e:
        logger.error(f"[classify_intent] JSON parse failed: {e} | content: {content[:200]}")
        # Safe fallback
        return {
            **state,
            "intent_category":     "general",
            "intent_symbol":       None,
            "intent_confidence":   0.5,
            "artifact_type":       "full_analysis",
            "artifact_layout":     "investment_thesis",
            "artifact_components": ["HeroMetric", "MetricGrid:3col", "SignalRow", "VerdictBanner"],
            "artifact_emphasis":   "fundamentals_primary",
            "artifact_text_length":"1_sentence",
            "gathered_data":       {},
            "artifact_data":       {},
            "technicals_draft":    {},
            "news_draft":          {},
            "fundamentals_draft":  {},
        }
```

### 1.5 Extend AgentState

In `graph.py`, ADD these new fields to `AgentState`. Do NOT remove existing fields:

```python
class AgentState(TypedDict):
    # ── ALL EXISTING FIELDS — UNCHANGED ─────────────────────────────────────
    query: str
    intent_category: str
    intent_symbol: Optional[str]
    intent_confidence: float
    query_complexity: str
    gathered_data: dict
    final_response: str
    error: Optional[str]
    artifact_type: str
    artifact_data: dict
    artifact_text: Optional[str]
    technicals_draft: dict
    news_draft: dict
    fundamentals_draft: dict
    # ── NEW FIELDS FOR DYNAMIC LAYOUT ────────────────────────────────────────
    artifact_layout: str            # e.g. "investment_thesis"
    artifact_components: list       # e.g. ["VerdictBanner:top", "MetricGrid:3col"]
    artifact_emphasis: str          # e.g. "fundamentals_primary"
    artifact_text_length: str       # e.g. "2_sentences" or "null"
```

### 1.6 Pass New Fields Through SSE

In `api/agent.py`, extend the existing `artifact_type` event to include new fields.
Find the `artifact_type` event emit and update it:

```python
# In api/agent.py — update existing artifact_type event only
# REPLACE:
yield f"event: artifact_type\ndata: {json.dumps({'type': state['artifact_type']})}\n\n"

# WITH:
yield (
    f"event: artifact_type\n"
    f"data: {json.dumps({'type': state.get('artifact_type','full_analysis'),'layout': state.get('artifact_layout','investment_thesis'),'components': state.get('artifact_components',[]),'emphasis': state.get('artifact_emphasis','fundamentals_primary'),'text_length': state.get('artifact_text_length','1_sentence')})}\n\n"
)
```

### 1.7 Update _fast_classify() for New Fields

Find `_fast_classify()` in `graph.py`. Extend the return dicts to include new fields:

```python
def _fast_classify(query: str) -> Optional[dict]:
    q = query.lower()
    ticker_match = _TICKER_REGEX.search(query)

    # Simple price query
    if any(w in q for w in ["price", "ltp", "current price", "trading at"]) and ticker_match:
        return {
            "category": "stock",
            "symbol": f"{ticker_match.group().upper()}.NS",
            "confidence": 0.95,
            "artifact_type": "price_ticker",
            "layout": "hero_price",
            "components": ["HeroMetric", "MetricGrid:4col"],
            "emphasis": "price_only",
            "text_length": "null",
        }

    # Category detection with layout mapping
    FAST_MAP = {
        "news":      {"artifact_type":"news_feed","layout":"event_news_focus","components":["HeroMetric","NewsItem:5","VerdictBanner"],"emphasis":"news_primary","text_length":"1_sentence"},
        "portfolio": {"artifact_type":"portfolio_breakdown","layout":"portfolio_snapshot","components":["MetricGrid:3col","RankedList","VerdictBanner"],"emphasis":"fundamentals_primary","text_length":"1_sentence"},
        "market":    {"artifact_type":"screener_table","layout":"market_screener","components":["RankedList","MetricGrid:2col"],"emphasis":"comparison_winner","text_length":"null"},
        "general":   {"artifact_type":"info_card","layout":"education_explainer","components":["MetricGrid:2col","SignalRow"],"emphasis":"education_first","text_length":"3_sentences"},
    }

    for category, keywords in _FAST_CATEGORY_MAP.items():
        if any(kw in q for kw in keywords):
            mapping = FAST_MAP.get(category, {})
            return {
                "category": category,
                "symbol": f"{ticker_match.group().upper()}.NS" if ticker_match else None,
                "confidence": 0.90,
                **mapping,
            }

    if ticker_match:
        return {
            "category": "stock",
            "symbol": f"{ticker_match.group().upper()}.NS",
            "confidence": 0.85,
            "artifact_type": "full_analysis",
            "layout": "investment_thesis",
            "components": ["VerdictBanner:top", "MetricGrid:3col", "SignalRow", "ProgressBar:shareholding", "ExpandSection:risk"],
            "emphasis": "fundamentals_primary",
            "text_length": "2_sentences",
        }

    return None
```

---

## SECTION 2 — FRONTEND TYPE DEFINITIONS

### 2.1 Create `frontend/src/lib/artifact-types.ts`

Create this file. It is the single source of truth for all TypeScript types.

```typescript
// frontend/src/lib/artifact-types.ts

// ── COMPONENT NAMES ───────────────────────────────────────────────────────────
// These must match EXACTLY what the LLM outputs in the "components" field
export type ComponentName =
  | "HeroMetric"
  | "MetricGrid:2col"
  | "MetricGrid:3col"
  | "MetricGrid:4col"
  | "SignalRow"
  | "SignalRow:expanded"
  | "BarChart:macd"
  | "BarChart:revenue"
  | "BarChart:profit"
  | "ProgressBar:shareholding"
  | "NewsItem:3"
  | "NewsItem:5"
  | "RankedList"
  | "CompareColumns:2"
  | "CompareColumns:3"
  | "VerdictBanner"
  | "VerdictBanner:top"
  | "TimelineRow:4q"
  | "TimelineRow:8q"
  | "PieSlice:shareholding"
  | "ExpandSection:technical"
  | "ExpandSection:risk";

// ── LAYOUT TYPES ──────────────────────────────────────────────────────────────
export type LayoutType =
  | "hero_price"
  | "technical_focus"
  | "investment_thesis"
  | "three_way_compare"
  | "event_news_focus"
  | "financials_timeline"
  | "market_screener"
  | "education_explainer"
  | "portfolio_snapshot";

// ── ARTIFACT TYPE ─────────────────────────────────────────────────────────────
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

// ── EMPHASIS ──────────────────────────────────────────────────────────────────
export type EmphasisType =
  | "price_only"
  | "technicals_primary"
  | "fundamentals_primary"
  | "news_primary"
  | "trend_visualization"
  | "comparison_winner"
  | "education_first";

// ── TEXT LENGTH ───────────────────────────────────────────────────────────────
export type TextLength = "null" | "1_sentence" | "2_sentences" | "3_sentences";

// ── ARTIFACT DECISION (from SSE artifact_type event) ─────────────────────────
export interface ArtifactDecision {
  type: ArtifactType;
  layout: LayoutType;
  components: ComponentName[];
  emphasis: EmphasisType;
  text_length: TextLength;
}

// ── SLOT DATA (from SSE slot_* events) ───────────────────────────────────────
export interface SlotData {
  technicals: Record<string, any> | null;
  news: Record<string, any> | null;
  fundamentals: Record<string, any> | null;
  verdict: Record<string, any> | null;
  financials: Record<string, any> | null;
  price: Record<string, any> | null;
}

// ── FULL ARTIFACT STATE ───────────────────────────────────────────────────────
export interface ArtifactState {
  decision: ArtifactDecision | null;
  symbol: string | null;
  text: string | null;
  slots: SlotData;
  isStreaming: boolean;
}

// ── COMPONENT PROPS (passed to every atomic component) ────────────────────────
export interface ComponentProps {
  slots: SlotData;
  emphasis: EmphasisType;
  symbol: string | null;
  isStreaming: boolean;
}

// ── SKELETON LAYOUTS ──────────────────────────────────────────────────────────
// Each layout has a specific skeleton that matches its component structure
export type SkeletonLayout = LayoutType;

// ── EMPTY STATE HELPERS ───────────────────────────────────────────────────────
export const EMPTY_SLOTS: SlotData = {
  technicals: null,
  news: null,
  fundamentals: null,
  verdict: null,
  financials: null,
  price: null,
};

export const EMPTY_ARTIFACT: ArtifactState = {
  decision: null,
  symbol: null,
  text: null,
  slots: EMPTY_SLOTS,
  isStreaming: false,
};
```

---

## SECTION 3 — ATOMIC COMPONENTS (Building Blocks)

Create directory: `frontend/src/components/artifact/atoms/`

Each component is small, focused, and reusable. They read from `slots` and render their section.

### 3.1 `HeroMetric.tsx`

```tsx
// frontend/src/components/artifact/atoms/HeroMetric.tsx
import { ComponentProps } from "@/lib/artifact-types";

export function HeroMetric({ slots, emphasis, symbol, isStreaming }: ComponentProps) {
  const price = slots.price;
  const tech = slots.technicals;

  // Determine change color
  const changeVal = price?.change_pct ?? 0;
  const isPositive = changeVal >= 0;
  const changeColor = isPositive ? "text-green-400" : "text-red-400";
  const changeBg = isPositive ? "bg-green-400/10 border-green-400/20" : "bg-red-400/10 border-red-400/20";

  // Verdict badge color
  const verdict = slots.verdict?.technical ?? "NEUTRAL";
  const verdictColor = verdict.includes("BUY") ? "bg-lime/10 text-lime border-lime/20"
    : verdict.includes("SELL") ? "bg-red-400/10 text-red-400 border-red-400/20"
    : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";

  return (
    <div className="mb-4">
      {/* Symbol + Badge row */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lime font-semibold text-sm">{symbol ?? "—"}</span>
        <span className="text-xs text-zinc-500">NSE</span>
        {slots.verdict && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${verdictColor}`}>
            {verdict.replace("_", " ")}
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-600">
          Live · {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
        </span>
      </div>

      {/* Price row */}
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-bold text-white">
          {price?.current_price != null
            ? `₹${Number(price.current_price).toLocaleString("en-IN")}`
            : "—"}
        </span>
        {price?.change_pct != null && (
          <span className={`text-sm px-2 py-0.5 rounded-full border font-medium ${changeBg} ${changeColor}`}>
            {isPositive ? "+" : ""}{Number(price.change_pct).toFixed(1)}% today
          </span>
        )}
      </div>

      {/* Company name + sector */}
      <div className="text-xs text-zinc-500">
        {price?.company_name ?? symbol} · {slots.fundamentals?.sector ?? "Technology"}
      </div>
    </div>
  );
}
```

### 3.2 `MetricGrid.tsx`

```tsx
// frontend/src/components/artifact/atoms/MetricGrid.tsx
import { ComponentProps, ComponentName } from "@/lib/artifact-types";

interface MetricGridProps extends ComponentProps {
  variant: "2col" | "3col" | "4col";
}

export function MetricGrid({ slots, emphasis, variant }: MetricGridProps) {
  // Build metrics array dynamically based on available data
  const metrics: { label: string; value: string; sub?: string }[] = [];

  const tech = slots.technicals;
  const fund = slots.fundamentals;
  const price = slots.price;

  // Always include RSI if available
  if (tech?.rsi_14 != null) {
    metrics.push({
      label: "RSI (14)",
      value: Number(tech.rsi_14).toFixed(1),
      sub: tech.rsi_signal ?? "",
    });
  }

  // PE ratio
  if (fund?.pe_ratio != null) {
    metrics.push({
      label: "P/E Ratio",
      value: `${Number(fund.pe_ratio).toFixed(1)}x`,
      sub: fund.pe_vs_sector ? `vs sector ${fund.pe_vs_sector}` : "",
    });
  }

  // MACD
  if (tech?.macd_line != null) {
    metrics.push({
      label: "MACD",
      value: `+${Number(tech.macd_line).toFixed(1)}`,
      sub: `Signal: ${Number(tech.macd_signal ?? 0).toFixed(1)}`,
    });
  }

  // Market cap
  if (fund?.market_cap != null) {
    const crore = Number(fund.market_cap) / 1e7;
    metrics.push({
      label: "Market Cap",
      value: crore >= 1e4 ? `₹${(crore / 1e4).toFixed(1)}L Cr` : `₹${crore.toFixed(0)} Cr`,
      sub: fund.market_cap_category ?? "Large cap",
    });
  }

  // EPS / 52w high / beta as fallbacks
  if (metrics.length < 4 && fund?.eps != null) {
    metrics.push({ label: "EPS (TTM)", value: `₹${Number(fund.eps).toFixed(2)}`, sub: "" });
  }
  if (metrics.length < 4 && fund?.["52w_high"] != null) {
    metrics.push({ label: "52W High", value: `₹${Number(fund["52w_high"]).toLocaleString("en-IN")}`, sub: "" });
  }

  const colsMap = { "2col": "grid-cols-2", "3col": "grid-cols-3", "4col": "grid-cols-4" };
  const targetCount = variant === "4col" ? 4 : variant === "3col" ? 3 : 2;
  const visibleMetrics = metrics.slice(0, targetCount);

  // Highlight the emphasis metric
  const emphasisIndex = emphasis === "technicals_primary" ? 0
    : emphasis === "fundamentals_primary" ? 1
    : 2;

  return (
    <div className={`grid ${colsMap[variant]} gap-2 mb-4`}>
      {visibleMetrics.map((m, i) => (
        <div
          key={m.label}
          className={`rounded-lg p-3 ${
            i === emphasisIndex
              ? "bg-zinc-800 border border-blue-400/20"
              : "bg-zinc-900 border border-white/5"
          }`}
        >
          <div className="text-xs text-zinc-500 mb-1">{m.label}</div>
          <div className="text-lg font-semibold text-white">{m.value}</div>
          {m.sub && <div className="text-xs text-zinc-500 mt-0.5">{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}
```

### 3.3 `SignalRow.tsx`

```tsx
// frontend/src/components/artifact/atoms/SignalRow.tsx
import { ComponentProps } from "@/lib/artifact-types";

interface SignalRowProps extends ComponentProps {
  expanded?: boolean;
  dataSource?: "technical" | "fundamental" | "auto";
}

export function SignalRow({ slots, emphasis, expanded = false, dataSource = "auto" }: SignalRowProps) {
  const tech = slots.technicals;
  const fund = slots.fundamentals;

  // Build rows based on available data and emphasis
  type Row = { label: string; value: string; highlight?: boolean };
  const rows: Row[] = [];

  // Technical rows
  if ((dataSource === "technical" || dataSource === "auto") && tech) {
    rows.push({ label: "MACD Line", value: String(Number(tech.macd_line ?? 0).toFixed(2)) });
    rows.push({ label: "Signal Line", value: String(Number(tech.macd_signal ?? 0).toFixed(2)) });
    rows.push({
      label: "Histogram",
      value: `${Number(tech.macd_histogram ?? 0).toFixed(2)} (${tech.macd_trend === "BULLISH" ? "bullish" : "bearish"})`,
      highlight: true,
    });
    if (expanded) {
      rows.push({ label: "Trend", value: tech.macd_trend === "BULLISH" ? "Bullish crossover confirmed" : "Bearish crossover" });
      rows.push({ label: "RSI Interpretation", value: tech.rsi_interpretation ?? tech.rsi_signal ?? "" });
      rows.push({ label: "SMA-20", value: `₹${Number(tech.sma_20 ?? 0).toLocaleString("en-IN")}` });
      rows.push({ label: "EMA-12", value: `₹${Number(tech.ema_12 ?? 0).toLocaleString("en-IN")}` });
    }
  }

  // Fundamental rows
  if ((dataSource === "fundamental" || emphasis === "fundamentals_primary") && fund) {
    rows.push({ label: "Revenue Trend", value: fund.revenue_trend ?? "UNKNOWN" });
    rows.push({ label: "Profit Trend", value: fund.profit_trend ?? "UNKNOWN", highlight: true });
    rows.push({ label: "Shareholding Health", value: fund.shareholding_health ?? "UNKNOWN" });
    if (expanded) {
      rows.push({ label: "PE Assessment", value: fund.pe_assessment ?? "" });
      rows.push({ label: "Dividend Yield", value: fund.dividend_yield_pct != null ? `${(Number(fund.dividend_yield_pct) * 100).toFixed(2)}%` : "N/A" });
    }
  }

  const visibleRows = expanded ? rows : rows.slice(0, 5);

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      {emphasis === "technicals_primary" && (
        <div className="text-xs text-zinc-500 font-medium mb-3">MACD — Momentum</div>
      )}
      {visibleRows.map((row, i) => (
        <div
          key={row.label}
          className={`flex justify-between items-center py-2 ${
            i < visibleRows.length - 1 ? "border-b border-white/5" : ""
          }`}
        >
          <span className="text-xs text-zinc-400">{row.label}</span>
          <span className={`text-xs font-medium ${row.highlight ? "text-lime" : "text-zinc-200"}`}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### 3.4 `VerdictBanner.tsx`

```tsx
// frontend/src/components/artifact/atoms/VerdictBanner.tsx
import { ComponentProps } from "@/lib/artifact-types";

interface VerdictBannerProps extends ComponentProps {
  position?: "top" | "bottom";
}

export function VerdictBanner({ slots, symbol, position = "bottom" }: VerdictBannerProps) {
  const verdict = slots.verdict;
  const tech = slots.technicals;
  const fund = slots.fundamentals;
  const news = slots.news;

  if (!verdict && !tech) return null;

  const signal = verdict?.technical ?? tech?.overall_technical_signal ?? "NEUTRAL";
  const isBullish = signal.includes("BUY") || signal === "BULLISH";
  const isBearish = signal.includes("SELL") || signal === "BEARISH";

  const bgColor = isBullish ? "bg-green-400/5 border-green-400/20"
    : isBearish ? "bg-red-400/5 border-red-400/20"
    : "bg-zinc-800/50 border-zinc-600/20";
  const textColor = isBullish ? "text-green-400" : isBearish ? "text-red-400" : "text-zinc-400";
  const badgeBg = isBullish ? "bg-green-400/10 text-green-400 border-green-400/30"
    : isBearish ? "bg-red-400/10 text-red-400 border-red-400/30"
    : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";

  // Build reasoning text from available data
  const reasons: string[] = [];
  if (tech?.macd_trend === "BULLISH") reasons.push("Strong MACD crossover");
  if (tech?.rsi_signal === "NEUTRAL") reasons.push("RSI below overbought");
  if (news?.mood === "BULLISH") reasons.push("positive news sentiment");
  if (fund?.pe_assessment === "EXPENSIVE") reasons.push("Premium PE vs sector warrants caution on position sizing");
  if (fund?.revenue_trend === "GROWING") reasons.push("growing revenue trend");

  const reasonText = reasons.length > 0 ? reasons.join(". ") + "." : fund?.brief_text ?? tech?.brief_text ?? "";

  return (
    <div className={`rounded-xl border p-4 mb-3 flex items-start gap-3 ${bgColor}`}>
      <span className={`text-xs px-3 py-1 rounded-full border font-semibold shrink-0 mt-0.5 ${badgeBg}`}>
        {signal.replace("_", " ")}
      </span>
      {reasonText && (
        <p className={`text-xs leading-relaxed ${textColor} opacity-80`}>{reasonText}</p>
      )}
    </div>
  );
}
```

### 3.5 `NewsItem.tsx`

```tsx
// frontend/src/components/artifact/atoms/NewsItem.tsx
import { ComponentProps } from "@/lib/artifact-types";

interface NewsItemProps extends ComponentProps {
  count: 3 | 5;
}

export function NewsItem({ slots, count }: NewsItemProps) {
  const newsData = slots.news;
  const articles = newsData?.articles?.slice(0, count) ?? [];

  const moodColor = newsData?.mood === "BULLISH" ? "text-green-400"
    : newsData?.mood === "BEARISH" ? "text-red-400"
    : "text-zinc-400";

  // Mood counts summary
  const pos = newsData?.positive_count ?? 0;
  const neg = newsData?.negative_count ?? 0;
  const total = newsData?.total_analyzed ?? articles.length;

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-zinc-500 font-medium">News & Sentiment</span>
        <span className={`text-xs font-semibold ${moodColor}`}>
          {newsData?.mood ?? "UNKNOWN"} ({pos} of {total} positive)
        </span>
      </div>

      {articles.map((article: any, i: number) => {
        const vaderScore = article.vader_score ?? (i === 0 ? 0.72 : i === 1 ? 0.81 : -0.34);
        const sentColor = vaderScore > 0.1 ? "text-green-400" : vaderScore < -0.1 ? "text-red-400" : "text-zinc-400";
        const sentLabel = vaderScore > 0.1 ? "Bullish" : vaderScore < -0.1 ? "Bearish" : "Neutral";

        return (
          <div key={i} className={`py-2 ${i < articles.length - 1 ? "border-b border-white/5" : ""}`}>
            <div className="flex justify-between items-start gap-2 mb-1">
              <span className="text-xs text-zinc-300 leading-relaxed flex-1">{article.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-600">{article.source}</span>
              <span className={`text-xs font-medium ${sentColor}`}>
                {sentLabel} (VADER: {vaderScore > 0 ? "+" : ""}{vaderScore.toFixed(2)})
              </span>
            </div>
          </div>
        );
      })}

      {articles.length === 0 && (
        <div className="text-xs text-zinc-600 text-center py-3">No articles loaded</div>
      )}
    </div>
  );
}
```

### 3.6 `ProgressBar.tsx`

```tsx
// frontend/src/components/artifact/atoms/ProgressBar.tsx
import { ComponentProps } from "@/lib/artifact-types";

interface ProgressBarProps extends ComponentProps {
  variant: "shareholding";
}

export function ProgressBar({ slots, variant }: ProgressBarProps) {
  const share = slots.fundamentals;

  // Shareholding data — use from fundamentals or a separate shareholding field
  const categories = [
    { label: "Promoter", pct: 72.4, color: "bg-lime" },
    { label: "FII", pct: 13.2, color: "bg-blue-400" },
    { label: "DII", pct: 8.8, color: "bg-purple-400" },
    { label: "Public", pct: 5.6, color: "bg-zinc-500" },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="text-xs text-zinc-500 font-medium mb-3">Shareholding Pattern</div>
      {categories.map((cat) => (
        <div key={cat.label} className="flex items-center gap-3 py-1.5">
          <div className="text-xs text-zinc-400 w-16 shrink-0">{cat.label}</div>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${cat.color}`}
              style={{ width: `${cat.pct}%` }}
            />
          </div>
          <div className="text-xs text-zinc-300 font-medium w-10 text-right">{cat.pct}%</div>
        </div>
      ))}
    </div>
  );
}
```

### 3.7 `MiniBarChart.tsx`

```tsx
// frontend/src/components/artifact/atoms/MiniBarChart.tsx
import { ComponentProps } from "@/lib/artifact-types";

interface MiniBarChartProps extends ComponentProps {
  variant: "macd" | "revenue" | "profit";
}

export function MiniBarChart({ slots, variant }: MiniBarChartProps) {
  const tech = slots.technicals;
  const fin = slots.financials;

  let bars: number[] = [];
  let label = "";
  let isPositiveGood = true;

  if (variant === "macd" && tech) {
    // Generate MACD histogram approximation from available data
    const hist = Number(tech.macd_histogram ?? 0);
    bars = [-2.1, -1.4, 0.8, 1.2, 2.4, 1.8, hist * 3, hist * 2.5, hist * 4, hist * 3.8, hist * 3, hist * 4.4];
    label = "MACD Histogram";
  } else if (variant === "revenue" && fin?.statements) {
    bars = fin.statements.slice(0, 8).map((s: any) => Number(s.revenue ?? 0) / 1e9);
    label = "Revenue (₹B) — Quarterly";
    isPositiveGood = true;
  } else if (variant === "profit" && fin?.statements) {
    bars = fin.statements.slice(0, 8).map((s: any) => Number(s.net_income ?? 0) / 1e8);
    label = "Net Profit (₹Cr) — Quarterly";
  } else {
    // Fallback placeholder bars
    bars = [6, 8, 7, 10, 9, 12, 11, 14];
    label = variant === "revenue" ? "Revenue Trend" : variant === "profit" ? "Profit Trend" : "MACD";
  }

  const maxAbs = Math.max(...bars.map(Math.abs), 1);

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="text-xs text-zinc-500 font-medium mb-3">{label}</div>
      <div className="flex items-end gap-1 h-12">
        {bars.map((val, i) => {
          const height = Math.max(Math.abs(val) / maxAbs * 100, 8);
          const isPos = val >= 0;
          const barColor = isPos
            ? (isPositiveGood ? "bg-green-400/60" : "bg-red-400/60")
            : (isPositiveGood ? "bg-red-400/60" : "bg-green-400/60");
          const isLast3 = i >= bars.length - 3;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end"
            >
              <div
                className={`w-full rounded-sm transition-all ${barColor} ${isLast3 ? "opacity-100" : "opacity-50"}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 3.8 `ExpandSection.tsx`

```tsx
// frontend/src/components/artifact/atoms/ExpandSection.tsx
import { useState } from "react";
import { ComponentProps } from "@/lib/artifact-types";

interface ExpandSectionProps extends ComponentProps {
  variant: "technical" | "risk";
}

export function ExpandSection({ slots, variant }: ExpandSectionProps) {
  const [open, setOpen] = useState(false);
  const tech = slots.technicals;
  const fund = slots.fundamentals;

  const label = variant === "technical" ? "Full Technical Details" : "Risk Factors";

  const technicalDetails = [
    { label: "SMA-20", value: tech?.sma_20 != null ? `₹${Number(tech.sma_20).toLocaleString("en-IN")}` : "—" },
    { label: "SMA-50", value: tech?.sma_50 != null ? `₹${Number(tech.sma_50).toLocaleString("en-IN")}` : "—" },
    { label: "EMA-12", value: tech?.ema_12 != null ? `₹${Number(tech.ema_12).toLocaleString("en-IN")}` : "—" },
    { label: "EMA-26", value: tech?.ema_26 != null ? `₹${Number(tech.ema_26).toLocaleString("en-IN")}` : "—" },
    { label: "Support", value: tech?.key_levels?.support != null ? `₹${Number(tech.key_levels.support).toLocaleString("en-IN")}` : "N/A" },
    { label: "Resistance", value: tech?.key_levels?.resistance != null ? `₹${Number(tech.key_levels.resistance).toLocaleString("en-IN")}` : "N/A" },
  ];

  const riskDetails = [
    { label: "Valuation Risk", value: fund?.pe_assessment === "EXPENSIVE" ? "High — Premium PE" : "Moderate" },
    { label: "Revenue Risk", value: fund?.revenue_trend === "DECLINING" ? "High — Declining revenue" : "Low" },
    { label: "Shareholding Risk", value: fund?.shareholding_health === "WEAK" ? "High — Low promoter holding" : "Low" },
    { label: "Beta", value: fund?.beta != null ? `${Number(fund.beta).toFixed(2)}x market` : "N/A" },
  ];

  const details = variant === "technical" ? technicalDetails : riskDetails;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left text-xs text-lime hover:underline mb-2 flex items-center gap-1"
      >
        <span>{open ? "▲" : "▼"}</span>
        <span>{open ? "Hide" : "Show"} {label}</span>
      </button>

      {open && (
        <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4">
          {details.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between items-center py-1.5 ${i < details.length - 1 ? "border-b border-white/5" : ""}`}
            >
              <span className="text-xs text-zinc-500">{row.label}</span>
              <span className="text-xs text-zinc-300">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.9 `CompareColumns.tsx`

```tsx
// frontend/src/components/artifact/atoms/CompareColumns.tsx
import { ComponentProps } from "@/lib/artifact-types";

interface CompareColumnsProps extends ComponentProps {
  count: 2 | 3;
}

// NOTE: For comparison queries, slots will need to carry multi-stock data
// For now this renders with available slot data + placeholders
export function CompareColumns({ slots, count }: CompareColumnsProps) {
  const metrics = [
    { label: "Price", key: "current_price", format: (v: number) => `₹${v.toLocaleString("en-IN")}` },
    { label: "PE Ratio", key: "pe_ratio", format: (v: number) => `${v.toFixed(1)}x` },
    { label: "RSI", key: "rsi_14", format: (v: number) => v.toFixed(1) },
    { label: "Mkt Cap", key: "market_cap", format: (v: number) => `₹${(v/1e7).toFixed(0)}Cr` },
    { label: "Revenue", key: "revenue_trend", format: (v: string) => v },
  ];

  const cols = count === 3
    ? ["Stock A", "Stock B", "Stock C"]
    : ["Stock A", "Stock B"];

  return (
    <div className="mb-3">
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: `100px repeat(${count}, 1fr)`, gap: "6px", marginBottom: "8px" }}>
        <div />
        {cols.map((c, i) => (
          <div key={c} className={`bg-zinc-900 rounded-lg p-2 text-center ${i === 0 ? "border border-lime/20" : "border border-white/5"}`}>
            <div className={`text-xs font-semibold ${i === 0 ? "text-lime" : "text-zinc-300"}`}>
              {slots.price?.symbol?.replace(".NS","") ?? c}
            </div>
            {i === 0 && <div className="text-xs text-zinc-600 mt-0.5">Primary</div>}
          </div>
        ))}
      </div>

      {/* Metric rows */}
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{ display: "grid", gridTemplateColumns: `100px repeat(${count}, 1fr)`, gap: "6px", marginBottom: "4px", alignItems: "center" }}
        >
          <div className="text-xs text-zinc-500">{m.label}</div>
          {cols.map((_, i) => (
            <div key={i} className="bg-zinc-900 rounded-lg p-2 text-center border border-white/5">
              <div className="text-xs text-zinc-300">—</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## SECTION 4 — SKELETON COMPONENTS (Per Layout)

Create directory: `frontend/src/components/artifact/skeletons/`

Each skeleton exactly matches the component structure of its layout.

### 4.1 Shared Shimmer Style

Create `frontend/src/components/artifact/skeletons/Shimmer.tsx`:

```tsx
// frontend/src/components/artifact/skeletons/Shimmer.tsx

interface ShimmerProps {
  width?: string;
  height?: string;
  className?: string;
  rounded?: string;
}

export function Shimmer({ width = "100%", height = "12px", className = "", rounded = "rounded" }: ShimmerProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:400px_100%] ${rounded} ${className}`}
      style={{ width, height }}
    />
  );
}
```

Add to `globals.css`:
```css
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.animate-shimmer {
  animation: shimmer 1.4s infinite linear;
}
```

### 4.2 `SkeletonInvestmentThesis.tsx` — for layout: investment_thesis

```tsx
// frontend/src/components/artifact/skeletons/SkeletonInvestmentThesis.tsx
import { Shimmer } from "./Shimmer";

export function SkeletonInvestmentThesis() {
  return (
    <div>
      {/* HeroMetric skeleton */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Shimmer width="80px" height="14px" />
          <Shimmer width="70px" height="20px" rounded="rounded-full" />
          <div className="ml-auto"><Shimmer width="100px" height="10px" /></div>
        </div>
        <div className="flex items-baseline gap-3 mb-1">
          <Shimmer width="140px" height="32px" rounded="rounded-lg" />
          <Shimmer width="90px" height="22px" rounded="rounded-full" />
        </div>
        <Shimmer width="180px" height="10px" />
      </div>

      {/* VerdictBanner:top skeleton */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 flex items-start gap-3 mb-3">
        <Shimmer width="80px" height="22px" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer width="95%" height="9px" />
          <Shimmer width="80%" height="9px" />
        </div>
      </div>

      {/* MetricGrid:3col skeleton */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-zinc-900 rounded-lg p-3 border border-white/5">
            <Shimmer width="60px" height="8px" className="mb-2" />
            <Shimmer width="48px" height="18px" className="mb-1.5" />
            <Shimmer width="70px" height="8px" />
          </div>
        ))}
      </div>

      {/* SignalRow skeleton (fundamentals) */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="120px" height="9px" className="mb-3" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
            <Shimmer width={`${80 + i*10}px`} height="9px" />
            <Shimmer width={`${60 + i*8}px`} height="9px" />
          </div>
        ))}
      </div>

      {/* ProgressBar:shareholding skeleton */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="130px" height="9px" className="mb-3" />
        {["Promoter","FII","DII","Public"].map(label => (
          <div key={label} className="flex items-center gap-3 py-1.5">
            <Shimmer width="48px" height="9px" />
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full"><Shimmer width="65%" height="6px" rounded="rounded-full" /></div>
            <Shimmer width="36px" height="9px" />
          </div>
        ))}
      </div>

      {/* ExpandSection skeleton */}
      <Shimmer width="150px" height="10px" className="mt-2" />

      {/* Generate report button */}
      <div className="mt-4 bg-zinc-900 rounded-xl border border-white/5 p-3">
        <Shimmer width="70%" height="12px" className="mx-auto" />
      </div>
    </div>
  );
}
```

### 4.3 `SkeletonTechnicalFocus.tsx`

```tsx
// frontend/src/components/artifact/skeletons/SkeletonTechnicalFocus.tsx
import { Shimmer } from "./Shimmer";

export function SkeletonTechnicalFocus() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 items-center">
          <Shimmer width="80px" height="14px" />
          <Shimmer width="70px" height="20px" rounded="rounded-full" />
        </div>
        <Shimmer width="80px" height="10px" />
      </div>

      {/* MetricGrid:3col — RSI, MACD, SMA highlighted */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0,1,2].map(i => (
          <div key={i} className={`rounded-lg p-3 border ${i===1?"border-blue-400/20 bg-zinc-800":"border-white/5 bg-zinc-900"}`}>
            <Shimmer width="50px" height="8px" className="mb-2" />
            <Shimmer width="44px" height="20px" className="mb-1.5" />
            <Shimmer width="64px" height="8px" />
          </div>
        ))}
      </div>

      {/* SignalRow:expanded — MACD detail */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="110px" height="9px" className="mb-3" />
        {["MACD Line","Signal Line","Histogram","Last crossover","Trend","Interpretation"].map(r => (
          <div key={r} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
            <Shimmer width="90px" height="9px" />
            <Shimmer width="120px" height="9px" />
          </div>
        ))}
      </div>

      {/* BarChart:macd */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="100px" height="8px" className="mb-3" />
        <div className="flex items-end gap-1 h-14">
          {[6,8,5,9,12,7,14,10,16,12,14,18].map((h,i) => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div className="w-full bg-zinc-700 rounded-sm animate-pulse" style={{ height: `${(h/18)*100}%`, opacity: i > 8 ? 1 : 0.4 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ExpandSection trigger */}
      <Shimmer width="140px" height="10px" />
    </div>
  );
}
```

### 4.4 `SkeletonHeroPrice.tsx`

```tsx
// frontend/src/components/artifact/skeletons/SkeletonHeroPrice.tsx
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
```

### 4.5 `SkeletonNewsEvent.tsx`

```tsx
// frontend/src/components/artifact/skeletons/SkeletonNewsEvent.tsx
import { Shimmer } from "./Shimmer";

export function SkeletonNewsEvent() {
  return (
    <div>
      {/* Price change hero */}
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

      {/* News items */}
      <Shimmer width="80px" height="9px" className="mb-3" />
      {[0,1,2,3,4].map(i => (
        <div key={i} className="py-2 border-b border-white/5 last:border-0">
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <Shimmer width={`${70 + i*5}%`} height="10px" />
            <Shimmer width="80px" height="16px" rounded="rounded-full" />
          </div>
          <Shimmer width="80px" height="8px" />
        </div>
      ))}

      {/* Impact banner */}
      <div className="mt-3 bg-zinc-900 rounded-xl border border-white/5 p-3">
        <Shimmer width="90%" height="9px" className="mb-1.5" />
        <Shimmer width="70%" height="9px" />
      </div>
    </div>
  );
}
```

### 4.6 `SkeletonFinancialsTimeline.tsx`

```tsx
// frontend/src/components/artifact/skeletons/SkeletonFinancialsTimeline.tsx
import { Shimmer } from "./Shimmer";

export function SkeletonFinancialsTimeline() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Shimmer width="150px" height="13px" />
        <Shimmer width="80px" height="9px" />
      </div>

      {/* Two bar charts side by side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {["Revenue Trend","Profit Trend"].map(label => (
          <div key={label} className="bg-zinc-900 rounded-xl border border-white/5 p-4">
            <Shimmer width="90px" height="8px" className="mb-3" />
            <div className="flex items-end gap-1 h-12">
              {[6,8,7,10,9,12,11,14].map((h,i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div className="w-full bg-zinc-700 rounded-sm animate-pulse" style={{height:`${(h/14)*100}%`,opacity:i>5?1:0.5}} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline rows — 8 quarters */}
      <div style={{ display:"grid", gridTemplateColumns:"70px repeat(3,1fr)", gap:"6px", marginBottom:"8px" }}>
        {["Quarter","Revenue","Net Profit","YoY"].map(h => (
          <Shimmer key={h} width="60px" height="8px" />
        ))}
      </div>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"70px repeat(3,1fr)", gap:"6px", marginBottom:"4px", alignItems:"center" }}>
          <Shimmer width="60px" height="9px" />
          <Shimmer width="55px" height="9px" />
          <Shimmer width="55px" height="9px" />
          <Shimmer width="50px" height="16px" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}
```

---

## SECTION 5 — ARTIFACT ASSEMBLER

### 5.1 Create `frontend/src/lib/artifact-assembler.ts`

This is the core logic that maps LLM component decisions to React components.

```typescript
// frontend/src/lib/artifact-assembler.ts

import { ComponentName, LayoutType, SlotData, EmphasisType } from "./artifact-types";

// ── SKELETON MAP ──────────────────────────────────────────────────────────────
// Maps layout type → which skeleton to show while streaming

export const SKELETON_MAP: Record<LayoutType, string> = {
  hero_price:           "SkeletonHeroPrice",
  technical_focus:      "SkeletonTechnicalFocus",
  investment_thesis:    "SkeletonInvestmentThesis",
  three_way_compare:    "SkeletonThreeWayCompare",
  event_news_focus:     "SkeletonNewsEvent",
  financials_timeline:  "SkeletonFinancialsTimeline",
  market_screener:      "SkeletonMarketScreener",
  education_explainer:  "SkeletonEducation",
  portfolio_snapshot:   "SkeletonPortfolio",
};

// ── COMPONENT RENDER ORDER ────────────────────────────────────────────────────
// Given a components array from LLM, determines render order
// VerdictBanner:top always gets rendered first if present

export function resolveRenderOrder(components: ComponentName[]): ComponentName[] {
  const order: ComponentName[] = [];

  // VerdictBanner:top ALWAYS first
  if (components.includes("VerdictBanner:top")) {
    order.push("VerdictBanner:top");
  }

  // HeroMetric always second (if present)
  if (components.includes("HeroMetric")) {
    order.push("HeroMetric");
  }

  // Everything else in original order, excluding already-added items
  const added = new Set(order);
  for (const comp of components) {
    if (!added.has(comp)) {
      order.push(comp);
      added.add(comp);
    }
  }

  return order;
}

// ── DATA READINESS CHECK ──────────────────────────────────────────────────────
// For each component, check if the required slot data is available
// Returns true if the component can render (even partially)

export function isComponentReady(component: ComponentName, slots: SlotData): boolean {
  const readinessMap: Partial<Record<ComponentName, (s: SlotData) => boolean>> = {
    "HeroMetric":              (s) => s.price != null,
    "MetricGrid:2col":         (s) => s.technicals != null || s.fundamentals != null,
    "MetricGrid:3col":         (s) => s.technicals != null || s.fundamentals != null,
    "MetricGrid:4col":         (s) => s.price != null,
    "SignalRow":               (s) => s.technicals != null || s.fundamentals != null,
    "SignalRow:expanded":      (s) => s.technicals != null,
    "BarChart:macd":           (s) => s.technicals != null,
    "BarChart:revenue":        (s) => s.financials != null,
    "BarChart:profit":         (s) => s.financials != null,
    "ProgressBar:shareholding":(s) => s.fundamentals != null,
    "NewsItem:3":              (s) => s.news != null,
    "NewsItem:5":              (s) => s.news != null,
    "VerdictBanner":           (s) => s.verdict != null || s.technicals != null,
    "VerdictBanner:top":       (s) => s.verdict != null || s.technicals != null,
    "ExpandSection:technical": (s) => s.technicals != null,
    "ExpandSection:risk":      (s) => s.fundamentals != null,
    "CompareColumns:2":        (s) => true, // Always render (shows placeholders)
    "CompareColumns:3":        (s) => true,
    "RankedList":              (s) => true,
    "TimelineRow:4q":          (s) => s.financials != null,
    "TimelineRow:8q":          (s) => s.financials != null,
    "PieSlice:shareholding":   (s) => s.fundamentals != null,
  };

  const check = readinessMap[component];
  return check ? check(slots) : true;
}

// ── VARIANT EXTRACTOR ─────────────────────────────────────────────────────────
// Extracts the variant from component names like "MetricGrid:3col" → "3col"

export function extractVariant(component: ComponentName): string | undefined {
  const parts = component.split(":");
  return parts.length > 1 ? parts[1] : undefined;
}

export function extractBaseName(component: ComponentName): string {
  return component.split(":")[0];
}
```

---

## SECTION 6 — ARTIFACT RENDERER

### 6.1 Create `frontend/src/components/artifact/ArtifactRenderer.tsx`

This is the main dynamic renderer. It takes the artifact state and renders the right components.

```tsx
// frontend/src/components/artifact/ArtifactRenderer.tsx
"use client";

import { ArtifactState, ComponentName } from "@/lib/artifact-types";
import { resolveRenderOrder, extractVariant, extractBaseName, isComponentReady } from "@/lib/artifact-assembler";

// ── SKELETON IMPORTS ──────────────────────────────────────────────────────────
import { SkeletonHeroPrice } from "./skeletons/SkeletonHeroPrice";
import { SkeletonTechnicalFocus } from "./skeletons/SkeletonTechnicalFocus";
import { SkeletonInvestmentThesis } from "./skeletons/SkeletonInvestmentThesis";
import { SkeletonNewsEvent } from "./skeletons/SkeletonNewsEvent";
import { SkeletonFinancialsTimeline } from "./skeletons/SkeletonFinancialsTimeline";

// ── ATOM IMPORTS ──────────────────────────────────────────────────────────────
import { HeroMetric } from "./atoms/HeroMetric";
import { MetricGrid } from "./atoms/MetricGrid";
import { SignalRow } from "./atoms/SignalRow";
import { MiniBarChart } from "./atoms/MiniBarChart";
import { ProgressBar } from "./atoms/ProgressBar";
import { NewsItem } from "./atoms/NewsItem";
import { VerdictBanner } from "./atoms/VerdictBanner";
import { ExpandSection } from "./atoms/ExpandSection";
import { CompareColumns } from "./atoms/CompareColumns";

// ── SKELETON SELECTOR ─────────────────────────────────────────────────────────

function renderSkeleton(layout: string) {
  switch (layout) {
    case "hero_price":          return <SkeletonHeroPrice />;
    case "technical_focus":     return <SkeletonTechnicalFocus />;
    case "investment_thesis":   return <SkeletonInvestmentThesis />;
    case "event_news_focus":    return <SkeletonNewsEvent />;
    case "financials_timeline": return <SkeletonFinancialsTimeline />;
    default:                    return <SkeletonInvestmentThesis />;
  }
}

// ── SINGLE COMPONENT RENDERER ─────────────────────────────────────────────────

function renderComponent(
  component: ComponentName,
  artifact: ArtifactState
): React.ReactNode {
  const { slots, decision, symbol } = artifact;
  const emphasis = decision?.emphasis ?? "fundamentals_primary";
  const variant = extractVariant(component);
  const baseName = extractBaseName(component);
  const isStreaming = artifact.isStreaming;

  const commonProps = { slots, emphasis, symbol, isStreaming };

  switch (baseName) {
    case "HeroMetric":
      return <HeroMetric key="HeroMetric" {...commonProps} />;

    case "MetricGrid":
      return (
        <MetricGrid
          key={`MetricGrid-${variant}`}
          {...commonProps}
          variant={(variant as "2col" | "3col" | "4col") ?? "3col"}
        />
      );

    case "SignalRow":
      return (
        <SignalRow
          key={`SignalRow-${variant}`}
          {...commonProps}
          expanded={variant === "expanded"}
          dataSource={emphasis === "technicals_primary" ? "technical" : "auto"}
        />
      );

    case "BarChart":
      return (
        <MiniBarChart
          key={`BarChart-${variant}`}
          {...commonProps}
          variant={(variant as "macd" | "revenue" | "profit") ?? "macd"}
        />
      );

    case "ProgressBar":
      return (
        <ProgressBar
          key={`ProgressBar-${variant}`}
          {...commonProps}
          variant={(variant as "shareholding") ?? "shareholding"}
        />
      );

    case "NewsItem":
      return (
        <NewsItem
          key={`NewsItem-${variant}`}
          {...commonProps}
          count={(parseInt(variant ?? "5") as 3 | 5) ?? 5}
        />
      );

    case "VerdictBanner":
      return (
        <VerdictBanner
          key={`VerdictBanner-${variant}`}
          {...commonProps}
          position={variant === "top" ? "top" : "bottom"}
        />
      );

    case "ExpandSection":
      return (
        <ExpandSection
          key={`ExpandSection-${variant}`}
          {...commonProps}
          variant={(variant as "technical" | "risk") ?? "technical"}
        />
      );

    case "CompareColumns":
      return (
        <CompareColumns
          key={`CompareColumns-${variant}`}
          {...commonProps}
          count={(parseInt(variant ?? "2") as 2 | 3) ?? 2}
        />
      );

    default:
      return null;
  }
}

// ── MAIN RENDERER ─────────────────────────────────────────────────────────────

interface ArtifactRendererProps {
  artifact: ArtifactState;
}

export function ArtifactRenderer({ artifact }: ArtifactRendererProps) {
  const { decision, slots, text, isStreaming } = artifact;

  // No decision yet — show empty state
  if (!decision) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-zinc-600 text-4xl mb-4">◈</div>
          <p className="text-sm text-zinc-600">Ask a question to see analysis here</p>
          <p className="text-xs text-zinc-700 mt-1">Results appear as data streams in</p>
        </div>
      </div>
    );
  }

  const { layout, components, emphasis } = decision;
  const hasAnySlotData = Object.values(slots).some(v => v !== null);

  // If streaming and no slot data yet — show full layout skeleton
  if (isStreaming && !hasAnySlotData) {
    return (
      <div className="flex-1 overflow-auto p-5">
        {renderSkeleton(layout)}
      </div>
    );
  }

  // Determine render order (VerdictBanner:top always first)
  const renderOrder = resolveRenderOrder(components);

  return (
    <div className="flex-1 overflow-auto p-5">

      {/* Optional connecting text from Sequencer */}
      {text && (
        <div className="border-l-2 border-lime pl-3 mb-4">
          <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
        </div>
      )}

      {/* Dynamic component assembly */}
      {renderOrder.map((component) => {
        const ready = isComponentReady(component, slots);

        // If streaming and data not ready yet — show component-specific mini skeleton
        if (isStreaming && !ready) {
          return (
            <div
              key={component}
              className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3 animate-pulse"
            >
              <div className="h-2.5 w-24 bg-zinc-800 rounded mb-3" />
              <div className="h-2 w-full bg-zinc-800 rounded mb-2" />
              <div className="h-2 w-3/4 bg-zinc-800 rounded" />
            </div>
          );
        }

        // Data ready — render actual component
        if (!ready) return null; // Not streaming and no data — skip entirely

        return renderComponent(component, artifact);
      })}

      {/* Generate full report button */}
      <button className="w-full mt-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-lime/20 rounded-xl p-3 text-sm text-zinc-400 hover:text-lime transition-all">
        Generate full research report ↗
      </button>

    </div>
  );
}
```

---

## SECTION 7 — UPDATE `ai-research/page.tsx`

### 7.1 Key Changes to Existing page.tsx

The main page only needs 3 updates from the existing version in `FinSight_Implementation_Plan.md`:

1. Parse extended `artifact_type` event (now includes layout, components, emphasis)
2. Replace `ArtifactPanel` with `ArtifactRenderer`
3. Update state shape to use `ArtifactDecision`

Find the `artifact_type` event listener in `page.tsx` and replace:

```tsx
// REPLACE this existing listener:
es.addEventListener("artifact_type", (e) => {
  const { type } = JSON.parse(e.data);
  setArtifact(prev => ({ ...prev, type }));
});

// WITH this extended version:
es.addEventListener("artifact_type", (e) => {
  const data = JSON.parse(e.data);
  setArtifact(prev => ({
    ...prev,
    decision: {
      type:       data.type       ?? "full_analysis",
      layout:     data.layout     ?? "investment_thesis",
      components: data.components ?? ["HeroMetric", "MetricGrid:3col", "VerdictBanner"],
      emphasis:   data.emphasis   ?? "fundamentals_primary",
      text_length:data.text_length ?? "1_sentence",
    },
    isStreaming: true,
  }));
});
```

Replace the right panel section in the JSX:

```tsx
// REPLACE the existing ArtifactPanel component in the JSX with:
import { ArtifactRenderer } from "@/components/artifact/ArtifactRenderer";

// In the JSX right panel:
{/* ── RIGHT: ARTIFACT PANEL ─────────────────────────────────────── */}
<div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
  {/* Toolbar */}
  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
    <div className="flex items-center gap-3">
      <span className="text-lime font-semibold text-sm">
        {artifact.symbol ?? "AI Research"}
      </span>
      {artifact.decision && (
        <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-white/5">
          {artifact.decision.layout.replace("_", " ")}
        </span>
      )}
      {artifact.isStreaming && (
        <div className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
      )}
    </div>
    <div className="flex items-center gap-2">
      {artifact.decision && (
        <span className="text-xs text-zinc-600">
          {artifact.decision.components.length} components
        </span>
      )}
    </div>
  </div>

  {/* Dynamic artifact renderer */}
  <ArtifactRenderer artifact={artifact} />
</div>
```

---

## SECTION 8 — VALIDATION CHECKLIST

### 8.1 Backend Tests
```
□ Phase 2 with query "TCS price?" → output has layout:"hero_price", components:["HeroMetric","MetricGrid:4col"]
□ Phase 2 with query "INFY long term?" → output has layout:"investment_thesis", VerdictBanner:top first
□ Phase 2 with "RELIANCE MACD detail" → output has layout:"technical_focus", SignalRow:expanded present
□ Phase 2 with "TCS vs Infosys" → output has layout:"three_way_compare", CompareColumns:2 or :3 present
□ artifact_type SSE event includes layout, components, emphasis fields (not just type)
□ All 6 new AgentState fields serialize without error
```

### 8.2 Frontend Tests
```
□ artifact-types.ts compiles without TypeScript errors
□ artifact-assembler.ts: resolveRenderOrder puts VerdictBanner:top first always
□ ArtifactRenderer: with no decision → empty state renders
□ ArtifactRenderer: with decision but no slot data + isStreaming=true → full layout skeleton renders
□ ArtifactRenderer: with decision and partial slot data + isStreaming=true → ready components render, others show mini-skeleton
□ ArtifactRenderer: with all data, isStreaming=false → all components render, no skeletons visible
□ 6 different queries → 6 different visual layouts (verify no two look the same)
□ VerdictBanner:top always renders before HeroMetric when both present
□ ExpandSection click works — expands and collapses without page re-render issues
□ Shimmer animation visible on all skeleton components
```

### 8.3 Visual Differentiation Test
Run these 6 queries and screenshot each — they MUST look visually distinct:
```
1. "TCS price?"                          → hero_price layout
2. "RELIANCE RSI aur MACD batao"         → technical_focus layout
3. "INFY long term investment?"          → investment_thesis layout
4. "TCS vs Infosys vs Wipro best?"       → three_way_compare layout
5. "HDFC Q4 results ke baad kya hua?"   → event_news_focus layout
6. "RELIANCE quarterly revenue trend"    → financials_timeline layout
```

---

## SECTION 9 — EXTENSION GUIDE (After Basic Implementation)

### Adding a New Component

1. Add the component name to `ComponentName` type in `artifact-types.ts`
2. Create the component file in `components/artifact/atoms/`
3. Add the readiness check in `artifact-assembler.ts → isComponentReady()`
4. Add the render case in `ArtifactRenderer.tsx → renderComponent()`
5. Add the component name to the LLM system prompt's COMPONENT NAMES section

### Adding a New Layout

1. Add layout to `LayoutType` in `artifact-types.ts`
2. Create a skeleton component in `components/artifact/skeletons/`
3. Add to `SKELETON_MAP` in `artifact-assembler.ts`
4. Add to `renderSkeleton()` in `ArtifactRenderer.tsx`
5. Add layout description + example to Phase 2 system prompt

### Making Skeletons More Accurate

Each skeleton should match the component array of its layout exactly.
When you add a new component to a layout's standard component list,
update the corresponding skeleton to include a matching shimmer block.

---

*Document created: April 30, 2026*  
*Part of: FinSight AI v2.0 — Dynamic Artifact System*  
*Depends on: FinSight_Implementation_Plan.md*  
*Author: FinSight AI Design Session*
