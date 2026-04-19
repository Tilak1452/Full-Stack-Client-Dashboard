# FinSight AI — Anti-Gravity Cloud Agent: Complete Execution Plan

> **Document Version:** 1.0  
> **Created:** April 17, 2026  
> **Scope:** Full implementation of the LangGraph-based NVIDIA Nemotron agent pipeline, SSE streaming, dynamic prompt intelligence, and supporting frontend upgrades — integrated cleanly into the existing FinSight codebase without disturbing any protected files.  
> **Reference Sources:** `FinSight_Agent_Architecture.md` + `FinSight_System_Documentation.md`

---

## ⚠️ CRITICAL GROUND RULES (Read Before Writing a Single Line of Code)

The existing codebase is **protected**. These rules are non-negotiable:

1. **Never modify existing working files** unless the only action is *adding* new imports, router registrations, or new nav items at the bottom — with zero removal or reorganisation of existing code.
2. **Never replace existing endpoints.** The current `/api/v1/analyze` via `analyze.py` and the legacy `analyst.py` service remain untouched. The new agent lives at a completely separate path (`/api/v1/agent/stream`).
3. **Never rename or move existing files.** New features work around the existing structure.
4. **Report conflicts first, code second.** If any new file path collides with an existing protected file, stop and adapt the new implementation.

---

## TABLE OF CONTENTS

- [Phase 0 — Conflict Analysis & Pre-Flight Checklist](#phase-0--conflict-analysis--pre-flight-checklist)
- [Phase 1 — Environment & Dependency Setup](#phase-1--environment--dependency-setup)
- [Phase 2 — Core Config Extension](#phase-2--core-config-extension)
- [Phase 3 — New Service Files (Supporting Tools)](#phase-3--new-service-files-supporting-tools)
- [Phase 4 — Agent Directory: The 4 Core Files](#phase-4--agent-directory-the-4-core-files)
  - [Step 4A — `tools.py`](#step-4a--toolspy)
  - [Step 4B — `prompts.py`](#step-4b--promptspy)
  - [Step 4C — `prompt_builder.py`](#step-4c--prompt_builderpy)
  - [Step 4D — `graph.py`](#step-4d--graphpy)
- [Phase 5 — SSE Streaming API Endpoint](#phase-5--sse-streaming-api-endpoint)
- [Phase 6 — Wire the New Router into main.py](#phase-6--wire-the-new-router-into-mainpy)
- [Phase 7 — Frontend: AI API Library Upgrade](#phase-7--frontend-ai-api-library-upgrade)
- [Phase 8 — Frontend: AI Research Chat Page Upgrade](#phase-8--frontend-ai-research-chat-page-upgrade)
- [Phase 9 — Frontend: Dashboard AI Insights Widget](#phase-9--frontend-dashboard-ai-insights-widget)
- [Phase 10 — Testing & Validation Checklist](#phase-10--testing--validation-checklist)
- [Phase 11 — Known Gaps to Resolve Post-Launch](#phase-11--known-gaps-to-resolve-post-launch)
- [Complete New File Manifest](#complete-new-file-manifest)
- [Environment Variable Reference](#environment-variable-reference)

---

## Phase 0 — Conflict Analysis & Pre-Flight Checklist

Before writing any code, map every new file against the existing protected file tree from `Gemini.md` Section 1.

### 0.1 — Conflict Register

| New File (from spec) | Conflicts with Existing File? | Resolution |
|---|---|---|
| `backend/app/agent/graph.py` | ❌ No — `agent/` directory does not exist yet | **CREATE NEW** |
| `backend/app/agent/prompts.py` | ❌ No | **CREATE NEW** |
| `backend/app/agent/prompt_builder.py` | ❌ No | **CREATE NEW** |
| `backend/app/agent/tools.py` | ❌ No | **CREATE NEW** |
| `backend/app/agent/__init__.py` | ❌ No | **CREATE NEW** |
| `backend/app/api/agent.py` | ❌ No — `api/` already exists but `agent.py` does not | **CREATE NEW** |
| `backend/app/services/setup_engine.py` | ❌ No | **CREATE NEW** |
| `backend/app/services/market_structure.py` | ❌ No | **CREATE NEW** |
| `backend/app/core/config.py` | ⚠️ EXISTS — protected | **APPEND ONLY** — add new fields at the bottom, never remove existing fields |
| `backend/app/main.py` | ⚠️ EXISTS — protected | **APPEND ONLY** — add one new `include_router()` call after the existing 9 routers |
| `frontend/src/lib/ai.api.ts` | ⚠️ EXISTS — protected | **APPEND ONLY** — add new `streamAgent()` function and TypeScript interfaces; keep existing `analyze()` function intact |
| `frontend/src/app/ai-research/page.tsx` | ⚠️ EXISTS — protected | **MAJOR UPGRADE** — the streaming UI logic needs to be added; discuss with developer whether to create `ai-research-v2/page.tsx` as a safe parallel route, or add the streaming path as a second mode within the existing file |
| `frontend/src/components/AIInsights.tsx` | ❌ No — does not exist yet in project | **CREATE NEW** |

### 0.2 — Pre-Flight Checklist

Complete every item before starting Phase 1:

- [ ] Developer has an **OpenRouter account** with API keys for both Super and Nano model tiers
- [ ] Developer has confirmed `NVIDIA_Nemotron_3_Super_API_KEY` and (optionally) `NVIDIA_Nemotron_3_Nano_API_KEY` from OpenRouter dashboard
- [ ] Developer has confirmed the models are accessible: `nvidia/llama-3.1-nemotron-70b-instruct` (Super) and `meta-llama/llama-3.1-8b-instruct` (Nano)
- [ ] Developer has confirmed `GNEWS_API_KEY` is available (for enhanced news; GNews is India-friendly, 100 free requests/day)
- [ ] The existing backend is running clean (`uvicorn` starts with no import errors)
- [ ] The existing frontend is running clean (`npm run dev` starts with no TypeScript errors)
- [ ] `langgraph==0.2.28` and `langchain-openai>=0.1.0` are available to install

---

## Phase 1 — Environment & Dependency Setup

### 1.1 — Update `.env` File

Open `Full-Stack-Client-Dashboard/.env` and **append** the following new variables at the bottom. Do not remove any existing variables.

```env
# ─── NEW: NVIDIA Nemotron via OpenRouter ──────────────────────────────────────
NVIDIA_Nemotron_3_Super_API_KEY=<your-openrouter-super-api-key>
NVIDIA_Nemotron_3_Nano_API_KEY=<your-openrouter-nano-api-key>   # Optional — falls back to Super if blank

# ─── NEW: OpenRouter base URL (never changes) ─────────────────────────────────
NVIDIA_BASE_URL=https://openrouter.ai/api/v1
NEMOTRON_SUPER_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
NEMOTRON_NANO_MODEL=meta-llama/llama-3.1-8b-instruct

# ─── NEW: Per-node output token budgets ───────────────────────────────────────
NEMOTRON_CLASSIFY_MAX_TOKENS=200
NEMOTRON_ANALYZE_MAX_TOKENS=2500
NEMOTRON_NEWS_MAX_TOKENS=1200
NEMOTRON_PORTFOLIO_MAX_TOKENS=1800
NEMOTRON_GENERAL_MAX_TOKENS=900
NEMOTRON_MARKET_MAX_TOKENS=4000

# ─── NEW: GNews API (India-friendly news source, 100 req/day free) ────────────
GNEWS_API_KEY=<your-gnews-key>
```

**Why two API keys?** OpenRouter allows separate quota tracking for different model tiers. Running classification and news on the cheap Nano model and reserving the Super model only for deep analysis cuts costs significantly. If you only have one key, set it as the Super key and leave the Nano key blank — the system falls back automatically.

### 1.2 — Update `requirements.txt`

Open `Full-Stack-Client-Dashboard/requirements.txt` and **add** the following lines. Do not remove any existing lines.

```
# ─── NEW: LangGraph agent pipeline ───────────────────────────────────────────
langgraph==0.2.28
langchain-openai>=0.1.0
langchain>=0.3.7
langchain-core>=0.3.19
langchain-community>=0.3.7
```

**Note:** `langchain-groq` can remain in `requirements.txt`. It will no longer be actively used by the new agent pipeline, but removing it risks breaking any existing code paths that import it (such as `analyst.py`). Leave it installed.

### 1.3 — Install New Dependencies

```bash
# From project root, with venv activated
pip install -r requirements.txt

# Verify the critical packages installed correctly
python -c "import langgraph; print('LangGraph OK:', langgraph.__version__)"
python -c "from langchain_openai import ChatOpenAI; print('LangChain-OpenAI OK')"
```

---

## Phase 2 — Core Config Extension

**File to modify:** `backend/app/core/config.py`  
**Action:** Append new fields only. Do not touch any existing field definitions.

### 2.1 — What to Add

Inside the `Settings` class (which inherits from `BaseSettings`), append these new field definitions at the bottom of the class body, after all existing fields:

```python
# ─── NVIDIA Nemotron via OpenRouter (NEW) ─────────────────────────────────────
nvidia_nemotron_3_super_api_key: str = ""
nvidia_nemotron_3_nano_api_key: str = ""          # Falls back to super key if blank
nvidia_base_url: str = "https://openrouter.ai/api/v1"
nemotron_super_model: str = "nvidia/llama-3.1-nemotron-70b-instruct"
nemotron_nano_model: str = "meta-llama/llama-3.1-8b-instruct"

# ─── Per-node token budgets (NEW) ─────────────────────────────────────────────
nemotron_classify_max_tokens: int = 200
nemotron_analyze_max_tokens: int = 2500
nemotron_news_max_tokens: int = 1200
nemotron_portfolio_max_tokens: int = 1800
nemotron_general_max_tokens: int = 900
nemotron_market_max_tokens: int = 4000

# ─── GNews API key (NEW) ──────────────────────────────────────────────────────
gnews_api_key: str = ""
```

### 2.2 — How Pydantic Loads These

Pydantic `BaseSettings` automatically maps uppercase `.env` variable names to lowercase Python field names with case-insensitive matching. So `NVIDIA_Nemotron_3_Super_API_KEY` in `.env` maps to `nvidia_nemotron_3_super_api_key` in the Python class. No additional `model_config` changes are needed.

### 2.3 — Verification

After saving, restart the backend and call `/health`. If no `ValidationError` is raised on startup, the new config fields are loading correctly.

---

## Phase 3 — New Service Files (Supporting Tools)

These two new service files are required by `tools.py` in the agent. They implement the trading setup detector and market structure analyser that give the agent its technical edge.

### 3.1 — `setup_engine.py`

**Create at:** `backend/app/services/setup_engine.py`

This file implements `detect_trading_setup(symbol, stock_data, candles)` — the function that analyses RSI, volume, and trend data to identify actionable trading setups.

**Internal logic to implement:**

The function receives the stock's full data dict (from `StockService`) and a list of OHLCV candle dicts. It must check for three setup types in priority order:

**Setup 1 — RSI Recovery Setup**  
Trigger condition: RSI was below 40 in the last 5 candles AND has now recovered above 42. This signals oversold exhaustion.  
Entry: current price. Stop loss: lowest low of the last 5 candles. Target 1: 1.5× the risk distance above entry. Target 2: 2.5× the risk distance above entry. Risk/Reward must be >= 1.5 to report this as valid.

**Setup 2 — Volume Breakout Setup**  
Trigger condition: current volume is more than 1.8× the 20-period average volume AND the price is above the 20-period SMA. This signals institutional accumulation.  
Entry: current price. Stop loss: 20-period SMA value (acts as support). Targets calculated as with Setup 1.

**Setup 3 — Trend Continuation Setup**  
Trigger condition: RSI is between 50 and 65 (healthy trending, not overbought) AND EMA is above SMA (short-term average above long-term average, meaning uptrend) AND price is within 3% of the EMA from above.  
Entry: current price. Stop loss: EMA value. Targets calculated similarly.

**Return format if a setup is detected:**
```python
{
    "name": "RSI Recovery Setup",          # Human-readable name
    "confidence": 0.72,                    # 0.0–1.0 (based on signal strength)
    "entry": 2847.50,                      # Entry price (₹)
    "stop_loss": 2790.00,                  # Stop-loss level (₹)
    "target_1": 2934.25,                   # First profit target (₹)
    "target_2": 2991.75,                   # Second profit target (₹)
    "risk_reward": 1.5,                    # Risk-to-reward ratio
    "reasoning": "RSI recovered from 36 to 44 — oversold bounce setting up."
}
```

**Return format if no setup is detected:**
```python
{
    "name": "No Clear Setup",
    "confidence": 0.0,
    "entry": None,
    "stop_loss": None,
    "target_1": None,
    "target_2": None,
    "risk_reward": 0.0,
    "reasoning": "No high-probability setup detected in current conditions."
}
```

**Error handling:** Wrap the entire function in a try/except. If candle data is insufficient (fewer than 20 candles), return the "No Clear Setup" dict with `reasoning = "Insufficient historical data"`. Log the error with Python's standard `logging` module, do not raise.

---

### 3.2 — `market_structure.py`

**Create at:** `backend/app/services/market_structure.py`

This file implements `analyze_market_structure(symbol, candles)` — the function that identifies the overall trend, key support, and key resistance levels for any stock.

**Internal logic to implement:**

The function receives a list of OHLCV candle dicts (use the last 50 candles from a 6-month period). Minimum required: 20 candles. If fewer are available, return a fallback dict.

**Step 1 — Determine trend direction:**  
Compute the 20-period SMA of closing prices. If the current close is above the SMA, the trend is "Uptrend". If below, "Downtrend". If within 1.5% of the SMA, "Sideways".

**Step 2 — Identify key resistance:**  
Look at the highest 5% of closing prices in the last 50 candles. Average those to get the key resistance level. Calculate the distance from current price as a percentage.

**Step 3 — Identify key support:**  
Look at the lowest 5% of closing prices in the last 50 candles. Average those to get the key support level. Calculate the distance from current price as a percentage.

**Step 4 — Determine trader bias:**  
If trend is "Uptrend" AND current price > 50-period SMA AND distance to resistance > distance to support → `"Bullish — holding above SMA, room to resistance"`.  
If trend is "Downtrend" → `"Bearish — trading below SMA, next level is support"`.  
Otherwise → `"Neutral — no clear directional bias"`.

**Return format:**
```python
{
    "trend": "Uptrend",
    "key_resistance": 2950.00,
    "key_support": 2780.00,
    "distance_to_resistance": 3.59,   # as a percentage
    "distance_to_support": -2.37,     # negative = below current price
    "trader_bias": "Bullish — holding above SMA, room to resistance"
}
```

**Error handling:** Same pattern as `setup_engine.py` — wrap in try/except, return a safe fallback dict with `trend="Unknown"` and all numeric fields as `None` on failure.

---

## Phase 4 — Agent Directory: The 4 Core Files

Create the new directory: `backend/app/agent/`

Then create `backend/app/agent/__init__.py` as an empty file.

---

### Step 4A — `tools.py`

**Create at:** `backend/app/agent/tools.py`  
**Purpose:** LangChain `@tool` decorated functions that give the LangGraph agent access to live market data.

This file wraps the existing backend services — it **never implements business logic directly**. All heavy lifting is delegated to the existing service singletons (`stock_service`, `news_service`) and the two new services from Phase 3.

#### Tool 1: `get_stock_data(symbol: str)`

```
@tool
def get_stock_data(symbol: str) -> dict:
    """Fetches current price and technical indicators for a given stock symbol."""
```

**Implementation:** Call `stock_service.get_full_stock_data(symbol)`. From the response, extract and return two sub-dictionaries:

- `stock_data`: keys `current_price`, `previous_close`, `market_cap`, `pe_ratio`, `day_high`, `day_low`, `exchange`
- `technicals`: keys `rsi`, `sma_20` (mapped from the existing `sma` field), `ema_20` (mapped from `ema`), `macd`, `macd_signal`, `bollinger_upper`, `bollinger_lower`, `volume_ratio`, `atr`

**Important:** The existing `StockDataResponse` schema in `schemas/stock.py` has `sma` and `ema` as field names (no `_20` suffix). When building the `technicals` dict, rename these to `sma_20` and `ema_20` for clarity inside the agent. The fields `macd`, `macd_signal`, `bollinger_upper`, `bollinger_lower`, `volume_ratio`, and `atr` may not yet exist in the current `stock_service` — see the note below.

**Note on missing fields:** The current `StockService.get_full_stock_data()` returns RSI, SMA, and EMA. MACD, Bollinger Bands, Volume Ratio, and ATR are referenced in the agent architecture but may not be implemented yet. For the initial implementation, include these in the tool return dict with a value of `None` if unavailable. The agent prompts are written to handle `None` gracefully. Adding these indicators to `stock_service.py` is a separate task (Phase 11).

**Error handling:** Wrap the service call in try/except. On failure, return `{"error": f"Could not fetch data for {symbol}", "stock_data": {}, "technicals": {}}`.

---

#### Tool 2: `get_stock_history(symbol: str, period: str = "3mo")`

```
@tool
def get_stock_history(symbol: str, period: str = "3mo") -> list:
    """Fetches OHLCV historical candles for a stock. Valid periods: 1mo, 3mo, 6mo, 1y, 5y."""
```

**Implementation:** Call `stock_service.get_historical_data(symbol, period, "1d")`. Return the list of candle dicts directly. Clamp the period to valid values before calling the service; default to `"3mo"` if an invalid value is passed.

---

#### Tool 3: `get_market_news(symbol: str = None, limit: int = 10)`

```
@tool
def get_market_news(symbol: Optional[str] = None, limit: int = 10) -> list:
    """Fetches market news articles. Pass symbol for stock-specific news, or None for general market news."""
```

**Implementation:** Call `news_service.get_news(limit=min(limit, 20))`. If `symbol` is provided, clean the ticker before passing to the news service by stripping the exchange suffix (e.g., `"RELIANCE.NS"` → `"RELIANCE"`) so that news keyword matching works correctly. Return the list of article dicts.

---

#### Tool 4: `detect_setup(symbol: str)`

```
@tool
def detect_setup(symbol: str) -> dict:
    """Detects a high-probability trading setup (entry, stop loss, targets) for a stock."""
```

**Implementation:**
1. Call `get_stock_data(symbol)` to get current stock data
2. Call `get_stock_history(symbol, period="3mo")` to get recent candles
3. Import and call `detect_trading_setup(symbol, stock_data, candles)` from `setup_engine.py`
4. Return the setup dict

---

#### Tool 5: `get_market_structure(symbol: str)`

```
@tool
def get_market_structure(symbol: str) -> dict:
    """Analyses the market structure (trend, support, resistance) for a stock."""
```

**Implementation:**
1. Call `get_stock_history(symbol, period="6mo")` to get 6 months of candles
2. Use only the last 50 candles (slice `candles[-50:]`)
3. Import and call `analyze_market_structure(symbol, candles)` from `market_structure.py`
4. Return the structure dict

---

#### `ALL_TOOLS` Export

At the bottom of `tools.py`, define:
```python
ALL_TOOLS = [get_stock_data, get_stock_history, get_market_news, detect_setup, get_market_structure]
```

This list is used by `graph.py` but is also useful for future LangGraph tool-binding.

---

### Step 4B — `prompts.py`

**Create at:** `backend/app/agent/prompts.py`  
**Purpose:** All 5 system prompts and 5 user message templates used by the LangGraph nodes.

This is a **pure data file** — no functions, just string constants. All strings are long, carefully engineered prompts. Here is the complete specification for each:

---

#### Constant 1: `CLASSIFIER_SYSTEM_PROMPT`

This prompt instructs the Nano model to classify any user query into exactly one of five categories. It must return strict JSON only — no preamble, no explanation, no markdown fences.

**Persona line:** "You are a financial query classifier for an Indian stock market AI assistant."

**Categories to classify:**
- `stock` — Questions about a specific company, ticker, or individual stock (analysis, buy/sell, price, setup)
- `news` — Questions about market news, recent events, why a stock moved, FII/DII flows, earnings announcements
- `portfolio` — Questions about the user's portfolio performance, holdings review, or portfolio optimization
- `market` — Questions about broader market conditions, sector performance, screener requests ("best stocks to buy", "oversold stocks")
- `general` — Educational questions, concept explanations, macro economics, or anything not fitting the above

**Symbol extraction rules (critical for yfinance compatibility):**
- Indian NSE stocks: always append `.NS` suffix. `"Reliance"` → `"RELIANCE.NS"`, `"TCS"` → `"TCS.NS"`, `"HDFC Bank"` → `"HDFCBANK.NS"`, `"Infosys"` → `"INFY.NS"`, `"State Bank"` → `"SBIN.NS"`
- Indian BSE stocks: append `.BO` only if user explicitly says "BSE" or "Bombay Stock Exchange"
- US stocks: use ticker as-is. `"Apple"` → `"AAPL"`, `"Tesla"` → `"TSLA"`, `"Nvidia"` → `"NVDA"`
- If no stock is mentioned, set `symbol` to `null`

**Required output format:**
```json
{"category": "stock", "symbol": "RELIANCE.NS", "confidence": 0.95, "reasoning": "User asking about Reliance stock entry point"}
```

Include 5–6 few-shot classification examples covering each category type (stock with symbol, news, portfolio, market screener, general education).

---

#### Constant 2: `CLASSIFIER_USER_TEMPLATE`

A simple template string with a single placeholder:
```
Classify this financial query: {query}
```

---

#### Constant 3: `ANALYST_SYSTEM_PROMPT`

This is the most important prompt in the system. It instructs the Super model to behave as a professional trading analyst. The prompt is **mode-aware** — it tells the LLM to adjust its persona and output structure based on what kind of response is needed.

**Opening persona:** "You are FinSight — a professional trading analyst for Indian equity markets (NSE/BSE). You think in ₹, reason with data, and give institutional-grade analysis."

**Core rules (always apply regardless of mode):**
- All prices in ₹ (Indian Rupees)
- Never recommend a specific portfolio allocation percentage (regulatory reason)
- Always include one risk/invalidation point
- Use real numbers from the data — never fabricate or guess
- If data is missing or `None`, state "data unavailable" rather than skipping the point
- End every response with a single "🎯 Key Level to Watch" bullet

**Mode-specific personas (the LLM picks based on `output_mode` injected in the user message):**

`trade_plan` mode → Trading desk operator. Institutional-grade, fast, numbers-first. Format: 1-sentence verdict → Entry/SL/T1/T2/R:R/Position sizing rule → 2 invalidation points. Word limit: 150–250 words.

`technical_deep_dive` mode → Quant analyst. Walk through every indicator in sequence — RSI context, MACD signal, Bollinger position, volume conviction, SMA structure. Confirm or contradict signals. End with a verdict and the 2 strongest signals. Word limit: 200–300 words.

`news_catalyst` mode → Financial journalist meets analyst. Lead with the most impactful headline. Ask: is this a price-moving catalyst or just noise? Combine with technicals to reach a verdict. Word limit: 120–200 words.

`price_check` mode → Bloomberg terminal. Maximum information density, minimum words. Output: current price, % change, one-line technical read, one key level to watch, most relevant headline. Word limit: 50–80 words.

`general_outlook` mode → Senior fund manager. Balanced, decisive, no hedging. Describe trend direction, risk levels, news backdrop, and current bias with 2–3 specific reasons. End with "Watch For:" section. Word limit: 180–250 words.

---

#### Constant 4: `NEWS_SYNTHESIS_SYSTEM_PROMPT`

This prompt governs the Nano model used to synthesise news articles.

**Persona:** "You are a financial news analyst specialising in Indian markets. You cut through noise and extract the signal."

**Dual-mode behaviour (mode is injected via user message):**

`narrative` mode (used for chat interface): Answer the user's exact question in Bloomberg Intelligence style prose. 100–180 words. Always end with a bolded **Overall Mood: [BULLISH/BEARISH/MIXED]** line. Never start with "The market" — lead with a specific company, event, or data point.

`dashboard` mode (used by the AI Insights widget): Return a JSON object only, no prose. Schema:
```json
{
  "overall_sentiment": "BULLISH",
  "confidence": 0.72,
  "market_summary": "RBI rate hold...",
  "key_themes": ["RBI policy", "FII outflows", "IT sector rally"],
  "fii_dii_signal": "FII buying ₹2,400 Cr in equities",
  "top_story_impact_level": "HIGH"
}
```

The `market_summary` field must begin with a specific number, event, or company name — never with "The market" or "Markets".

---

#### Constant 5: `PORTFOLIO_AUDITOR_SYSTEM_PROMPT`

**Persona:** "You are a portfolio risk analyst. You review holdings with institutional discipline — concentration risk, P&L attribution, and position sizing hygiene."

**Mandatory analytical tasks:**
1. For every holding, compute and state: `weight_pct = (current_value / total_portfolio_value) × 100`
2. If any single holding exceeds 35% weight → immediately flag as HIGH CONCENTRATION RISK in the opening line
3. Identify the top performer and worst performer by unrealized P&L %
4. State the overall portfolio P&L in ₹ and %
5. Give 2–3 specific, actionable rebalancing suggestions (not vague advice)
6. End with a "Portfolio Health Score" from 1–10 with one-sentence justification

**Format:** Structured markdown with headers for each section. Word limit: 250–400 words.

---

#### Constant 6: `MARKET_SCREENER_SYSTEM_PROMPT`

**Persona:** "You are a quantitative equity screener for NSE stocks. You filter based on explicit criteria and rank by setup quality."

**Explicit filter rules (the LLM must apply these exactly):**
- `"oversold"` queries → show only stocks with RSI < 35
- `"overbought"` queries → show only stocks with RSI > 65
- `"breakout"` queries → show only stocks where price > SMA20 AND volume_ratio > 1.4
- `"best to buy"` or `"buy today"` queries → show stocks with RSI < 50 AND MACD bullish AND setup_confidence > 0.5
- For ambiguous queries → rank by setup confidence descending, show top 3–5

**Required output format:** Every response must end with a "📊 Screener Verdict Summary" block:
```
📊 Screener Verdict Summary
- X out of 12 NSE stocks match your criteria today.
- Strongest setup: [SYMBOL] — [one-line reason]
- Most risky entry: [SYMBOL] — [one-line reason]
- Market Context: [one sentence on overall conditions today]
```

---

### Step 4C — `prompt_builder.py`

**Create at:** `backend/app/agent/prompt_builder.py`  
**Purpose:** 3 public builder functions that assemble dynamic, data-rich user messages for each analysis node.

---

#### Public Function 1: `build_analyst_prompt()`

```python
def build_analyst_prompt(
    symbol: str,
    stock_data: dict,
    technicals: dict,
    news: list,
    setup: dict,
    structure: dict,
    original_query: str
) -> str
```

**What it builds:** A fully structured user message containing the user's question + live data + contextual annotations + a specific task instruction that matches the query's intent.

**Building process step by step:**

**Step 1 — Detect output mode:** Call the internal `detect_output_mode(original_query)` function to determine which response structure the LLM should use. Store as `output_mode`.

**Step 2 — Build Section 1 (always included): User Question**
```
## User Question
{original_query}
[Output Mode: {output_mode}]
```

**Step 3 — Build Section 2 (always included): Price Snapshot**
```
## Price Snapshot — {symbol}
Current Price: ₹{current_price}
Previous Close: ₹{previous_close} ({change_pct:+.2f}%)
Day Range: ₹{day_low} – ₹{day_high}
Market Cap: ₹{market_cap_formatted}
P/E Ratio: {pe_ratio}
```
Format market cap in crores (divide by 10,000,000). Add human-readable annotation: "Large-cap" if > ₹20,000 Cr, "Mid-cap" if > ₹5,000 Cr, "Small-cap" otherwise.

**Step 4 — Build Section 3 (always included): Technical Picture**  
For each indicator, don't just show the number — add an interpretation annotation:

- **RSI:** Show value + annotation. Rules: RSI < 30 → `"⚠️ OVERSOLD — mean reversion watch"`, RSI 30–40 → `"Approaching oversold territory"`, RSI 40–50 → `"Mild weakness"`, RSI 50–60 → `"Neutral momentum"`, RSI 60–70 → `"Strengthening momentum"`, RSI > 70 → `"⚠️ OVERBOUGHT — pullback risk"`
- **MACD:** If `macd > macd_signal` → `"Bullish crossover — upside momentum"`, else → `"Bearish crossover — downside pressure"`. If either is None, show `"MACD: Data unavailable"`
- **Price vs SMA20:** If price is > 5% above SMA → `"Extended above — possible pullback to SMA20"`, > 0% above → `"Clean uptrend structure"`, < -8% below → `"Severely below — strong downtrend"`, otherwise → `"Below SMA20 — bearish structure"`
- **Bollinger Bands:** If price > upper band → `"Overextended, mean reversion risk"`, < lower band → `"Extreme compression, bounce candidate"`, else → show position as % of band width
- **Volume Ratio:** > 2.5× → `"🔥 EXTREME — major institutional activity"`, > 1.5× → `"📊 HIGH — institutional interest, move likely real"`, < 0.6× → `"💤 LOW — weak conviction, discount any move"`, else → `"Normal activity"`
- **ATR:** Show daily volatility in ₹ and as `{(atr/price)*100:.1f}%` of price

**Step 5 — Build Section 4 (conditional): Market Structure**  
Only include if `structure` dict is non-empty and has no error:
```
## Market Structure
Trend: {trend}
Trader Bias: {trader_bias}
🔴 Key Resistance: ₹{key_resistance} ({distance_to_resistance:+.1f}% away)
🟢 Key Support: ₹{key_support} ({distance_to_support:+.1f}% away)
```

**Step 6 — Build Section 5 (conditional): Recent News**  
Only include if `news` list is non-empty. Show up to 3 headlines. Count positive vs. negative vs. neutral sentiment and show the overall tone:
```
## Recent News
Overall tone: 🟢 Bullish (3 positive, 1 negative, 1 neutral)

1. 📈 Reliance Industries Q3 profit beats estimates — Yahoo Finance
2. 📰 RBI holds repo rate steady at 6.5%
3. 📉 Broader market weakness on FII outflows
```
Sentiment icons: 📈 positive, 📉 negative, 📰 neutral.

**Step 7 — Build Section 6 (conditional): Trading Setup**  
Only include if `setup` dict exists and `setup["name"] != "No Clear Setup"`:
```
## Detected Trading Setup
Setup Type: {setup["name"]}
Confidence: {setup["confidence"]*100:.0f}%
Entry: ₹{setup["entry"]}
Stop Loss: ₹{setup["stop_loss"]}
Target 1: ₹{setup["target_1"]}
Target 2: ₹{setup["target_2"]}
Risk/Reward: {setup["risk_reward"]:.1f}:1
Reasoning: {setup["reasoning"]}
⚠️ Risk max 1-2% of capital per trade
```

If setup is "No Clear Setup" but the output mode is `trade_plan`, include:
```
## Trading Setup
No high-probability setup detected in current conditions.
Watch the ₹{key_support} support level for a potential re-entry zone.
```

**Step 8 — Append mode-specific task instruction:** Call `_get_mode_instruction(output_mode)` and append the result.

---

#### Internal Helper: `detect_output_mode(query: str) -> str`

Scans the query for keywords and returns one of 5 modes:

| Mode | Keywords to scan for (case-insensitive) |
|---|---|
| `trade_plan` | buy, sell, trade, entry, invest, should i, kya kharidna, short |
| `technical_deep_dive` | rsi, macd, sma, ema, overbought, oversold, indicator, technical, breakout, support, resistance |
| `news_catalyst` | why, fell, surged, crashed, rallied, what happened, results, earnings, catalyst |
| `price_check` | price, kitna hai, current price, rate, trading at, at what price |
| `general_outlook` | default (none of the above match) |

Check for keywords in priority order (trade_plan first, general_outlook last).

---

#### Internal Helper: `_get_mode_instruction(output_mode: str) -> str`

Returns the final task instruction appended to every analyst prompt. Different for each mode:

`trade_plan` → "Based on the above data, provide: 1) One-sentence verdict. 2) Entry / Stop Loss / Target 1 / Target 2 / R:R / Position sizing rule. 3) Two specific invalidation points. 150–250 words. Numbers-first, no fluff."

`technical_deep_dive` → "Walk through RSI → MACD → Bollinger → Volume → SMA structure. For each, state if it's confirming or contradicting the trend. End with the 2 strongest signals and a final verdict. 200–300 words."

`news_catalyst` → "Lead with the most impactful headline. Analyse: is this a genuine price catalyst or noise? Cross-reference with technical setup. Give a combined buy/sell/hold verdict. 120–200 words."

`price_check` → "Provide: current price, % change, one-line technical read, one key level, one relevant headline. Maximum 80 words. Bloomberg terminal style — maximum density."

`general_outlook` → "Describe: trend direction, key risk levels, news backdrop, current bias. Give 2–3 specific reasons for the bias. End with a 'Watch For:' section (2 specific price events to monitor). 180–250 words."

---

#### Public Function 2: `build_news_prompt()`

```python
def build_news_prompt(
    articles: list,
    original_query: str,
    query_mode: str = "narrative"
) -> str
```

**Building process:**

**Step 1 — Detect focus area** from the query keywords:
- FII/DII focus (keywords: fii, dii, foreign, institutional, flow) → Add priority instruction: "Extract all FII/DII flow signals above all else."
- Sector focus (keywords: sector, it, bank, pharma, auto, metal, nifty sector) → Add instruction: "Identify sector-specific themes and rotation evidence."
- Catalyst focus (keywords: why, reason, fell, crashed, surged, what happened) → Add instruction: "Identify the single event driving price movement."
- No specific focus → No extra instruction

**Step 2 — Format articles list:**
Number each article with sentiment label and source:
```
1. [POSITIVE] RBI holds repo rate steady at 6.5% — Yahoo Finance (2026-04-14T08:00:00)
2. [NEGATIVE] Nifty falls 200 pts on FII selling — Economic Times (2026-04-14T09:30:00)
```

**Step 3 — Append mode instruction:**

For `narrative` mode: "Answer the user's question in Bloomberg Intelligence style. Lead with the most important signal, not a summary opener. 100–180 words. End with **Overall Mood: [BULLISH/BEARISH/MIXED]**."

For `dashboard` mode: "Return ONLY a JSON object with these exact keys: overall_sentiment, confidence, market_summary, key_themes (array of 3), fii_dii_signal, top_story_impact_level. No prose before or after the JSON."

---

#### Public Function 3: `build_general_prompt()`

```python
def build_general_prompt(
    question: str,
    portfolio_context: dict = None
) -> str
```

**Building process:**

**Step 1 — Detect response mode** via `detect_general_response_mode(question)`:
- `advisory` (keywords: should, invest, buy, sell, worth it, good time, opinion, outlook, analysis)
- `macro` (keywords: rbi, inflation, gdp, rupee, rate, economy, fed, global, recession, crude)
- `educational` (default — everything else)

**Step 2 — Detect complexity level** via `detect_complexity(question)`:
- `advanced` (keywords: options, derivatives, sharpe, beta, alpha, volatility, drawdown, sortino, convexity, yield curve)
- `intermediate` (keywords: pe ratio, rsi, technical, fundamental, earnings, valuation, sector rotation, ema, bollinger)
- `beginner` (default)

**Step 3 — Set word limit** based on complexity: beginner → 100–150 words, intermediate → 150–250 words, advanced → 250–400 words.

**Step 4 — Inject portfolio context** if provided: Append a brief holdings summary (symbols + current weights) so the LLM can personalise general advice to the user's actual situation.

**Step 5 — Append mode-specific response structure:**

Educational → "Format: **[Concept Name]** — **What It Is** (2–3 sentences) → **How It Works** (Indian market example) → **Key Number To Know** → **Takeaway** (one actionable sentence) → **Explore Next:** (2–3 concepts)"

Advisory → "Format: **[Topic]** — **[BULLISH/BEARISH/NEUTRAL/CAUTION]** → **Why:** (3 specific reasons) → **The Risk:** (what makes this wrong?) → **What To Do:** (one action)"

Macro → "Format: **[Event] — Market Impact** → **Immediate Effect:** (Indian market reaction) → **Sectors Most Affected:** (NSE sector + direction) → **FII/DII Behaviour:** → **Trader's Takeaway:** (one action)"

---

### Step 4D — `graph.py`

**Create at:** `backend/app/agent/graph.py`  
**Purpose:** The LangGraph state machine — the central orchestrator that coordinates all 9 nodes.

This is the largest and most complex file in the new feature. Implementation must follow this exact specification.

---

#### Part 1: Imports and State Definition

```python
import random
import logging
from typing import Optional, TypedDict
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
```

Import from the local agent modules: `prompts.py` (all 6 constants), `prompt_builder.py` (3 builder functions), `tools.py` (all 5 tools).

Import from the existing backend: `settings` from `core/config.py`, `stock_service` from `services/stock_service.py`, `news_service` from `services/news_service.py`.

**AgentState TypedDict:**
```python
class AgentState(TypedDict):
    query: str
    intent_category: str
    intent_symbol: Optional[str]
    intent_confidence: float
    gathered_data: dict
    final_response: str
    error: Optional[str]
```

---

#### Part 2: Node Configuration and LLM Factory

Define the `_NODE_CONFIG` dictionary:

```python
_NODE_CONFIG = {
    "classify_intent":  {"model": "nano",  "temp_min": 0.05, "temp_max": 0.15, "max_tokens_key": "nemotron_classify_max_tokens"},
    "analyze_stock":    {"model": "super", "temp_min": 0.30, "temp_max": 0.42, "max_tokens_key": "nemotron_analyze_max_tokens"},
    "synthesize_news":  {"model": "nano",  "temp_min": 0.35, "temp_max": 0.48, "max_tokens_key": "nemotron_news_max_tokens"},
    "audit_portfolio":  {"model": "super", "temp_min": 0.28, "temp_max": 0.40, "max_tokens_key": "nemotron_portfolio_max_tokens"},
    "handle_general":   {"model": "nano",  "temp_min": 0.38, "temp_max": 0.50, "max_tokens_key": "nemotron_general_max_tokens"},
    "handle_market":    {"model": "super", "temp_min": 0.50, "temp_max": 0.50, "max_tokens_key": "nemotron_market_max_tokens"},
}
```

Define `_get_llm(node_name: str) -> ChatOpenAI`:
1. Look up the config for `node_name` from `_NODE_CONFIG`
2. Select the API key: if `model == "nano"` and `settings.nvidia_nemotron_3_nano_api_key` is non-empty, use the nano key; else use the super key
3. Select the model name: if nano key was used, use `settings.nemotron_nano_model`, else use `settings.nemotron_super_model`
4. Pick temperature: `random.uniform(config["temp_min"], config["temp_max"])` — this is the randomisation
5. Get max_tokens from settings via `getattr(settings, config["max_tokens_key"])`
6. Return `ChatOpenAI(base_url=settings.nvidia_base_url, api_key=..., model=..., temperature=..., max_tokens=..., streaming=True, timeout=60)`

---

#### Part 3: Node Implementations

##### Node 1: `classify_intent(state: AgentState) -> dict`

1. Create LLM with `_get_llm("classify_intent")`
2. Build messages: `[SystemMessage(CLASSIFIER_SYSTEM_PROMPT), HumanMessage(CLASSIFIER_USER_TEMPLATE.format(query=state["query"]))]`
3. Call `llm.invoke(messages)`
4. Parse the response content as JSON. Strip markdown fences if present (`content.strip().lstrip("```json").rstrip("```").strip()`)
5. Extract `category`, `symbol`, `confidence` from the parsed JSON
6. On any failure (JSON parse error, missing keys), default to: `category="general"`, `symbol=None`, `confidence=0.0`
7. Return: `{"intent_category": category, "intent_symbol": symbol, "intent_confidence": confidence}`

##### Node 2: `route_intent(state: AgentState) -> str` (Conditional Edge Function)

This is not a node itself — it's a routing function passed to `add_conditional_edges`. Return a string matching one of the registered node names:

- `state["intent_category"] == "stock"` AND `state["intent_symbol"]` is not None → return `"gather_stock_data"`
- `state["intent_category"] == "stock"` AND `state["intent_symbol"]` is None → return `"handle_market"` (fall back to screener)
- `state["intent_category"] == "news"` → return `"gather_news_data"`
- `state["intent_category"] == "portfolio"` → return `"gather_portfolio_data"`
- `state["intent_category"] == "market"` → return `"handle_market"`
- Default (including `"general"`) → return `"handle_general"`

##### Node 3: `gather_stock_data(state: AgentState) -> dict`

Call 4 tools in sequence for `symbol = state["intent_symbol"]`:
1. `get_stock_data(symbol)` → store under `gathered_data["stock_data"]` and `gathered_data["technicals"]`
2. `detect_setup(symbol)` → store under `gathered_data["trading_setup"]`
3. `get_market_structure(symbol)` → store under `gathered_data["market_structure"]`
4. `get_market_news(symbol, limit=5)` → store under `gathered_data["news_headlines"]`

Return: `{"gathered_data": {all four results merged}}`

Wrap each tool call individually in try/except. If a tool fails, store an empty dict/list for that key and log the error. Never let one failed tool call abort the whole gather step.

##### Node 4: `gather_news_data(state: AgentState) -> dict`

Call `get_market_news(symbol=state.get("intent_symbol"), limit=15)`.  
Return: `{"gathered_data": {"articles": result}}`

##### Node 5: `gather_portfolio_data(state: AgentState) -> dict`

Currently a placeholder. Return:  
`{"gathered_data": {"portfolio": {"holdings": [], "total_invested": 0, "total_value": 0, "overall_pnl_pct": 0}}}`  
Real portfolio data injection is a Phase 11 item.

##### Node 6: `analyze_stock(state: AgentState) -> dict`

1. Extract all gathered data from `state["gathered_data"]`
2. Call `build_analyst_prompt(symbol, stock_data, technicals, news_headlines, trading_setup, market_structure, state["query"])` to get the dynamic user message
3. Create LLM with `_get_llm("analyze_stock")`
4. Build messages: `[SystemMessage(ANALYST_SYSTEM_PROMPT), HumanMessage(dynamic_prompt)]`
5. Call `llm.invoke(messages)`
6. On 429 rate limit error: return `{"final_response": f"**Rate Limited** — Analysis temporarily unavailable. Raw data: RSI {rsi}, Price ₹{price}. Please retry in 60 seconds."}`
7. On success: return `{"final_response": response.content}`

##### Node 7: `synthesize_news(state: AgentState) -> dict`

1. Get articles from `state["gathered_data"].get("articles", [])`
2. Call `build_news_prompt(articles, state["query"], query_mode="narrative")`
3. Create LLM with `_get_llm("synthesize_news")`
4. Send `[SystemMessage(NEWS_SYNTHESIS_SYSTEM_PROMPT), HumanMessage(dynamic_prompt)]`
5. Return `{"final_response": response.content}`

##### Node 8: `audit_portfolio(state: AgentState) -> dict`

1. Extract portfolio data from `state["gathered_data"].get("portfolio", {})`
2. Build user message manually (no builder function for this one):
```
Portfolio Summary:
Total Invested: ₹{total_invested:,.0f}
Current Value: ₹{total_value:,.0f}
Overall P&L: {overall_pnl_pct:+.2f}%

Holdings Data:
{json.dumps(holdings, indent=2)}
```
3. Create LLM with `_get_llm("audit_portfolio")`
4. Send `[SystemMessage(PORTFOLIO_AUDITOR_SYSTEM_PROMPT), HumanMessage(portfolio_message)]`
5. Return `{"final_response": response.content}`

##### Node 9: `handle_general(state: AgentState) -> dict`

1. Call `build_general_prompt(state["query"], portfolio_context=None)`
2. Create LLM with `_get_llm("handle_general")`
3. Send `[SystemMessage(GENERAL_EDUCATOR_SYSTEM_PROMPT), HumanMessage(dynamic_prompt)]`
4. Return `{"final_response": response.content}`

##### Node 10: `handle_market(state: AgentState) -> dict`

This is the most complex node — it screens 12 NSE stocks and presents the LLM with structured data to rank/filter:

1. Define `SCREEN_UNIVERSE = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "SBIN.NS", "TATASTEEL.NS", "ICICIBANK.NS", "WIPRO.NS", "AXISBANK.NS", "BAJFINANCE.NS", "SUNPHARMA.NS", "LT.NS"]`
2. For each symbol in the universe, call `get_stock_data(symbol)` and `detect_setup(symbol)`. Catch errors per symbol.
3. Build a `screen_results` list: one dict per stock containing `symbol`, `price`, `rsi`, `macd`, `volume_ratio`, `atr`, `setup_name`, `setup_confidence`, `setup_entry`, `setup_sl`, `setup_t1`, `setup_r_r`
4. Build the user message:
```
User Query: {state["query"]}

NSE Market Screen — {datetime.now().strftime('%d %b %Y %H:%M IST')}
{json.dumps(screen_results, indent=2)}
```
5. Create LLM with `_get_llm("handle_market")`
6. Send `[SystemMessage(MARKET_SCREENER_SYSTEM_PROMPT), HumanMessage(screen_message)]`
7. Return `{"final_response": response.content}`

---

#### Part 4: Graph Assembly Function

```python
def build_agent_graph() -> StateGraph:
    workflow = StateGraph(AgentState)
    
    # Register nodes
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
    
    # Conditional routing from classify_intent
    workflow.add_conditional_edges(
        "classify_intent",
        route_intent,
        {
            "gather_stock_data": "gather_stock_data",
            "gather_news_data": "gather_news_data",
            "gather_portfolio_data": "gather_portfolio_data",
            "handle_general": "handle_general",
            "handle_market": "handle_market",
        }
    )
    
    # Linear edges: data gathering → analysis → END
    workflow.add_edge("gather_stock_data", "analyze_stock")
    workflow.add_edge("gather_news_data", "synthesize_news")
    workflow.add_edge("gather_portfolio_data", "audit_portfolio")
    workflow.add_edge("analyze_stock", END)
    workflow.add_edge("synthesize_news", END)
    workflow.add_edge("audit_portfolio", END)
    workflow.add_edge("handle_general", END)
    workflow.add_edge("handle_market", END)
    
    return workflow.compile()
```

#### Part 5: Compiled Graph Singleton

```python
# Module-level singleton — compiled once at import time
try:
    agent_graph = build_agent_graph()
    logger.info("FinSight LangGraph agent compiled successfully.")
except Exception as e:
    logger.error(f"Failed to compile agent graph: {e}")
    agent_graph = None
```

---

## Phase 5 — SSE Streaming API Endpoint

**Create at:** `backend/app/api/agent.py`  
**Purpose:** FastAPI router that exposes the agent via SSE (Server-Sent Events), allowing the frontend to receive tokens as they stream.

### 5.1 — Request Schema

Define a Pydantic model for the request body:
```python
class AgentRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000, description="User's financial question")
    portfolio_id: Optional[int] = Field(None, description="Portfolio ID for portfolio audit queries")
    symbol: Optional[str] = Field(None, description="Override symbol detection (e.g., for stock page button)")
```

### 5.2 — Router Setup

```python
router = APIRouter(prefix="/api/v1/agent", tags=["Agent"])
```

### 5.3 — SSE Generator Function

Create an async generator `agent_stream_generator(request: AgentRequest)` that:

**1. Emits a `status` event immediately** (gives the frontend instant feedback before any LLM call):
```
event: status
data: {"message": "Agent initialising...", "step": 1}
```

**2. Builds the initial state:**
```python
initial_state = AgentState(
    query=request.query,
    intent_category="",
    intent_symbol=request.symbol,    # Use override if provided
    intent_confidence=0.0,
    gathered_data={},
    final_response="",
    error=None
)
```

**3. Streams graph execution** using `agent_graph.astream(initial_state, stream_mode=["messages", "updates"])`.

**4. Processes each streamed event from LangGraph:**

LangGraph `astream` with `stream_mode=["messages", "updates"]` yields two types of objects:
- `("messages", (message_chunk, metadata))` — individual LLM token chunks
- `("updates", state_update_dict)` — full node output after a node completes

For `"messages"` events:
- Check `metadata` to see which node this chunk is from (`metadata.get("langgraph_node")`)
- If this is the first token from an analysis node (`analyze_stock`, `synthesize_news`, `audit_portfolio`, `handle_general`, `handle_market`): emit a `model` event first with the node name and model tier (`"super"` or `"nano"` based on `_NODE_CONFIG`)
- Then emit a `chunk` event for the token text:
```
event: chunk
data: {"text": "<token text>"}
```

For `"updates"` events:
- After `classify_intent` completes: emit a `classified` event:
```
event: classified
data: {"category": "stock", "symbol": "RELIANCE.NS", "confidence": 0.95}
```
- After `classify_intent`: emit a new `status` event describing the next step (e.g., "Gathering stock data for RELIANCE.NS...")

**5. On graph completion:** emit a `done` event:
```
event: done
data: {"message": "Analysis complete."}
```

**6. On any exception:** emit an `error` event:
```
event: error
data: {"message": "Analysis failed. Please retry.", "partial_response": ""}
```

### 5.4 — Endpoint Definition

```python
@router.post("/stream")
async def stream_agent(request: AgentRequest):
    return StreamingResponse(
        agent_stream_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
```

The `X-Accel-Buffering: no` header prevents nginx from buffering the stream if the app is deployed behind a reverse proxy.

### 5.5 — Non-Streaming Test Endpoint

Add a second endpoint for testing the agent without SSE (useful for debugging):

```python
@router.post("/")
async def invoke_agent(request: AgentRequest):
    if agent_graph is None:
        raise HTTPException(status_code=503, detail="Agent graph failed to initialise")
    
    initial_state = AgentState(
        query=request.query,
        intent_category="",
        intent_symbol=request.symbol,
        intent_confidence=0.0,
        gathered_data={},
        final_response="",
        error=None
    )
    result = await agent_graph.ainvoke(initial_state)
    return {"response": result["final_response"], "category": result["intent_category"], "symbol": result["intent_symbol"]}
```

---

## Phase 6 — Wire the New Router into `main.py`

**File to modify:** `backend/app/main.py`  
**Action:** Append only. Do not touch anything above or rearrange existing code.

### 6.1 — Add Import at the Top of the Import Block

Find the existing block of router imports (they look like `from app.api.portfolio import router as portfolio_router`). Add the new import at the **end of this group**:

```python
from app.api.agent import router as agent_router
```

### 6.2 — Register the New Router

Find the block of `app.include_router()` calls (there are 9 currently). Add one more at the **very end of this group**:

```python
app.include_router(agent_router)    # /api/v1/agent/*
```

### 6.3 — No Other Changes

Do not modify startup events, exception handlers, CORS config, or any other existing code. The 9 existing routers remain exactly as they are.

---

## Phase 7 — Frontend: AI API Library Upgrade

**File to modify:** `frontend/src/lib/ai.api.ts`  
**Action:** Append only. The existing `analyze()` function stays untouched.

### 7.1 — Add TypeScript Interfaces (Append to the file)

```typescript
// ─── NEW: Agent SSE Streaming Types ──────────────────────────────────────────

export interface AgentRequest {
  query: string;
  portfolio_id?: number | null;
  symbol?: string | null;
}

export interface AgentSSEEvent {
  type: 'status' | 'classified' | 'model' | 'chunk' | 'done' | 'error';
  data: Record<string, unknown>;
}

export interface ChunkEventData      { text: string; }
export interface ModelEventData      { model: string; node: string; }
export interface ClassifiedEventData { category: string; symbol: string | null; confidence: number; }
export interface StatusEventData     { message: string; step: number; }
export interface ErrorEventData      { message: string; partial_response: string; }
```

### 7.2 — Add `streamAgent()` Function (Append to the file)

```typescript
export function streamAgent(
  request: AgentRequest,
  onEvent: (event: AgentSSEEvent) => void,
  onComplete: () => void,
  onError: (err: Error) => void
): AbortController {
  const controller = new AbortController();
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  fetch(`${BASE_URL}/api/v1/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Agent stream failed: ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const typeMatch = rawEvent.match(/^event:\s*(.+)$/m);
          const dataMatch = rawEvent.match(/^data:\s*(.+)$/m);
          if (!typeMatch || !dataMatch) continue;

          const eventType = typeMatch[1].trim() as AgentSSEEvent['type'];
          try {
            const eventData = JSON.parse(dataMatch[1].trim());
            onEvent({ type: eventType, data: eventData });
            if (eventType === 'done' || eventType === 'error') {
              onComplete();
              return;
            }
          } catch {
            // Skip malformed event
          }
        }
      }
      onComplete();
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') onError(err);
    });

  return controller;
}
```

**Why return `AbortController`?** The calling component stores this reference so it can call `controller.abort()` if the user navigates away mid-stream or sends a new question before the previous one completes. This prevents memory leaks and partial renders.

---

## Phase 8 — Frontend: AI Research Chat Page Upgrade

**File to modify:** `frontend/src/app/ai-research/page.tsx`  
**Strategy:** The current page uses a polling/fake-loading pattern with the old `analyze()` API. The new implementation adds a parallel streaming path that becomes the default. The old path is preserved as a fallback.

### 8.1 — Updated Message Type

In the component's message state, the `msg` type needs a new optional field:

```typescript
interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  model?: string;       // NEW — "super" or "nano", for the model badge
  category?: string;    // NEW — "stock", "news", etc., for the intent badge
  symbol?: string;      // NEW — extracted ticker if any
}
```

### 8.2 — Streaming Submit Handler

Replace the existing `handleSubmit` function (or add a new `handleStreamSubmit` alongside it — coordinate with developer on which approach is preferred to avoid breaking the current UX during transition):

```typescript
const handleStreamSubmit = () => {
  if (!input.trim() || isLoading) return;

  // 1. Immediately add the user message and an empty AI placeholder
  const userMsg: ChatMessage = { role: 'user', text: input };
  const aiPlaceholder: ChatMessage = { role: 'ai', text: '', model: '' };
  setMsgs(prev => [...prev, userMsg, aiPlaceholder]);
  const aiIndex = msgs.length + 1;   // Index of the placeholder in the new array

  setIsLoading(true);
  setInput('');

  // 2. Start the SSE stream
  const abortRef = streamAgent(
    { query: input },
    (event) => {
      if (event.type === 'chunk') {
        const { text } = event.data as ChunkEventData;
        setMsgs(prev => {
          const updated = [...prev];
          updated[aiIndex] = { ...updated[aiIndex], text: updated[aiIndex].text + text };
          return updated;
        });
      } else if (event.type === 'model') {
        const { model, node } = event.data as ModelEventData;
        setMsgs(prev => {
          const updated = [...prev];
          updated[aiIndex] = { ...updated[aiIndex], model };
          return updated;
        });
      } else if (event.type === 'classified') {
        const { category, symbol } = event.data as ClassifiedEventData;
        setMsgs(prev => {
          const updated = [...prev];
          updated[aiIndex] = { ...updated[aiIndex], category, symbol: symbol ?? undefined };
          return updated;
        });
      } else if (event.type === 'error') {
        const { message } = event.data as ErrorEventData;
        setMsgs(prev => {
          const updated = [...prev];
          updated[aiIndex] = { ...updated[aiIndex], text: `❌ ${message}` };
          return updated;
        });
      }
    },
    () => setIsLoading(false),
    (err) => {
      setMsgs(prev => {
        const updated = [...prev];
        updated[aiIndex] = { ...updated[aiIndex], text: `❌ Connection error: ${err.message}` };
        return updated;
      });
      setIsLoading(false);
    }
  );
};
```

### 8.3 — AI Message Render Updates

In the JSX where AI messages are rendered, add:

**Model badge** (renders below message text):
```tsx
{msg.model && (
  <span className="model-badge">
    {msg.model === 'super' ? '🚀 Nemotron Super 49B' : '⚡ Nemotron Nano 8B'}
  </span>
)}
```

**Category badge** (renders at the top of the AI message):
```tsx
{msg.category && (
  <span className={`category-badge category-${msg.category}`}>
    {msg.category.toUpperCase()}
    {msg.symbol ? ` — ${msg.symbol}` : ''}
  </span>
)}
```

**3-dot loading animation** (shown when `msg.text === ''` and `isLoading === true`):
```tsx
{msg.text === '' && isLoading ? (
  <div className="thinking-dots">
    <span /><span /><span />
  </div>
) : (
  <span>{msg.text}</span>
)}
```

Style the `.thinking-dots` spans with CSS keyframe animation (3 dots bouncing in sequence with 0.15s delays). Use the existing `lime` accent colour from the design system (`#C8FF00`).

---

## Phase 9 — Frontend: Dashboard AI Insights Widget

**Create at:** `frontend/src/components/AIInsights.tsx`  
**Purpose:** The dashboard's AI-powered market sentiment panel. This component calls the agent's news synthesis path in `dashboard` mode to get a structured JSON summary.

### 9.1 — Component Behaviour

On mount, this component:
1. Calls `streamAgent({ query: "What is the overall market sentiment today?" })` via the streaming API
2. Accumulates all `chunk` events
3. On `done`, attempts to parse the accumulated text as JSON
4. Renders the parsed `overall_sentiment`, `market_summary`, `key_themes`, `fii_dii_signal`, and `top_story_impact_level` fields

If JSON parsing fails (the model returned narrative prose instead of JSON), fall back to displaying the raw text as a summary card.

### 9.2 — Display Layout

Render a card component with:
- A coloured verdict badge at the top: 🟢 BULLISH (green), 🔴 BEARISH (red), 🟡 NEUTRAL (amber)
- `market_summary` text in body (medium weight, white)
- `key_themes` displayed as 3 small pill tags in muted style
- `fii_dii_signal` shown in a highlighted info box with ₹ prefix
- `top_story_impact_level` badge: HIGH (red pulse animation), MEDIUM (amber), LOW (grey)
- A "Refresh" button that triggers a new fetch

### 9.3 — Import in Dashboard Page

Open `frontend/src/app/dashboard/page.tsx`. **Append** the import at the top of the import block:
```typescript
import AIInsights from '@/components/AIInsights';
```
Then **add** the component in the JSX where the old static `aiInsightsData` was previously rendered, replacing that section only. The rest of the dashboard page is untouched.

---

## Phase 10 — Testing & Validation Checklist

Complete each test in order. Do not proceed to the next phase until each passes.

### 10.1 — Backend Unit Tests

```bash
# From project root with venv activated
cd backend
python -m pytest tests/ -v
```

Ensure all existing tests still pass. The new agent files do not need new tests yet (add in next sprint).

### 10.2 — Manual Agent Tests via Swagger

Start the backend (`uvicorn app.main:app --reload`) and open `http://localhost:8000/docs`.

Test the non-streaming endpoint `POST /api/v1/agent/`:

| Test Query | Expected `category` | Expected `symbol` |
|---|---|---|
| "Should I buy RELIANCE today?" | `stock` | `RELIANCE.NS` |
| "Why did Nifty fall today?" | `news` | `null` |
| "What stocks are oversold?" | `market` | `null` |
| "What is P/E ratio?" | `general` | `null` |
| "Review my portfolio" | `portfolio` | `null` |
| "Analyse TCS.NS" | `stock` | `TCS.NS` |

Verify that:
- The classification step runs (no 422 or 500 errors)
- The `response` field contains a markdown-formatted analysis (not an empty string)
- No existing endpoints return errors (test `/api/v1/indices`, `/portfolios/`, `/api/v1/stock/RELIANCE.NS`)

### 10.3 — SSE Stream Test (curl)

```bash
curl -X POST http://localhost:8000/api/v1/agent/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the price of Infosys?"}' \
  --no-buffer
```

Expected output (in order):
```
event: status
data: {"message": "Agent initialising...", "step": 1}

event: classified
data: {"category": "stock", "symbol": "INFY.NS", "confidence": 0.93}

event: model
data: {"model": "super", "node": "analyze_stock"}

event: chunk
data: {"text": "**"}

event: chunk
data: {"text": "INFY"}
... (many more chunk events)

event: done
data: {"message": "Analysis complete."}
```

### 10.4 — Frontend Tests

Start the frontend (`npm run dev`) and navigate to `/ai-research`.

- [ ] Sending a question triggers the loading dots animation immediately
- [ ] Token text appears progressively (not all at once at the end)
- [ ] The model badge appears (🚀 or ⚡) after the `model` event
- [ ] The category badge appears after the `classified` event
- [ ] The full response renders correctly in markdown (bold text, line breaks)
- [ ] Sending a second question before the first finishes does not cause duplicate state updates or infinite re-renders
- [ ] Navigating away from the page mid-stream stops the stream (AbortController fires)

### 10.5 — Regression Tests

Verify these existing features are completely unaffected:

- [ ] `/dashboard` — Market indices cards load correctly
- [ ] `/stock/RELIANCE.NS` — Stock detail page loads with RSI/SMA/EMA indicators
- [ ] `/portfolio` — Portfolio list and summary load correctly
- [ ] `/alerts` — Alert management CRUD works
- [ ] `/news` — News feed loads with sentiment badges
- [ ] The old "Analyze" button (which calls `/api/v1/analyze` via the existing `analyze.py`) still works if present

---

## Phase 11 — Known Gaps to Resolve Post-Launch

These items are documented in the source specs as planned but not yet built. They should be tracked as separate tasks.

### High Priority

**1. Portfolio Data Injection**  
The `audit_portfolio` node currently returns placeholder data. When a user asks a portfolio question, the `portfolio_id` from the `AgentRequest` should be used to fetch real holdings from the database via `portfolio_service.get_portfolio_summary()` and inject that data into `AgentState.gathered_data["portfolio"]` before the `audit_portfolio` node runs.

Implementation approach: Create a new pre-processing step in `gather_portfolio_data` that calls `portfolio_service.get_portfolio_summary(db, portfolio_id)` if `portfolio_id` is present in the request. Pass `portfolio_id` through the agent state (requires adding `portfolio_id: Optional[int]` to `AgentState`).

**2. Stock Indicator Expansion**  
The `tools.py` `get_stock_data()` function currently returns `None` for MACD, Bollinger Bands, volume ratio, and ATR because the existing `StockService` does not compute these. These should be added to `services/indicators.py` (which already implements RSI, SMA, and EMA) and wired into `StockService.get_full_stock_data()`.

**3. Frontend Streaming Error Recovery**  
If the SSE connection drops mid-response (network timeout, server restart), the frontend currently shows partial text with no indication that the stream ended. Add: a timeout detection (if no chunk event arrives within 15 seconds during active streaming, trigger an error state), and a "Retry" button that re-sends the same query.

**4. Unify Stock Page Analysis Buttons**  
The stock detail page (`/stock/[symbol]`) has an analysis button that currently calls the legacy `analyst.py` path. This should be updated to call `streamAgent({ query: "Give me a full analysis of ${symbol}", symbol: symbol })` via the new LangGraph path. Update `stock/[symbol]/page.tsx` to add the streaming path as the default for the "Run Full Agent Analysis" button.

### Medium Priority

**5. Dashboard News Widget Query Mode**  
The `AIInsights` component should explicitly pass a `query_mode: "dashboard"` hint in its query. Currently the agent auto-detects mode from keywords. A more reliable approach is to add an optional `mode` field to `AgentRequest` that short-circuits classification and forces `query_mode="dashboard"` when the dashboard widget calls the agent.

**6. Market Screener Universe Configuration**  
The hardcoded `SCREEN_UNIVERSE` list in `graph.py` should be configurable via a `.env` variable or a database table. This allows expanding coverage to mid-caps or sector-specific lists without code changes.

**7. LangSmith Tracing**  
Set `LANGCHAIN_TRACING_V2=true` in `.env` with a valid `LANGCHAIN_API_KEY` to enable full graph visualisation in the LangSmith dashboard. This is invaluable for debugging which node a query failed at and how much token budget was consumed per node.

### Low Priority

**8. Separate Nano API Key Setup**  
Currently all OpenRouter requests use the super key even for Nano model nodes (if the nano key is not set). Setting up a separate Nano key on OpenRouter's free tier allows cost tracking per model tier and avoids rate limits on the Super key during classification-heavy periods.

**9. Redis Caching for Stock Data**  
The market screener in `handle_market` makes 24 tool calls (12 stocks × 2 calls each). Without caching, this hits yFinance 24 times per screener query. Enabling Redis and caching stock data for 5 minutes would reduce this to near-zero on repeat queries.

---

## Complete New File Manifest

All files to be **created** (✅) and **appended to** (⚠️):

| Action | File Path |
|---|---|
| ✅ CREATE | `backend/app/agent/__init__.py` |
| ✅ CREATE | `backend/app/agent/tools.py` |
| ✅ CREATE | `backend/app/agent/prompts.py` |
| ✅ CREATE | `backend/app/agent/prompt_builder.py` |
| ✅ CREATE | `backend/app/agent/graph.py` |
| ✅ CREATE | `backend/app/api/agent.py` |
| ✅ CREATE | `backend/app/services/setup_engine.py` |
| ✅ CREATE | `backend/app/services/market_structure.py` |
| ✅ CREATE | `frontend/src/components/AIInsights.tsx` |
| ⚠️ APPEND | `backend/app/core/config.py` — add 13 new field definitions |
| ⚠️ APPEND | `backend/app/main.py` — add 1 import + 1 router registration |
| ⚠️ APPEND | `requirements.txt` — add 5 new package lines |
| ⚠️ APPEND | `.env` — add 13 new variable lines |
| ⚠️ APPEND | `frontend/src/lib/ai.api.ts` — add TypeScript interfaces + `streamAgent()` function |
| ⚠️ MODIFY | `frontend/src/app/ai-research/page.tsx` — upgrade streaming logic and message render |
| ⚠️ MODIFY | `frontend/src/app/dashboard/page.tsx` — import and render `AIInsights` component |

**Protected files that must NOT be touched at all:**

`backend/app/api/analyze.py`, `backend/app/ai/analyst.py`, `backend/app/api/stock.py`, `backend/app/api/portfolio.py`, `backend/app/api/news.py`, `backend/app/api/market.py`, `backend/app/api/alerts.py`, `backend/app/api/rag.py`, `backend/app/api/stream.py`, `backend/app/services/stock_service.py`, `backend/app/services/portfolio_service.py`, `backend/app/services/news_service.py`, `backend/app/services/alert_service.py`, `backend/app/models/*`, `backend/app/schemas/*`, `frontend/src/lib/api-client.ts`, `frontend/src/lib/portfolio.api.ts`, `frontend/src/lib/stock.api.ts`, `frontend/src/components/Sidebar.tsx`

---

## Environment Variable Reference

Complete list of new variables to add to `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NVIDIA_Nemotron_3_Super_API_KEY` | ✅ Yes | — | OpenRouter API key for Super model tier |
| `NVIDIA_Nemotron_3_Nano_API_KEY` | Optional | Falls back to Super key | OpenRouter API key for Nano model tier |
| `NVIDIA_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `NEMOTRON_SUPER_MODEL` | No | `nvidia/llama-3.1-nemotron-70b-instruct` | Super model identifier |
| `NEMOTRON_NANO_MODEL` | No | `meta-llama/llama-3.1-8b-instruct` | Nano model identifier |
| `NEMOTRON_CLASSIFY_MAX_TOKENS` | No | `200` | Token budget for classification node |
| `NEMOTRON_ANALYZE_MAX_TOKENS` | No | `2500` | Token budget for stock analysis node |
| `NEMOTRON_NEWS_MAX_TOKENS` | No | `1200` | Token budget for news synthesis node |
| `NEMOTRON_PORTFOLIO_MAX_TOKENS` | No | `1800` | Token budget for portfolio audit node |
| `NEMOTRON_GENERAL_MAX_TOKENS` | No | `900` | Token budget for general educator node |
| `NEMOTRON_MARKET_MAX_TOKENS` | No | `4000` | Token budget for market screener node |
| `GNEWS_API_KEY` | Optional | — | GNews API key (India-friendly, 100 free requests/day) |

---

*Document prepared: April 17, 2026 | FinSight AI v2.0 — Agent Pipeline Implementation*c