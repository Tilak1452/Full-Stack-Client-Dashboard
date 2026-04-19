# FinSight AI — Agent Architecture & Prompt System (Complete Reference)

> **Purpose:** This document is a complete, step-by-step breakdown of the 4 core agent files that power FinSight AI's LangGraph-based reasoning pipeline. Use this as context when working with Claude or any other AI assistant to understand how queries flow through the system.
>
> **Last updated:** April 17, 2026

---

## TABLE OF CONTENTS

1. [High-Level Architecture](#1-high-level-architecture)
2. [File 1 — `graph.py` (State Machine & Orchestration)](#2-file-1--graphpy)
3. [File 2 — `prompts.py` (All System & User Prompt Templates)](#3-file-2--promptspy)
4. [File 3 — `prompt_builder.py` (Dynamic Prompt Assembly)](#4-file-3--prompt_builderpy)
5. [File 4 — `tools.py` (Data-Fetching Tools)](#5-file-4--toolspy)
6. [Complete Flow Example](#6-complete-flow-example)

---

## 1. HIGH-LEVEL ARCHITECTURE

The FinSight AI agent is a **LangGraph state machine** with 9 nodes. Every user query follows this pipeline:

```
User Query
    │
    ▼
┌──────────────────┐
│  classify_intent │  ← Nano model classifies: stock / news / portfolio / market / general
└──────────────────┘
    │
    ▼ (conditional routing)
    ┌───────────────────────────────────────────────────────────┐
    │                                                           │
    ▼                   ▼                   ▼                   ▼                 ▼
gather_stock_data   gather_news_data   gather_portfolio_data   handle_general   handle_market
    │                   │                   │                   │                 │
    ▼                   ▼                   ▼                   │                 │
analyze_stock    synthesize_news    audit_portfolio            │                 │
    │                   │                   │                   │                 │
    └───────────────────┴───────────────────┴───────────────────┴─────────────────┘
                                            │
                                            ▼
                                           END
                                    (final_response)
```

### State Object (passed between all nodes)

```python
class AgentState(TypedDict):
    query: str                      # The user's original question
    intent_category: str            # "stock" | "news" | "portfolio" | "general" | "market"
    intent_symbol: Optional[str]    # Extracted ticker (e.g., "RELIANCE.NS") or None
    intent_confidence: float        # 0.0 to 1.0
    gathered_data: dict             # Accumulated tool results (stock data, news, setups, etc.)
    final_response: str             # The final human-readable markdown response
    error: Optional[str]            # Error message if something failed
```

---

## 2. FILE 1 — `graph.py`

**Location:** `backend/app/agent/graph.py` (579 lines, 21KB)
**Purpose:** Defines the LangGraph state machine — all nodes, routing logic, model configuration, and the compiled graph singleton.

### Step 1: Model Configuration (OpenRouter / NVIDIA Nemotron)

The system uses **two model tiers** accessed via OpenRouter:

| Node | Model Tier | Temperature Range | Max Tokens |
|------|-----------|-------------------|------------|
| `classify_intent` | **Nano** | 0.05 – 0.15 | From `settings.nemotron_classify_max_tokens` |
| `analyze_stock` | **Super** | 0.30 – 0.42 | From `settings.nemotron_analyze_max_tokens` |
| `synthesize_news` | **Nano** | 0.35 – 0.48 | From `settings.nemotron_news_max_tokens` |
| `audit_portfolio` | **Super** | 0.28 – 0.40 | From `settings.nemotron_portfolio_max_tokens` |
| `handle_general` | **Nano** | 0.38 – 0.50 | From `settings.nemotron_general_max_tokens` |
| `handle_market` | **Super** | 0.50 – 0.50 | From `settings.nemotron_market_max_tokens` |

**Key design choice:** Temperature is **randomized** within the safe range on every call to prevent repetitive phrasing.

The `_get_llm()` function creates a `ChatOpenAI` instance configured for OpenRouter:
- `base_url` = `settings.nvidia_base_url`
- `model` = either `settings.nemotron_super_model` or `settings.nemotron_nano_model`
- `api_key` = either super or nano API key (nano falls back to super if not set)
- `streaming=True` for token-by-token output
- `timeout=60` seconds

---

### Step 2: Node — `classify_intent`

**What it does:** Takes the user's raw query and classifies it into one of 5 categories.

**Logic:**
1. Sends `CLASSIFIER_SYSTEM_PROMPT` + `CLASSIFIER_USER_TEMPLATE` (with query injected) to the Nano model
2. Parses the JSON response to extract: `category`, `symbol`, `confidence`
3. Strips markdown fences (```` ```json ... ``` ````) if the model wraps output
4. On failure: defaults to `category="general"`, `symbol=None`, `confidence=0.0`

**Output to state:** Sets `intent_category`, `intent_symbol`, `intent_confidence`

---

### Step 3: Node — `route_intent` (Conditional Router)

**What it does:** Decides which branch to execute based on the classified intent.

**Routing rules:**
- `"stock"` + symbol exists → `gather_stock_data`
- `"stock"` + NO symbol → `handle_market` (falls back to screening)
- `"news"` → `gather_news_data`
- `"portfolio"` → `gather_portfolio_data`
- `"market"` → `handle_market`
- `"general"` (or anything else) → `handle_general`

---

### Step 4: Data Gathering Nodes

#### `gather_stock_data`
Calls 4 tools in sequence for the extracted symbol:
1. `get_stock_data(symbol)` → price, technicals (RSI, MACD, SMA, etc.)
2. `detect_setup(symbol)` → trading setup detection (entry/SL/targets)
3. `get_market_structure(symbol)` → trend, support/resistance levels
4. `get_market_news(symbol, limit=5)` → recent news headlines

All results are stored in `state["gathered_data"]` under keys: `stock_data`, `technicals`, `trading_setup`, `market_structure`, `news_headlines`.

#### `gather_news_data`
Calls `get_market_news(symbol, limit=15)` — fetches 15 articles for general news or symbol-specific news.

Stores result in `state["gathered_data"]["articles"]`.

#### `gather_portfolio_data`
Currently a **placeholder** — returns empty portfolio structure. Portfolio data is injected from the frontend request payload in the API layer.

---

### Step 5: Analysis/Synthesis Nodes

#### `analyze_stock` (Trading Coach)
1. Extracts all gathered data from state
2. Calls `build_analyst_prompt()` from `prompt_builder.py` — this is the **dynamic prompt builder** that creates a query-intent-aware prompt with all the real-time data
3. Sends `ANALYST_SYSTEM_PROMPT` + the dynamic prompt to the **Super** model
4. **Rate limit fallback:** If a 429 error occurs, returns the raw gathered data with a "temporarily unavailable" message instead of crashing

#### `synthesize_news`
1. Calls `build_news_prompt()` from `prompt_builder.py`
2. Sends `NEWS_SYNTHESIS_SYSTEM_PROMPT` + dynamic news prompt to the **Nano** model
3. Always uses `query_mode="narrative"` for chat (prose output)

#### `audit_portfolio`
1. Sends `PORTFOLIO_AUDITOR_SYSTEM_PROMPT` + portfolio data to the **Super** model
2. Injects: `total_invested`, `total_value`, `overall_pnl_pct`, and full `holdings` JSON

#### `handle_general`
1. Calls `build_general_prompt()` from `prompt_builder.py`
2. Auto-detects `response_mode` (educational/advisory/macro) and `complexity_level` (beginner/intermediate/advanced)
3. Sends to **Nano** model — returns clean markdown, no JSON

#### `handle_market` (Stock Screener)
This is the most data-intensive node:
1. Defines a **liquid NSE watchlist** of 12 stocks: RELIANCE, TCS, HDFCBANK, INFY, SBIN, TATASTEEL, ICICIBANK, WIPRO, AXISBANK, BAJFINANCE, SUNPHARMA, LT
2. For EACH stock: calls `get_stock_data()` + `detect_setup()`
3. Compiles all data into a JSON payload with: price, RSI, MACD, volume ratio, ATR, setup details
4. Sends the full screened data + user query to `MARKET_SCREENER_SYSTEM_PROMPT`
5. The LLM filters and ranks stocks based on the user's criteria

---

### Step 6: Graph Assembly

```python
def build_agent_graph() -> StateGraph:
    workflow = StateGraph(AgentState)

    # Register 9 nodes
    workflow.add_node("classify_intent", classify_intent)
    workflow.add_node("gather_stock_data", gather_stock_data)
    workflow.add_node("gather_news_data", gather_news_data)
    workflow.add_node("gather_portfolio_data", gather_portfolio_data)
    workflow.add_node("analyze_stock", analyze_stock)
    workflow.add_node("synthesize_news", synthesize_news)
    workflow.add_node("audit_portfolio", audit_portfolio)
    workflow.add_node("handle_general", handle_general)
    workflow.add_node("handle_market", handle_market)

    # Entry point
    workflow.set_entry_point("classify_intent")

    # Conditional routing from classifier
    workflow.add_conditional_edges("classify_intent", route_intent, {
        "gather_stock_data": "gather_stock_data",
        "gather_news_data": "gather_news_data",
        "gather_portfolio_data": "gather_portfolio_data",
        "handle_general": "handle_general",
        "handle_market": "handle_market",
    })

    # Data gathering → Analysis
    workflow.add_edge("gather_stock_data", "analyze_stock")
    workflow.add_edge("gather_news_data", "synthesize_news")
    workflow.add_edge("gather_portfolio_data", "audit_portfolio")

    # All analysis nodes → END
    workflow.add_edge("analyze_stock", END)
    workflow.add_edge("synthesize_news", END)
    workflow.add_edge("audit_portfolio", END)
    workflow.add_edge("handle_general", END)
    workflow.add_edge("handle_market", END)

    return workflow.compile()

# Singleton — imported by the API router
agent_graph = build_agent_graph()
```

---

## 3. FILE 2 — `prompts.py`

**Location:** `backend/app/agent/prompts.py` (352 lines, 19.5KB)
**Purpose:** Contains ALL system prompts and user message templates for every node in the graph.

### Universal Data Rule (injected into multiple prompts)

```
## ⚠️ STRICT REAL-TIME DATA ENFORCEMENT
- You MUST NOT provide generic or historical suggestions.
- You MUST base ALL analysis on the real-time data provided to you in this message.
- If a data field is null, missing, or unavailable, explicitly state "DATA UNAVAILABLE: <field_name>" — do NOT guess.
- If ALL data is unavailable, respond: "Unable to complete analysis — real-time data fetch failed."
- NEVER use phrases like "historically", "typically", "usually" or "in the past".
```

---

### Prompt 1: Intent Classifier

**`CLASSIFIER_SYSTEM_PROMPT`** — Instructs the LLM to output ONLY a single JSON object with no preamble.

**Categories:**
| Category | When to Use |
|----------|-------------|
| `stock` | Query about a SPECIFIC named stock (requires a ticker) |
| `news` | Market news, events, sector news |
| `portfolio` | User's own holdings, P&L, returns |
| `market` | NSE/BSE stock screening/discovery (no specific stock named) |
| `general` | Everything else — educational, commodities (gold/crypto), macro/geopolitical |

**Critical distinction rules built into the prompt:**
- `stock` vs `market`: "stock" REQUIRES a specific named company. "market" is for finding multiple stocks.
- `market` vs `general`: Commodities (gold, silver, oil), crypto (bitcoin), and macro events (war, inflation) → ALWAYS "general"

**Ticker extraction rules:**
- Indian NSE → append ".NS" (e.g., "Reliance" → "RELIANCE.NS")
- Indian BSE → append ".BO" only if explicitly mentioned
- US stocks → as-is (e.g., "Apple" → "AAPL")
- No stock named → symbol MUST be null

**10 few-shot examples** are included covering: stock, news, portfolio, general (educational), general (commodity), general (geopolitical), market (screening), and edge cases.

**Failure protocol:** If confidence < 0.4 → return `{"category": "general", "symbol": null, "confidence": 0.0}`

**User template:** `CLASSIFIER_USER_TEMPLATE` = `"Classify this query: {query}"`

---

### Prompt 2: Stock Analyst (Trading Coach)

**`ANALYST_SYSTEM_PROMPT`** — Professional equity analyst persona with 5 sub-personas based on `output_mode`:

| Output Mode | Persona | Style |
|-------------|---------|-------|
| `trade_plan` | Trading desk operator | Fast, direct, every sentence has a price level |
| `technical_deep_dive` | Quant analyst | Methodical indicator walk-through, divergence checks |
| `news_catalyst` | Financial journalist + analyst | Lead with news story, support with data |
| `price_check` | Bloomberg terminal | Maximum density, minimum words |
| `general_outlook` | Senior fund manager | Balanced, thoughtful, decisive |

**Core analysis rules hardcoded in the prompt:**
1. RSI > 70 = overbought, RSI < 30 = oversold. Always cite exact value.
2. RSI divergence detection: price near day_high + RSI < 65 = bearish divergence
3. MACD above signal = bullish. Note histogram expansion/shrinkage.
4. Price vs SMA20: above = uptrend, below = downtrend. Note % gap.
5. Volume ratio > 1.5x = institutional activity. < 0.7x = low conviction.
6. Weight: technicals 60%, news sentiment 40%.
7. Never use "Buy" or "Sell" — use BULLISH/BEARISH/NEUTRAL.

**Failure protocol:** If `current_price` is null → return `INSUFFICIENT_DATA` verdict with confidence 0.

**User template:** `ANALYST_USER_TEMPLATE` = `"{dynamic_prompt}"` — the entire user message is built by `prompt_builder.py`.

---

### Prompt 3: News Synthesizer

**`NEWS_SYNTHESIS_SYSTEM_PROMPT`** — Bloomberg Intelligence-style market commentary with 2 modes:

| Mode | Trigger | Output Format |
|------|---------|---------------|
| NARRATIVE | User asked a conversational question | Prose (100-180 words), ends with **Overall Mood** |
| DASHBOARD | System call for dashboard widget | JSON with: `overall_sentiment`, `confidence`, `market_summary`, `key_themes`, `fii_dii_signal`, `sector_rotation`, `top_story` |

**Banned phrases (automatic failure):**
- "markets are mixed" / "stocks showed movement" / "significant volatility"
- "investors are watching" / "time will tell"
- Any `market_summary` starting with "The market" or "Markets"

**Internal reasoning gate (hidden from output):**
1. What is the single most market-moving headline?
2. Are FII/DII flow signals present?
3. Is there sector rotation evidence?
4. What was the user's specific focus area?

**Failure protocol:** If < 2 articles → return insufficient data message.

**User template:** `NEWS_SYNTHESIS_USER_TEMPLATE` = `"{news_prompt}"` — built by `prompt_builder.py`.

---

### Prompt 4: Portfolio Auditor

**`PORTFOLIO_AUDITOR_SYSTEM_PROMPT`** — Portfolio risk analyst with strict JSON output.

**Verdict thresholds (hardcoded, no deviation):**
| Verdict | Condition |
|---------|-----------|
| BULLISH | Overall P&L > +5% AND at least 60% of holdings gaining |
| BEARISH | Overall P&L < -5% OR any single holding > -15% loss |
| NEUTRAL | All other cases |

**Concentration risk rules:**
| Risk Level | Condition |
|------------|-----------|
| HIGH | Any single stock > 40% of total portfolio value |
| MODERATE | Top 3 stocks > 75% of total value |
| SECTOR | Any single sector > 50% of total value |
| LOW | None of the above |

**Weight computation requirement:** For each holding, compute `weight_pct = (current_value / total_value) × 100`. If any single holding > 35%, classify as HIGH regardless.

**Output format (strict JSON):**
```json
{
  "verdict": "BULLISH | BEARISH | NEUTRAL",
  "confidence": 0.85,
  "overall_return_pct": 12.5,
  "reasoning_summary": "2-3 sentences with actual P&L numbers",
  "risk_assessment": "concentration risk with specific symbols and percentages",
  "top_performer": "SYMBOL +X%",
  "worst_performer": "SYMBOL -X%",
  "recommendation": "one actionable rebalancing sentence"
}
```

**User template:** `PORTFOLIO_AUDITOR_USER_TEMPLATE` — injects `total_invested`, `total_value`, `overall_pnl_pct`, and `holdings` JSON.

---

### Prompt 5: General Educator (3-Mode Adaptive)

**`GENERAL_EDUCATOR_SYSTEM_PROMPT`** — Financial advisor/educator for Indian retail investors with 3 modes:

| Mode | Examples | Response Style |
|------|----------|---------------|
| EDUCATIONAL | "What is P/E ratio?", "Explain RSI" | Definition → Practice Example → Key Number → Takeaway |
| ADVISORY | "Should I buy gold?", "Is crypto safe?" | Clear BULLISH/BEARISH/NEUTRAL stance with 3 reasons |
| MACRO | "Will war affect markets?", "Impact of US tariffs" | Event → Indian sector impact → FII/DII behavior → Takeaway |

**Strict rules:**
- Output ONLY plain markdown. No JSON. No code blocks.
- Start directly with bold header — no "Here is my answer" or "Great question".
- Use Indian Rupee (₹). Reference NSE/BSE/Sensex/Nifty.
- For educational beginner: use one relatable analogy before technical explanation.
- For advisory: give a clear directional stance. No "it depends" without an actual answer.
- For macro: always map event → Indian sector impact → specific NSE index affected.

**User template:** `GENERAL_EDUCATOR_USER_TEMPLATE` = `"{general_prompt}"` — built by `prompt_builder.py`.

---

### Prompt 6: Market Screener

**`MARKET_SCREENER_SYSTEM_PROMPT`** — Senior Indian equity analyst for stock screening.

**Filter logic (applied BEFORE writing response):**
| User Intent | Filter Applied |
|-------------|---------------|
| "oversold" | RSI < 35 |
| "overbought" | RSI > 65 |
| "breakout" | Price above SMA20 AND volume_ratio > 1.4 |
| "near 52-week low" | Price within 5% of day_low |
| "bullish setup" | setup_confidence > 0.6 |
| "best to buy" | RSI < 50 + MACD bullish + setup_confidence > 0.5 |
| No specific filter | Rank by overall signal strength |

**Output format (markdown):**
```
📡 Live Screened Results — [X matching from total screened]

For each stock:
**[SYMBOL]** | Price: ₹X | RSI: X | MACD: [Bullish/Bearish] | Volume: Xx avg | Setup: [name]
- Entry: ₹X | Stop Loss: ₹X | Target 1: ₹X | Target 2: ₹X | R:R: X

📊 Screener Verdict Summary
📐 Filter Logic Applied
⚠️ Risk Note
Data Timestamp: [from fetched data]
```

**User template:** `MARKET_SCREENER_USER_TEMPLATE` — injects `query` + `screened_data` (full JSON payload of all screened stocks).

---

## 4. FILE 3 — `prompt_builder.py`

**Location:** `backend/app/agent/prompt_builder.py` (561 lines, 26.5KB)
**Purpose:** Dynamically assembles user-facing prompts at runtime. Every section is conditional — only included if real data exists.

### Detection Functions

#### `detect_output_mode(query)` — Routes analyst to the right response structure

Checks the user's query for keyword matches and returns one of 5 modes:

| Mode | Trigger Keywords (checked in priority order) |
|------|----------------------------------------------|
| `trade_plan` | buy, sell, trade, entry, setup, invest, position, should i, target, stop loss, long, short (also Hindi: kharidna, bechna, kya karu) |
| `technical_deep_dive` | rsi, macd, sma, ema, bollinger, technical, indicator, overbought, oversold, divergence, momentum, volume, support, resistance, trend, breakout, breakdown |
| `news_catalyst` | news, why, reason, what happened, catalyst, fell, crashed, surged, jumped, results, earnings, quarter |
| `price_check` | price, rate, current, now, today price, share price, worth, value — BUT NOT if also contains: should, analysis, outlook, view |
| `general_outlook` | Default fallback for any query that doesn't match the above |

#### `detect_complexity(query)` — Detects user's financial literacy level

| Level | Trigger Keywords |
|-------|-----------------|
| `advanced` | ev/ebitda, dcf, wacc, beta, alpha, sharpe, sortino, implied volatility, put-call ratio, derivatives, futures, options, fibonacci, elliott wave, wyckoff |
| `beginner` | what is, explain, kya hota, matlab, means, simple, beginner, new to, first time, should i, safe hai |
| `intermediate` | Default |

#### `detect_general_response_mode(query)` — Routes general queries

| Mode | Trigger Keywords |
|------|-----------------|
| `advisory` | should i, is it safe, will i, good time, worth it, buy gold, invest in, crypto safe, kya karu |
| `macro` | war, inflation, rbi, fed, interest rate, gdp, tariff, geopolitical, china, recession, oil price, effect of, impact of, india pakistan |
| `educational` | Default |

---

### `build_analyst_prompt()` — The Core Dynamic Prompt Builder

This is the most important function. It takes raw data from tools and builds a comprehensive, annotated prompt.

**Parameters:** `symbol`, `stock_data`, `technicals`, `news`, `setup`, `structure`, `original_query`

**Step-by-step prompt construction:**

#### Section 1: User's Question + Output Mode
```
## User's Question: "Should I buy TCS today?"
**Focus your entire response on directly answering this question using only the data below. Output mode: `trade_plan`.**
```

#### Section 2: Live Price Snapshot
- Current price with ▲/▼ direction and % change
- Day range with range percentage
- Absolute change vs previous close
- P/E ratio
- Market cap in Crores (₹)

#### Section 3: Technical Picture (with contextual alerts)

**RSI zones with emoji alerts:**
| RSI Value | Zone Label |
|-----------|-----------|
| > 80 | 🔴 Extremely Overbought — HIGH risk of reversal |
| > 70 | 🔴 Overbought — momentum weakening |
| > 65 | 🟠 Approaching Overbought Zone |
| < 20 | 🟢 Extremely Oversold — strong mean reversion potential |
| < 30 | 🟢 Oversold — potential bounce zone |
| < 35 | 🟡 Near Oversold — weak, not yet recovering |
| 35-65 | 🟡 Neutral — no extreme reading |

**Divergence detection (auto-computed):**
- If price ≥ 98% of day_high AND RSI < 65 → ⚠️ POTENTIAL BEARISH DIVERGENCE
- If price ≤ 102% of day_low AND RSI > 35 → 💡 POTENTIAL BULLISH DIVERGENCE

**MACD with crossover context:**
- MACD > signal + gap > 0.05 → "Bullish crossover active"
- MACD > signal + gap ≤ 0.05 → "Weak bullish — histogram shrinking"
- MACD < signal + gap > 0.05 → "Bearish crossover active"
- MACD < signal + gap ≤ 0.05 → "Weak bearish — potential reversal forming"

**Price vs SMA20:**
- Above + gap > 5% → "Extended above — possible pullback to SMA20"
- Above + gap ≤ 5% → "Clean uptrend structure"
- Below + gap < -8% → "Severely below — strong downtrend"
- Below + gap ≥ -8% → "Below SMA20 — bearish structure"

**Bollinger Bands:**
- Price > upper band → "Overextended, mean reversion risk"
- Price < lower band → "Extreme compression, bounce candidate"
- Inside bands → shows position as percentage of band width

**Volume interpretation:**
| Volume Ratio | Interpretation |
|-------------|---------------|
| > 2.5x | 🔥 EXTREME — major institutional activity |
| > 1.5x | 📊 HIGH — institutional interest, move likely real |
| < 0.6x | 💤 LOW — weak conviction, discount any move |
| 0.6x-1.5x | Normal activity |

**ATR:** Shows daily volatility in ₹ and as % of price.

#### Section 4: Market Structure (conditional)
- Trend direction + trader bias
- 🔴 Key resistance level with distance
- 🟢 Key support level with distance

#### Section 5: Recent News (conditional + enriched)
- Overall news tone: 🟢 Bullish / 🔴 Bearish / 🟡 Mixed with counts
- Top 3 headlines with sentiment icons (📈 positive / 📉 negative / 📰 neutral)

#### Section 6: Trading Setup (conditional)
- If a valid setup was detected: full entry/SL/target/R:R details + "Risk max 1-2% of capital"
- If `trade_plan` mode but no setup: "No high-probability setup detected" + suggests watching support level

#### Section 7: Mode-Specific Task Instruction
The function `_get_mode_instruction()` appends the final instruction that tells the LLM exactly how to structure its response:

| Mode | Instruction Summary | Word Limit |
|------|---------------------|-----------|
| `trade_plan` | 1-sentence verdict → Entry/SL/T1/T2/RR/Position → 2 invalidation points | 150-250 words |
| `technical_deep_dive` | Walk through each indicator → confirm/contradict → verdict + 2 strongest signals | 200-300 words |
| `news_catalyst` | Lead with impactful headline → price-moving or noise? → combined verdict | 120-200 words |
| `price_check` | Price + change → technical read → key level → headline | 50-80 words |
| `general_outlook` | Trend + risk levels + news backdrop → bias + reasons → "Watch For" | 180-250 words |

---

### `build_news_prompt()` — News Synthesis Builder

**Parameters:** `articles`, `original_query`, `query_mode` ("narrative" or "dashboard")

**Focus area detection from query keywords:**
| Detected Focus | Priority Instruction |
|---------------|---------------------|
| FII/DII (keywords: fii, dii, foreign, institutional, flow) | Extract all FII/DII flow signals above all else |
| Sector (keywords: sector, it, bank, pharma, auto, metal, nifty) | Identify sector-specific themes, rotation evidence |
| Catalyst (keywords: why, reason, fell, crashed, surged) | Identify single event driving price movement |

**Article formatting:** Each article is listed as:
```
1. [POSITIVE] RBI holds repo rate — Yahoo Finance (2026-04-14T08:00:00Z)
```

**Narrative mode output:** Instructs LLM to write Bloomberg Intelligence-style prose, 100-180 words, ending with **Overall Mood**.

**Dashboard mode output:** Short instruction to synthesize into JSON structure.

---

### `build_general_prompt()` — General Educator Builder

**Parameters:** `question`, `portfolio_context`

**Auto-detection:** Runs `detect_general_response_mode()` and `detect_complexity()` to determine structure.

**Word limits by complexity:**
| Level | Limit |
|-------|-------|
| Beginner | 100-150 words. No jargon. One simple analogy. |
| Intermediate | 150-250 words. Light technical language. |
| Advanced | 250-400 words. Full technical language. |

**Mode-specific response structures:**

**Educational:**
```
**[Concept Name]** _(beginner)_
**What It Is** — 2-3 sentences
**How It Works in Practice** — NSE/BSE example
**The Number You Should Know** — One key metric
**Key Takeaway** — One actionable sentence
**Explore Next:** — 2-3 related concepts
```

**Advisory:**
```
**[Asset/Topic]** — **[BULLISH / BEARISH / NEUTRAL / CAUTION]**
**Why:** 3 specific reasons
**The Risk:** What could make this wrong?
**What To Do:** One actionable sentence
```

**Macro:**
```
**[Event/Topic] — Market Impact**
**Immediate Effect:** Indian markets reaction
**Sectors Most Affected:** NSE sectors + direction
**FII/DII Behaviour:** Institutional flow response
**Trader's Takeaway:** One concrete action
```

---

## 5. FILE 4 — `tools.py`

**Location:** `backend/app/agent/tools.py` (256 lines, 8.7KB)
**Purpose:** LangChain `@tool` functions that fetch real-time data from existing backend services.

### Tool 1: `get_stock_data(symbol)`
- **Service used:** `StockService.get_full_stock_data()`
- **Returns:** Two sub-dicts:
  - `stock_data`: current_price, previous_close, market_cap, pe_ratio, day_high, day_low, exchange
  - `technicals`: rsi, sma_20, ema_20, macd, macd_signal, bollinger_upper, bollinger_lower, volume_ratio, atr

### Tool 2: `get_stock_history(symbol, period="3mo")`
- **Service used:** `StockService.get_historical_data()`
- **Valid periods:** 1mo, 3mo, 6mo, 1y, 5y
- **Returns:** List of OHLCV candles

### Tool 3: `get_market_news(symbol=None, limit=10)`
- **Service used:** `NewsService.get_news()` or `NewsService.get_news_for_symbol()`
- **Limit capped:** 1-20
- **Symbol cleaning:** Strips exchange suffix (RELIANCE.NS → RELIANCE) for cleaner news matching
- **Returns:** List of articles with: title, source, sentiment, published_at, summary

### Tool 4: `detect_setup(symbol)`
- **Service used:** `detect_trading_setup()` from `setup_engine.py`
- **Data required:** Full stock data + 3-month historical candles
- **Checks for:** RSI Recovery Setup, Volume Breakout Setup, Trend Continuation Setup
- **Returns:** Setup dict with: name, confidence, entry, stop_loss, target_1, target_2, risk_reward, reasoning

### Tool 5: `get_market_structure(symbol)`
- **Service used:** `analyze_market_structure()` from `market_structure.py`
- **Data required:** 6 months of daily candles (uses last 50)
- **Minimum:** 20 candles required
- **Returns:** trend, key_resistance, key_support, distance_to_resistance, distance_to_support, trader_bias

### `ALL_TOOLS` list
```python
ALL_TOOLS = [get_stock_data, get_stock_history, get_market_news, detect_setup, get_market_structure]
```

---

## 6. COMPLETE FLOW EXAMPLE

**User query:** _"Should I buy RELIANCE today?"_

### Step 1 — Classification (Nano model)
```
Input:  "Should I buy RELIANCE today?"
Output: {"category": "stock", "symbol": "RELIANCE.NS", "confidence": 0.95}
```

### Step 2 — Routing
`category="stock"` + `symbol="RELIANCE.NS"` → routes to `gather_stock_data`

### Step 3 — Data Gathering
4 parallel tool calls:
- `get_stock_data("RELIANCE.NS")` → price ₹2,847.50, RSI 58.3, MACD, etc.
- `detect_setup("RELIANCE.NS")` → "RSI Recovery Setup" or "No Clear Setup"
- `get_market_structure("RELIANCE.NS")` → trend: "Uptrend", support: ₹2,800
- `get_market_news("RELIANCE.NS", 5)` → 5 recent articles with sentiments

### Step 4 — Dynamic Prompt Building
`build_analyst_prompt()` detects:
- `output_mode = "trade_plan"` (because "buy" is in the query)
- Builds full prompt with: price snapshot, technicals with RSI/MACD/Bollinger annotations, market structure, news sentiment, setup details, and trade plan task instruction

### Step 5 — LLM Analysis (Super model)
Sends `ANALYST_SYSTEM_PROMPT` + dynamic prompt → Gets back a focused trade plan response with entry/SL/targets.

### Step 6 — Response
`state["final_response"]` is set to the LLM's markdown output → returned to the API → displayed in the frontend chat.
