# FinSight AI Agent — Complete Deployment Guide
### Replicate the Full System on a New Device
**Based on Production State: April 2026 | Maintained by: Harsh**

---

> ## 📋 Purpose of This Guide
>
> This guide walks you through replicating the **FinSight AI Agent** — a domain-specific,
> multi-model, pipeline-driven Financial Intelligence System for the Indian stock market (NSE/BSE) —
> from scratch on any new device. Follow every section in order.
> Nothing is assumed to already be installed.

---

## TABLE OF CONTENTS

1. [System Requirements](#1-system-requirements)
2. [Project Folder Structure](#2-project-folder-structure)
3. [Backend Setup (Python / FastAPI)](#3-backend-setup-python--fastapi)
4. [Frontend Setup (Next.js / TypeScript)](#4-frontend-setup-nextjs--typescript)
5. [Environment Variables & API Keys](#5-environment-variables--api-keys)
6. [Model Configuration (3-Tier Architecture)](#6-model-configuration-3-tier-architecture)
7. [LangGraph Agent Pipeline — Node-by-Node Setup](#7-langgraph-agent-pipeline--node-by-node-setup)
8. [LangChain Tools Setup (Live Data Fetchers)](#8-langchain-tools-setup-live-data-fetchers)
9. [Specialist Prompts Registry](#9-specialist-prompts-registry)
10. [API Endpoints Verification](#10-api-endpoints-verification)
11. [SSE Streaming Integration Check](#11-sse-streaming-integration-check)
12. [Known Issues & Fixes Before You Start](#12-known-issues--fixes-before-you-start)
13. [Running the Full System](#13-running-the-full-system)
14. [Gemini 2.5 Model Upgrade (Optional but Recommended)](#14-gemini-25-model-upgrade-optional-but-recommended)
15. [Post-Deployment Checklist](#15-post-deployment-checklist)

---

## 1. System Requirements

### Hardware
| Component | Minimum | Recommended |
|---|---|---|
| RAM | 8 GB | 16 GB |
| Storage | 5 GB free | 10 GB free |
| CPU | 4 cores | 8 cores |
| Internet | Required | Required (live yFinance calls) |

### Software Prerequisites

Install all of the following on the new device **before** cloning or copying the project:

#### Python
```bash
# Minimum version: Python 3.11+
python --version   # Verify after install
pip --version      # Should come bundled
```
Download from: https://www.python.org/downloads/

#### Node.js & npm
```bash
# Minimum version: Node.js 18+
node --version
npm --version
```
Download from: https://nodejs.org/

#### Git (to clone or copy repo)
```bash
git --version
```
Download from: https://git-scm.com/

#### Windows-specific note
> ⚠️ On Windows, the default FastAPI dev port `8000` may conflict with other services (WinError 10013).
> This project uses **port 8001** instead. Make sure that port is free.

---

## 2. Project Folder Structure

After cloning/copying your project, confirm this structure exists on the new device:

```
finsight-ai/
│
├── backend/
│   └── app/
│       ├── agent/
│       │   ├── graph.py          ← Core LangGraph state machine (~800 lines)
│       │   ├── tools.py          ← 5 async LangChain tools (live data fetchers)
│       │   ├── prompts.py        ← 6 specialist system prompts
│       │   ├── prompt_builder.py ← Dynamic data injection into prompts
│       │   └── agent.py          ← ⚠️ DEPRECATED STUB — do NOT use or modify
│       ├── api/
│       │   └── agent.py          ← HTTP endpoints (blocking + SSE streaming)
│       └── core/
│           └── config.py         ← All model slugs, token budgets, API keys
│
├── frontend/
│   └── src/
│       ├── app/
│       │   └── ai-research/
│       │       └── page.tsx      ← AI chat UI (SSE consumer)
│       └── lib/
│           └── ai.api.ts         ← TypeScript SSE event types + fetch wrapper
│
├── .env                          ← Backend secrets (create this — see Section 5)
├── .env.local                    ← Frontend secrets (create this — see Section 5)
├── requirements.txt              ← Python dependencies
└── package.json                  ← Node dependencies
```

> **Important:** `backend/app/agent/agent.py` is a deprecated stub left over from the old ReAct architecture. Do **not** import from it or run it. The active entry point is `graph.py`.

---

## 3. Backend Setup (Python / FastAPI)

### Step 1 — Navigate to backend directory
```bash
cd finsight-ai/backend
```

### Step 2 — Create a Python virtual environment
```bash
# Create venv
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate
```

### Step 3 — Install all Python dependencies
```bash
pip install -r requirements.txt
```

If `requirements.txt` is missing or incomplete, install these packages manually:

```bash
pip install fastapi uvicorn[standard] langchain langgraph langchain-openai \
            yfinance pandas numpy vaderSentiment httpx python-dotenv \
            feedparser asyncio aiohttp pydantic
```

### Step 4 — Verify key package versions
```bash
pip show langgraph langchain fastapi yfinance
```

Expected working versions (April 2026):
| Package | Minimum Version |
|---|---|
| `fastapi` | 0.110+ |
| `langgraph` | 0.1.0+ |
| `langchain` | 0.2.0+ |
| `langchain-openai` | 0.1.0+ |
| `yfinance` | 0.2.40+ |
| `vaderSentiment` | 3.3.2+ |

---

## 4. Frontend Setup (Next.js / TypeScript)

### Step 1 — Navigate to frontend directory
```bash
cd finsight-ai/frontend
```

### Step 2 — Install all Node dependencies
```bash
npm install
```

### Step 3 — Verify the TypeScript types file exists
Open `src/lib/ai.api.ts` and confirm these event types are defined:

```typescript
type AgentSSEEvent =
  | { type: 'complexity'; complexity: string; model: string }
  | { type: 'status';     message: string }
  | { type: 'result';     content: string; intent: string }
  | { type: 'error';      message: string }
  | { type: 'done' };
```

If this file is missing, recreate it with the types above before proceeding.

---

## 5. Environment Variables & API Keys

This is the most critical step. The system will not start without the correct keys.

### 5.1 Backend — Create `.env` file

Create a file named `.env` inside `finsight-ai/backend/` with the following content:

```env
# ─────────────────────────────────────────────
# OpenRouter Base Config
# ─────────────────────────────────────────────
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=sk-or-v1-YOUR_MAIN_OPENROUTER_KEY_HERE

# ─────────────────────────────────────────────
# Model-Specific API Keys (OpenRouter)
# ─────────────────────────────────────────────
# Nemotron Super 70B (PAID — requires credits in your OpenRouter account)
NVIDIA_NEMOTRON_API_KEY=sk-or-v1-YOUR_NEMOTRON_KEY_HERE

# ─────────────────────────────────────────────
# Optional: Gemini 2.5 (If upgrading — see Section 14)
# ─────────────────────────────────────────────
GEMINI_OPENROUTER_API_KEY=sk-or-v1-YOUR_GEMINI_KEY_HERE

# ─────────────────────────────────────────────
# App Settings
# ─────────────────────────────────────────────
APP_PORT=8001
DEBUG=True
```

> ⚠️ **Nemotron credit warning:** The Nemotron key currently has ~956 tokens of credit remaining,
> which is **below the 1,200 token threshold** required by `handle_general`.
> **Top up credits on OpenRouter before running complex queries.**

### 5.2 Frontend — Create `.env.local` file

Create a file named `.env.local` inside `finsight-ai/frontend/` with:

```env
# Points frontend to backend running on port 8001
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
```

> This was updated from the default `8000` to `8001` due to Windows WinError 10013 port conflicts.

### 5.3 Where to get API Keys

| Key | Where to Get |
|---|---|
| `OPENROUTER_API_KEY` | Sign up at https://openrouter.ai → Keys section |
| `NVIDIA_NEMOTRON_API_KEY` | Same OpenRouter account → add credits for Nemotron |
| `GEMINI_OPENROUTER_API_KEY` | Same OpenRouter account → enable Gemini models |

> **Free models** (Gemma 4, Qwen 3) work with just the main `OPENROUTER_API_KEY`.
> The **Nemotron** model requires a paid balance.

---

## 6. Model Configuration (3-Tier Architecture)

The system routes every query through one of three model tiers. Open `backend/app/core/config.py` and verify these slugs and settings are present:

### Model Slugs
```python
# Tier 1 — Simple (price lookups, JSON classification)
SIMPLE_MODEL = "google/gemma-4-31b-it:free"

# Tier 2 — Medium (single-stock technical analysis, sector news)
MEDIUM_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free"

# Tier 3 — Complex (multi-stock, portfolio strategy, macro)
COMPLEX_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct"
```

### Fallback Chain (3-attempt, explicit)
```python
_LLM_CHAINS = {
    "simple":  [
        "google/gemma-4-31b-it:free",              # Attempt 0 — Primary
        "qwen/qwen3-next-80b-a3b-instruct:free",   # Attempt 1 — Fallback
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Attempt 2 — Final safety
    ],
    "medium":  [
        "qwen/qwen3-next-80b-a3b-instruct:free",   # Attempt 0 — Primary
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Attempt 1 — Fallback
        "google/gemma-4-31b-it:free",              # Attempt 2 — Final safety
    ],
    "complex": [
        "nvidia/llama-3.1-nemotron-70b-instruct",  # Attempt 0 — Primary
        "qwen/qwen3-next-80b-a3b-instruct:free",   # Attempt 1 — Fallback
        "google/gemma-4-31b-it:free",              # Attempt 2 — Final safety
    ],
}
```

### Per-Node Token & Temperature Configuration
```python
NODE_CONFIG = {
    "classify_intent": {"temperature": 0.05, "max_tokens": 200},
    "analyze_stock":   {"temperature": 0.36, "max_tokens": 2500},
    "synthesize_news": {"temperature": 0.40, "max_tokens": 1200},
    "audit_portfolio": {"temperature": 0.34, "max_tokens": 1800},
    "handle_general":  {"temperature": 0.44, "max_tokens": 900},
    "handle_market":   {"temperature": 0.45, "max_tokens": 4000},
}

# Global settings applied to ALL nodes
GLOBAL_LLM_CONFIG = {
    "base_url":  "https://openrouter.ai/api/v1",
    "streaming": False,   # Do NOT set True — causes invoke() issues
    "timeout":   90,      # Seconds — necessary for Nemotron on large contexts
}
```

---

## 7. LangGraph Agent Pipeline — Node-by-Node Setup

Open `backend/app/agent/graph.py` and verify each phase is present and correctly wired.

### Phase 1 — Rule-Based Complexity Classifier
**Function:** `classify_query_complexity(query: str) -> str`

This must run in under 1ms with zero API calls. It uses keyword matching only:

```python
SIMPLE_KEYWORDS  = ["price", "current price", "52 week", "market cap", "what is pe"]
MEDIUM_KEYWORDS  = ["rsi", "sma", "ema", "macd", "technical analysis", "support",
                    "sector", "trend", "best stock", "today in", "news"]
COMPLEX_KEYWORDS = ["compare", "vs", "portfolio", "risk", "diversify",
                    "invest in", "should i", "best etf", "macro", "next year"]
```

Confirm the function returns `"simple"`, `"medium"`, or `"complex"` — nothing else.
This value is stored in `AgentState.query_complexity` and flows through every downstream node.

### Phase 2 — LLM Intent Classifier
**Function:** `classify_intent(state: AgentState) -> AgentState`

Verify the prompt structure:
```python
SYSTEM = """You are a financial query intent classifier for FinSight AI.
Classify the query and return ONLY valid JSON:
{"category": "stock|news|portfolio|market|general", "symbol": "TICKER.NS or null"}"""
```

Confirm error handling is present — if JSON parsing fails, it must default to:
```python
intent_category = "general"
intent_symbol   = None
```

### Phase 3 — Parallel Data Gather Nodes

Confirm `gather_stock_data` uses `asyncio.gather()` for all 4 tool calls simultaneously:
```python
stock_raw, tech_raw, structure_raw, news_raw = await asyncio.gather(
    get_stock_data.ainvoke({"symbol": symbol}),
    get_technical_indicators.ainvoke({"symbol": symbol}),
    get_sector_context.ainvoke({"symbol": symbol}),
    get_financial_news.ainvoke({"query": clean_name}),
)
```

Confirm data key normalization is applied AFTER the gather call:
```python
# These renames must happen before passing to synthesis nodes
"rsi_14"        → "rsi"
"macd_line"     → "macd"
"ema_12"        → "ema_20"
"market_cap_cr" → "market_cap"
```

Confirm `handle_market` fetches all 12 stocks from the screen universe in parallel:
```python
SCREEN_UNIVERSE = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "SBIN.NS",
    "TATASTEEL.NS", "ICICIBANK.NS", "WIPRO.NS", "AXISBANK.NS",
    "BAJFINANCE.NS", "SUNPHARMA.NS", "LT.NS"
]
```

### Phase 4 — Specialist-Prompt Synthesis Nodes

Each synthesis node must follow this rule strictly:
- **Never call tools** — they receive pre-fetched data from Phase 3
- **Never hallucinate** — all prompts include anti-hallucination guards
- **Always end with:** `⚠️ This analysis is for research purposes only — not financial advice.`

Verify the `route_intent()` function correctly maps:
```
intent_category == "stock"     → gather_stock_data   → analyze_stock
intent_category == "news"      → gather_news_data    → synthesize_news
intent_category == "portfolio" → gather_portfolio    → audit_portfolio
intent_category == "market"    → handle_market       (self-contained node)
intent_category == "general"   → handle_general      (no gather needed)
```

---

## 8. LangChain Tools Setup (Live Data Fetchers)

Open `backend/app/agent/tools.py` and verify all 5 tools are present and decorated with `@tool`:

### Tool Checklist

| Tool Name | Input | Key Output Fields |
|---|---|---|
| `get_stock_data` | `symbol: str` | `price`, `pe_ratio`, `market_cap_cr`, `week_52_high/low`, `beta` |
| `get_technical_indicators` | `symbol: str` | `rsi_14`, `sma_20/50`, `ema_12/26`, `macd_line`, `macd_signal_line` |
| `get_financial_news` | `query: str, limit: int` | `title`, `source`, `sentiment`, `published` |
| `get_sector_context` | `symbol: str` | Peer PE ratios, sector index performance |
| `compare_stocks` | `symbols: List[str]` | Side-by-side price, PE, RSI, SMA for up to 5 stocks |

### Critical Implementation Details

All tools must use `asyncio.run_in_executor()` to wrap synchronous yFinance calls:

```python
loop = asyncio.get_event_loop()
data = await loop.run_in_executor(None, yf.Ticker(symbol).info.get)
```

This prevents the async FastAPI server from blocking on yFinance's synchronous HTTP calls.

All tools must return **JSON strings**, not dicts — the gather nodes parse them with `json.loads()`.

---

## 9. Specialist Prompts Registry

Open `backend/app/agent/prompts.py` and verify all 6 prompt constants exist:

| Constant Name | Used In Node | LLM Persona | Output Format |
|---|---|---|---|
| `CLASSIFIER_SYSTEM_PROMPT` | `classify_intent` | JSON Router | Strict JSON only |
| `ANALYST_SYSTEM_PROMPT` | `analyze_stock` | Senior Equity Analyst (15 yrs exp) | Markdown with sections |
| `NEWS_SYNTHESIS_SYSTEM_PROMPT` | `synthesize_news` | Bloomberg Intelligence Analyst | Flowing prose markdown |
| `PORTFOLIO_AUDITOR_SYSTEM_PROMPT` | `audit_portfolio` | Portfolio Risk Advisor | Structured markdown |
| `GENERAL_EDUCATOR_SYSTEM_PROMPT` | `handle_general` | Financial Educator & Macro Advisor | Conversational markdown |
| `MARKET_SCREENER_SYSTEM_PROMPT` | `handle_market` | Market Screener | Ranked markdown list |

### Verify Anti-Hallucination Guards

Every prompt except `CLASSIFIER_SYSTEM_PROMPT` must include all three of these lines verbatim:
```
"Use ONLY the data provided below. Never fabricate prices, ratios, or news."
"Be direct and cite real numbers from the data."
"End every response with: ⚠️ This analysis is for research purposes only — not financial advice."
```

---

## 10. API Endpoints Verification

Open `backend/app/api/agent.py` and confirm both endpoints exist.

### Blocking Endpoint
```
POST /api/v1/agent/query
```

Expected response shape:
```json
{
  "response":          "## IT Sector Analysis\n\n...",
  "intent":            "general",
  "symbol":            null,
  "complexity":        "complex",
  "model_used":        "nvidia/llama-3.1-nemotron-70b-instruct",
  "processing_time_ms": 4250
}
```

### SSE Streaming Endpoint
```
POST /api/v1/agent/stream
```

Expected event sequence:
```
event: complexity
data: {"complexity": "complex", "model": "Nemotron Super 70B"}

event: status
data: {"message": "Fetching live market data..."}

event: result
data: {"content": "## Analysis...", "intent": "general"}

event: done
data: {}
```

### Test both endpoints after startup
```bash
# Blocking test
curl -X POST http://127.0.0.1:8001/api/v1/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is TCS price?", "portfolio_context": []}'
```

---

## 11. SSE Streaming Integration Check

Open `frontend/src/app/ai-research/page.tsx` and verify:

1. The frontend connects to the SSE endpoint using `EventSource` or `fetch` with streaming
2. The model badge logic reads from the `complexity` event:

```typescript
// Verify this badge mapping is present
const MODEL_BADGES = {
  simple:  "🌱 Gemma 4 31B",       // green badge
  medium:  "🔮 Qwen3 80B",         // purple badge
  complex: "🚀 Nemotron Super 70B", // blue badge
};
```

3. The `result` event appends content to the chat UI as it streams
4. The `error` event displays a visible error message (not a silent failure)

---

## 12. Known Issues & Fixes Before You Start

Address these **before your first test run** to avoid confusion:

### Issue 1 — Nemotron Credit Exhaustion (CRITICAL)
**Symptom:** `402 - You requested up to 1200 tokens, but can only afford 956.`
**Fix:** Log into OpenRouter → Billing → Top up credits for the Nemotron key.
Minimum recommended top-up: **$5 USD** to cover extended testing.

### Issue 2 — Qwen 3 Rate Limiting (HIGH)
**Symptom:** `429 - qwen/qwen3-next-80b-a3b-instruct:free is temporarily rate-limited upstream.`
**Fix A:** Add your own Qwen API key in OpenRouter settings for a dedicated rate limit.
**Fix B:** Replace Qwen 3 in the medium tier with Gemini 2.5 Flash (see Section 14).

### Issue 3 — `detect_setup` is a Stub (MEDIUM)
**Location:** `graph.py`, called inside `gather_stock_data`
**Symptom:** Trading setup section in stock analysis is always empty.
**Fix:** This is a known incomplete feature. RSI/MACD crossover detection needs to be
implemented. For now, the system continues functioning — setup detection just returns `{}`.

### Issue 4 — Port Conflict on Windows (HIGH)
**Symptom:** `OSError: [WinError 10013]` on startup
**Fix:** Always run the backend on port `8001`:
```bash
uvicorn app.main:app --reload --port 8001
```
And confirm `frontend/.env.local` points to `http://127.0.0.1:8001`.

---

## 13. Running the Full System

### Step 1 — Start the Backend
```bash
# From finsight-ai/backend/
# Activate your virtual environment first!

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

# Start server
uvicorn app.main:app --reload --port 8001
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### Step 2 — Start the Frontend (separate terminal)
```bash
# From finsight-ai/frontend/
npm run dev
```

You should see:
```
▲ Next.js 14.x
- Local: http://localhost:3000
```

### Step 3 — Open the App
Navigate to: `http://localhost:3000/ai-research`

### Step 4 — Test Each Intent Category

Run one query from each category to verify the full pipeline:

| Test Query | Expected Intent | Expected Tier |
|---|---|---|
| `"What is TCS price?"` | `stock` | `simple` |
| `"Show RSI and MACD for Infosys"` | `stock` | `medium` |
| `"Compare TCS vs Wipro for investment"` | `stock` | `complex` |
| `"Latest news on HDFC Bank"` | `news` | `medium` |
| `"What is a P/E ratio?"` | `general` | `complex` |
| `"Best IT stocks today"` | `market` | `medium` |

---

## 14. Gemini 2.5 Model Upgrade (Optional but Recommended)

The current Gemma 4 and Qwen 3 free models have reliability issues (congestion, rate limits).
Switching to Gemini 2.5 resolves both.

### Why Upgrade

| Capability | Gemma 4 31B (Current) | Gemini 2.5 Flash (Proposed) |
|---|---|---|
| JSON adherence | Good (sometimes adds extra text) | Excellent (native JSON mode) |
| Context window | ~32K tokens | 1M tokens |
| TTFT (speed) | ~1.5s | ~0.8s |
| Cost per 1M tokens | Free (congested) | ~$0.075 |
| Rate limits | Heavy congestion | Generous quota |

### Step 1 — Add Gemini key to `.env`
```env
GEMINI_OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
```

### Step 2 — Update `_LLM_CHAINS` in `config.py`
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

### Step 3 — Switch `classify_intent` to always use Gemini Flash

In `graph.py`, find the `classify_intent` function and hardcode it to use Gemini Flash
regardless of the query's complexity tier:

```python
# In classify_intent(), override model selection:
llm = _get_llm("classify_intent", model_override="google/gemini-2.5-flash")
```

This immediately improves routing accuracy across the whole pipeline because the
classifier gets better JSON adherence.

---

## 15. Post-Deployment Checklist

Run through every item below before handing off or declaring the deployment complete:

### Environment
- [ ] Python 3.11+ installed and `python --version` confirmed
- [ ] Node.js 18+ installed and `node --version` confirmed
- [ ] Virtual environment created and activated in `backend/`
- [ ] All Python packages installed (`pip install -r requirements.txt`)
- [ ] All Node packages installed (`npm install` in `frontend/`)

### Configuration
- [ ] `backend/.env` file created with all required keys
- [ ] `frontend/.env.local` points to `http://127.0.0.1:8001`
- [ ] Nemotron credit balance checked and topped up if below 1,200 tokens
- [ ] `_LLM_CHAINS` fallback dict verified in `config.py`
- [ ] Port `8001` confirmed free on the new device

### Files
- [ ] `graph.py` present and NOT importing from deprecated `agent.py`
- [ ] `tools.py` contains all 5 `@tool`-decorated async functions
- [ ] `prompts.py` contains all 6 specialist prompt constants
- [ ] `prompt_builder.py` present for dynamic data injection
- [ ] Frontend `ai.api.ts` contains all 5 `AgentSSEEvent` types

### Pipeline Validation
- [ ] Simple query (`TCS price`) returns in under 3 seconds
- [ ] Medium query (`RSI for Infosys`) returns technical analysis with real numbers
- [ ] Complex query (`Compare TCS vs Wipro`) uses Nemotron and returns structured markdown
- [ ] Market query (`Best IT stocks today`) fetches all 12 stocks from SCREEN_UNIVERSE
- [ ] All responses end with the disclaimer: `⚠️ This analysis is for research purposes only`
- [ ] SSE stream shows model badge before response renders

### Known Stubs to Address
- [ ] `detect_setup()` — returns empty `{}` — implement RSI/MACD crossover logic later
- [ ] `gather_portfolio_data()` — placeholder; portfolio data comes from frontend payload

---

## Appendix: Quick Reference — File Map

| File | Purpose |
|---|---|
| `backend/app/agent/graph.py` | Core LangGraph state machine (~800 lines) |
| `backend/app/agent/tools.py` | 5 async LangChain tools (live data fetchers) |
| `backend/app/agent/prompts.py` | 6 specialist system prompts |
| `backend/app/agent/prompt_builder.py` | Dynamic data injection into prompts |
| `backend/app/api/agent.py` | HTTP endpoints (blocking + SSE streaming) |
| `backend/app/core/config.py` | All model slugs, token budgets, API keys |
| `backend/app/agent/agent.py` | ⚠️ DEPRECATED STUB — do not use |
| `frontend/src/app/ai-research/page.tsx` | AI chat UI (SSE consumer) |
| `frontend/src/lib/ai.api.ts` | TypeScript SSE event types + fetch wrapper |

---

## Appendix: Emergency Fallback Behaviour

If all 3 LLM attempts fail for any reason (quota, downtime, network), the system **does not crash**.
Each synthesis node has a hardcoded fallback:

| Node | What It Returns on Total Failure |
|---|---|
| `analyze_stock` | Raw price and RSI data as plain text |
| `synthesize_news` | Article count + "please check News tab" |
| `handle_general` | "I encountered an error, please try again" |
| `handle_market` | Screened stock count + "AI interpretation unavailable" |

The server always returns **something** to the user.

---

*Deployment Guide compiled by Harsh — April 2026.*
*Reflects production codebase as documented in `Latest_Update_Harsh.md`.*
*Review this guide again after: Nemotron credit top-up, `detect_setup` implementation, and any model tier upgrades.*