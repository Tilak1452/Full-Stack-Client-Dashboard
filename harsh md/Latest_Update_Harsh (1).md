# FinSight AI Agent — Complete System Documentation
### Latest Update — April 2026 | Prepared by: Harsh

---

> ## ⚠️ IMPORTANT NOTICE FOR ALL TEAM MEMBERS
>
> This document reflects the **ACTUAL PRODUCTION STATE** of the FinSight AI Agent as of **April 21, 2026**.
> All architectural decisions, code structures, model IDs, and pipeline flows described here
> match the **real, deployed codebase** inside `backend/app/agent/`.
>
> Do **NOT** use older documentation — the architecture described here has been **fully migrated**
> from a legacy single-LLM ReAct agent to the modern Specialist-Prompt LangGraph State Machine.

---

## TABLE OF CONTENTS

1. [Project Vision & Identity](#1-project-vision--identity)
2. [Why We Migrated: From ReAct to LangGraph](#2-why-we-migrated-from-react-to-langgraph)
3. [Production Architecture Overview](#3-production-architecture-overview)
4. [Phase 1: Rule-Based Complexity Classifier](#4-phase-1-rule-based-complexity-classifier)
5. [Phase 2: LLM Intent Classifier Node](#5-phase-2-llm-intent-classifier-node)
6. [Phase 3: Parallel Data Gathering Nodes](#6-phase-3-parallel-data-gathering-nodes)
7. [Phase 4: Specialist-Prompt Synthesis Nodes](#7-phase-4-specialist-prompt-synthesis-nodes)
8. [Model Strategy — The 3-Tier Architecture](#8-model-strategy--the-3-tier-architecture)
9. [Fallback Chain & Resilience Mechanism](#9-fallback-chain--resilience-mechanism)
10. [All 5 LangChain Tools (Live Data Fetchers)](#10-all-5-langchain-tools-live-data-fetchers)
11. [Specialist Prompts Registry](#11-specialist-prompts-registry)
12. [API Endpoints Exposed to Frontend](#12-api-endpoints-exposed-to-frontend)
13. [Frontend Integration (SSE Streaming)](#13-frontend-integration-sse-streaming)
14. [Per-Node LLM Configuration Table](#14-per-node-llm-configuration-table)
15. [Current Model Status on OpenRouter](#15-current-model-status-on-openrouter)
16. [Known Issues & Active Bugs](#16-known-issues--active-bugs)
17. [Future Improvements Roadmap](#17-future-improvements-roadmap)
18. [Gemini 2.5 Upgrade Proposal](#18-gemini-25-upgrade-proposal)

---

## 1. Project Vision & Identity

FinSight AI is not a generic AI assistant.
It is a **domain-specific, multi-model, pipeline-driven Financial Intelligence System** built exclusively for the **Indian stock market (NSE/BSE)**.

### What Makes FinSight AI Different

| Platform | Strength |
|---|---|
| ChatGPT | Teaching & general reasoning |
| Gemini | Multimodal & general tasks |
| Claude | Long-context planning |
| **FinSight AI** | **Real-time Indian equity analysis, risk-aware multi-agent orchestration** |

### Core Philosophy

- **LLM = Synthesizer, NOT Controller.** The AI never decides what data to fetch. Tools run deterministically. The LLM only interprets structured data and writes beautiful financial prose.
- **Real data over hallucination.** Every response is grounded in live yFinance calls, VADER-scored news, and real RSI/MACD calculations.
- **Graceful degradation.** If all AI models fail (quota, rate limit, downtime), the system still returns the raw technical data it gathered, never crashes.

---

## 2. Why We Migrated: From ReAct to LangGraph

### What Was the Legacy System

Until **April 2026**, the agent was built on a **single-LLM ReAct (Reason + Act) loop** pattern:

```
User Query → Single LLM decides tools → Execute tools sequentially → LLM synthesizes → Response
```

**Problems identified with the old ReAct system:**

| Problem | Impact |
|---|---|
| LLM decided which tools to call | Hallucinated tool names, skipped real data |
| Sequential tool calls | High latency (4–6 second chains) |
| One model for all tasks | Expensive; classifier and analyst paid the same cost |
| No fallback on quota errors | System crashed on 429/402 errors |
| No complexity awareness | Simple price lookup ≡ complex portfolio analysis in cost |

### The New Architecture

The **Specialist-Prompt LangGraph State Machine** eliminates all of the above:

- Tools are called **deterministically** by gather nodes — LLM never chooses them
- Tools run in **parallel** via `asyncio.gather()` — latency drops ~60%
- Each node uses a **different specialist model** matched to task difficulty
- A **3-tier fallback chain** catches every quota/rate-limit failure automatically

---

## 3. Production Architecture Overview

```
                        USER QUERY
                             │
              ┌──────────────▼──────────────┐
              │   PHASE 1: Rule Classifier   │  ← <1ms, ZERO API calls
              │   classify_query_complexity() │
              │   "simple" │ "medium" │ "complex" │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   PHASE 2: LLM Classifier    │  ← Gemma 4 (cheapest/fastest)
              │   classify_intent()          │
              │   → intent_category          │
              │   → intent_symbol            │
              └──────────────┬──────────────┘
                             │
                      route_intent()
                             │
          ┌──────────────────┼──────────────────┬──────────────┐
          │                  │                  │              │
          ▼                  ▼                  ▼              ▼
  gather_stock_data   gather_news_data  gather_portfolio  handle_market
  [PARALLEL: 4 tools] [async news API] [data injected]   [PARALLEL: 12 stocks]
          │                  │                  │              │
          ▼                  ▼                  ▼              ▼
   analyze_stock      synthesize_news    audit_portfolio  [market LLM synthesis]
   [Specialist LLM]   [Specialist LLM]  [Specialist LLM]
          │
          ▼  (when category == "general")
   handle_general
   [Educator LLM]
```

**Key Design Axioms:**
1. Every node is a **pure function** — it takes state, returns new state.
2. Gather nodes **never call an LLM**. They fetch data only.
3. Synthesis nodes **never call tools**. They interpret data only.
4. The LangGraph state (`AgentState`) is a TypedDict that flows immutably through every step.

---

## 4. Phase 1: Rule-Based Complexity Classifier

**File:** `backend/app/agent/graph.py`
**Function:** `classify_query_complexity(query: str) -> str`

This is a **zero-latency, zero-API-cost** classifier that runs in under 1 millisecond using keyword matching. It sets the **model tier** for every downstream LLM call in the current session.

### Classification Rules

```python
# SIMPLE — Price lookups, basic data retrieval
Triggers: "price", "current price", "52 week", "market cap", "what is pe"
→ Model selected: Gemma 4 31B (free, fast dense model)

# MEDIUM — Single-stock technical analysis, sector news
Triggers: "rsi", "sma", "ema", "macd", "technical analysis", "support",
          "sector", "trend", "best stock", "today in", "news"
→ Model selected: Qwen3 (free MoE reasoning model)

# COMPLEX — Multi-stock, portfolio strategy, macro, comparisons
Triggers: "compare", "vs", "portfolio", "risk", "diversify",
          "invest in", "should i", "best etf", "macro", "next year"
→ Model selected: Nemotron Super 70B (RLHF-tuned, highest quality)
```

### Why This Matters

Without this step, every query — including *"what is TCS price?"* — would route to the expensive Nemotron model. By pre-routing based on complexity, we:
- Reduce average query cost by ~80% for simple lookups
- Reduce latency for simple queries from ~8s → ~2s
- Reserve the best model exclusively for complex financial reasoning

---

## 5. Phase 2: LLM Intent Classifier Node

**File:** `backend/app/agent/graph.py`
**Function:** `classify_intent(state: AgentState) -> AgentState`

This LLM call identifies **what the user is asking about**, specifically:

- **intent_category**: One of `["stock", "news", "portfolio", "market", "general"]`
- **intent_symbol**: Ticker in NSE format (e.g., `RELIANCE.NS`) or `null`
- **intent_confidence**: Float 0.0–1.0 (not used in routing currently)

### Prompt Used

```
System: "You are a financial query intent classifier for FinSight AI.
        Classify the query and return ONLY valid JSON:
        {"category": "stock|news|portfolio|market|general", "symbol": "TICKER.NS or null"}"

User: 'User query: "{query}"'
```

**Always uses Gemma 4 31B** regardless of complexity rating — because this is a JSON extraction task, not deep reasoning.

**Error Handling:** If the LLM fails to return valid JSON (network error, malformed output, rate limit), the node falls back to `intent_category = "general"` so the system always responds rather than crashing.

---

## 6. Phase 3: Parallel Data Gathering Nodes

These nodes call real-world APIs using `asyncio.gather()` to run **all tool calls simultaneously**.

### 6.1 `gather_stock_data` (Stock Intent)

Runs **4 tools in parallel** for a single stock query:

```python
stock_raw, tech_raw, structure_raw, news_raw = await asyncio.gather(
    get_stock_data.ainvoke({"symbol": symbol}),               # Tool 1
    get_technical_indicators.ainvoke({"symbol": symbol}),     # Tool 2
    get_sector_context.ainvoke({"symbol": symbol}),           # Tool 3
    get_financial_news.ainvoke({"query": clean_name}),        # Tool 4
)
```

**Legacy sequential time:** ~4,000ms
**Parallel time with asyncio.gather:** ~900ms

Data key normalization happens here:
- `rsi_14` → `rsi`
- `macd_line` → `macd`
- `ema_12` → `ema_20`
- `market_cap_cr` → `market_cap`

### 6.2 `gather_news_data` (News Intent)

Fetches up to 15 articles from the news service, normalizes them to:
```json
{"title": "...", "source": "...", "sentiment": "bullish|bearish|neutral", "published_at": "..."}
```

### 6.3 `gather_portfolio_data` (Portfolio Intent)

Currently a placeholder — portfolio data is injected from the frontend request payload. Returns empty structure that gets populated by the API layer in `api/agent.py`.

### 6.4 `handle_market` (Market Intent — Self-Contained)

The most complex gather node. Fetches **12 stocks from the screen universe IN PARALLEL**:

```python
SCREEN_UNIVERSE = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "SBIN.NS",
    "TATASTEEL.NS", "ICICIBANK.NS", "WIPRO.NS", "AXISBANK.NS",
    "BAJFINANCE.NS", "SUNPHARMA.NS", "LT.NS"
]
```

Each symbol gets `get_stock_data` + `get_technical_indicators` in parallel, then ALL 12 symbols fetch SIMULTANEOUSLY. This node then passes the aggregated JSON blob directly to the Market Screener LLM for ranking and filtering.

---

## 7. Phase 4: Specialist-Prompt Synthesis Nodes

These nodes receive the gathered data and produce the final human-readable response.

### 7.1 `analyze_stock`

**Specialist Role:** Senior Indian Equity Research Analyst (15 years experience)
**System Prompt Identity:** "You are FinSight AI — a senior Indian equity research analyst."

Uses `build_analyst_prompt()` from `prompt_builder.py` to inject:
- Current price, previous close, day change %
- PE ratio, Market Cap, 52-week high/low
- RSI-14, SMA-20/50, EMA-12/26, MACD + Signal line
- Recent news headlines with VADER sentiment scores
- Detected trading setup (if any)
- Market structure context

Output: Structured markdown with sections for price analysis, technicals, news sentiment, risks and conclusion. Always ends with: *⚠️ This analysis is for research purposes only — not financial advice.*

### 7.2 `synthesize_news`

**Specialist Role:** Bloomberg Intelligence-style Market News Analyst

Produces a market briefing with:
- Most market-moving headline first
- Company names, prices, exact numbers cited
- Flowing markdown prose (NOT JSON)
- Concludes with: **Overall Mood:** BULLISH/BEARISH/NEUTRAL + one-sentence reason

### 7.3 `audit_portfolio`

**Specialist Role:** Portfolio Risk Advisor

Receives total invested, total current value, overall P&L%, and full holdings list in JSON. Produces:
- Risk assessment
- Sector concentration warnings
- Rebalancing suggestions
- Individual holding analysis

### 7.4 `handle_general`

**Specialist Role:** Financial Educator & Macro Advisor

Used for educational queries, investment strategy questions, and macroeconomic concepts. Examples:
- *"Should I invest in IT sector?"*
- *"What is a P/E ratio?"*
- *"Explain diversification"*

### 7.5 `handle_market`

**Specialist Role:** Market Screener

Receives the 12-stock aggregated JSON and the user's screening criteria. Outputs a ranked list of stocks matching the query criteria (e.g., "best IT stocks today", "top gainers", "oversold stocks").

---

## 8. Model Strategy — The 3-Tier Architecture

### The Tier System

```
SIMPLE TIER   → google/gemma-4-31b-it:free
                Fast, dense model. Perfect for JSON parsing and simple price lookups.
                Temperature: 0.05–0.10 (very deterministic for classifier role)

MEDIUM TIER   → qwen/qwen3-next-80b-a3b-instruct:free
                80B MoE reasoning model. Handles single-stock analysis, sector news.
                Temperature: 0.30–0.48 (moderate creativity for analysis prose)

COMPLEX TIER  → nvidia/llama-3.1-nemotron-70b-instruct
                RLHF-tuned 70B. Reserved for complex multi-step financial reasoning.
                Temperature: 0.38–0.50 (higher for strategy and general Q&A)
```

### How the Complexity Tier Selects the Node's Model

```
Query: "What is the price of TCS?"
  → classify_query_complexity() → "simple"
  → classify_intent() → category: "stock", symbol: "TCS.NS"
  → gather_stock_data() → fetch real-time data
  → analyze_stock() → _get_llm("analyze_stock", complexity="simple")
                    → USES: google/gemma-4-31b-it:free
                    → max_tokens: 2500, temp: ~0.35

Query: "Compare TCS vs Infosys and tell me which to invest in"
  → classify_query_complexity() → "complex"
  → classify_intent() → category: "stock", symbol: "TCS.NS"
  → gather_stock_data() → fetch real-time data
  → analyze_stock() → _get_llm("analyze_stock", complexity="complex")
                    → USES: nvidia/llama-3.1-nemotron-70b-instruct
                    → max_tokens: 2500, temp: ~0.36
```

**This is why identical nodes can use different models** — the tier is set ONCE at Phase 1 and flows through the entire session via `AgentState.query_complexity`.

---

## 9. Fallback Chain & Resilience Mechanism

**Code Location:** `backend/app/agent/graph.py`, `_LLM_CHAINS` dict + `_get_llm()` function

### The 3-Attempt Explicit Fallback Chain

Previously, the fallback was broken (all 3 attempts used the same "complex" model due to a math error). This has been fixed with an explicit ordered list per tier.

```python
_LLM_CHAINS = {
    "simple":  [
        "google/gemma-4-31b-it:free",              # Attempt 0 — Primary
        "qwen/qwen3-next-80b-a3b-instruct:free",   # Attempt 1 — Fallback 1
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Attempt 2 — Final safety
    ],
    "medium":  [
        "qwen/qwen3-next-80b-a3b-instruct:free",   # Attempt 0 — Primary
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Attempt 1 — Fallback 1
        "google/gemma-4-31b-it:free",              # Attempt 2 — Final safety
    ],
    "complex": [
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Attempt 0 — Primary
        "qwen/qwen3-next-80b-a3b-instruct:free",   # Attempt 1 — Fallback 1
        "google/gemma-4-31b-it:free",              # Attempt 2 — Final safety
    ],
}
```

### What Happens When ALL 3 Attempts Fail

Every synthesis node has a final `except` block that returns a **raw data fallback** instead of an error page:

- `analyze_stock` → Returns raw price and RSI data as plain text
- `synthesize_news` → Returns article count and "please check News tab"
- `handle_general` → Returns "I encountered an error, please try again"
- `handle_market` → Returns screened stock count + "AI interpretation unavailable"

**The server never crashes. The user always gets some response.**

---

## 10. All 5 LangChain Tools (Live Data Fetchers)

**File:** `backend/app/agent/tools.py`

All tools are:
- `@tool`-decorated async functions
- Return JSON strings (parsed by gather nodes)
- Use `asyncio.run_in_executor()` to wrap synchronous yFinance calls without blocking

### Tool 1: `get_stock_data`

**Input:** `symbol: str` (e.g., `"TCS.NS"`)

**Returns:**
```json
{
  "symbol": "TCS.NS",
  "company": "Tata Consultancy Services Ltd",
  "price": 3420.5,
  "previous_close": 3390.0,
  "change_pct": 0.9,
  "day_high": 3445.0,
  "day_low": 3380.0,
  "market_cap_cr": 124500,
  "pe_ratio": 28.4,
  "week_52_high": 4200.0,
  "week_52_low": 3100.0,
  "volume": 1234567,
  "sector": "Technology",
  "beta": 0.72
}
```

### Tool 2: `get_technical_indicators`

**Input:** `symbol: str`

**Returns:**
```json
{
  "rsi_14": 58.3,
  "sma_20": 3350.0,
  "sma_50": 3280.0,
  "ema_12": 3380.0,
  "ema_26": 3300.0,
  "macd_line": 42.5,
  "macd_signal_line": 38.1,
  "macd_trend": "BULLISH",
  "rsi_signal": "NEUTRAL"
}
```

### Tool 3: `get_financial_news`

**Input:** `query: str, limit: int`

Fetches from Yahoo Finance RSS + VADER sentiment scoring. Returns list of:
```json
[
  {
    "title": "TCS Q4 Results Beat Estimates; Revenue Up 12%",
    "source": "Economic Times",
    "sentiment": "bullish",
    "published": "2026-04-20T14:30:00"
  }
]
```

### Tool 4: `get_sector_context`

**Input:** `symbol: str`

Returns peer PE ratios, sector index performance, and relative valuation benchmarks.

### Tool 5: `compare_stocks`

**Input:** `symbols: List[str]` (up to 5)

Side-by-side comparison of price, PE, market cap, RSI, SMA for multiple stocks simultaneously.

---

## 11. Specialist Prompts Registry

**File:** `backend/app/agent/prompts.py`

| Prompt Constant | Used In Node | LLM Persona | Output Format |
|---|---|---|---|
| `CLASSIFIER_SYSTEM_PROMPT` | `classify_intent` | JSON Router | Strict JSON only |
| `ANALYST_SYSTEM_PROMPT` | `analyze_stock` | Senior Equity Analyst | Markdown with sections |
| `NEWS_SYNTHESIS_SYSTEM_PROMPT` | `synthesize_news` | Bloomberg Intelligence | Flowing prose markdown |
| `PORTFOLIO_AUDITOR_SYSTEM_PROMPT` | `audit_portfolio` | Portfolio Risk Advisor | Structured markdown |
| `GENERAL_EDUCATOR_SYSTEM_PROMPT` | `handle_general` | Financial Educator | Conversational markdown |
| `MARKET_SCREENER_SYSTEM_PROMPT` | `handle_market` | Market Screener | Ranked markdown list |

### Anti-Hallucination Rules in Every Prompt

Every specialist system prompt includes:
- *"Use ONLY the data provided below. Never fabricate prices, ratios, or news."*
- *"Be direct and cite real numbers from the data."*
- *"End every response with: ⚠️ This analysis is for research purposes only — not financial advice."*

---

## 12. API Endpoints Exposed to Frontend

**File:** `backend/app/api/agent.py`

### `POST /api/v1/agent/query`

**Type:** Blocking JSON response (waits for full pipeline to complete)

**Request Body:**
```json
{
  "query": "Should I invest in IT sector?",
  "portfolio_context": []
}
```

**Response:**
```json
{
  "response": "## IT Sector Analysis\n\n...",
  "intent": "general",
  "symbol": null,
  "complexity": "complex",
  "model_used": "nvidia/llama-3.1-nemotron-70b-instruct",
  "processing_time_ms": 4250
}
```

### `POST /api/v1/agent/stream`

**Type:** Server-Sent Events (SSE) — real-time streaming

Emits structured events:

```
event: complexity
data: {"complexity": "complex", "model": "Nemotron Super 70B"}

event: status
data: {"message": "Fetching live market data..."}

event: result
data: {"content": "## IT Sector Analysis\n\n...", "intent": "general"}

event: done
data: {}
```

Frontend connects with `EventSource` and renders text as tokens arrive.

---

## 13. Frontend Integration (SSE Streaming)

**File:** `frontend/src/app/ai-research/page.tsx`
**File:** `frontend/src/lib/ai.api.ts`

### TypeScript Event Types

```typescript
type AgentSSEEvent =
  | { type: 'complexity'; complexity: string; model: string }
  | { type: 'status';     message: string }
  | { type: 'result';     content: string; intent: string }
  | { type: 'error';      message: string }
  | { type: 'done' };
```

### Model Badge Display

The frontend reads the `complexity` event to show a colored badge before the response renders:

- `simple`  → `🌱 Gemma 4 31B` (green badge)
- `medium`  → `🔮 Qwen3 80B` (purple badge)
- `complex` → `🚀 Nemotron Super 70B` (blue badge)

---

## 14. Per-Node LLM Configuration Table

| Node | Temperature Range | Max Tokens | Purpose |
|---|---|---|---|
| `classify_intent` | 0.05 – 0.10 | 200 | JSON output — very low randomness needed |
| `analyze_stock` | 0.30 – 0.42 | 2,500 | Deep-dive analysis with data grounding |
| `synthesize_news` | 0.35 – 0.48 | 1,200 | Narrative prose from structured data |
| `audit_portfolio` | 0.28 – 0.40 | 1,800 | Risk analysis — needs precision |
| `handle_general` | 0.38 – 0.50 | 900 | Educational Q&A — moderate creativity |
| `handle_market` | 0.40 – 0.50 | 4,000 | Screening 12 stocks — large context |

**Global settings (all nodes):**
- `base_url`: `https://openrouter.ai/api/v1`
- `streaming`: `False` (sync `.invoke()` calls — streaming=True causes issues)
- `timeout`: `90` seconds

---

## 15. Current Model Status on OpenRouter

*Last tested: April 21, 2026*

| Model | OpenRouter Slug | Status | Access Type |
|---|---|---|---|
| Gemma 4 31B | `google/gemma-4-31b-it:free` | ✅ Working | Free (congested at times) |
| Qwen 3 80B | `qwen/qwen3-next-80b-a3b-instruct:free` | ⚠️ Unstable | Free (heavy rate-limiting) |
| Nemotron Super 70B | `nvidia/llama-3.1-nemotron-70b-instruct` | ✅ Working | Paid (requires credits) |

**Important:** The `:free` slug models are separately provisioned by OpenRouter and may be rate-limited during peak hours. The paid Nemotron model is the most reliable for consistent production use.

**Credit Status:** The `NVIDIA_Nemotron_3_Super_API_KEY` currently has ~956 tokens of credit remaining which is below the 1,200 token threshold for `handle_general`. **This needs to be topped up.**

---

## 16. Known Issues & Active Bugs

### Issue 1: `handle_general` Credit Exhaustion
- **Error:** `402 - You requested up to 1200 tokens, but can only afford 956.`
- **Root Cause:** Nemotron Super key balance is low.
- **Fix:** Top up the OpenRouter credit balance for `NVIDIA_Nemotron_3_Super_API_KEY`.

### Issue 2: Qwen 3 Rate Limiting
- **Error:** `429 - qwen/qwen3-next-80b-a3b-instruct:free is temporarily rate-limited upstream.`
- **Root Cause:** Qwen 3 free tier is free and heavily congested globally.
- **Fix (Option A):** Add your own Qwen API key in OpenRouter settings to get dedicated rate limits.
- **Fix (Option B):** Upgrade the medium tier to a paid model like Gemini 2.5 Flash.

### Issue 3: `detect_setup` is a Stub
- **Location:** `graph.py`, called inside `gather_stock_data`
- **Status:** Currently returns empty `{}` — no actual trading setup detection.
- **Fix Required:** Implement RSI/MACD crossover + candlestick pattern detection logic.

### Issue 4: Port 8001 vs 8000
- The default dev port was changed to `8001` due to Windows WinError 10013 conflicts.
- `.env.local` has been updated to point to `http://127.0.0.1:8001`.
- Run backend with: `uvicorn app.main:app --reload --port 8001`

---

## 17. Future Improvements Roadmap

### Short-Term (Next Sprint)

| Task | Priority | Description |
|---|---|---|
| Top up Nemotron credits | CRITICAL | Unblocks all complex queries |
| Implement `detect_setup` | HIGH | Replace stub with RSI/MACD crossover logic |
| Add BYOK for Qwen | HIGH | Add own Qwen API key to avoid rate limits |
| Unit tests for graph nodes | MEDIUM | Test classify_intent, gather_stock_data isolation |

### Medium-Term

| Task | Priority | Description |
|---|---|---|
| Upgrade Gemma → Gemini 2.5 Flash | HIGH | Better JSON adherence for classifier |
| Memory system | MEDIUM | Store last 3 turns in AgentState for follow-up queries |
| Enhanced `handle_market` universe | MEDIUM | Expand from 12 → 50 stocks |
| WebSocket streaming for agent | LOW | Replace SSE with persistent WS connection |

### Long-Term

| Task | Description |
|---|---|
| Risk Agent | Dedicated node for portfolio volatility + drawdown analysis |
| Strategy Agent | Long-term investment strategy generation with MPT integration |
| Multi-turn conversation | Stateful session memory across queries |
| Voice interface | Speech-to-query + TTS response for mobile |

---

## 18. Gemini 2.5 Upgrade Proposal

### Why Gemini 2.5 is Superior for FinSight

Based on our specific use cases — JSON classification, financial data synthesis, and general financial advisory — here is the comparison:

| Capability | Gemma 4 31B (Current) | Gemini 2.5 Flash (Proposed) |
|---|---|---|
| JSON adherence (classifier) | Good (sometimes adds extra text) | Excellent (native JSON mode) |
| Context window | ~32K tokens | 1M tokens |
| Financial knowledge | Good | Excellent + recent training |
| Speed (TTFT) | ~1.5s | ~0.8s |
| Cost per 1M tokens | Free (limited) | ~$0.075 (extremely cheap) |
| Rate limits | Heavy congestion | Generous per-minute quota |

### Proposed New Tier Configuration

```python
_LLM_CHAINS = {
    "simple":  [
        "google/gemini-2.5-flash",              # Fast JSON classification
        "qwen/qwen3-next-80b-a3b-instruct:free", # Free fallback
        "nvidia/llama-3.1-nemotron-70b-instruct" # Final safety
    ],
    "medium":  [
        "qwen/qwen3-next-80b-a3b-instruct:free",  # Mid-tier free
        "google/gemini-2.5-flash",                # Paid fallback
        "nvidia/llama-3.1-nemotron-70b-instruct"  # Final safety
    ],
    "complex": [
        "google/gemini-2.5-pro-preview",           # Best for deep reasoning
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Strong paid fallback
        "google/gemini-2.5-flash",                 # Fast final fallback
    ],
}
```

**What to add to `.env`:**
```env
GEMINI_OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
```

> ✅ **Recommendation:** Switch `classify_intent` to always use `google/gemini-2.5-flash` regardless of complexity tier. The JSON adherence and speed improvement for the classifier step will immediately improve routing accuracy across the whole pipeline.

---

## Appendix: File Map

| File | Purpose |
|---|---|
| `backend/app/agent/graph.py` | Core LangGraph state machine (800 lines) |
| `backend/app/agent/tools.py` | 5 async LangChain tools |
| `backend/app/agent/prompts.py` | 6 specialist system prompts |
| `backend/app/agent/prompt_builder.py` | Dynamic data injection into prompts |
| `backend/app/api/agent.py` | HTTP endpoints (blocking + SSE streaming) |
| `backend/app/core/config.py` | All model slugs, token budgets, API keys |
| `backend/app/agent/agent.py` | ⚠️ DEPRECATED STUB — do not use |
| `frontend/src/app/ai-research/page.tsx` | AI chat UI (SSE consumer) |
| `frontend/src/lib/ai.api.ts` | TypeScript SSE event types + fetch wrapper |

---

*Document compiled and maintained by Harsh — April 21, 2026.*
*Reflects production codebase commit state as of this date.*
*Next scheduled review: After Nemotron credit top-up and detect_setup implementation.*
