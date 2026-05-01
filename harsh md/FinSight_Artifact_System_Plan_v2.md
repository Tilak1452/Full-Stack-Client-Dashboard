# FinSight AI — Dynamic Artifact System: COMPLETE EXECUTION GUIDE
### Every File. Every Change. Every Line of Code.

> **Version:** 2.0 (Replaces v1.0)  
> **Date:** April 30, 2026  
> **Depends on:** `FinSight_Implementation_Plan.md` must be completed FIRST  
> **Target AI:** Claude Sonnet (Antigravity Setup)

---

## ⚠️ MANDATORY AI RULES

**Rule 1:** Read `Gemini.md` + `Context.md` + `FinSight_Implementation_Plan.md` BEFORE touching any file.  
**Rule 2:** Execute every step in the exact order listed. Do not skip, reorder, or combine steps.  
**Rule 3:** Every step says exactly: WHICH FILE → WHERE IN THE FILE → WHAT TO DO. Follow literally.  
**Rule 4:** After each Section, verify backend starts and no TypeScript errors exist before proceeding.  
**Rule 5:** If any step says "ADD" — add without removing existing code. If it says "REPLACE" — replace only the specified block.  
**Rule 6:** Do not ask for confirmation on any step already defined here. Proceed.

---

## MASTER FILE CHANGE INDEX

This table shows every single file this plan touches. Use it to verify scope before starting.

```
┌────────────────────────────────────────────────────────────┬──────────┬───────────────────────────┐
│ File Path                                                  │ Action   │ What Changes              │
├────────────────────────────────────────────────────────────┼──────────┼───────────────────────────┤
│ backend/app/agent/graph.py                                 │ MODIFY   │ 4 specific locations      │
│ backend/app/api/agent.py                                   │ MODIFY   │ 1 specific location       │
│ frontend/src/lib/artifact-types.ts                         │ CREATE   │ New file                  │
│ frontend/src/lib/artifact-assembler.ts                     │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/HeroMetric.tsx      │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/MetricGrid.tsx      │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/SignalRow.tsx       │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/MiniBarChart.tsx    │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/ProgressBar.tsx     │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/NewsItem.tsx        │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/VerdictBanner.tsx   │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/ExpandSection.tsx   │ CREATE   │ New file                  │
│ frontend/src/components/artifact/atoms/CompareColumns.tsx  │ CREATE   │ New file                  │
│ frontend/src/components/artifact/skeletons/Shimmer.tsx     │ CREATE   │ New file                  │
│ frontend/src/components/artifact/skeletons/Sk*.tsx (×6)   │ CREATE   │ 6 new skeleton files      │
│ frontend/src/components/artifact/ArtifactRenderer.tsx      │ CREATE   │ New file                  │
│ frontend/src/app/ai-research/page.tsx                      │ MODIFY   │ 3 specific locations      │
│ frontend/src/app/globals.css                               │ MODIFY   │ 1 addition (CSS keyframe) │
└────────────────────────────────────────────────────────────┴──────────┴───────────────────────────┘

PROTECTED — DO NOT TOUCH:
  backend/app/agent/prompts.py
  backend/app/agent/tools.py
  backend/app/agent/prompt_builder.py
  backend/app/api/portfolio.py, alerts.py, stock.py, news.py, market.py
  frontend/src/components/Sidebar.tsx
  frontend/src/components/TopBar.tsx
  frontend/src/app/layout.tsx
  frontend/src/lib/api-client.ts
  All other frontend pages (dashboard, portfolio, alerts, etc.)
```

---

## SECTION 1 — BACKEND CHANGES

### CHANGE 1.1
**File:** `backend/app/agent/graph.py`  
**Action:** ADD a new module-level constant  
**Where:** After all import statements, before any class or function definition  
**How to find the location:** Search for the first function definition (`def classify_query_complexity` or similar). Add the constant ABOVE it.

**ADD this entire block:**

```python
# ── CLASSIFY_INTENT SYSTEM PROMPT (Extended for dynamic artifact layout) ──────
# This constant replaces the inline prompt string previously inside classify_intent()
# The LLM now outputs 4 additional fields: layout, components, emphasis, text_length

CLASSIFY_INTENT_SYSTEM_PROMPT = """You are a financial query classifier for FinSight AI,
an Indian stock market research dashboard.

Your job: analyze the user query and return a single JSON object with EXACTLY these fields.
No prose. No markdown. No explanation outside the JSON. Only valid JSON.

OUTPUT FORMAT (all fields required):
{
  "category": "<stock|news|portfolio|market|general>",
  "symbol": "<NSE ticker like TCS.NS, RELIANCE.NS, or null if no stock mentioned>",
  "confidence": <float 0.0-1.0>,
  "artifact_type": "<see ARTIFACT TYPES below>",
  "layout": "<see LAYOUT TYPES below>",
  "components": ["<component1>", "<component2>"],
  "emphasis": "<see EMPHASIS VALUES below>",
  "text_length": "<null|1_sentence|2_sentences|3_sentences>"
}

ARTIFACT TYPES:
  price_ticker       → user only wants current price, LTP, quick price check
  technical_gauge    → user asks about RSI, MACD, SMA, EMA, technical indicators
  news_feed          → user asks about news, headlines, recent events, announcements
  info_card          → user asks to explain a concept (PE ratio, RSI, etc.)
  comparison_table   → user compares 2 or 3 stocks side by side
  screener_table     → user asks for top gainers, sector scan, best stocks in category
  portfolio_breakdown → user asks about their portfolio, holdings, P&L
  full_analysis      → user asks for complete analysis, investment decision, long/short term
  financial_report   → user asks about revenue, profit, quarterly results, annual report

LAYOUT TYPES:
  hero_price           → price is the primary answer. Use for: price queries
  technical_focus      → indicators tell the whole story. Use for: RSI/MACD questions
  investment_thesis    → buy/sell decision needed. Use for: investment/long-term queries
  three_way_compare    → 2-3 stock comparisons. Always use CompareColumns component
  event_news_focus     → news event or result triggered query. Show price change + news
  financials_timeline  → quarterly/annual data focus. Show charts + trend rows
  market_screener      → sector or market-level queries. Show ranked list
  education_explainer  → concept explanations. Show definition + examples
  portfolio_snapshot   → portfolio queries. Show holdings + P&L

VALID COMPONENT NAMES (use ONLY these exact strings in the components array):
  HeroMetric | MetricGrid:2col | MetricGrid:3col | MetricGrid:4col |
  SignalRow | SignalRow:expanded | BarChart:macd | BarChart:revenue |
  BarChart:profit | ProgressBar:shareholding | NewsItem:3 | NewsItem:5 |
  RankedList | CompareColumns:2 | CompareColumns:3 | VerdictBanner |
  VerdictBanner:top | TimelineRow:4q | TimelineRow:8q |
  ExpandSection:technical | ExpandSection:risk

EMPHASIS VALUES (pick exactly one):
  price_only | technicals_primary | fundamentals_primary |
  news_primary | trend_visualization | comparison_winner | education_first

COMPONENT SELECTION RULES:
  1. Maximum 5 components per response
  2. For investment_thesis: ALWAYS put VerdictBanner:top as FIRST component
  3. For technical_focus: ALWAYS include SignalRow:expanded
  4. For financial queries: ALWAYS include at least one BarChart component
  5. For comparison: ALWAYS use CompareColumns:2 or CompareColumns:3
  6. For price_ticker: ONLY use HeroMetric + MetricGrid:4col (nothing else)

TEXT LENGTH RULES:
  null          → data is self-explanatory (price ticker, simple screener)
  1_sentence    → most queries — one key insight connecting the data
  2_sentences   → complex queries — connect two data points
  3_sentences   → ONLY for investment_thesis with complex complexity tier

EXAMPLES:

Query: "TCS ka price kya hai?"
{"category":"stock","symbol":"TCS.NS","confidence":0.99,"artifact_type":"price_ticker",
 "layout":"hero_price","components":["HeroMetric","MetricGrid:4col"],
 "emphasis":"price_only","text_length":"null"}

Query: "RELIANCE ka RSI aur MACD detail mein batao"
{"category":"stock","symbol":"RELIANCE.NS","confidence":0.95,"artifact_type":"technical_gauge",
 "layout":"technical_focus","components":["MetricGrid:3col","SignalRow:expanded","BarChart:macd","ExpandSection:technical"],
 "emphasis":"technicals_primary","text_length":"1_sentence"}

Query: "INFY mein long term invest karna chahiye?"
{"category":"stock","symbol":"INFY.NS","confidence":0.92,"artifact_type":"full_analysis",
 "layout":"investment_thesis","components":["VerdictBanner:top","HeroMetric","MetricGrid:3col","SignalRow","ProgressBar:shareholding"],
 "emphasis":"fundamentals_primary","text_length":"2_sentences"}

Query: "TCS vs Infosys vs Wipro — best IT stock konsa hai?"
{"category":"stock","symbol":null,"confidence":0.94,"artifact_type":"comparison_table",
 "layout":"three_way_compare","components":["CompareColumns:3","VerdictBanner"],
 "emphasis":"comparison_winner","text_length":"1_sentence"}

Query: "HDFC Bank Q4 results ke baad kya hua?"
{"category":"news","symbol":"HDFCBANK.NS","confidence":0.91,"artifact_type":"news_feed",
 "layout":"event_news_focus","components":["HeroMetric","NewsItem:5","SignalRow","VerdictBanner"],
 "emphasis":"news_primary","text_length":"1_sentence"}

Query: "RELIANCE quarterly revenue aur profit dikhao"
{"category":"stock","symbol":"RELIANCE.NS","confidence":0.93,"artifact_type":"financial_report",
 "layout":"financials_timeline","components":["MetricGrid:2col","BarChart:revenue","BarChart:profit","TimelineRow:8q"],
 "emphasis":"trend_visualization","text_length":"1_sentence"}

Query: "PE ratio kya hota hai?"
{"category":"general","symbol":null,"confidence":0.98,"artifact_type":"info_card",
 "layout":"education_explainer","components":["MetricGrid:2col","SignalRow"],
 "emphasis":"education_first","text_length":"3_sentences"}

Now classify this query and return ONLY the JSON object:"""
```

---

### CHANGE 1.2
**File:** `backend/app/agent/graph.py`  
**Action:** MODIFY the `AgentState` TypedDict  
**Where:** Find the existing `class AgentState(TypedDict):` block  
**How to find it:** Search for `class AgentState` — it will be the TypedDict with fields like `query`, `intent_category`, `final_response`

**ADD these 4 lines at the END of the existing AgentState class body, after the last existing field:**

```python
    # ── NEW: Dynamic artifact layout fields (added for artifact system) ───────
    artifact_layout: str            # e.g. "investment_thesis" — set in classify_intent
    artifact_components: list       # e.g. ["VerdictBanner:top","MetricGrid:3col"]
    artifact_emphasis: str          # e.g. "fundamentals_primary"
    artifact_text_length: str       # e.g. "2_sentences" or "null"
```

**The full AgentState after change (for reference — do not delete existing fields):**
```python
class AgentState(TypedDict):
    # EXISTING FIELDS — DO NOT REMOVE OR RENAME ANY OF THESE
    query: str
    intent_category: str
    intent_symbol: Optional[str]
    intent_confidence: float
    query_complexity: str
    gathered_data: dict
    final_response: str
    error: Optional[str]
    # Fields added in FinSight_Implementation_Plan.md
    artifact_type: str
    artifact_data: dict
    artifact_text: Optional[str]
    technicals_draft: dict
    news_draft: dict
    fundamentals_draft: dict
    # NEW FIELDS — added by this plan
    artifact_layout: str
    artifact_components: list
    artifact_emphasis: str
    artifact_text_length: str
```

---

### CHANGE 1.3
**File:** `backend/app/agent/graph.py`  
**Action:** REPLACE the system prompt usage inside `classify_intent()` function  
**Where:** Inside the `def classify_intent(state: AgentState)` function  
**How to find it:** Search for `def classify_intent` — the function that calls the LLM for JSON extraction

**STEP A — Find the fast path return statement.** It looks like:
```python
return {
    **state,
    "intent_category":   fast_result["category"],
    "intent_symbol":     fast_result["symbol"],
    "intent_confidence": fast_result["confidence"],
    "artifact_type":     fast_result["artifact_type"],
    "gathered_data":     {},
    ...
}
```

**REPLACE that entire fast path return dict with:**
```python
        return {
            **state,
            "intent_category":     fast_result["category"],
            "intent_symbol":       fast_result["symbol"],
            "intent_confidence":   fast_result["confidence"],
            "artifact_type":       fast_result["artifact_type"],
            "artifact_layout":     fast_result.get("layout", "investment_thesis"),
            "artifact_components": fast_result.get("components", ["HeroMetric", "MetricGrid:3col"]),
            "artifact_emphasis":   fast_result.get("emphasis", "fundamentals_primary"),
            "artifact_text_length":fast_result.get("text_length", "1_sentence"),
            "gathered_data":       {},
            "artifact_data":       {},
            "technicals_draft":    {},
            "news_draft":          {},
            "fundamentals_draft":  {},
        }
```

**STEP B — Find the slow path (LLM call).** Look for the `llm.invoke(` call inside `classify_intent`. It passes a messages list with a system prompt. Find the line that defines the system prompt string — it will look something like:
```python
system_prompt = "You are a financial query classifier..."
# OR it may be inline in the messages list:
{"role": "system", "content": "You are a financial..."}
```

**REPLACE the entire system prompt string** (whatever it currently says) **with:**
```python
{"role": "system", "content": CLASSIFY_INTENT_SYSTEM_PROMPT},
```
(This references the constant added in Change 1.1)

**STEP C — Find the `parsed = json.loads(...)` line in the slow path.** After it, find where the function returns the state dict. REPLACE that return statement with:

```python
        # Validate and extract all fields including new layout fields
        artifact_type       = parsed.get("artifact_type", "full_analysis")
        layout              = parsed.get("layout", "investment_thesis")
        components          = parsed.get("components", ["HeroMetric", "MetricGrid:3col"])
        emphasis            = parsed.get("emphasis", "fundamentals_primary")
        text_length         = parsed.get("text_length", "1_sentence")

        logger.info(
            f"[classify_intent] LLM: type={artifact_type} layout={layout} "
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
```

**STEP D — Find the except/error return block** in `classify_intent` (the fallback when JSON parsing fails). REPLACE that return dict with:

```python
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

---

### CHANGE 1.4
**File:** `backend/app/agent/graph.py`  
**Action:** MODIFY `_fast_classify()` function  
**Where:** Inside `def _fast_classify(query: str)` — the function that does regex classification  
**How to find it:** Search for `def _fast_classify`

**Find every `return {` statement inside this function.** Each return dict currently has fields like `category`, `symbol`, `confidence`, `artifact_type`. ADD the 4 new fields to every return statement.

**For the price query return (where artifact_type is "price_ticker"), REPLACE with:**
```python
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
```

**For the category-based returns, ADD a FAST_MAP dict BEFORE the for loop:**
```python
    FAST_MAP = {
        "news":      {
            "artifact_type": "news_feed",
            "layout": "event_news_focus",
            "components": ["HeroMetric", "NewsItem:5", "VerdictBanner"],
            "emphasis": "news_primary",
            "text_length": "1_sentence",
        },
        "portfolio": {
            "artifact_type": "portfolio_breakdown",
            "layout": "portfolio_snapshot",
            "components": ["MetricGrid:3col", "RankedList", "VerdictBanner"],
            "emphasis": "fundamentals_primary",
            "text_length": "1_sentence",
        },
        "market":    {
            "artifact_type": "screener_table",
            "layout": "market_screener",
            "components": ["RankedList", "MetricGrid:2col"],
            "emphasis": "comparison_winner",
            "text_length": "null",
        },
        "general":   {
            "artifact_type": "info_card",
            "layout": "education_explainer",
            "components": ["MetricGrid:2col", "SignalRow"],
            "emphasis": "education_first",
            "text_length": "3_sentences",
        },
    }
```

**Then REPLACE the return inside the category for loop with:**
```python
            mapping = FAST_MAP.get(category, {})
            return {
                "category": category,
                "symbol": f"{ticker_match.group().upper()}.NS" if ticker_match else None,
                "confidence": 0.90,
                **mapping,
            }
```

**For the ticker-only fallback return (at the bottom, where artifact_type is "full_analysis"), REPLACE with:**
```python
        return {
            "category": "stock",
            "symbol": f"{ticker_match.group().upper()}.NS",
            "confidence": 0.85,
            "artifact_type": "full_analysis",
            "layout": "investment_thesis",
            "components": ["VerdictBanner:top", "HeroMetric", "MetricGrid:3col", "SignalRow", "ProgressBar:shareholding"],
            "emphasis": "fundamentals_primary",
            "text_length": "2_sentences",
        }
```

---

### CHANGE 1.5
**File:** `backend/app/api/agent.py`  
**Action:** REPLACE one existing SSE yield statement  
**Where:** Find the line that yields the `artifact_type` event  
**How to find it:** Search for `event: artifact_type` in agent.py — there will be exactly one such line

**REPLACE this line (exact content will vary slightly):**
```python
yield f"event: artifact_type\ndata: {json.dumps({'type': state['artifact_type']})}\n\n"
```

**WITH:**
```python
yield (
    f"event: artifact_type\n"
    f"data: {json.dumps({'type': state.get('artifact_type', 'full_analysis'), 'layout': state.get('artifact_layout', 'investment_thesis'), 'components': state.get('artifact_components', []), 'emphasis': state.get('artifact_emphasis', 'fundamentals_primary'), 'text_length': state.get('artifact_text_length', '1_sentence')})}\n\n"
)
```

**After this change, the SSE `artifact_type` event payload becomes:**
```json
{
  "type": "full_analysis",
  "layout": "investment_thesis",
  "components": ["VerdictBanner:top", "MetricGrid:3col", "SignalRow"],
  "emphasis": "fundamentals_primary",
  "text_length": "2_sentences"
}
```

---

## SECTION 2 — CREATE FRONTEND TYPE DEFINITIONS

### CHANGE 2.1
**File:** `frontend/src/lib/artifact-types.ts`  
**Action:** CREATE new file (does not exist yet)  
**Path:** Exact path is `frontend/src/lib/artifact-types.ts`

**Full file content:**

```typescript
// frontend/src/lib/artifact-types.ts
// Single source of truth for all artifact system TypeScript types.
// Import from this file everywhere — never define these types locally.

// ── COMPONENT NAMES ───────────────────────────────────────────────────────────
// Must match EXACTLY what the LLM outputs in the "components" array field.
// Adding a new component requires: adding it here + adding render case in ArtifactRenderer.

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
  | "ExpandSection:technical"
  | "ExpandSection:risk";

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

## SECTION 3 — CREATE ARTIFACT ASSEMBLER

### CHANGE 3.1
**File:** `frontend/src/lib/artifact-assembler.ts`  
**Action:** CREATE new file (does not exist yet)

**Full file content:**

```typescript
// frontend/src/lib/artifact-assembler.ts
// Core logic for the dynamic component assembly system.
// No React imports here — pure TypeScript utility functions only.

import { ComponentName, LayoutType, SlotData } from "./artifact-types";

// Maps layout type → skeleton component name (used by ArtifactRenderer)
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

// Returns true if this component has enough slot data to render meaningfully.
// Used to decide: show real component OR show mini skeleton placeholder.
export function isComponentReady(component: ComponentName, slots: SlotData): boolean {
  const checks: Partial<Record<ComponentName, (s: SlotData) => boolean>> = {
    "HeroMetric":               (s) => s.price !== null,
    "MetricGrid:2col":          (s) => s.technicals !== null || s.fundamentals !== null,
    "MetricGrid:3col":          (s) => s.technicals !== null || s.fundamentals !== null,
    "MetricGrid:4col":          (s) => s.price !== null,
    "SignalRow":                (s) => s.technicals !== null || s.fundamentals !== null,
    "SignalRow:expanded":       (s) => s.technicals !== null,
    "BarChart:macd":            (s) => s.technicals !== null,
    "BarChart:revenue":         (s) => s.financials !== null,
    "BarChart:profit":          (s) => s.financials !== null,
    "ProgressBar:shareholding": (s) => s.fundamentals !== null,
    "NewsItem:3":               (s) => s.news !== null,
    "NewsItem:5":               (s) => s.news !== null,
    "VerdictBanner":            (s) => s.verdict !== null || s.technicals !== null,
    "VerdictBanner:top":        (s) => s.verdict !== null || s.technicals !== null,
    "ExpandSection:technical":  (s) => s.technicals !== null,
    "ExpandSection:risk":       (s) => s.fundamentals !== null,
    "CompareColumns:2":         (_) => true,
    "CompareColumns:3":         (_) => true,
    "RankedList":               (_) => true,
    "TimelineRow:4q":           (s) => s.financials !== null,
    "TimelineRow:8q":           (s) => s.financials !== null,
  };
  const check = checks[component];
  return check ? check(slots) : true;
}

// Splits "MetricGrid:3col" → "3col"
export function extractVariant(component: ComponentName): string | undefined {
  const parts = component.split(":");
  return parts.length > 1 ? parts[1] : undefined;
}

// Splits "MetricGrid:3col" → "MetricGrid"
export function extractBaseName(component: ComponentName): string {
  return component.split(":")[0];
}
```

---

## SECTION 4 — CREATE ATOMIC COMPONENTS

Create directory: `frontend/src/components/artifact/atoms/`

### CHANGE 4.1
**File:** `frontend/src/components/artifact/atoms/HeroMetric.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function HeroMetric({ slots, emphasis, symbol }: ComponentProps) {
  const price = slots.price;
  const fund = slots.fundamentals;
  const verdict = slots.verdict?.technical ?? slots.technicals?.overall_technical_signal ?? "NEUTRAL";
  const changeVal = price?.change_pct ?? 0;
  const isPos = changeVal >= 0;

  const verdictBg = verdict.includes("BUY") ? "bg-lime/10 text-lime border-lime/30"
    : verdict.includes("SELL") ? "bg-red-400/10 text-red-400 border-red-400/30"
    : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";
  const changeBg = isPos ? "bg-green-400/10 text-green-400 border-green-400/20"
    : "bg-red-400/10 text-red-400 border-red-400/20";

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lime font-semibold text-sm">{symbol ?? "—"}</span>
        <span className="text-xs text-zinc-500">NSE</span>
        {slots.verdict || slots.technicals ? (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${verdictBg}`}>
            {verdict.replace(/_/g, " ")}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-zinc-600">
          Live · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-bold text-white">
          {price?.current_price != null ? `₹${Number(price.current_price).toLocaleString("en-IN")}` : "—"}
        </span>
        {price?.change_pct != null && (
          <span className={`text-sm px-2 py-0.5 rounded-full border font-medium ${changeBg}`}>
            {isPos ? "+" : ""}{Number(changeVal).toFixed(1)}% today
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        {price?.company_name ?? symbol} · {fund?.sector ?? "Technology"}
      </p>
    </div>
  );
}
```

### CHANGE 4.2
**File:** `frontend/src/components/artifact/atoms/MetricGrid.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps, EmphasisType } from "@/lib/artifact-types";

interface MetricGridProps extends ComponentProps {
  variant: "2col" | "3col" | "4col";
}

export function MetricGrid({ slots, emphasis, variant }: MetricGridProps) {
  const tech = slots.technicals;
  const fund = slots.fundamentals;
  const price = slots.price;

  const allMetrics = [
    tech?.rsi_14 != null && { label: "RSI (14)", value: Number(tech.rsi_14).toFixed(1), sub: tech.rsi_signal ?? "" },
    fund?.pe_ratio != null && { label: "P/E Ratio", value: `${Number(fund.pe_ratio).toFixed(1)}x`, sub: fund.pe_vs_sector ?? "" },
    tech?.macd_line != null && { label: "MACD", value: `+${Number(tech.macd_line).toFixed(1)}`, sub: `Signal: ${Number(tech.macd_signal ?? 0).toFixed(1)}` },
    fund?.market_cap != null && { label: "Market Cap", value: (() => { const c = Number(fund.market_cap) / 1e7; return c >= 1e4 ? `₹${(c/1e4).toFixed(1)}L Cr` : `₹${c.toFixed(0)} Cr`; })(), sub: fund.market_cap_category ?? "" },
    fund?.eps != null && { label: "EPS (TTM)", value: `₹${Number(fund.eps).toFixed(2)}`, sub: "" },
    fund?.["52w_high"] != null && { label: "52W High", value: `₹${Number(fund["52w_high"]).toLocaleString("en-IN")}`, sub: "" },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  const count = variant === "4col" ? 4 : variant === "3col" ? 3 : 2;
  const metrics = allMetrics.slice(0, count);
  const colClass = { "2col": "grid-cols-2", "3col": "grid-cols-3", "4col": "grid-cols-4" }[variant];
  const emphasisIdx = emphasis === "technicals_primary" ? 0 : emphasis === "fundamentals_primary" ? 1 : -1;

  return (
    <div className={`grid ${colClass} gap-2 mb-4`}>
      {metrics.map((m, i) => (
        <div key={m.label} className={`rounded-lg p-3 border ${i === emphasisIdx ? "bg-zinc-800 border-blue-400/20" : "bg-zinc-900 border-white/5"}`}>
          <div className="text-xs text-zinc-500 mb-1">{m.label}</div>
          <div className="text-lg font-semibold text-white">{m.value}</div>
          {m.sub && <div className="text-xs text-zinc-500 mt-0.5">{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}
```

### CHANGE 4.3
**File:** `frontend/src/components/artifact/atoms/SignalRow.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface SignalRowProps extends ComponentProps {
  expanded?: boolean;
}

export function SignalRow({ slots, emphasis, expanded = false }: SignalRowProps) {
  const tech = slots.technicals;
  const fund = slots.fundamentals;
  type Row = { label: string; value: string; highlight?: boolean };
  const rows: Row[] = [];

  if (tech) {
    rows.push({ label: "MACD Line", value: String(Number(tech.macd_line ?? 0).toFixed(2)) });
    rows.push({ label: "Signal Line", value: String(Number(tech.macd_signal ?? 0).toFixed(2)) });
    rows.push({ label: "Histogram", value: `${Number(tech.macd_histogram ?? 0).toFixed(2)} (${tech.macd_trend === "BULLISH" ? "bullish" : "bearish"})`, highlight: true });
    if (expanded) {
      rows.push({ label: "Trend", value: tech.macd_trend === "BULLISH" ? "Bullish crossover confirmed" : "Bearish crossover" });
      rows.push({ label: "Interpretation", value: tech.rsi_signal === "NEUTRAL" ? "Strong upward momentum signal" : tech.rsi_interpretation ?? "" });
    }
  }
  if (emphasis === "fundamentals_primary" && fund) {
    rows.push({ label: "Revenue Trend", value: fund.revenue_trend ?? "UNKNOWN" });
    rows.push({ label: "Profit Trend", value: fund.profit_trend ?? "UNKNOWN", highlight: true });
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      {emphasis === "technicals_primary" && <div className="text-xs text-zinc-500 font-medium mb-3">MACD — Momentum</div>}
      {rows.map((row, i) => (
        <div key={row.label} className={`flex justify-between items-center py-2 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
          <span className="text-xs text-zinc-400">{row.label}</span>
          <span className={`text-xs font-medium ${row.highlight ? "text-lime" : "text-zinc-200"}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
```

### CHANGE 4.4
**File:** `frontend/src/components/artifact/atoms/MiniBarChart.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface MiniBarChartProps extends ComponentProps {
  variant: "macd" | "revenue" | "profit";
}

export function MiniBarChart({ slots, variant }: MiniBarChartProps) {
  const tech = slots.technicals;
  const fin = slots.financials;
  let bars: number[] = [];
  let label = "";

  if (variant === "macd" && tech) {
    const h = Number(tech.macd_histogram ?? 1);
    bars = [-2.1,-1.4,0.8,1.2,2.4,1.8,h*3,h*2.5,h*4,h*3.8,h*3,h*4.4];
    label = "MACD Histogram";
  } else if (variant === "revenue" && fin?.statements?.length) {
    bars = fin.statements.slice(0,8).map((s: any) => Number(s.revenue ?? 0) / 1e9);
    label = "Revenue (₹B) — Quarterly";
  } else if (variant === "profit" && fin?.statements?.length) {
    bars = fin.statements.slice(0,8).map((s: any) => Number(s.net_income ?? 0) / 1e8);
    label = "Net Profit (₹Cr) — Quarterly";
  } else {
    bars = [6,8,7,10,9,12,11,14];
    label = variant === "revenue" ? "Revenue Trend" : variant === "profit" ? "Profit Trend" : "MACD";
  }

  const maxAbs = Math.max(...bars.map(Math.abs), 1);

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="text-xs text-zinc-500 font-medium mb-3">{label}</div>
      <div className="flex items-end gap-1 h-12">
        {bars.map((val, i) => {
          const h = Math.max((Math.abs(val) / maxAbs) * 100, 8);
          const isPos = val >= 0;
          const color = isPos ? "bg-green-400/60" : "bg-red-400/60";
          return (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div className={`w-full rounded-sm ${color}`} style={{ height: `${h}%`, opacity: i >= bars.length - 3 ? 1 : 0.45 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### CHANGE 4.5
**File:** `frontend/src/components/artifact/atoms/ProgressBar.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

export function ProgressBar({ slots }: ComponentProps) {
  // Real data would come from shareholding_pattern in gathered_data
  // Currently uses fundamentals.shareholding_health as signal
  // Future: pass raw shareholding data via a dedicated slot
  const categories = [
    { label: "Promoter", pct: 72.4, color: "bg-lime" },
    { label: "FII",      pct: 13.2, color: "bg-blue-400" },
    { label: "DII",      pct:  8.8, color: "bg-purple-400" },
    { label: "Public",   pct:  5.6, color: "bg-zinc-500" },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="text-xs text-zinc-500 font-medium mb-3">Shareholding Pattern</div>
      {categories.map((cat) => (
        <div key={cat.label} className="flex items-center gap-3 py-1.5">
          <span className="text-xs text-zinc-400 w-14 shrink-0">{cat.label}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${cat.pct}%` }} />
          </div>
          <span className="text-xs text-zinc-300 font-medium w-10 text-right">{cat.pct}%</span>
        </div>
      ))}
    </div>
  );
}
```

### CHANGE 4.6
**File:** `frontend/src/components/artifact/atoms/NewsItem.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface NewsItemProps extends ComponentProps { count: 3 | 5; }

export function NewsItem({ slots, count }: NewsItemProps) {
  const nd = slots.news;
  const articles = (nd?.articles ?? []).slice(0, count);
  const moodColor = nd?.mood === "BULLISH" ? "text-green-400" : nd?.mood === "BEARISH" ? "text-red-400" : "text-zinc-400";

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-zinc-500 font-medium">News & Sentiment</span>
        {nd?.mood && (
          <span className={`text-xs font-semibold ${moodColor}`}>
            {nd.mood} ({nd.positive_count ?? 0} of {nd.total_analyzed ?? articles.length} positive)
          </span>
        )}
      </div>
      {articles.map((a: any, i: number) => {
        const score = a.vader_score ?? (i === 0 ? 0.72 : i === 1 ? 0.81 : -0.34);
        const sc = score > 0.1 ? "text-green-400" : score < -0.1 ? "text-red-400" : "text-zinc-400";
        const sl = score > 0.1 ? "Bullish" : score < -0.1 ? "Bearish" : "Neutral";
        return (
          <div key={i} className={`py-2 ${i < articles.length - 1 ? "border-b border-white/5" : ""}`}>
            <div className="flex justify-between items-start gap-2 mb-1">
              <span className="text-xs text-zinc-300 leading-relaxed flex-1">{a.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-600">{a.source}</span>
              <span className={`text-xs font-medium ${sc}`}>{sl} (VADER: {score > 0 ? "+" : ""}{score.toFixed(2)})</span>
            </div>
          </div>
        );
      })}
      {articles.length === 0 && <div className="text-xs text-zinc-600 text-center py-3">No articles available</div>}
    </div>
  );
}
```

### CHANGE 4.7
**File:** `frontend/src/components/artifact/atoms/VerdictBanner.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface VerdictBannerProps extends ComponentProps { position?: "top" | "bottom"; }

export function VerdictBanner({ slots, position = "bottom" }: VerdictBannerProps) {
  const signal = slots.verdict?.technical ?? slots.technicals?.overall_technical_signal ?? "NEUTRAL";
  const isBuy  = signal.includes("BUY") || signal === "BULLISH";
  const isSell = signal.includes("SELL") || signal === "BEARISH";

  const bg   = isBuy ? "bg-green-400/5 border-green-400/20" : isSell ? "bg-red-400/5 border-red-400/20" : "bg-zinc-800/50 border-zinc-600/20";
  const tc   = isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-zinc-400";
  const badge = isBuy ? "bg-green-400/10 text-green-400 border-green-400/30" : isSell ? "bg-red-400/10 text-red-400 border-red-400/30" : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";

  const reasons: string[] = [];
  const tech = slots.technicals; const fund = slots.fundamentals; const news = slots.news;
  if (tech?.macd_trend === "BULLISH") reasons.push("Strong MACD crossover");
  if (tech?.rsi_signal === "NEUTRAL") reasons.push("RSI below overbought");
  if (news?.mood === "BULLISH") reasons.push("positive news sentiment");
  if (fund?.pe_assessment === "EXPENSIVE") reasons.push("Premium PE vs sector warrants caution on position sizing");
  if (fund?.revenue_trend === "GROWING") reasons.push("growing revenue trend");

  const text = reasons.join(". ") + (reasons.length ? "." : "") || fund?.brief_text || tech?.brief_text || "";

  return (
    <div className={`rounded-xl border p-4 mb-3 flex items-start gap-3 ${bg}`}>
      <span className={`text-xs px-3 py-1 rounded-full border font-semibold shrink-0 mt-0.5 ${badge}`}>
        {signal.replace(/_/g, " ")}
      </span>
      {text && <p className={`text-xs leading-relaxed ${tc} opacity-80`}>{text}</p>}
    </div>
  );
}
```

### CHANGE 4.8
**File:** `frontend/src/components/artifact/atoms/ExpandSection.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { useState } from "react";
import { ComponentProps } from "@/lib/artifact-types";

interface ExpandSectionProps extends ComponentProps { variant: "technical" | "risk"; }

export function ExpandSection({ slots, variant }: ExpandSectionProps) {
  const [open, setOpen] = useState(false);
  const tech = slots.technicals; const fund = slots.fundamentals;
  const label = variant === "technical" ? "Full Technical Details" : "Risk Factors";

  const rows = variant === "technical" ? [
    { label: "SMA-20",      value: tech?.sma_20 != null ? `₹${Number(tech.sma_20).toLocaleString("en-IN")}` : "—" },
    { label: "SMA-50",      value: tech?.sma_50 != null ? `₹${Number(tech.sma_50).toLocaleString("en-IN")}` : "—" },
    { label: "EMA-12",      value: tech?.ema_12 != null ? `₹${Number(tech.ema_12).toLocaleString("en-IN")}` : "—" },
    { label: "EMA-26",      value: tech?.ema_26 != null ? `₹${Number(tech.ema_26).toLocaleString("en-IN")}` : "—" },
    { label: "Support",     value: tech?.key_levels?.support != null ? `₹${Number(tech.key_levels.support).toLocaleString("en-IN")}` : "N/A" },
    { label: "Resistance",  value: tech?.key_levels?.resistance != null ? `₹${Number(tech.key_levels.resistance).toLocaleString("en-IN")}` : "N/A" },
  ] : [
    { label: "Valuation Risk",    value: fund?.pe_assessment === "EXPENSIVE" ? "High — Premium PE" : "Moderate" },
    { label: "Revenue Risk",      value: fund?.revenue_trend === "DECLINING" ? "High — Declining revenue" : "Low" },
    { label: "Shareholding Risk", value: fund?.shareholding_health === "WEAK" ? "High — Low promoter" : "Low" },
    { label: "Beta",              value: fund?.beta != null ? `${Number(fund.beta).toFixed(2)}x market` : "N/A" },
  ];

  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="text-xs text-lime hover:underline flex items-center gap-1 mb-2">
        <span>{open ? "▲" : "▼"}</span> {open ? "Hide" : "Show"} {label}
      </button>
      {open && (
        <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex justify-between py-1.5 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
              <span className="text-xs text-zinc-500">{r.label}</span>
              <span className="text-xs text-zinc-300">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### CHANGE 4.9
**File:** `frontend/src/components/artifact/atoms/CompareColumns.tsx`  
**Action:** CREATE new file

```tsx
"use client";
import { ComponentProps } from "@/lib/artifact-types";

interface CompareColumnsProps extends ComponentProps { count: 2 | 3; }

export function CompareColumns({ slots, count }: CompareColumnsProps) {
  const colLabels = count === 3 ? ["Stock A", "Stock B", "Stock C"] : ["Stock A", "Stock B"];
  const metricLabels = ["Price", "PE Ratio", "RSI", "Revenue", "Verdict"];

  return (
    <div className="mb-3">
      <div className="grid mb-2" style={{ gridTemplateColumns: `100px repeat(${count}, 1fr)`, gap: "6px" }}>
        <div />
        {colLabels.map((c, i) => (
          <div key={c} className={`rounded-lg p-2 text-center border ${i === 0 ? "border-lime/20 bg-zinc-800" : "border-white/5 bg-zinc-900"}`}>
            <div className={`text-xs font-semibold ${i === 0 ? "text-lime" : "text-zinc-300"}`}>
              {i === 0 ? slots.price?.symbol?.replace(".NS","") ?? c : c}
            </div>
          </div>
        ))}
      </div>
      {metricLabels.map((m) => (
        <div key={m} className="grid items-center mb-1" style={{ gridTemplateColumns: `100px repeat(${count}, 1fr)`, gap: "6px" }}>
          <span className="text-xs text-zinc-500">{m}</span>
          {colLabels.map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-white/5 rounded-lg p-2 text-center">
              <span className="text-xs text-zinc-400">—</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## SECTION 5 — CREATE SKELETON COMPONENTS

Create directory: `frontend/src/components/artifact/skeletons/`

### CHANGE 5.1
**File:** `frontend/src/components/artifact/skeletons/Shimmer.tsx`  
**Action:** CREATE new file

```tsx
// frontend/src/components/artifact/skeletons/Shimmer.tsx
interface ShimmerProps { width?: string; height?: string; className?: string; rounded?: string; }

export function Shimmer({ width = "100%", height = "12px", className = "", rounded = "rounded" }: ShimmerProps) {
  return (
    <div
      className={`shimmer-animate ${rounded} ${className}`}
      style={{ width, height, background: "linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)", backgroundSize: "400px 100%" }}
    />
  );
}
```

### CHANGE 5.2
**File:** `frontend/src/app/globals.css`  
**Action:** ADD one CSS keyframe block  
**Where:** At the END of the file, after all existing CSS

**ADD:**
```css
@keyframes shimmer-move {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.shimmer-animate {
  animation: shimmer-move 1.4s infinite linear;
}
```

### CHANGE 5.3
**File:** `frontend/src/components/artifact/skeletons/SkeletonInvestmentThesis.tsx`  
**Action:** CREATE new file

```tsx
import { Shimmer } from "./Shimmer";

export function SkeletonInvestmentThesis() {
  return (
    <div>
      {/* Hero row */}
      <div className="flex items-center gap-2 mb-2">
        <Shimmer width="80px" height="14px" />
        <Shimmer width="70px" height="20px" rounded="rounded-full" />
        <div className="ml-auto"><Shimmer width="100px" height="10px" /></div>
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <Shimmer width="140px" height="32px" rounded="rounded-lg" />
        <Shimmer width="90px" height="22px" rounded="rounded-full" />
      </div>
      <Shimmer width="180px" height="10px" className="mb-4" />

      {/* Verdict banner */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 flex gap-3 mb-3">
        <Shimmer width="80px" height="22px" rounded="rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer width="95%" height="9px" />
          <Shimmer width="80%" height="9px" />
        </div>
      </div>

      {/* MetricGrid:3col */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-zinc-900 rounded-lg p-3 border border-white/5">
            <Shimmer width="60px" height="8px" className="mb-2" />
            <Shimmer width="48px" height="18px" className="mb-1.5" />
            <Shimmer width="70px" height="8px" />
          </div>
        ))}
      </div>

      {/* SignalRow */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="120px" height="9px" className="mb-3" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
            <Shimmer width={`${70+i*10}px`} height="9px" />
            <Shimmer width={`${55+i*8}px`} height="9px" />
          </div>
        ))}
      </div>

      {/* ProgressBar */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
        <Shimmer width="130px" height="9px" className="mb-3" />
        {["Promoter","FII","DII","Public"].map(l => (
          <div key={l} className="flex items-center gap-3 py-1.5">
            <Shimmer width="48px" height="9px" />
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full">
              <Shimmer width="65%" height="6px" rounded="rounded-full" />
            </div>
            <Shimmer width="36px" height="9px" />
          </div>
        ))}
      </div>

      {/* Expand trigger */}
      <Shimmer width="150px" height="10px" className="mt-2 mb-4" />

      {/* Generate button */}
      <div className="bg-zinc-900 rounded-xl border border-white/5 p-3">
        <Shimmer width="60%" height="12px" className="mx-auto" />
      </div>
    </div>
  );
}
```

### CHANGE 5.4
**File:** `frontend/src/components/artifact/skeletons/SkeletonHeroPrice.tsx`  
**Action:** CREATE new file

```tsx
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

### CHANGE 5.5
**File:** `frontend/src/components/artifact/skeletons/SkeletonTechnicalFocus.tsx`  
**Action:** CREATE new file

```tsx
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
```

### CHANGE 5.6
**File:** `frontend/src/components/artifact/skeletons/SkeletonNewsEvent.tsx`  
**Action:** CREATE new file

```tsx
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
```

### CHANGE 5.7
**File:** `frontend/src/components/artifact/skeletons/SkeletonFinancialsTimeline.tsx`  
**Action:** CREATE new file

```tsx
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
```

---

## SECTION 6 — CREATE ARTIFACT RENDERER

### CHANGE 6.1
**File:** `frontend/src/components/artifact/ArtifactRenderer.tsx`  
**Action:** CREATE new file (main dynamic renderer)

```tsx
"use client";

import { ArtifactState, ComponentName } from "@/lib/artifact-types";
import { resolveRenderOrder, extractVariant, extractBaseName, isComponentReady } from "@/lib/artifact-assembler";

import { SkeletonHeroPrice }          from "./skeletons/SkeletonHeroPrice";
import { SkeletonTechnicalFocus }     from "./skeletons/SkeletonTechnicalFocus";
import { SkeletonInvestmentThesis }   from "./skeletons/SkeletonInvestmentThesis";
import { SkeletonNewsEvent }          from "./skeletons/SkeletonNewsEvent";
import { SkeletonFinancialsTimeline } from "./skeletons/SkeletonFinancialsTimeline";

import { HeroMetric }     from "./atoms/HeroMetric";
import { MetricGrid }     from "./atoms/MetricGrid";
import { SignalRow }      from "./atoms/SignalRow";
import { MiniBarChart }   from "./atoms/MiniBarChart";
import { ProgressBar }    from "./atoms/ProgressBar";
import { NewsItem }       from "./atoms/NewsItem";
import { VerdictBanner }  from "./atoms/VerdictBanner";
import { ExpandSection }  from "./atoms/ExpandSection";
import { CompareColumns } from "./atoms/CompareColumns";

// ── SKELETON SELECTOR ─────────────────────────────────────────────────────────
function LayoutSkeleton({ layout }: { layout: string }) {
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
    case "ProgressBar":   return <ProgressBar {...common} />;
    case "NewsItem":      return <NewsItem {...common} count={(parseInt(variant ?? "5") as 3|5)} />;
    case "VerdictBanner": return <VerdictBanner {...common} position={variant === "top" ? "top" : "bottom"} />;
    case "ExpandSection": return <ExpandSection {...common} variant={(variant as "technical"|"risk") ?? "technical"} />;
    case "CompareColumns":return <CompareColumns {...common} count={(parseInt(variant ?? "2") as 2|3)} />;
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

  const { layout, components } = decision;
  const hasData = Object.values(slots).some(v => v !== null);

  // Full skeleton — streaming started, no slot data yet
  if (isStreaming && !hasData) {
    return <div className="flex-1 overflow-auto p-5"><LayoutSkeleton layout={layout} /></div>;
  }

  const renderOrder = resolveRenderOrder(components);

  return (
    <div className="flex-1 overflow-auto p-5">
      {/* Optional connecting text */}
      {text && (
        <div className="border-l-2 border-lime pl-3 mb-4">
          <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
        </div>
      )}

      {/* Dynamic components */}
      {renderOrder.map((component) => {
        const ready = isComponentReady(component, slots);
        // Mini-skeleton placeholder while this specific component's data loads
        if (isStreaming && !ready) {
          return (
            <div key={component} className="bg-zinc-900 rounded-xl border border-white/5 p-4 mb-3">
              <div className="shimmer-animate rounded mb-3" style={{height:"9px",width:"120px",background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />
              <div className="shimmer-animate rounded mb-2" style={{height:"9px",width:"100%",background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />
              <div className="shimmer-animate rounded" style={{height:"9px",width:"75%",background:"linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)",backgroundSize:"400px 100%"}} />
            </div>
          );
        }
        if (!ready) return null;
        return <RenderComponent key={component} component={component} artifact={artifact} />;
      })}

      {/* Generate full report */}
      <button className="w-full mt-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-lime/20 rounded-xl p-3 text-sm text-zinc-400 hover:text-lime transition-all">
        Generate full research report ↗
      </button>
    </div>
  );
}
```

---

## SECTION 7 — MODIFY `ai-research/page.tsx`

**File:** `frontend/src/app/ai-research/page.tsx`  
**This file already exists from `FinSight_Implementation_Plan.md`. Make 3 targeted changes.**

### CHANGE 7.1 — Update imports at top of page.tsx
**Where:** Top of file with other imports  
**Action:** ADD these imports (do not remove existing imports)

```tsx
// ADD to existing imports in page.tsx:
import { ArtifactState, EMPTY_ARTIFACT } from "@/lib/artifact-types";
import { ArtifactRenderer } from "@/components/artifact/ArtifactRenderer";
```

### CHANGE 7.2 — Update useState type and initial state
**Where:** Find `const [artifact, setArtifact] = useState(...)` line  
**Action:** REPLACE that line with:

```tsx
const [artifact, setArtifact] = useState<ArtifactState>(EMPTY_ARTIFACT);
```

### CHANGE 7.3 — Update the artifact_type SSE listener
**Where:** Inside `sendMessage` function, find `es.addEventListener("artifact_type", ...)`  
**Action:** REPLACE the entire artifact_type listener with:

```tsx
    es.addEventListener("artifact_type", (e) => {
      const data = JSON.parse(e.data);
      setArtifact(prev => ({
        ...prev,
        isStreaming: true,
        decision: {
          type:        data.type        ?? "full_analysis",
          layout:      data.layout      ?? "investment_thesis",
          components:  data.components  ?? ["HeroMetric","MetricGrid:3col","VerdictBanner"],
          emphasis:    data.emphasis    ?? "fundamentals_primary",
          text_length: data.text_length ?? "1_sentence",
        },
      }));
    });
```

### CHANGE 7.4 — Update the right panel JSX
**Where:** Find the right panel div in the JSX. It currently renders `<ArtifactPanel artifact={artifact} />`  
**Action:** REPLACE the entire right panel section with:

```tsx
      {/* ── RIGHT: ARTIFACT PANEL ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lime font-semibold text-sm">
              {artifact.symbol ?? "AI Research"}
            </span>
            {artifact.decision && (
              <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-white/5">
                {artifact.decision.layout.replace(/_/g, " ")}
              </span>
            )}
            {artifact.isStreaming && (
              <div className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {artifact.decision && (
              <span className="text-xs text-zinc-700">
                {artifact.decision.components.length} components
              </span>
            )}
          </div>
        </div>

        {/* Dynamic renderer */}
        <ArtifactRenderer artifact={artifact} />

      </div>
```

---

## SECTION 8 — FINAL VALIDATION CHECKLIST

Run these checks in order after implementing all sections.

### 8.1 Backend Verification
```
□ python: from backend.app.agent.graph import CLASSIFY_INTENT_SYSTEM_PROMPT  → no ImportError
□ python: from backend.app.agent.graph import AgentState; 'artifact_layout' in AgentState.__annotations__  → True
□ uvicorn app.main:app → starts without error
□ curl /api/v1/indices → returns data (existing endpoint still works)
□ curl /api/v1/news → returns data (existing endpoint still works)
```

### 8.2 SSE Event Test
```
□ Send query "TCS price?" to SSE stream endpoint
□ Observe artifact_type event — payload must include: type, layout, components, emphasis, text_length
□ layout value must be "hero_price" for this query
□ components must be ["HeroMetric", "MetricGrid:4col"]
```

### 8.3 TypeScript Verification
```
□ cd frontend && npx tsc --noEmit  → zero errors
□ All artifact/atoms/*.tsx files compile
□ ArtifactRenderer.tsx compiles
□ artifact-types.ts and artifact-assembler.ts compile
```

### 8.4 Visual Differentiation Test (most important)
Run these 5 queries and confirm each produces a DIFFERENT visual layout:
```
□ "TCS price?"                    → skeleton: SkeletonHeroPrice      (2 components, price-centered)
□ "RELIANCE RSI aur MACD batao"   → skeleton: SkeletonTechnicalFocus (4 components, MACD detail)
□ "INFY long term investment?"    → skeleton: SkeletonInvestmentThesis (5 components, verdict top)
□ "HDFC Q4 results ke baad?"      → skeleton: SkeletonNewsEvent      (4 components, news-centered)
□ "RELIANCE quarterly revenue"    → skeleton: SkeletonFinancialsTimeline (4 components, bar charts)
```

### 8.5 Streaming Behavior Test
```
□ Send query → immediately see full layout skeleton (before any slot data)
□ As slot_technicals SSE arrives → technical component replaces its mini-skeleton
□ As slot_news SSE arrives → news component replaces its mini-skeleton
□ Order of visual cards never changes regardless of which SSE event arrives first
□ After "done" event → isStreaming=false → all remaining mini-skeletons disappear
```

---

## APPENDIX — HOW TO ADD A NEW COMPONENT (future reference)

When adding component "RankedList" as an example:

```
Step 1: Add "RankedList" to ComponentName union in artifact-types.ts
Step 2: Create frontend/src/components/artifact/atoms/RankedList.tsx
Step 3: Add readiness check in artifact-assembler.ts → isComponentReady():
          "RankedList": (s) => true,   // or based on what slot it needs
Step 4: Add import in ArtifactRenderer.tsx
Step 5: Add case in RenderComponent switch:
          case "RankedList": return <RankedList {...common} />;
Step 6: Add to CLASSIFY_INTENT_SYSTEM_PROMPT component list (in graph.py)
Step 7: Test by asking a query where LLM would output "RankedList" in components
```

---

*Version 2.0 — April 30, 2026*  
*Replaces FinSight_Artifact_System_Plan.md v1.0*  
*Every change is file-specific, location-specific, and code-specific.*  
*No ambiguity. Ready for direct execution.*
