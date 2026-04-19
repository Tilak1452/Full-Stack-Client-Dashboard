# FinSight AI — Complete System Architecture & Change Documentation

**Version:** 2.0 (Post-Nemotron Migration + Prompt Intelligence Upgrade)  
**Purpose:** Full handover document for final production implementation  
**Status:** All architecture decisions finalized. Ready for clean implementation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Directory Structure](#3-project-directory-structure)
4. [Environment Configuration (.env)](#4-environment-configuration-env)
5. [Python Dependencies (requirements.txt)](#5-python-dependencies)
6. [Backend Architecture](#6-backend-architecture)
   - 6.1 [LLM Backend Migration: Groq → NVIDIA Nemotron via OpenRouter](#61-llm-backend-migration)
   - 6.2 [LangGraph State Machine (graph.py)](#62-langgraph-state-machine)
   - 6.3 [Node-Level Model Router (_NODE_CONFIG)](#63-node-level-model-router)
   - 6.4 [Dynamic Prompt Builder (prompt_builder.py)](#64-dynamic-prompt-builder)
   - 6.5 [Prompt System (prompts.py)](#65-prompt-system)
   - 6.6 [SSE Streaming Architecture (agent.py)](#66-sse-streaming-architecture)
   - 6.7 [Yahoo Finance .NS Symbol Auto-Append](#67-yahoo-finance-ns-symbol-auto-append)
   - 6.8 [AI Analyst Service (analyst.py)](#68-ai-analyst-service)
   - 6.9 [Categorizer Service (categorizer.py)](#69-categorizer-service)
7. [Frontend Architecture](#7-frontend-architecture)
   - 7.1 [AI Research Agent Page (ai-research/page.tsx)](#71-ai-research-agent-page)
   - 7.2 [AI API Library (ai.api.ts)](#72-ai-api-library)
   - 7.3 [Dashboard AI Insights Widget](#73-dashboard-ai-insights-widget)
   - 7.4 [Market News & Sentiment Page](#74-market-news--sentiment-page)
   - 7.5 [Stock Analysis Page Features](#75-stock-analysis-page-features)
8. [Key Design Decisions](#8-key-design-decisions)
9. [What Still Needs to Be Implemented](#9-what-still-needs-to-be-implemented)
10. [How to Run Locally](#10-how-to-run-locally)
11. [API Endpoints Reference](#11-api-endpoints-reference)
12. [Conflict Prevention Notes for Parallel Development](#12-conflict-prevention-notes-for-parallel-development)

---

## 1. Project Overview

**FinSight AI** is a full-stack financial research dashboard for Indian market investors (NSE/BSE). It consists of:

- A **FastAPI Python backend** that runs a LangGraph AI agent, fetches live market data via Yahoo Finance, and serves REST + SSE endpoints.
- A **Next.js 16 frontend** (TypeScript + Tailwind-free, vanilla CSS) that shows a real-time AI chat interface, dashboard with AI insights, market news feed, portfolio tracker, and stock analysis.

The system was originally built with **Groq + Llama 3.3 70B** as the LLM backend. It has been fully migrated and upgraded to use **NVIDIA Nemotron models via OpenRouter**, with a completely redesigned prompt intelligence system.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend Framework | FastAPI + Uvicorn |
| AI Orchestration | LangChain + LangGraph (state machine) |
| LLM Provider | NVIDIA Nemotron via OpenRouter API |
| LLM Client | `langchain-openai` (ChatOpenAI pointed at OpenRouter) |
| Market Data | Yahoo Finance (`yfinance`) with `.NS` auto-append |
| News Data | GNews API + NewsAPI + RSS feeds |
| Database | SQLite (dev) / PostgreSQL (prod) via SQLAlchemy |
| Caching | Redis (optional — falls back to in-memory dict) |
| Background Jobs | APScheduler |
| Frontend | Next.js 16.2.3 with Turbopack |
| Frontend Language | TypeScript + React |
| CSS | Vanilla CSS (no Tailwind) |
| Real-time Streaming | Server-Sent Events (SSE) via FastAPI StreamingResponse |

---

## 3. Project Directory Structure

```
Full-Stack-Client-Dashboard/
├── .env                          ← All API keys and model configs (NEVER commit)
├── requirements.txt              ← Python dependencies
├── financial_ai.db               ← SQLite database (dev only)
├── venv/                         ← Python virtual environment
│
├── backend/
│   └── app/
│       ├── main.py               ← FastAPI app entry point
│       ├── core/
│       │   └── config.py         ← Pydantic BaseSettings (loads .env)
│       ├── agent/
│       │   ├── graph.py          ← LangGraph state machine + model router (CORE FILE)
│       │   ├── prompts.py        ← All 5 system prompts (CORE FILE)
│       │   ├── prompt_builder.py ← Dynamic prompt assembly (CORE FILE)
│       │   └── tools.py          ← Yahoo Finance tools for the graph
│       ├── api/
│       │   ├── agent.py          ← SSE streaming endpoint (/api/v1/agent/stream)
│       │   ├── stock.py          ← Stock data endpoints
│       │   ├── news.py           ← News endpoints
│       │   └── portfolio.py      ← Portfolio CRUD endpoints
│       ├── services/
│       │   ├── categorizer.py    ← LLM-powered intent classifier (standalone)
│       │   └── ...               ← Other service modules
│       └── ai/
│           └── analyst.py        ← Legacy analyst agent (being phased out by graph.py)
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx           ← Main dashboard
        │   ├── ai-research/
        │   │   └── page.tsx       ← AI chat interface (MODIFIED)
        │   ├── market-news/
        │   │   └── page.tsx       ← News & Sentiment page
        │   └── stocks/
        │       └── [symbol]/
        │           └── page.tsx   ← Stock analysis page
        ├── components/
        │   ├── TopBar.tsx
        │   ├── AIInsights.tsx     ← Dashboard AI insight widget
        │   └── ...
        └── lib/
            ├── ai.api.ts          ← Agent streaming API client (MODIFIED)
            ├── stock.api.ts       ← Stock data API client
            ├── news.api.ts        ← News API client
            └── portfolio.api.ts   ← Portfolio API client
```

---

## 4. Environment Configuration (.env)

The `.env` file must be placed at the project root (`Full-Stack-Client-Dashboard/.env`).  
The `config.py` uses `pydantic-settings` to load it automatically.

```env
# ─── LLM Keys (OpenRouter) ───
NVIDIA_Nemotron_3_Super_API_KEY=<your-openrouter-api-key-for-super>
NVIDIA_Nemotron_3_Nano_API_KEY=<your-openrouter-api-key-for-nano>

# ─── Model Output Token Budgets ───
NEMOTRON_CLASSIFY_MAX_TOKENS=200
NEMOTRON_ANALYZE_MAX_TOKENS=2500
NEMOTRON_NEWS_MAX_TOKENS=1200
NEMOTRON_PORTFOLIO_MAX_TOKENS=1800
NEMOTRON_GENERAL_MAX_TOKENS=900
NEMOTRON_MARKET_MAX_TOKENS=4000

# ─── News APIs ───
GNEWS_API_KEY=<your-gnews-key>         # Free, India-friendly, 100 req/day
NEWS_API_KEY=<your-newsapi-key>

# ─── Market Data ───
ALPHA_VANTAGE_KEY=<your-alpha-vantage-key>
FMP_API_KEY=<your-fmp-key>

# ─── Database (SQLite by default) ───
# DATABASE_URL=postgresql+psycopg2://user:pass@host/db  # uncomment for prod

# ─── Optional ───
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=financial-research-agent
LANGCHAIN_API_KEY=<your-langsmith-key>
REDIS_URL=redis://localhost:6379/0
```

> **Important:** The `config.py` BaseSettings class maps env variable names with case-sensitivity handled by Pydantic. The key names in `.env` must use the casing that Pydantic expects (lowercase with underscores internally, but Pydantic ignores case).

---

## 5. Python Dependencies

Key packages in `requirements.txt`:

```
fastapi
uvicorn[standard]
pydantic
pydantic-settings
sqlalchemy
python-dotenv

# Market Data
yfinance
alpha_vantage
fredapi

# Data Processing
pandas
numpy
requests
tenacity
feedparser

# LLM & AI Agents — CRITICAL
langchain>=0.3.7
langchain-core>=0.3.19
langchain-openai>=0.1.0    ← NEW (replaces langchain-groq as active provider)
langchain-groq             ← Still in requirements but NO LONGER USED in live code
langgraph==0.2.28
langchain-community>=0.3.7

# APScheduler for background market alert jobs
apscheduler
```

**Install command:**
```bash
pip install -r requirements.txt
```

---

## 6. Backend Architecture

### 6.1 LLM Backend Migration

**What changed:** The LLM provider was completely replaced.

| | Before | After |
|---|---|---|
| Library | `langchain-groq` (`ChatGroq`) | `langchain-openai` (`ChatOpenAI`) |
| Model | `llama-3.3-70b-versatile` | `nvidia/llama-3.1-nemotron-70b-instruct` (Super) + `meta-llama/llama-3.1-8b-instruct` (Nano) |
| Endpoint | Groq cloud API | OpenRouter API (`https://openrouter.ai/api/v1`) |
| Execution | Synchronous `.invoke()` | Async `.astream()` for SSE streaming |
| Temperature | Fixed per prompt | **Randomized within per-node ranges** for response variety |

**Files changed:**
- `backend/app/agent/graph.py` — removed `ChatGroq`, added `ChatOpenAI` with `_NODE_CONFIG`
- `backend/app/services/categorizer.py` — replaced `ChatGroq` with `ChatOpenAI`
- `backend/app/ai/analyst.py` — replaced legacy LLM chain with `ChatOpenAI`
- `backend/app/core/config.py` — added all new Nemotron settings

---

### 6.2 LangGraph State Machine

**File:** `backend/app/agent/graph.py`

The LangGraph state machine is the **core brain** of FinSight. It is preserved completely — only the LLM engine underneath was swapped.

**How it works:**
1. User sends a query via POST `/api/v1/agent/stream`
2. `classify_intent` node: LLM classifies the query into one of 5 categories: `stock`, `news`, `portfolio`, `market`, `general`
3. `route_intent` function: Routes to the correct data-gathering branch based on classification
4. Data-gathering nodes fetch live data from Yahoo Finance tools
5. Analysis nodes call the LLM with the gathered data + dynamic prompt
6. `final_response` is set in state and streamed back

**Graph Flow:**
```
classify_intent
      │
   route_intent (conditional edges)
      │
  ┌───┴────────────┬────────────┬──────────────┬─────────────┐
  │                │            │              │             │
gather_stock    gather_news  gather_portfolio  handle_general  handle_market
  │                │            │
analyze_stock  synthesize_news  audit_portfolio
  │                │            │
  └───────────────END────────────┘
```

**AgentState TypedDict:**
```python
class AgentState(TypedDict):
    query: str
    intent_category: str          # "stock" | "news" | "portfolio" | "market" | "general"
    intent_symbol: Optional[str]  # "RELIANCE.NS", "TCS.NS", "AAPL" etc.
    intent_confidence: float
    gathered_data: dict           # All tool results stored here
    final_response: str           # Final markdown response
    error: Optional[str]
```

---

### 6.3 Node-Level Model Router

**File:** `backend/app/agent/graph.py` — `_NODE_CONFIG` dictionary and `_get_llm(node_name)` function

This is the new routing intelligence. Each LangGraph node gets its own model tier, temperature range, and token budget:

```python
_NODE_CONFIG = {
    "classify_intent":  { "model": "nano",  "temp_min": 0.05, "temp_max": 0.15, "max_tokens": 200   },
    "analyze_stock":    { "model": "super", "temp_min": 0.30, "temp_max": 0.42, "max_tokens": 2500  },
    "synthesize_news":  { "model": "nano",  "temp_min": 0.35, "temp_max": 0.48, "max_tokens": 1200  },
    "audit_portfolio":  { "model": "super", "temp_min": 0.28, "temp_max": 0.40, "max_tokens": 1800  },
    "handle_general":   { "model": "nano",  "temp_min": 0.38, "temp_max": 0.50, "max_tokens": 900   },
    "handle_market":    { "model": "super", "temp_min": 0.50, "temp_max": 0.50, "max_tokens": 4000  },
}
```

**Why temperature is randomized:** To prevent the AI from giving the exact same response structure for similar queries. Each request picks a random temperature within the node's range, producing natural response variety while staying within safe bounds.

**Model routing logic:**
- `super` → `nvidia/llama-3.1-nemotron-70b-instruct` — used for heavy analysis (stock, portfolio, market screening)
- `nano` → `meta-llama/llama-3.1-8b-instruct` — used for fast tasks (classification, news, general Q&A)
- If `NVIDIA_Nemotron_3_Nano_API_KEY` is not set, nano nodes automatically fall back to the super API key

---

### 6.4 Dynamic Prompt Builder

**File:** `backend/app/agent/prompt_builder.py`

This is the most impactful new file. It was completely rewritten from scratch. It contains 3 public builder functions and 3 internal detection functions.

#### Public Functions

**`build_analyst_prompt(symbol, stock_data, technicals, news, setup, structure, original_query)`**
- Output: A fully assembled user message for the analyst node
- **Detects `output_mode` automatically** from the user's original query
- Injects the user's exact question at the very top
- Builds contextual technical annotations (not just raw numbers)
- Contains a `_get_mode_instruction()` that appends a different task specification based on mode

**`build_news_prompt(articles, original_query, query_mode="narrative")`**
- Output: A user message for the news synthesis node
- `query_mode="narrative"` → answers user's question in Bloomberg prose
- `query_mode="dashboard"` → returns structured JSON for the dashboard widget
- Detects focus area (FII/DII, sector rotation, catalyst) from the query

**`build_general_prompt(question, portfolio_context)`**
- Output: A user message for the general educator node
- Auto-detects `response_mode`: `educational`, `advisory`, or `macro`
- Auto-detects `complexity_level`: `beginner`, `intermediate`, or `advanced`
- Applies different word limits based on complexity

#### Detection Functions

**`detect_output_mode(query: str) → str`**

Returns one of:
| Mode | Trigger Keywords | LLM Response Structure |
|---|---|---|
| `trade_plan` | buy, sell, trade, entry, invest, should I | Entry → SL → Target → R:R → Invalidation |
| `technical_deep_dive` | RSI, MACD, SMA, overbought, breakout | Indicator-by-indicator walkthrough |
| `news_catalyst` | why, fell, surged, what happened, results | News lead → technical confirmation |
| `price_check` | price, rate, kitna hai, current | 4-line Bloomberg ticker note |
| `general_outlook` | (default) | Balanced trend + risk level + bias |

**`detect_general_response_mode(query: str) → str`**
- Returns `advisory` / `macro` / `educational` based on keywords

**`detect_complexity(query: str) → str`**
- Returns `beginner` / `intermediate` / `advanced` based on financial jargon

#### Key Problem Fixed: Pre-Computed Verdict Removed

**Before (broken):** Python computed `BULLISH/BEARISH/NEUTRAL` algorithmically from RSI/MACD signals, then injected it into the prompt before the LLM saw the data. The LLM just wrote a justification — not a real analysis.

**After (fixed):** The verdict computation code is deleted. Raw data is presented to the LLM with contextual annotations. The LLM reasons to its own conclusion from the evidence.

---

### 6.5 Prompt System

**File:** `backend/app/agent/prompts.py`

Contains 5 system prompts + 5 user templates. All have been upgraded:

#### `CLASSIFIER_SYSTEM_PROMPT` (unchanged)
- Intent classification into: `stock`, `news`, `portfolio`, `market`, `general`
- 5-category system with few-shot examples
- Ticker symbol extraction with `.NS` suffix for NSE stocks
- Returns strict JSON: `{"category", "symbol", "confidence", "reasoning"}`

#### `ANALYST_SYSTEM_PROMPT` (rewritten)
**Before:** Had 6 fixed sections (MARKET READ, TECHNICAL VERDICT, NEWS IMPACT, TRADE PLAN, WHAT WOULD INVALIDATE, HONEST ASSESSMENT) — always the same skeleton regardless of query.

**After:** Mode-aware. The prompt instructs the LLM to adopt different personas based on `output_mode`:
- `trade_plan` → Trading desk operator. Fast, direct, numbers-first.
- `technical_deep_dive` → Quant analyst. Walk through each indicator.
- `news_catalyst` → Financial journalist meets analyst.
- `price_check` → Bloomberg terminal. Maximum density, minimum words.
- `general_outlook` → Senior fund manager. Balanced, decisive.

#### `NEWS_SYNTHESIS_SYSTEM_PROMPT` (upgraded)
**Before:** Always returned a JSON object — even when user asked a conversational question.

**After:** Hybrid mode:
- `query_mode="narrative"` → Direct Bloomberg-style prose answer to user's question
- `query_mode="dashboard"` → JSON object for dashboard widget use

New rules:
- `market_summary` MUST begin with a specific number, company, or event — NEVER "The market..."
- Added `top_story_impact_level: "HIGH" | "MEDIUM" | "LOW"` to JSON schema

#### `GENERAL_EDUCATOR_SYSTEM_PROMPT` (upgraded)
**Before:** One 4-section template (Topic, What It Means, Analogy, Takeaway, Related) for ALL question types.

**After:** 3 distinct response modes:
- **Educational Mode:** Concept → Explanation → Real Indian market example → Key metric → Explore next
- **Advisory Mode:** Direct stance (BULLISH/BEARISH/NEUTRAL) → 3 reasons → Risk → Action
- **Macro Mode:** Immediate Indian market impact → Affected sectors → FII/DII behaviour → Trader takeaway

Complexity-aware word limits: Beginner=150 words, Intermediate=250 words, Advanced=400 words

#### `PORTFOLIO_AUDITOR_SYSTEM_PROMPT` (upgraded)
- Added weight computation requirement: LLM must compute `weight_pct = (current_value / total_value) × 100` for each holding
- If any holding weight > 35% → automatic HIGH concentration risk
- Top holding weight must be explicitly called out in `reasoning_summary`

#### `MARKET_SCREENER_SYSTEM_PROMPT` (upgraded)
**Before:** Listed stocks matching criteria based on vague description.

**After:** Has explicit filter rules:
- "oversold" → RSI < 35
- "overbought" → RSI > 65
- "breakout" → price above SMA20 AND volume_ratio > 1.4
- "best to buy" → RSI < 50 + MACD bullish + setup_confidence > 0.5

New **Screener Verdict Summary** section required in every response:
```
📊 Screener Verdict Summary
- X out of 12 NSE stocks match your criteria today.
- Strongest setup: [SYMBOL] — [why]
- Most risky entry: [SYMBOL] — [why]
- Market Context: [one sentence on overall market conditions]
```

---

### 6.6 SSE Streaming Architecture

**File:** `backend/app/api/agent.py`

**Before:** Used `agent_graph.invoke()` — synchronous, blocking. The frontend received the full response only after the entire graph completed. No streaming.

**After:** Uses `agent_graph.astream(initial_state, stream_mode=["messages", "updates"])` — true async streaming. The frontend receives tokens as they are generated by the LLM.

**SSE Event Types emitted:**

| Event | When | Payload |
|---|---|---|
| `status` | Agent start + after classification | `{message, step}` |
| `classified` | After `classify_intent` node | `{category, symbol, confidence}` |
| `model` | Before first token from analysis nodes | `{model: "super"/"nano", node}` |
| `chunk` | Every token from LLM output | `{text: "<token>"}` |
| `done` | After graph completes | `{message: "Analysis complete."}` |
| `error` | On any node failure | `{message, partial_response}` |

**Endpoint:** `POST /api/v1/agent/stream`  
**Content-Type:** `text/event-stream`

The `model` event is what triggers the model badge UI in the frontend (🚀 Nemotron Super 49B or ⚡ Nemotron Nano 8B).

---

### 6.7 Yahoo Finance .NS Symbol Auto-Append

**File:** `backend/app/agent/prompts.py` — `CLASSIFIER_SYSTEM_PROMPT`

**Problem:** Yahoo Finance requires the `.NS` suffix for NSE-listed Indian stocks (e.g., `RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`). Without it, `yfinance` returns no data.

**Solution:** The classifier prompt has explicit ticker extraction rules:
```
- Indian NSE stocks: append ".NS" suffix
  "Reliance" → "RELIANCE.NS"
  "TCS" → "TCS.NS"
  "HDFC Bank" → "HDFCBANK.NS"
- Indian BSE stocks: append ".BO" suffix only if explicitly mentioned
- US stocks: use ticker as-is
  "Apple" → "AAPL", "Tesla" → "TSLA"
```

The `intent_symbol` field in `AgentState` always carries the correctly-suffixed symbol, which is then passed directly to all `yfinance` tool calls.

**Also important:** The market screener universe is hardcoded in `graph.py` with `.NS` already appended:
```python
SCREEN_UNIVERSE = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "SBIN.NS",
    "TATASTEEL.NS", "ICICIBANK.NS", "WIPRO.NS", "AXISBANK.NS",
    "BAJFINANCE.NS", "SUNPHARMA.NS", "LT.NS",
]
```

---

### 6.8 AI Analyst Service

**File:** `backend/app/ai/analyst.py`

This is a **legacy service** that pre-dates the LangGraph agent. It was migrated from Groq to `ChatOpenAI` (same OpenRouter endpoint) but is being phased out in favor of the LangGraph graph in `graph.py`.

**Current state:** Uses `ChatOpenAI` with `nvidia/llama-3.1-nemotron-70b-instruct`. The dashboard's "Generate AI Analysis Report" and "Run Full Agent Analysis" buttons on the stock detail page currently call this service.

**What needs to happen:** These features should be gradually migrated to route through the LangGraph graph instead. For now, `analyst.py` is functional but runs as a simple single-step LLM call without the state machine pipeline.

---

### 6.9 Categorizer Service

**File:** `backend/app/services/categorizer.py`

A standalone LLM-powered query classifier used by some legacy endpoints (outside the main LangGraph graph flow). It was migrated from `ChatGroq` to `ChatOpenAI`:

```python
ChatOpenAI(
    model="nvidia/llama-3.1-nemotron-70b-instruct",
    api_key=settings.nvidia_nemotron_3_super_api_key,
    base_url="https://openrouter.ai/api/v1",
    temperature=0,
    max_tokens=256,
)
```

---

## 7. Frontend Architecture

### 7.1 AI Research Agent Page

**File:** `frontend/src/app/ai-research/page.tsx`

**What changed:**

**Before:**
- Used a `setInterval` stepping through 4 fake loading messages ("Fetching data...", "Running analysis...", etc.)
- Waited for `result` event from the API, then displayed the full response at once
- No indication of which model was used

**After:**
- The `msg` state now has a `model?: string` field
- A placeholder AI message `{role: 'ai', text: '', model: ''}` is injected into `msgs` immediately when user sends
- As `chunk` events arrive, the text is accumulated and the message updates in-place (true streaming render)
- On `model` event, the badge field is updated
- On `error` event, error text is appended to the current AI message
- Model badge renders as: `🚀 Nemotron Super 49B` or `⚡ Nemotron Nano 8B`
- Placeholder shows a 3-dot bounce animation while text is empty
- No fake loading spinner — the actual tokens appear immediately

**Important note on aiMessageIndex:** The streaming update uses index-based state mutation. The `aiMessageIndex` is captured at send time as `msgs.length + 1`. State updates are applied to `msgs[aiMessageIndex]` in-place. This works correctly as long as no new messages are added during streaming.

---

### 7.2 AI API Library

**File:** `frontend/src/lib/ai.api.ts`

**What changed:** New type definitions and the complete streaming client were added.

**New TypeScript interfaces:**
```typescript
export interface AgentSSEEvent {
  type: 'status' | 'classified' | 'model' | 'chunk' | 'done' | 'error';
  data: Record<string, unknown>;
}

export interface ChunkEventData    { text: string; }
export interface ModelEventData    { model: string; node: string; }
export interface ClassifiedEventData { category: string; symbol: string | null; confidence: number; }
export interface ErrorEventData    { message: string; }
```

**`streamAgent()` function:**
- Uses `fetch()` with `ReadableStream` to connect to `/api/v1/agent/stream`
- Decodes SSE bytes with `TextDecoder`
- Splits on `\n\n` to separate SSE events
- Parses `event: <type>\ndata: <json>` format with regex
- Calls `onEvent(event)` for every event, `onComplete()` on `done`/`error`, `onError(err)` on connection failure
- Returns an `AbortController` so the calling component can cancel the stream

---

### 7.3 Dashboard AI Insights Widget

**File:** `frontend/src/components/AIInsights.tsx` (or the dashboard page component)

The main dashboard has an AI Insights panel that shows:
- A brief AI-generated market sentiment summary
- A verdict badge (BULLISH / BEARISH / NEUTRAL)
- Key themes from recent news

**How it works:** This widget calls the `synthesize_news` path of the agent in `dashboard` mode, which returns the structured JSON with `overall_sentiment`, `market_summary`, `key_themes`, and `fii_dii_signal`.

**What changed:** The `NEWS_SYNTHESIS_SYSTEM_PROMPT` now includes `top_story_impact_level` in the JSON schema. The dashboard widget should display this field to indicate how market-moving the top story is.

---

### 7.4 Market News & Sentiment Page

**File:** `frontend/src/app/market-news/page.tsx`

This page shows recent news articles with sentiment labels. It fetches from the backend news API which uses GNews + RSS feeds.

**Key dependency:** `GNEWS_API_KEY` must be set in `.env`. The GNews API is India-friendly (unlike NewsAPI which blocks many Indian IPs). It provides 100 requests/day on the free tier.

**Sentiment labels** are computed by the backend using both:
1. VADER sentiment analysis (rule-based, fast)
2. Optional LLM-enhanced sentiment (more accurate)

---

### 7.5 Stock Analysis Page Features

**File:** `frontend/src/app/stocks/[symbol]/page.tsx`

The stock detail page has two AI-powered action buttons:

**"Generate AI Analysis Report":**
- Calls `POST /api/v1/ai/analyze` (through `analyst.py`)
- Returns a structured analysis report for the stock
- Currently uses `analyst.py` directly (pre-LangGraph path)

**"Run Full Agent Analysis":**
- Should call `POST /api/v1/agent/stream` with `symbol` override
- Routes through the full LangGraph pipeline
- Returns streamed analysis using `output_mode="general_outlook"` or `"trade_plan"` depending on context

> **Note for implementation:** These two features should ideally be unified to both route through the LangGraph agent. Currently `analyst.py` is a separate code path. Priority: unify them in the next sprint.

---

## 8. Key Design Decisions

### Why LangGraph (not direct LLM calls)?

LangGraph gives us a **stateful pipeline** where:
1. Classification happens first, separately from analysis — a weaker model can classify, a stronger one can analyze
2. Data gathering is decoupled from LLM calls — tools run in Python, not as LLM tool-calls
3. Error handling is node-level — one failing node doesn't break the whole response
4. The graph is visualizable and debuggable via LangSmith

### Why OpenRouter (not direct NVIDIA NIM)?

The user has OpenRouter API keys, which proxy to NVIDIA models. This works identically to the NIM API from the LangChain `ChatOpenAI` perspective — just point `base_url` at OpenRouter.

### Why temperature randomization?

Fixed temperature = deterministic responses for identical inputs. If a user asks "Should I buy Reliance?" twice in the same session, they'd get nearly identical text. Randomizing within a safe range (e.g., 0.30–0.42 for analysis) ensures natural variation while preventing incoherent outputs.

### Why keep `max_tokens` limits per node?

OpenRouter charges per output token. Without limits, a buggy prompt could generate 10,000 tokens for a simple query. Per-node limits are our safety budget:
- Fast nodes (classify): 200 tokens max
- Analysis nodes: 2500 tokens max
- Market screener: 4000 tokens max (highest because it lists 12+ stocks)

---

## 9. What Still Needs to Be Implemented

The following items are planned but not yet built:

### High Priority
- [ ] **Unify stock analysis page**: Route "Run Full Agent Analysis" button through `agent/stream` endpoint instead of `analyst.py`. The LangGraph path is fully functional.
- [ ] **Portfolio data injection**: The `audit_portfolio` node currently has placeholder data (`holdings: []`). The real portfolio data needs to be fetched from the database (using `portfolio_id` from the request) and injected into the agent state before `audit_portfolio` runs.
- [ ] **Frontend streaming error recovery**: If the SSE stream drops mid-response, the frontend currently shows partial text. Add a retry + error boundary.

### Medium Priority
- [ ] **Dashboard news widget hybrid mode**: The dashboard AI insights call should pass `query_mode="dashboard"` explicitly so it gets JSON back (not narrative prose). Currently it may receive prose.
- [ ] **Market Screener universe expansion**: The hardcoded 12-stock `SCREEN_UNIVERSE` in `graph.py` should be configurable or pulled from a database.
- [ ] **LangSmith tracing**: Set `LANGCHAIN_TRACING_V2=true` in production to enable full graph visualization in LangSmith.

### Low Priority
- [ ] **Redis caching**: Currently falls back to in-memory dict. Set up Redis for cross-request caching of stock data and news.
- [ ] **Rate limit handling on frontend**: When the LLM returns a 429 (rate limited), surface a proper user-friendly retry message.
- [ ] **Nano API key setup**: If the OpenRouter Nano key is not set, Nano nodes fall back to the Super key. Set up a separate Nano key to reduce costs on classification/news/general calls.

---

## 10. How to Run Locally

### Backend
```bash
# From project root
./venv/Scripts/python.exe -m uvicorn backend.app.main:app --reload --port 8000

# OR if your venv is activated:
uvicorn backend.app.main:app --reload --port 8000
```

Backend runs at: `http://127.0.0.1:8000`  
API Docs: `http://127.0.0.1:8000/docs`

### Frontend
```bash
# From /frontend directory
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## 11. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/agent/stream` | Main AI streaming endpoint (SSE). Use this from frontend. |
| `POST` | `/api/v1/agent` | Non-streaming agent (for testing only) |
| `GET` | `/api/v1/stocks/{symbol}` | Live stock data + technicals |
| `GET` | `/api/v1/news` | Market news feed |
| `GET` | `/api/v1/portfolio` | User portfolio |
| `POST` | `/api/v1/ai/analyze` | Legacy analyst endpoint (analyst.py) |

**Agent stream request body:**
```json
{
  "query": "Should I buy Reliance today?",
  "portfolio_id": null,
  "symbol": null
}
```

---

## 12. Conflict Prevention Notes for Parallel Development

If you are working on this project in parallel with another developer, here are the files that are most likely to conflict:

| File | Risk Level | Who Should Own It |
|---|---|---|
| `backend/app/agent/graph.py` | 🔴 HIGH | One person only — core state machine |
| `backend/app/agent/prompts.py` | 🔴 HIGH | One person only — all 5 prompts |
| `backend/app/agent/prompt_builder.py` | 🔴 HIGH | One person only — detection logic |
| `backend/app/api/agent.py` | 🟡 MEDIUM | Coordinate if adding new SSE event types |
| `backend/app/core/config.py` | 🟡 MEDIUM | Add new env vars carefully |
| `frontend/src/app/ai-research/page.tsx` | 🟡 MEDIUM | Coordinate streaming UI changes |
| `frontend/src/lib/ai.api.ts` | 🟡 MEDIUM | Coordinate if adding new event types |
| `frontend/src/app/stocks/[symbol]/page.tsx` | 🟢 LOW | Safe to modify independently |
| `frontend/src/app/market-news/page.tsx` | 🟢 LOW | Safe to modify independently |
| `.env` | 🔴 HIGH | Never commit. Each developer uses their own. |

**Golden rule:** The `.env` file is never committed to git. Each developer must create their own `.env` using the template in Section 4.

---

*Document generated: 2026-04-16 | FinSight AI v2.0*
