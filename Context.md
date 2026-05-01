# FinSight AI — Context Document Part 1: System Overview & Problems Identified

> **Purpose:** This document provides a complete contextual overview of the FinSight AI Agent system,
> the core architecture, and the specific problems that were identified during a detailed design
> review session. Another AI reading this document should be able to fully understand the system
> before making any changes.
>
> **Companion Files:**
> - `Context_Part2_Migration_Decisions.md` — Model choices, provider strategy, API key management
> - `Context_Part3_Implementation_Guide.md` — Step-by-step implementation plan and Claude prompts

---

## 1. What is FinSight AI?

FinSight AI is a **production-grade financial research dashboard** for the Indian stock market (NSE/BSE).
It is a full-stack monorepo:

- **Backend:** FastAPI (Python) — AI agents, portfolio management, live market data, alerts
- **Frontend:** Next.js 14 (TypeScript) — dark-themed dashboard UI

The system fetches live market data from Yahoo Finance (yFinance), runs technical analysis (RSI, SMA, EMA,
MACD), manages portfolios in Supabase (PostgreSQL), and performs AI-powered stock analysis using LLMs
via a LangGraph pipeline.

---

## 2. The AI Pipeline — Core Architecture (4 Phases)

The AI pipeline is the heart of the system. It is a **specialist-prompt LangGraph state machine** located
at `backend/app/agent/graph.py`. The pipeline follows 4 sequential phases:

### Phase 1 — Rule-Based Complexity Classifier (`classify_query_complexity`)
- **What it does:** Classifies the user's query into `simple`, `medium`, or `complex` using pure
  Python keyword matching — **no LLM call, no network, executes in <1ms.**
- **Output:** A string — `"simple"`, `"medium"`, or `"complex"` — stored in `AgentState.query_complexity`.
- **Simple keywords:** `"price"`, `"market cap"`, `"52 week"`, `"p/e ratio"`, etc.
- **Complex keywords:** `"compare"`, `"portfolio"`, `"risk"`, `"macro"`, `"inflation"`, `"long term"`, etc.
- **Medium:** Everything else defaults to medium.

> ⚠️ **Known Bug (Identified in Review):** The keyword list was incomplete. Queries like
> `"Analyze RELIANCE for long term"` were mis-classified as `simple` because `"long term"` was
> NOT in the COMPLEX_KEYWORDS list. This caused wrong model selection in downstream phases.

### Phase 2 — LLM Intent Classifier (`classify_intent`)
- **What it does:** Takes the user's natural language query and extracts **three pieces of structured data**:
  1. `category` — one of `stock`, `news`, `portfolio`, `market`, or `general`
  2. `symbol` — normalized NSE ticker (e.g., `"RELIANCE.NS"`) or `null`
  3. `confidence` — float in `[0.0, 1.0]`
- **Output format:** Strict JSON: `{"category": "stock", "symbol": "TCS.NS", "confidence": 0.9}`
- **Previous model used:** Gemma 4 31B via OpenRouter (Google AI)
- **Why this phase is critical:** Without this, the pipeline wouldn't know which tools to call or
  which specialist LLM persona to activate.
- **Analogy:** Think of it as a hospital receptionist — it listens to the patient (user query) and
  routes them to the correct specialist doctor (synthesis node).

> ⚠️ **Known Bottleneck:** Phase 2 was taking **5–10 seconds** using Gemma 4 31B via OpenRouter.
> This is far too slow for what is essentially a JSON routing task (~30–50 tokens output).

### Phase 3 — Parallel Data Gathering (`gather_stock_data`, `gather_news_data`, etc.)
- **What it does:** Based on the intent from Phase 2, the correct data-gathering node fires.
- **Key node — `gather_stock_data`:** Uses `asyncio.gather()` to fetch **4 data sources simultaneously**:
  - `get_stock_data(symbol)` — current price, PE, market cap
  - `get_technical_indicators(symbol)` — RSI-14, SMA-20/50, EMA-12/26, MACD
  - `get_financial_news(query)` — latest news headlines with VADER sentiment
  - `get_sector_context(symbol)` — peer PE ratios, sector index performance
- **Key node — `handle_market`:** Fetches 12 NSE stocks from `SCREEN_UNIVERSE` in parallel
  (24 simultaneous yFinance calls). Reduces screening time from ~60s (sequential) to ~5s (parallel).
- **Typical latency:** 3–8 seconds (network-bound by yFinance)

### Phase 4 — Specialist-Prompt Synthesis (multiple nodes)
- **What it does:** Passes the gathered data to a specialist LLM node that synthesizes a markdown
  response using a role-specific persona and system prompt.
- **Nodes and their personas:**

| Node | LLM Persona | Token Budget |
|---|---|---|
| `analyze_stock` | Senior Equity Research Analyst | 2500 tokens |
| `synthesize_news` | Financial Journalist / Bloomberg Analyst | 1200 tokens |
| `audit_portfolio` | Portfolio Risk Advisor | 1800 tokens |
| `handle_general` | Financial Educator | 900 tokens |
| `handle_market` | Quantitative Market Screener | 4000 tokens |

- **Typical latency (before optimization):** 10–20 seconds
- **Why so slow:** 2500 token budgets + slow models via OpenRouter + 90s timeout

---

## 3. The LangGraph State — `AgentState`

All data flows between nodes via the `AgentState` TypedDict (defined in `graph.py`):

```python
class AgentState(TypedDict):
    query: str                   # User's original question
    intent_category: str         # "stock" | "news" | "portfolio" | "market" | "general"
    intent_symbol: Optional[str] # Normalized ticker, e.g., "TCS.NS"
    intent_confidence: float     # 0.0–1.0
    query_complexity: str        # "simple" | "medium" | "complex"
    gathered_data: dict          # All tool results from Phase 3
    final_response: str          # Final markdown answer from Phase 4
    error: Optional[str]         # Error message if something failed
```

**Key insight for context management:** LLMs are stateless — they don't remember anything between calls.
The `AgentState` acts as the "shared folder" that every node reads from and writes to. When the system
switches from one LLM to another (e.g., from Gemma to Gemini), the new LLM receives the entire state
(including previous messages) as input. It doesn't know or care which model wrote previous entries —
it simply reads them as "Assistant" messages.

---

## 4. The Model Routing System (`_get_llm` function)

Located in `graph.py`, the `_get_llm(node_name, complexity, fallback_index)` function determines
which LLM instance to return for a given node call.

### Pre-Migration Model Tiers (via OpenRouter)
```
simple  → google/gemma-4-31b-it:free
medium  → qwen/qwen3-next-80b-a3b-instruct:free
complex → nvidia/llama-3.1-nemotron-70b-instruct
```

### 3-Attempt Fallback Chain (per complexity tier)
```python
_LLM_CHAINS = {
    "simple":  ["google/gemma-4-31b-it:free",  "qwen/qwen3-next-80b-a3b-instruct:free", "nvidia/llama-3.1-nemotron-70b-instruct"],
    "medium":  ["qwen/qwen3-next-80b-a3b-instruct:free", "nvidia/llama-3.1-nemotron-70b-instruct", "google/gemma-4-31b-it:free"],
    "complex": ["nvidia/llama-3.1-nemotron-70b-instruct", "qwen/qwen3-next-80b-a3b-instruct:free", "google/gemma-4-31b-it:free"],
}
```

On HTTP 402 or 429 (quota exhaustion), `fallback_index` increments and the next model in the chain is tried.

---

## 5. The Core Problem — Why This Needs to Change

### Problem 1: OpenRouter Downtime (9 AM – 6 PM IST)
OpenRouter is an **aggregator/middleman** — it does not run its own hardware. It routes requests
to third-party providers (Groq, Together, Fireworks, etc.) via a shared pool. During Indian market
hours (9 AM – 6 PM), global traffic on OpenRouter's free tier spikes, causing:
- Repeated 429 (rate limit exceeded) errors
- 402 (insufficient credits) errors
- Complete request failures with no response

This is catastrophic for a financial dashboard where users need real-time analysis during market hours.

### Problem 2: Phase 2 Takes 5–10 Seconds
The classify_intent node was doing a **full LLM API call** just to extract a JSON object like:
`{"category": "stock", "symbol": "TCS.NS"}`.

This is wasteful because:
- Gemma 4 31B is a "reasoning" model, overkill for JSON extraction
- OpenRouter adds network overhead on top of model latency
- The output is only ~30–50 tokens — a regex could handle many cases instantly

### Problem 3: Wrong Complexity Routing
Because `"long term"` was not in `COMPLEX_KEYWORDS`, a query like `"Analyze RELIANCE for long term"`
was classified as `simple` → routed to Gemma 4 (a slow model for generation) → incorrect tier used
for synthesis → poor quality + slow response.

### Problem 4: 90-Second Provider Timeouts
If a model hangs or a provider is slow, the system would wait **90 seconds** before falling back to
the next model. This is completely unacceptable for a user-facing financial dashboard.

---

## 6. Total Latency Breakdown (Before Any Fixes)

```
Query: "Analyze RELIANCE for long term"

├── Phase 1 (complexity classify):  <1ms    ← free, keyword matching
├── Phase 2 (classify_intent LLM):  5-10s   ← entire LLM call for JSON extraction
│   └── Gemma 4 31B via OpenRouter
├── Phase 3 (gather_stock_data):    3-8s    ← 4 concurrent yfinance calls
└── Phase 4 (analyze_stock LLM):   10-20s  ← 2500 token generation, 90s timeout
    └── Wrongly routed to "simple" → Gemma 4 (slow for generation)

TOTAL ESTIMATED: 18–38 seconds
```

This is the baseline. The goal after optimization is **sub-8 seconds** end-to-end.

---

## 7. Key Files for Any AI Working on This System

| File | Purpose | Priority |
|---|---|---|
| `backend/app/agent/graph.py` | Core LangGraph state machine (~800 lines) | **HIGHEST** |
| `backend/app/core/config.py` | All model slugs, token budgets, API keys | **HIGHEST** |
| `backend/app/agent/prompts.py` | 6 specialist system prompts | HIGH |
| `backend/app/agent/prompt_builder.py` | Dynamic data injection into prompts | HIGH |
| `backend/app/agent/tools.py` | 5 async LangChain tools (live data fetchers) | HIGH |
| `backend/app/api/agent.py` | HTTP endpoints (blocking + SSE streaming) | MEDIUM |
| `backend/.env` | API keys (NEVER commit) | CRITICAL |

---

## 8. What Must NOT Be Changed

Per the project's strict rules (`GEMINI.md`):
- The overall **4-Phase LangGraph flow** must remain intact
- The **9-node graph topology** must not be restructured
- The **`AgentState` field names** must remain backward compatible
- The **SSE streaming event types** (`complexity`, `status`, `classified`, `chunk`, `result`, `done`, `error`)
  must remain unchanged as the frontend depends on them
- Do NOT modify `api/agent.py`, `api/portfolio.py`, or any other existing API endpoints —
  only ADD to them if needed

---

*Read `Context_Part2_Migration_Decisions.md` next for model selection rationale and provider strategy.*


# FinSight AI — Context Document Part 2: Migration Decisions & Model Strategy

> **Purpose:** This document records every decision made during the design review about model
> selection, direct provider strategy, multi-key management, and the hybrid optimization approach.
> An AI reading this should understand WHY each choice was made — not just what was chosen.
>
> **Read Part 1 first:** `Context_Part1_System_Overview.md`
> **Read Part 3 next:** `Context_Part3_Implementation_Guide.md`

---

## 1. The Root Decision: Eliminate OpenRouter Completely

### Why OpenRouter Must Go
OpenRouter is a **third-party aggregator** — it does not own any compute hardware. It re-routes
requests to actual providers (Groq, Together AI, Fireworks, etc.) through a **shared free-tier pool**.

During Indian market hours (9 AM – 6 PM IST), this shared pool fills up because thousands of
global users hit the same endpoints simultaneously, causing:
- HTTP 429 (rate limit exceeded) on a shared, not personal, quota
- HTTP 402 (insufficient credits) mid-request
- Silent hangs where the request never completes (90s timeout then fails)

**Direct Provider APIs solve this** because each account on Google AI Studio, Groq Cloud, or
NVIDIA Build gets its own **personal dedicated quota** that is unaffected by global traffic spikes.

### Key Analogy Used in the Review
> OpenRouter = Shopping mall parking lot (shared, gets full during rush hour)
> Direct API = Your own personal parking spot (always available regardless of mall traffic)

---

## 2. Direct Provider Selection — The Three-Provider Strategy

After comparing models on speed, intelligence, stability, and free-tier limits, the following
**three direct providers** were chosen to replace OpenRouter:

### Provider 1: Google AI Studio → Gemini 2.5 Flash
**Used for:** Phase 2 (Intent Classifier) and News Synthesis node

| Attribute | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| Provider URL | https://aistudio.google.com |
| Free Tier Rate Limit | 10–15 RPM, 250 RPD |
| Intelligence Index | 20.6 (42%) — moderate |
| Latency (TTFT) | 0.56s — ultra-fast |
| Context Window | 1.05M tokens |
| Key Advantage | **Native JSON Mode** — outputs only valid JSON, zero extra text |
| SDK | `langchain-google-genai` → `ChatGoogleGenerativeAI` |

**Why chosen for Phase 2 (Intent Classifier):**
- Phase 2 only outputs ~30–50 tokens (a JSON object) — it does NOT need high reasoning
- Native JSON Mode eliminates the "extra text" bug where Gemma 4 was adding prose around JSON,
  causing `json.loads()` to crash and triggering retries
- 0.56s TTFT = the user barely notices Phase 2 happening
- Google's infrastructure has near-zero downtime compared to OpenRouter's peak-hour congestion

**Why NOT used for Phase 4 (Stock Analysis):**
- Intelligence index of 20.6 (42%) is insufficient for deep financial reasoning
- A 51.5 intelligence model is required for multi-step stock analysis

---

### Provider 2: Groq Cloud → Llama 3.3 70B or Qwen 2.5 72B
**Used for:** Phase 4 (Synthesis nodes — analyze_stock, synthesize_news, audit_portfolio)

| Attribute | Value |
|---|---|
| Models Available | `llama-3.3-70b-versatile`, `qwen-2.5-72b`, `mixtral-8x7b` |
| Provider URL | https://console.groq.com |
| Free Tier Rate Limit | 30–60 RPM, ~1000 RPD |
| Key Technology | **LPU (Language Processing Unit)** — custom hardware chips |
| Token Speed | 500+ tokens/second |
| SDK | `langchain-groq` → `ChatGroq` |

**Why Groq is the synthesis engine:**
- LPU hardware generates tokens at 500+ tokens/sec — 5–10x faster than GPU-based providers
- Where OpenRouter took 10–20 seconds for 2500 tokens, Groq completes it in **2–3 seconds**
- Groq is NOT an aggregator — they own and operate their own LPU infrastructure
  → No shared pool, no morning congestion problem

**Why Groq won't have the same downtime issue as OpenRouter:**
> OpenRouter routes your request through 3rd-party providers (including Groq!).
> When you use Groq directly, you bypass OpenRouter entirely and get a personal account quota
> that doesn't fluctuate with global traffic. Groq's own infrastructure has been proven more
> stable than OpenRouter's shared tier.

**The user already has a Groq general API key** — this is confirmed and ready to use.

---

### Provider 3: NVIDIA Build (NIM) → Qwen 3.5 397B-A17B or Nemotron
**Used for:** Complex tier queries as top-tier fallback

| Attribute | Value |
|---|---|
| Model | `Qwen 3.5 397B-A17B` (MoE architecture) |
| Provider URL | https://build.nvidia.com |
| Default Rate Limit | ~40 RPM per account |
| Intelligence | Very high — 397B total params, 17B active per token |
| OpenAI Compatibility | Yes — uses OpenAI-compatible endpoints |
| SDK | `langchain-nvidia-ai-endpoints` OR standard `ChatOpenAI` with NVIDIA base URL |

**Why Qwen 3.5 397B-A17B:**
- MoE (Mixture of Experts) architecture: 397B total parameters, 17B active
  → Gets intelligence of a 397B model at the speed of a 17B model
- Intelligence Index: 45.0 (89%) — excellent for complex financial reasoning
- NVIDIA's infrastructure is industrial-grade (enterprise-level SLA)

**Multiple keys strategy for NVIDIA:**
> NVIDIA rate limits are per-account (not per-key). To get higher throughput via Round Robin,
> the user needs 3–4 different NVIDIA accounts (different email/phone). 5 accounts = ~200 RPM
> total effective capacity.

---

## 3. Final Model Assignment Per Phase

| Phase | Node | Model | Provider | Rationale |
|---|---|---|---|---|
| Phase 1 | `classify_query_complexity` | Pure Python regex | No API call | <1ms, free |
| Phase 2 | `classify_intent` | `gemini-2.5-flash` | Google AI Studio | 0.56s, native JSON |
| Phase 3 | `gather_*` nodes | No LLM | yFinance/feedparser | Deterministic data |
| Phase 4 (simple) | `analyze_stock` | `llama-3.3-70b-versatile` | Groq | Fast LPU generation |
| Phase 4 (medium) | `synthesize_news` | `llama-3.3-70b-versatile` | Groq | Fast LPU generation |
| Phase 4 (complex) | `analyze_stock` | `qwen-3.5-397b` | NVIDIA Build | Highest intelligence |
| Fallback | Any synthesis | `gemini-2.5-flash` | Google AI Studio | Always available |

---

## 4. Multi-Key Round-Robin Strategy

### Why Multiple Keys?
Even with direct provider APIs, a single API key has rate limits. To achieve 24/7 stability
and handle traffic bursts (e.g., during market open at 9:15 AM IST), the system should rotate
across **multiple keys from the same provider** (from different accounts).

### How Round-Robin Works

**Conceptually:**
```
Request 1 → GOOGLE_API_KEY_1
Request 2 → GOOGLE_API_KEY_2
Request 3 → GOOGLE_API_KEY_3
Request 4 → GOOGLE_API_KEY_1  ← cycles back
```

If any key returns HTTP 429 (rate limited), the system **immediately rotates to the next key
and retries** without returning an error to the user.

**Expected capacity with multiple keys:**

| Provider | Keys | RPM Per Key | Total RPM |
|---|---|---|---|
| Google AI Studio | 5 keys | 15 RPM | **75 RPM** |
| Groq Cloud | 3 keys | 30 RPM | **90 RPM** |
| NVIDIA Build | 4 accounts | 40 RPM | **160 RPM** |

This gives the system enough headroom even on the busiest market days.

### Where Keys Live — `.env` Structure
```env
# Google Gemini — Multiple keys as comma-separated list
GOOGLE_API_KEYS=key1,key2,key3,key4,key5

# Groq — Multiple keys as comma-separated list
GROQ_API_KEYS=key1,key2,key3

# NVIDIA Build — Single key (different accounts needed for more)
NVIDIA_API_KEY=nvapi-xxxx

# DeepSeek (optional paid tier for highest-intelligence fallback)
DEEPSEEK_API_KEY=sk-ds-xxxx
```

### The `KeyManager` Class (New File: `backend/app/core/key_manager.py`)
This new utility module handles all key rotation logic. Its responsibilities:
1. Parse comma-separated keys from `.env` into Python lists at startup
2. Maintain a rotating index per provider (`google_index`, `groq_index`, etc.)
3. On each call, return the next key in the list (thread-safe with a lock or atomic increment)
4. On HTTP 429, increment the index immediately and retry with the next key
5. Expose a simple API: `KeyManager.get_google_key()`, `KeyManager.get_groq_key()`, etc.

---

## 5. Parallel Execution in Phase 4 (Multi-Key Parallelism)

### The Concept
Instead of having one LLM write the entire financial report sequentially (taking 20s), the Phase 4
synthesis can be split into **3 parallel sub-tasks** that each run on a different API key simultaneously:

```
Phase 4 (Parallel)
├── Branch A: Technical Analysis  → Key 1 (Groq) → RSI, MACD, trend signals
├── Branch B: News Sentiment      → Key 2 (Google) → headline analysis
└── Branch C: Fundamental Ratios → Key 3 (Groq) → PE, market cap, beta

All three branches run via asyncio.gather() simultaneously
Result: All finish in ~0.8s instead of 3 × 0.8s = 2.4s sequentially
```

**Status:** This is a **planned enhancement** — it's more complex and should be implemented AFTER
the basic direct-API migration is stable.

---

## 6. Context Retention Between Model Switches

### The Problem
When the system switches from one model (e.g., Gemma for a simple query) to another (e.g., Gemini
for a medium query), how does the new model know what was discussed before?

### The Solution — AgentState as "Shared Folder"
- All models read from and write to the same `AgentState`
- The `gathered_data` dict carries all tool results (ticker symbol, RSI, news, etc.)
- Previous LLM responses are stored as `BaseMessage` objects in `messages` list
- When a new model is called, the full `messages` list is passed as context
- The new model reads previous entries as plain "AI assistant" messages — it doesn't care which
  model generated them

### Token-Efficient Context Management (3 Approaches Decided)

#### Approach 1: Metadata Persistence (Recommended for FinSight)
Instead of passing raw conversation paragraphs, store only structured variables:
```python
# In AgentState — store metadata, not full history
current_ticker: str        # e.g., "TCS.NS"
last_rsi: float            # e.g., 45.2
last_sentiment: str        # e.g., "NEUTRAL"
user_focus: str            # e.g., "technical"
```
**Token saving:** ~70–80% fewer tokens per model call.

#### Approach 2: Sliding Window Memory
Pass only the last 3–5 messages to each model instead of full history.
Best for: Standard financial queries where follow-ups reference only the immediate prior exchange.

#### Approach 3: Incremental Summarization Node
When message count exceeds 10, a lightweight model (Gemma) runs once to compress the history
into a 200-token summary. The summary replaces the raw history for all future calls.
Best for: Long research sessions (e.g., portfolio deep-dives).

---

## 7. LLM Intelligence Comparison (April 2026 Benchmarks)

| Model | Intelligence Index | Latency | Context | Best Use In FinSight |
|---|---|---|---|---|
| Gemini 2.5 Flash | 20.6 (42%) | 0.56s | 1.05M | Phase 2 — fast JSON routing |
| Qwen 3.5 397B A17B | 45.0 (89%) | 1.65s | 262K | Phase 4 — complex analysis |
| DeepSeek V4 Pro | 51.5 (96%) | 1.82s | 1.05M | Phase 4 — highest reasoning |
| Llama 3.3 70B (Groq) | ~38 (75%) | 0.8s | 128K | Phase 4 — fast generation |

**Design principle agreed upon:**
> Use the **cheapest/fastest** model that is sufficient for the task.
> Do NOT use high-reasoning models for simple classification.
> Save high-intelligence models (DeepSeek, Qwen 397B) for Phase 4 deep analysis only.

---

## 8. How to Get API Keys (Summary)

| Platform | URL | Models | Key Type | Notes |
|---|---|---|---|---|
| Google AI Studio | aistudio.google.com | Gemini 2.5 Flash/Pro | Free | Click "Get API key" → "Create API key" |
| Groq Cloud | console.groq.com | Llama, Qwen, Mixtral | Free | Click "API Keys" → "Create API Key" |
| NVIDIA Build | build.nvidia.com | Qwen 3.5, Nemotron, Llama | Free w/ phone verify | Go to model page → "Get API Key" |
| DeepSeek AI | platform.deepseek.com | DeepSeek V3/R1 | Paid credits | Navigate to "API Keys" → "Create" |
| Together AI | together.ai | Many open-source | Free + paid | Settings → API Keys |

**User's current key inventory:**
- ✅ Groq general API key — confirmed available
- ✅ Multiple Google/Gemini keys — multiple accounts already exist (`Gemma_4_API_KEY_1`, etc. in `.env`)
- ✅ DeepSeek V4 API key — exists in `.env` (`Deepseek_V4API_KEY`)
- ❌ NVIDIA Build key — needs to be generated

---

*Read `Context_Part3_Implementation_Guide.md` for the exact step-by-step implementation plan.*


# FinSight AI — Context Document Part 3: Implementation Guide

> **Purpose:** This document provides the exact step-by-step implementation plan for:
> 1. Removing OpenRouter completely from the pipeline
> 2. Integrating direct provider APIs (Google, Groq, NVIDIA)
> 3. Applying the hybrid latency optimizations (regex fast-path, timeout fixes, keyword expansion)
>
> This document was compiled from a design review conversation and is the **handoff document**
> for the implementing AI (Claude Sonnet or equivalent).
>
> **Read first:** `Context_Part1_System_Overview.md` → `Context_Part2_Migration_Decisions.md`

---

## SECTION A: What Must Be Done (Summary of All Changes)

The migration is broken into **5 ordered steps**. They must be executed in sequence because each
step is a dependency for the next.

| Step | What | Files Changed |
|---|---|---|
| 1 | Remove OpenRouter, install direct SDKs, restructure `.env` | `.env`, `requirements.txt` |
| 2 | Create `KeyManager` class for round-robin rotation | `backend/app/core/key_manager.py` (NEW) |
| 3 | Refactor `config.py` to use native model IDs | `backend/app/core/config.py` |
| 4 | Refactor `_get_llm()` in `graph.py` to use direct providers | `backend/app/agent/graph.py` |
| 5 | Apply hybrid optimizations (regex fast-path, timeout, keywords) | `backend/app/agent/graph.py` |

---

## SECTION B: Step-by-Step Implementation

### Step 1 — Environment & Dependencies

#### 1A: Install Direct Provider SDKs
Run from the project root inside the activated `.venv`:
```bash
pip install langchain-google-genai langchain-groq langchain-nvidia-ai-endpoints
```

> **Note:** Do NOT uninstall `langchain-openai` yet — it is still used by `ai/analyst.py`
> (the AnalystAgent for stock detail pages). Only remove it if confirmed unused elsewhere.

#### 1B: Restructure `.env` File
Add the following new keys to the existing `.env`. Keep all existing keys untouched.

```env
# ─── Direct Provider Keys (New — Replacing OpenRouter) ───────────────────────

# Google AI Studio — Multiple accounts for Round Robin (15 RPM each)
# Get from: https://aistudio.google.com → Get API key → Create API key
GOOGLE_API_KEYS=AIzaSy_KEY1_HERE,AIzaSy_KEY2_HERE,AIzaSy_KEY3_HERE

# Groq Cloud — Multiple keys for Round Robin (30 RPM each)
# Get from: https://console.groq.com → API Keys → Create API Key
GROQ_API_KEYS=gsk_KEY1_HERE,gsk_KEY2_HERE

# NVIDIA Build — Qwen 3.5 397B / Nemotron (40 RPM per account)
# Get from: https://build.nvidia.com → select model → Get API Key
NVIDIA_API_KEY=nvapi-xxxx

# ─── Model IDs for Direct Providers ──────────────────────────────────────────
GEMINI_FLASH_MODEL=gemini-2.5-flash
GROQ_MEDIUM_MODEL=llama-3.3-70b-versatile
GROQ_SIMPLE_MODEL=llama-3.3-70b-versatile
NVIDIA_COMPLEX_MODEL=qwen/qwen3-235b-a22b

# ─── Remove or comment out these old OpenRouter entries ──────────────────────
# OPENROUTER_BASE_URL=https://openrouter.ai/api/v1        ← DELETE
# NVIDIA_NEMOTRON_3_SUPER_API_KEY=sk-or-v1-xxxx           ← DELETE
# NVIDIA_NEMOTRON_3_NANO_API_KEY=sk-or-v1-xxxx            ← DELETE
# QWEN_3_API_KEY=sk-or-v1-xxxx                            ← DELETE
# GEMMA_API_KEY=sk-or-v1-xxxx                             ← DELETE
```

> ⚠️ **The existing Google Gemini keys** (`Gemma_4_API_KEY_1`, `Gemma_4_API_KEY_2`,
> `Gemini_API_KEY_1` through `Gemini_API_KEY_5`) in `.env` are Google AI Studio keys.
> These SHOULD be reused — parse them into `GOOGLE_API_KEYS` as a comma-separated list
> or reference them individually in `KeyManager`.

---

### Step 2 — Create `KeyManager` (New File)

**File:** `backend/app/core/key_manager.py` ← **CREATE THIS FILE**

**Responsibilities:**
- Parse comma-separated key lists from `.env` at startup
- Implement round-robin rotation with a thread-safe counter
- Handle HTTP 429 by rotating to the next key immediately and retrying
- Expose simple class methods: `get_google_key()`, `get_groq_key()`, `get_nvidia_key()`

**Logic specification:**
```python
import itertools
import threading
import os
from typing import List

class KeyManager:
    """
    Round-Robin API key manager for multi-provider LLM calls.
    Rotates keys per request to maximize free-tier rate limits.
    On 429 error, rotate to next key immediately.
    """

    def __init__(self):
        self._google_keys: List[str] = self._load_keys("GOOGLE_API_KEYS")
        self._groq_keys: List[str] = self._load_keys("GROQ_API_KEYS")
        self._nvidia_key: str = os.getenv("NVIDIA_API_KEY", "")

        self._google_cycle = itertools.cycle(self._google_keys)
        self._groq_cycle = itertools.cycle(self._groq_keys)
        self._lock = threading.Lock()

    def _load_keys(self, env_var: str) -> List[str]:
        raw = os.getenv(env_var, "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        if not keys:
            raise ValueError(f"No keys found for {env_var} in .env")
        return keys

    def get_google_key(self) -> str:
        with self._lock:
            return next(self._google_cycle)

    def get_groq_key(self) -> str:
        with self._lock:
            return next(self._groq_cycle)

    def get_nvidia_key(self) -> str:
        return self._nvidia_key


# Module-level singleton
key_manager = KeyManager()
```

**Error handling on 429:**
The `_get_llm()` function in `graph.py` must catch `429`/`RateLimitError` exceptions and call
`key_manager.get_google_key()` (or groq) again, passing the new key to a fresh LLM instance,
then retry the invocation. The `fallback_index` mechanism already handles model-level fallback;
key rotation is a new inner loop that fires first.

---

### Step 3 — Refactor `config.py`

**File:** `backend/app/core/config.py` ← **MODIFY (add fields, keep existing ones)**

Add these new fields to the `Settings` class. Do NOT remove any existing fields — the `AnalystAgent`
in `ai/analyst.py` still uses `groq_api_key`, `openai_api_key`, `gemini_api_key`.

```python
class Settings(BaseSettings):
    # ... all existing fields remain unchanged ...

    # ─── NEW: Direct Provider Keys (comma-separated for round-robin) ─────────
    google_api_keys: str = ""          # GOOGLE_API_KEYS in .env
    groq_api_keys: str = ""            # GROQ_API_KEYS in .env
    nvidia_api_key: str = ""           # NVIDIA_API_KEY in .env

    # ─── NEW: Direct Model IDs (native provider slugs, not OpenRouter slugs) ─
    gemini_flash_model: str = "gemini-2.5-flash"
    groq_medium_model: str = "llama-3.3-70b-versatile"
    groq_simple_model: str = "llama-3.3-70b-versatile"
    nvidia_complex_model: str = "qwen/qwen3-235b-a22b"

    # ─── NEW: Updated timeout (was 90s, now 35s for fail-fast behavior) ──────
    llm_provider_timeout: int = 35
```

**The `_LLM_CHAINS` dict in `graph.py`** must be updated from OpenRouter slugs to native slugs:
```python
# OLD (OpenRouter slugs)
_LLM_CHAINS = {
    "simple":  ["google/gemma-4-31b-it:free", ...],
    ...
}

# NEW (Native provider routing — not slugs anymore, but provider+model pairs)
# See Step 4 for how _get_llm() now works with providers instead of model slugs
```

---

### Step 4 — Refactor `_get_llm()` in `graph.py`

**File:** `backend/app/agent/graph.py` ← **MODIFY the `_get_llm()` function ONLY**

This is the **core change**. The function signature changes from:
```python
def _get_llm(node_name: str, complexity: str = "complex", fallback_index: int = 0) -> ChatOpenAI:
```
To:
```python
def _get_llm(node_name: str, complexity: str = "complex", fallback_index: int = 0):
    # Returns ChatGoogleGenerativeAI OR ChatGroq depending on node + fallback
```

**New routing logic:**

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from .core.key_manager import key_manager

def _get_llm(node_name: str, complexity: str = "complex", fallback_index: int = 0):
    cfg = _NODE_CONFIG.get(node_name, _NODE_CONFIG["handle_general"])
    temperature = round(random.uniform(cfg["temp_min"], cfg["temp_max"]), 3)
    timeout = settings.llm_provider_timeout  # 35s (was 90s)

    # ── Phase 2 (Intent Classifier): ALWAYS Google Gemini Flash ───────────────
    if node_name == "classify_intent":
        return ChatGoogleGenerativeAI(
            model=settings.gemini_flash_model,
            google_api_key=key_manager.get_google_key(),
            temperature=0.05,
            max_output_tokens=settings.nemotron_classify_max_tokens,
        )

    # ── Synthesis nodes: provider depends on complexity + fallback_index ──────
    provider_chain = {
        "simple":  ["groq",   "google", "groq"],
        "medium":  ["groq",   "google", "groq"],
        "complex": ["nvidia", "groq",   "google"],
    }
    provider = provider_chain.get(complexity, ["groq", "google", "groq"])[
        min(fallback_index, 2)
    ]

    if provider == "groq":
        return ChatGroq(
            model=settings.groq_medium_model,
            groq_api_key=key_manager.get_groq_key(),
            temperature=temperature,
            max_tokens=cfg["max_tokens"],
            timeout=timeout,
        )
    elif provider == "nvidia":
        return ChatNVIDIA(
            model=settings.nvidia_complex_model,
            api_key=key_manager.get_nvidia_key(),
            temperature=temperature,
            max_tokens=cfg["max_tokens"],
        )
    else:  # google fallback
        return ChatGoogleGenerativeAI(
            model=settings.gemini_flash_model,
            google_api_key=key_manager.get_google_key(),
            temperature=temperature,
            max_output_tokens=cfg["max_tokens"],
        )
```

---

### Step 5 — Hybrid Optimizations in `graph.py`

These are the **latency fixes** identified during the review. Apply all of them:

#### 5A: Regex Fast-Path in `classify_intent`
Before calling the LLM in `classify_intent`, run a regex pre-check. If the ticker can be
extracted deterministically, skip the LLM call entirely.

**Logic to add at the TOP of `classify_intent()`:**
```python
import re

# Known NSE/BSE ticker patterns — common large-cap symbols
_TICKER_REGEX = re.compile(
    r'\b(RELIANCE|TCS|INFY|HDFCBANK|SBIN|ICICIBANK|WIPRO|AXISBANK|BAJFINANCE|'
    r'SUNPHARMA|LT|TATASTEEL|ADANI|ONGC|COALINDIA|NTPC|POWERGRID|HINDUNILVR|'
    r'NESTLEIND|MARUTI|TATAMOTORS|BHARTIARTL|M&M|JSWSTEEL|INDIGO|ASIANPAINT)\b',
    re.IGNORECASE
)

_CATEGORY_KEYWORDS = {
    "news":      ["news", "headline", "update", "latest", "happened", "event"],
    "portfolio": ["portfolio", "holding", "bought", "sold", "position", "balance"],
    "market":    ["nifty", "sensex", "market", "index", "sector", "top stocks"],
    "general":   ["what is", "explain", "how does", "define", "meaning"],
}

def _fast_classify(query: str) -> dict | None:
    """
    Regex-based fast path. Returns classification dict if confident, else None.
    If None, fall through to LLM classification.
    """
    q = query.lower()
    ticker_match = _TICKER_REGEX.search(query)

    # Detect category by keywords
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            return {
                "category": category,
                "symbol": f"{ticker_match.group().upper()}.NS" if ticker_match else None,
                "confidence": 0.9
            }

    # If ticker found but no category keyword → assume "stock"
    if ticker_match:
        return {
            "category": "stock",
            "symbol": f"{ticker_match.group().upper()}.NS",
            "confidence": 0.85
        }

    return None  # Cannot classify deterministically → use LLM
```

Then in `classify_intent()`:
```python
def classify_intent(state: AgentState) -> AgentState:
    # ── FAST PATH: Try regex first (<1ms, no API call) ─────────────────────
    fast_result = _fast_classify(state["query"])
    if fast_result:
        logger.info("classify_intent [FAST PATH]: regex classified query")
        return {
            **state,
            "intent_category":   fast_result["category"],
            "intent_symbol":     fast_result["symbol"],
            "intent_confidence": fast_result["confidence"],
            "query_complexity":  classify_query_complexity(state["query"]),
            "gathered_data":     {},
        }

    # ── SLOW PATH: LLM classification (only if regex couldn't determine) ───
    llm = _get_llm("classify_intent")
    # ... rest of existing LLM logic unchanged ...
```

#### 5B: Expand COMPLEX_KEYWORDS
Add missing financial terms that should route to the complex tier:
```python
complex_patterns = [
    # ... existing patterns ...
    "long term", "short term", "long-term", "short-term",
    "fundamental", "intrinsic value", "valuation", "dcf",
    "earnings", "quarterly results", "annual report",
    "should i buy", "should i sell", "good investment",
    "growth potential", "target price", "fair value",
    "technical analysis", "chart pattern", "breakout",
]
```

#### 5C: Reduce Provider Timeout (90s → 35s)
In `_get_llm()`, replace all `timeout=90` with `timeout=settings.llm_provider_timeout` (which is
now 35s). This ensures a slow/hanging provider fails fast and triggers the fallback chain instead
of blocking the user for 90 seconds.

#### 5D: Reduce Token Budgets for Simple Tier
For `simple` complexity tier, halve the token budgets — simple queries don't need verbose reports:
```python
_NODE_CONFIG = {
    "analyze_stock": {
        "temp_min": 0.30, "temp_max": 0.42,
        "max_tokens": settings.nemotron_analyze_max_tokens,  # Keep at 2500 for complex
        "max_tokens_simple": 1200,  # NEW: for simple tier
    },
    # ... etc
}
```
And in the synthesis nodes, use `cfg["max_tokens_simple"]` when `complexity == "simple"`.

---

## SECTION C: Validation & Testing Checklist

After implementation, verify each item:

### Infrastructure Tests
- [ ] `GOOGLE_API_KEYS` parsed correctly: `key_manager.get_google_key()` returns rotating values
- [ ] `GROQ_API_KEYS` parsed correctly: `key_manager.get_groq_key()` returns rotating values
- [ ] No references to `openrouter.ai/api/v1` remain in `graph.py` or `config.py`
- [ ] `langchain-google-genai` and `langchain-groq` importable without errors
- [ ] Backend starts without `ValueError` from `KeyManager`

### Latency Tests
```
Test Query 1: "What is TCS price?"        → Expected: <3s  (regex fast path)
Test Query 2: "Show RSI for Infosys"      → Expected: <8s  (Groq synthesis)
Test Query 3: "Analyze RELIANCE long term"→ Expected: <12s (NVIDIA complex)
Test Query 4: "Latest news on HDFC Bank" → Expected: <6s  (news synthesis)
Test Query 5: "Best IT stocks today"      → Expected: <15s (market screener)
```

### Routing Correctness Tests
- [ ] "Analyze RELIANCE for long term" → classified as `complex` (NOT `simple`)
- [ ] "What is TCS price" → classified as `simple` via regex fast-path (no LLM call)
- [ ] "Latest news HDFC" → classified as `news` category
- [ ] "My portfolio holdings" → classified as `portfolio` category
- [ ] "What is P/E ratio" → classified as `general`

### Stability Tests
- [ ] Test with all Google keys rate-limited (simulate 429) → system uses Groq fallback
- [ ] Test at 9 AM IST (Indian market open) → no downtime observed
- [ ] Provider timeout fires at 35s (not 90s) → logs show "timeout, falling back"

### SSE Stream Tests (Frontend must not break)
- [ ] `complexity` event still emitted at start of stream
- [ ] `classified` event still emitted after `classify_intent` node
- [ ] `result` event still carries final markdown text
- [ ] `done` event still terminates the stream
- [ ] Model badge in UI updates correctly: `⚡ Gemini 2.5 Flash` for simple, etc.

---

## SECTION D: Files That Must NOT Be Modified

Per the project's `GEMINI.md` constraint rules, the following files must remain UNTOUCHED:

| File | Reason |
|---|---|
| `backend/app/ai/analyst.py` | Uses its own LLM setup (Groq/OpenAI/Gemini directly) — separate pipeline |
| `backend/app/api/agent.py` | SSE streaming logic is correct — only the graph.py changes |
| `backend/app/api/*.py` (all other routers) | Not related to agent pipeline |
| `frontend/` (all files) | No frontend changes needed for this migration |
| `backend/app/agent/prompts.py` | System prompts are correct and tested |
| `backend/app/agent/prompt_builder.py` | Dynamic prompt assembly is correct |
| `backend/app/agent/tools.py` | Data fetching tools work correctly |

---

## SECTION E: Master Prompt for Claude (Ready to Paste)

Copy the following prompt into Claude Sonnet, along with the current `graph.py` and `config.py`
file contents, to execute this migration:

```
Role: You are a Senior AI Infrastructure Architect specializing in LangGraph and 
multi-provider LLM orchestration.

Task: Migrate the "FinSight AI Agent" from OpenRouter-based gateway to Direct Provider 
APIs (Google AI Studio, Groq Cloud, NVIDIA Build) and optimize pipeline latency from 
30+ seconds to sub-8 seconds using a hybrid approach.

CRITICAL CONSTRAINTS:
1. Do NOT change the 4-Phase LangGraph pipeline flow
2. Do NOT change AgentState field names or structure
3. Do NOT modify any file except graph.py and config.py (plus creating key_manager.py)
4. Do NOT remove any existing config.py fields — only add new ones
5. The SSE streaming event types (complexity, status, classified, chunk, result, done, error) 
   must remain exactly as-is

Changes Required:
1. REMOVE all OpenRouter references: no more openrouter.ai/api/v1 base URLs, 
   no more ChatOpenAI with OpenRouter keys, no more OpenRouter model slugs

2. CREATE backend/app/core/key_manager.py:
   - Parses GOOGLE_API_KEYS and GROQ_API_KEYS from .env (comma-separated)
   - Implements thread-safe round-robin rotation
   - On HTTP 429: rotate to next key and retry automatically

3. MODIFY backend/app/core/config.py — add fields only:
   - google_api_keys, groq_api_keys, nvidia_api_key (parsed from .env)
   - gemini_flash_model = "gemini-2.5-flash"
   - groq_medium_model = "llama-3.3-70b-versatile"
   - nvidia_complex_model = "qwen/qwen3-235b-a22b"
   - llm_provider_timeout = 35

4. MODIFY _get_llm() in backend/app/agent/graph.py:
   - classify_intent: ALWAYS use ChatGoogleGenerativeAI with Gemini Flash
   - simple/medium synthesis: use ChatGroq with Llama 3.3
   - complex synthesis: use ChatNVIDIA or ChatGroq fallback
   - ALL timeouts: use settings.llm_provider_timeout (35s)

5. MODIFY classify_intent() in graph.py — add regex fast-path:
   - Run _fast_classify(query) FIRST using regex (no API call, <1ms)
   - If regex succeeds: return result immediately, skip LLM call
   - If regex fails: fall through to Gemini Flash LLM call

6. EXPAND COMPLEX_KEYWORDS in classify_query_complexity():
   - Add: "long term", "short term", "fundamental", "intrinsic value", 
     "valuation", "should i buy", "should i sell", "earnings", "target price"

7. REDUCE token budgets for simple tier (halve them):
   - analyze_stock simple: 2500 → 1200 tokens
   - handle_general simple: 900 → 500 tokens
   - Keep complex tier budgets unchanged

User's available keys:
- GROQ_API_KEYS: Already have a Groq general API key (confirmed)
- GOOGLE_API_KEYS: Multiple Google accounts exist (Gemma_4_API_KEY_1, Gemini_API_KEY_1 etc.)
  → Consolidate these into GOOGLE_API_KEYS comma-separated list
- DEEPSEEK_API_KEY: Already exists in .env (Deepseek_V4API_KEY)
- NVIDIA_API_KEY: Needs to be generated from build.nvidia.com

Deliverables:
1. Full updated backend/app/core/config.py
2. New backend/app/core/key_manager.py
3. Updated backend/app/agent/graph.py (only _get_llm, classify_intent, 
   classify_query_complexity functions changed — rest unchanged)
```

---

## SECTION F: Expected Latency After All Changes

```
Query: "Analyze RELIANCE for long term"

├── Phase 1 (keyword classify):    <1ms   ← unchanged, free
├── Phase 2 (regex fast-path):     <1ms   ← NEW: if ticker detected, skip LLM call
│   └── OR Gemini 2.5 Flash:      ~0.8s  ← fallback if regex can't classify
├── Phase 3 (gather_stock_data):   3-5s   ← network-bound by yFinance, unchanged
└── Phase 4 (analyze_stock):       2-3s   ← Groq LPU (was 10-20s via OpenRouter)
    └── "long term" now correctly  ────── ← routes to COMPLEX tier → best model

TOTAL ESTIMATED: 6-10 seconds  (was 18-38 seconds) — ~75% improvement
```

The remaining ~5–10s is **pure LLM generation time** which is unavoidable with cloud APIs.
The only way to further reduce *perceived* latency is to enable **real token streaming**
(user sees first words appear in 1–2s via SSE `chunk` events instead of waiting for the full
response). This requires switching from `graph.ainvoke()` to streaming mode — planned as a
follow-up enhancement.

---

*Document compiled from design review session — April 28, 2026.*
*Maintained by: Tilak | Reviewed by: Harsh | System: FinSight AI v2.0*

---

## SECTION 2 — STRATEGIC CONTEXT (April 29, 2026)

> This section captures the architectural decisions and trade-off analysis from the developer's
> research session. Any AI reading this file **must** absorb this context before suggesting
> changes to the model routing or parallelism strategy.

---

### 2.1 — The Core Problem: Why DeepSeek V4 Is a Bottleneck

**Current state:** DeepSeek V4 (via OpenRouter) is used for `complex` tier queries.

**Problem:** DeepSeek V4 (and R1) are "Reasoning" models — powerful but notorious for very high
**Time to First Token (TTFT)**. For a real-time chat agent, this means 20–30 second silences
before the user sees anything. This is unacceptable for a financial dashboard.

**Additional problem with OpenRouter:** OpenRouter is a shared gateway. Free-tier models
compete for shared connections. During Indian market hours (9 AM – 6 PM IST), the shared pool
gets congested → requests drop, 429 errors, and "morning downtime" occurs.

---

### 2.2 — Recommended Model Replacements

| Tier | Current Model | Recommended Replacement | Reason |
|------|--------------|------------------------|--------|
| `simple` | Gemma 4 31B | Keep as-is | Fast, cost-efficient |
| `medium` | Qwen3.5 397B A17B | Keep, but switch provider to NVIDIA Build | Direct API = stable 40 RPM, no shared pool |
| `complex` | DeepSeek V4 (OpenRouter) | **Llama 3.3 70B (Groq Cloud)** | 300–500 tok/s on LPU, TTFT ~0.1–0.2s, matches GPT-4o quality |
| `complex` (fallback) | — | Gemini 2.5 Pro (Google AI Studio) | 1M context window, ideal for long PDF/news analysis |

**Key insight:** Llama 3.3 70B on Groq generates a 2,000-word financial report in ~2–4 seconds.
DeepSeek V4 takes 20–30 seconds for the same task.

---

### 2.3 — Provider Rate Limits (RPM Focus — Per Minute Only)

> The developer explicitly asked for **Requests Per Minute (RPM)** comparisons,
> not daily/token limits. Use this table for KeyManager configuration.

| Provider | Model | RPM (Free/Dev Tier) | Stability |
|----------|-------|-------------------|-----------|
| **Groq Cloud** | Llama 3.3 70B / Qwen 2.5 72B | **30 RPM** (dedicated) | High |
| **Groq Cloud** | Llama 8B / Mixtral 8x7B | **100 RPM** (dedicated) | High |
| **NVIDIA Build** | Qwen 3.5 397B A17B | **40 RPM** (dedicated) | Ultra-High |
| **Google AI Studio** | Gemini 2.5 Flash | **15 RPM** | Stable |
| **Google AI Studio** | Gemini 2.5 Pro | **2 RPM** | Stable |
| **OpenRouter** | Free/shared models | ~20 RPM (SHARED pool) | Unstable at peak |

**Why RPM matters for this pipeline:** The parallel Phase 4 architecture fires 3 LLM requests
simultaneously (Technicals + News + Fundamentals nodes). That means each user request consumes
3 RPM slots at once. With Groq at 30 RPM, the system can serve 10 concurrent users doing
parallel analysis without a single 429 error.

**Multi-key multiplier (KeyManager strategy):**
- 3 Groq accounts × 30 RPM = **90 RPM total system capacity**
- 5 Google keys × 15 RPM = **75 RPM for the intent classifier**

---

### 2.4 — NVIDIA Build vs. Groq Cloud: When to Use Each

| Dimension | Groq Cloud | NVIDIA Build |
|-----------|-----------|--------------|
| **Speed (TTFT)** | ~0.1–0.2s ✅ Winner | ~0.5–1s |
| **Throughput** | 300–500 tok/s ✅ Winner | 20–50 tok/s |
| **Hardware** | LPU (Groq's own silicon) | H100/A100 GPUs |
| **Accuracy / Intelligence** | Excellent up to 70B params | ✅ Winner — hosts 397B+ models |
| **Max Model Size** | ~70B (LPU SRAM constraint) | 397B+ (Qwen, Nemotron) |
| **RPM (Dev)** | 30 RPM (large models) | 40 RPM |
| **Best Use Case** | Real-time chat, streaming | Deep financial reasoning |

**Hybrid Orchestration Decision (Approved by Developer):**

```
Phase 2 (Intent Classifier):  Google AI Studio — Gemini Flash (stable, cheap)
Phase 3 (Data Gather):         yFinance — no LLM (parallel asyncio.gather)
Phase 4 — Fast nodes:          Groq — Llama 3.3 70B  (News Sentiment, Technical Summary)
Phase 4 — Deep nodes:          NVIDIA Build — Qwen 3.5 397B A17B (Fundamental Analysis, Synthesis)
```

With `asyncio.gather()`, Phase 4 runs all nodes in parallel. User waits for the *slowest* node,
not the *sum* of all nodes.

---

### 2.5 — Parallelism + Streaming: The Sequencing Problem (RESOLVED)

**The developer's concern:** If Phase 4 runs 3 nodes in parallel (Technicals, News, Fundamentals),
and they finish at different times, the streaming output will arrive in random order.
A user expects: Intro → Price → RSI/MACD → News → Conclusion — not a random mix.

**The problem is real.** "Race condition" can cause RSI data to stream before the intro section
if the Technicals node finishes faster.

**The approved solution: "Parallel Thinking, Sequential Streaming"**

```
┌─────────────────────────────────────────────────────┐
│ PHASE 4 — PARALLEL DRAFTING (invisible to user)     │
│                                                     │
│  Node A: Technicals Specialist  ─── writes to       │
│  Node B: News Sentiment Node    ─── AgentState      │
│  Node C: Fundamental Analyst    ─── (all 3 run      │
│                                      concurrently)  │
│                                                     │
│  asyncio.gather() waits for ALL three to finish.    │
│  Total time = time of SLOWEST node (~3s), not sum.  │
└─────────────────────────────────────────────────────┘
           │
           ▼ (all data ready in AgentState)
┌─────────────────────────────────────────────────────┐
│ SEQUENCER NODE (visible to user — starts streaming) │
│                                                     │
│  Reads AgentState sections in FIXED ORDER:          │
│  1. Intro / Executive Summary                       │
│  2. Price & Volume                                  │
│  3. Technical Indicators (RSI, MACD, SMA/EMA)       │
│  4. News Sentiment                                  │
│  5. Fundamental Valuation                           │
│  6. Conclusion / Recommendation                     │
│                                                     │
│  Streams to frontend token-by-token (SSE).          │
│  Sequence is ALWAYS correct.                        │
└─────────────────────────────────────────────────────┘
```

**Implementation note for the Sequencer Node:**
- It is a single LangGraph node that runs AFTER the parallel gather nodes.
- It reads the pre-drafted sections from `AgentState` (already populated by parallel nodes).
- It synthesizes them into a coherent Markdown report and streams via the LLM call.
- The parallel nodes write **JSON data / bullet-point drafts** to state, not final prose.
  The Sequencer writes the final prose (ensuring one coherent voice, not 3 different styles).

**Alternative (Frontend Slot approach):** Backend tags each streamed chunk with a `type` field
(e.g., `{"type": "RSI", "content": "..."}`). Frontend has fixed-position "slots" and fills them
as data arrives. This allows fully parallel streaming without a Sequencer Node, but requires
more complex frontend state management. The developer has not committed to this approach yet.

---

### 2.6 — Round Robin and Streaming: Clarification

**Round Robin is for API Key rotation, NOT for node assignment.**

Round Robin in the `KeyManager` means: if Key 1 hits its RPM limit, the next request
automatically uses Key 2, then Key 3, cycling back. This is transparent to the LangGraph nodes.

Round Robin does **NOT** mean different nodes use different keys in a way that breaks
streaming order. Each LangGraph node still calls its designated provider (Groq or NVIDIA)
sequentially within itself — Round Robin just picks *which account's API key* to use for
that call, preventing individual key throttling.

---

### 2.7 — Qwen 3.5 397B A17B — Rate Limit Clarification

**Model:** `qwen-3.5-397b` (Mixture of Experts, 17B active parameters per call)

**Direct provider:** NVIDIA Build (NIM endpoints)

**RPM:** **40 RPM** on developer/free tier (NOT 4 RPM — that figure was for a restricted trial tier)

**Why A17B matters for latency:** Despite 397B total parameters, only 17B activate per token.
This makes generation speed closer to a 17B dense model, not a 397B model. NVIDIA can serve
40 requests/minute efficiently because of this sparse activation pattern.

**NVIDIA Build endpoint details (for `key_manager.py` configuration):**
```
base_url: https://integrate.api.nvidia.com/v1
model:    nvidia/qwen-3.5-397b  (verify exact slug on build.nvidia.com)
```

---

### 2.8 — Files This Context Impacts

When implementing the above decisions, these files will be affected:

| File | What Changes |
|------|-------------|
| `backend/app/core/key_manager.py` | NEW — Round-robin key pool (Groq + NVIDIA + Google keys) |
| `backend/app/agent/graph.py` | Add parallel Phase 4 nodes + Sequencer Node; update `_invoke_with_fallback` to use KeyManager |
| `backend/app/api/agent.py` | Already addressed in Fix 3 above (dual stream mode) |

> **Do NOT touch** `prompts.py`, `prompt_builder.py`, `tools.py`, or any frontend files
> for the latency optimization work.

---

*Section 2 added: April 29, 2026. Source: Developer research conversation on model selection,
provider benchmarks, parallelism design, and streaming sequencing strategy.*

---

## SECTION 3 — PHASE 4 ARCHITECTURE & UI STRATEGY (April 29, 2026 — Evening Session)

> This section captures the follow-up design session that went deeper into Phase 4 node splitting,
> provider selection at scale, Groq's disqualification, and the structured artifact/slot UI system.
> Any AI implementing Phase 4 parallelism or the AI Research frontend **must read this section first.**

---

### 3.1 — Why Groq Is Disqualified from Phase 4 Synthesis

**Decision: Groq Cloud is NOT used for Phase 4 synthesis nodes.**

This was explicitly evaluated and rejected. The reasons:

1. **LPU Sequential Batching:** Groq's LPU hardware processes requests one-at-a-time per slot.
   With parallel Phase 4 firing 3 LLM calls per user, and 5 concurrent users = 15 simultaneous
   requests, the last request waits for the first 14 to complete. Parallelism benefit is fully negated.

2. **RPM Wall at Scale:** Groq Llama 3.3 70B = 30 RPM per key. Each user query in parallel Phase 4
   burns 3 RPM slots at once → only 10 users/minute before 429s. Not a production system.

3. **Groq remains valid ONLY for Phase 2 (intent classification)** where its 0.1s TTFT matters
   and only 1 request fires per user query. Even here, Gemini Flash is an acceptable alternative.

---

### 3.2 — Phase 4: Exactly 3 Parallel Specialist Nodes

**Decision: Phase 4 splits into exactly 3 parallel nodes, not 2 and not 5.**

| Node | Data it reads from AgentState | Token budget | Output format |
|------|-------------------------------|-------------|---------------|
| **Technicals Node** | RSI, MACD, SMA/EMA, price, volume | ~150 tokens | Structured JSON |
| **News Sentiment Node** | Headlines, VADER scores, sources | ~150 tokens | Structured JSON |
| **Fundamentals Node** | PE, market cap, beta, 52w range, sector | ~200 tokens | Structured JSON |

**Why 3:** Maps directly to the 3 independent axes of financial analysis. These nodes read from
non-overlapping fields in `AgentState.gathered_data` — no cross-reference needed during drafting.
They can genuinely run in parallel without any shared state mutation.

**Critical design principle:** Parallel nodes write **structured JSON, not prose**.
This drops token budgets from 800–2500 tokens (prose) to 150–200 tokens (JSON).
Generation time per node: ~1–2 seconds on Gemini Flash. All 3 finish in ~2 seconds simultaneously.

---

### 3.3 — Model Assignment Per Node (Final Decision)

#### Simple + Medium Complexity Queries
All 3 parallel nodes → **Gemini 2.5 Flash (Google AI Studio)**

- 5 keys × 15 RPM = 75 RPM effective system capacity
- Each user query burns 3 RPM → 25 concurrent users before key rotation kicks in
- Flash handles structured JSON output natively with near-zero hallucination on financial ratios

#### Complex Complexity Queries (Asymmetric Assignment)
| Node | Model | Reasoning |
|------|-------|-----------|
| Technicals Node | Gemini 2.5 Flash | Technicals are pattern-matching on numbers, not deep reasoning |
| News Sentiment Node | Gemini 2.5 Flash | Sentiment classification is a structured output task, not reasoning |
| **Fundamentals Node** | **NVIDIA Qwen 3.5 397B A17B** | Only this node needs real financial reasoning (sector PE comparison, beta analysis, valuation conclusions) |

**The key asymmetry:** Only the Fundamentals node needs a powerful model for complex queries.
Assigning 397B to all 3 nodes would waste compute and create unnecessary latency.

#### Sequencer Node (All Tiers)
- Model: **Gemini 2.5 Flash**
- Token budget: **≤400 tokens** (intro + transitions + conclusion + JSON→prose stitch only)
- Runs AFTER all 3 parallel nodes complete (reads from AgentState)
- Estimated time: <1 second
- **Must NOT rewrite or synthesize** — only assembles pre-written sections in fixed order

---

### 3.4 — More NVIDIA Keys ≠ Lower Latency (Important Clarification)

**Developer asked:** "If I increase the Qwen API keys, will it reduce latency?"

**Answer: No.** This is a critical distinction:

| More API Keys | More Powerful Model |
|--------------|---------------------|
| Increases concurrent users served | Increases quality of single response |
| Does NOT make one request faster | Does NOT help concurrency |
| Solves 429 rate limit errors | Solves reasoning quality |
| Adds throughput | Adds intelligence |

Latency for a single user = model TTFT + token generation speed + network.
Adding 10 NVIDIA keys still means each individual request takes the same 1.5–3 seconds.

**To reduce user-perceived latency → use the Slot/Artifact UI system (see Section 3.5).**

---

### 3.5 — Frontend Slot System + Structured Artifact UI (APPROVED DESIGN)

**Decision: The AI Research page will use a slot-based, structured artifact UI instead of
a single streaming text wall.**

#### The Core Idea
The developer's intent: instead of showing one long Markdown text response, the UI renders
**interactive structured cards** (artifacts) — one per specialist node — that fill in as each
parallel node completes. Users get fast, scannable information first; they can click for depth.

```
┌────────────────────────────────────────────────────────────────┐
│  AI Research Page — Artifact Card Layout                       │
│                                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │ 📊 Technicals    │  │ 📰 News Sentiment│  │ 🏦 Fundamentals│ │
│  │ RSI: 58.3 ●Neutral│ │ Mood: BULLISH   │  │ PE: 24.1   │  │
│  │ MACD: ↑ Bullish  │  │ 3/5 Positive    │  │ β: 0.87    │  │
│  │ [Click for more] │  │ [Click for more] │  │ [Click for more]│ │
│  └──────────────────┘  └──────────────────┘  └─────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⚖️ Verdict: MODERATE BUY                                 │  │
│  │ "Strong technicals offset by stretched valuation..."     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [Generate Full Report ↓]  ← Only if user wants detail        │
└────────────────────────────────────────────────────────────────┘
```

#### How It Works — Backend (api/agent.py)
Each parallel node emits a **typed SSE event** as it completes, instead of one final `result` event:

```python
# Each node emits its own event type with structured JSON payload
yield f"event: technicals\ndata: {json.dumps({'rsi': 58.3, 'rsi_signal': 'NEUTRAL', 'macd_trend': 'BULLISH', 'sma_20': 3350})}\n\n"
yield f"event: news\ndata: {json.dumps({'mood': 'BULLISH', 'positive_count': 3, 'total': 5, 'top_headline': '...'})}\n\n"
yield f"event: fundamentals\ndata: {json.dumps({'pe_ratio': 24.1, 'beta': 0.87, 'market_cap': '14.2T', 'verdict': 'STRETCHED'})}\n\n"
yield f"event: verdict\ndata: {json.dumps({'signal': 'MODERATE_BUY', 'reason': '...'})}\n\n"
```

The existing `complexity`, `classified`, `status`, and `done` events are **unchanged**.

#### How It Works — Frontend (ai-research/page.tsx)
```typescript
// Slot state — fixed positions regardless of arrival order
const [slots, setSlots] = useState({ technicals: null, news: null, fundamentals: null, verdict: null });

es.addEventListener('technicals', (e) => setSlots(s => ({...s, technicals: JSON.parse(e.data)})));
es.addEventListener('news',        (e) => setSlots(s => ({...s, news: JSON.parse(e.data)})));
es.addEventListener('fundamentals',(e) => setSlots(s => ({...s, fundamentals: JSON.parse(e.data)})));
es.addEventListener('verdict',     (e) => setSlots(s => ({...s, verdict: JSON.parse(e.data)})));
```

Cards render in fixed visual order (Technicals → News → Fundamentals → Verdict).
If News arrives before Technicals, News fills its slot silently but stays in position.
User sees a skeleton card animate to filled state as each slot completes — no jumbling.

#### Click-to-Expand Behavior
- Each card has a `[View Details]` button
- Clicking sends a follow-up request to generate prose for ONLY that section
- This keeps the initial response fast (structured JSON) and depth optional (prose on demand)
- No auto-generation of the full prose report unless the user clicks `[Generate Full Report]`

#### Why This Approach is Better
| Old Approach | New Approach |
|-------------|-------------|
| Single 2500-token prose block | 3 × 150-token JSON payloads (parallel) |
| User waits 15-20s to see anything | User sees first card in ~2s |
| One long wall of text | Interactive scannable cards |
| Full reasoning every time | Structured first, depth on demand |
| Sequential streaming | Parallel slot filling |

---

### 3.6 — Files Impacted by Section 3 Decisions

| File | Change Type | What Changes |
|------|------------|-------------|
| `backend/app/agent/graph.py` | MODIFY | Split single synthesis node into 3 parallel specialist nodes; add Sequencer Node; JSON output prompts |
| `backend/app/api/agent.py` | MODIFY | Emit typed SSE events per node (`technicals`, `news`, `fundamentals`, `verdict`) |
| `backend/app/agent/prompts.py` | MODIFY | Update specialist prompts to return structured JSON instead of prose |
| `frontend/src/app/ai-research/page.tsx` | MODIFY | Add slot-based renderer; typed EventSource listeners; artifact card components |

> **Do NOT touch:** `portfolio.py`, `alerts.py`, `stock.py`, `news.py`, `market.py`,
> `Sidebar.tsx`, `TopBar.tsx`, or any auth files. Changes are isolated to the agent pipeline
> and the AI Research page only.

---

### 3.7 — Open Decisions (Needs Developer Input Before Implementation)

1. **NVIDIA account count:** NVIDIA RPM is per-account, not per-key. Confirm how many
   separate NVIDIA Build accounts are available. Determines complex-tier concurrency ceiling.

2. **Click-to-expand scope:** When user clicks "View Details" on a card, should it:
   - (A) Stream prose inline below the card, OR
   - (B) Open a side panel / modal with the full section report?

3. **Full Report trigger:** Should `[Generate Full Report]` produce a single combined Markdown
   document (for copy/save), or render expanded prose inside each card?

4. **Skeleton card design:** Developer to confirm if skeleton loading animation should be
   a shimmer effect or a spinner per card slot.

---

*Section 3 added: April 29, 2026. Source: Developer architecture session on Phase 4 node splitting,
Groq disqualification analysis, provider model assignment, and structured artifact UI system design.*

---

## SECTION 4 — DYNAMIC ARTIFACT UI SYSTEM (April 29, 2026 — Night Session)

> This section captures the evolution from a static slot layout to a **dynamic, intent-driven
> artifact/component system** — similar to how Claude renders different artifact types based on
> query intent. Any AI working on the AI Research page frontend **must read this section.**
> Section 3.5 (static slots) is superseded by this design for the rendering layer.

---

### 4.1 — The Problem with the Static Slot Approach

**Developer's insight:** The 3-slot card layout defined in Section 3.5 is a fixed template.
Every query — whether "TCS price?" or "Compare TCS vs Infosys" — would render the same
Technicals + News + Fundamentals layout. This is static, not intelligent.

**Claude's actual model (what the developer wants to replicate):**
```
Chat panel (left)  |  Artifact panel (right — dynamically rendered)
───────────────────┼────────────────────────────────────────────────
User query         |  → Claude understands query type
                   |  → Decides WHICH artifact type to build
                   |  → Renders the appropriate component
```

The key principle: **the query drives the component type, not the other way around.**

---

### 4.2 — The Dynamic Artifact Architecture (APPROVED DESIGN)

#### Backend: Add `artifact_type` to Phase 2 Output

Phase 2 (`classify_intent`) already returns `category`, `symbol`, `confidence`.
One additional field is added — **`artifact_type`** — decided by the same LLM call,
with zero extra latency (same token generation, just one more JSON field).

```python
# Phase 2 output — NEW shape
{
  "category":     "stock",
  "symbol":       "TCS.NS",
  "confidence":   0.9,
  "artifact_type": "full_analysis"   # ← NEW FIELD, same LLM call
}
```

#### Artifact Type Decision Map

```python
ARTIFACT_TYPE_MAP = {
  "price lookup"      : "price_ticker",        # "TCS ka price?"
  "single stock full" : "full_analysis",        # "TCS ka analysis karo"
  "comparison"        : "comparison_table",     # "TCS vs Infosys compare"
  "technical only"    : "technical_gauge",      # "TCS ka RSI dekho"
  "news query"        : "news_feed",            # "HDFC ki news?"
  "portfolio query"   : "portfolio_breakdown",  # "mera portfolio kaisa hai"
  "market screener"   : "screener_table",       # "aaj ke top gainers"
  "general/education" : "info_card",            # "PE ratio kya hota hai"
}
```

#### Frontend: Component Registry Pattern

```typescript
// lib/artifact-registry.ts
const ARTIFACT_REGISTRY = {
  price_ticker:        PriceTickerArtifact,
  full_analysis:       FullAnalysisArtifact,     // Section 3.5 ka 3-slot system
  comparison_table:    ComparisonArtifact,
  technical_gauge:     TechnicalGaugeArtifact,
  news_feed:           NewsFeedArtifact,
  portfolio_breakdown: PortfolioArtifact,
  screener_table:      ScreenerArtifact,
  info_card:           InfoCardArtifact,
} as const;

// Dynamic renderer — query-driven component selection
function ArtifactPanel({ artifactType, data }) {
  const Component = ARTIFACT_REGISTRY[artifactType] ?? DefaultArtifact;
  return <Component data={data} />;
}
```

#### SSE Event Order (Updated)

```python
# api/agent.py — artifact_type is the FIRST event emitted (before complexity)
yield f"event: artifact_type\ndata: {json.dumps({'type': state['artifact_type']})}\n\n"

# Existing events follow unchanged
yield f"event: complexity\ndata: ...\n\n"
yield f"event: classified\ndata: ...\n\n"
# ... data events per node ...
yield f"event: done\ndata: ...\n\n"
```

Frontend mounts the correct component BEFORE data arrives → faster perceived render.

---

### 4.3 — Split-Panel Layout (page.tsx)

```
┌──────────────────┬──────────────────────────────────────────┐
│  CHAT PANEL      │  ARTIFACT PANEL (dynamic)                │
│  (left — fixed)  │  (right — component changes per query)   │
│                  │                                          │
│ User: Analyze    │  ┌────────────────────────────────────┐  │
│ TCS...           │  │ TCS.NS — Live Analysis             │  │
│                  │  │ [Technicals] [News] [Fundamentals] │  │
│ AI: Fetching...  │  │ RSI: 58.3 ● Neutral                │  │
│                  │  │ MACD: ↑ Bullish                    │  │
│                  │  │ [▼ View Full Technical Analysis]   │  │
│                  │  └────────────────────────────────────┘  │
└──────────────────┴──────────────────────────────────────────┘
```

- Left panel: Chat input + message history (static layout)
- Right panel: Mounts different component based on `artifact_type` SSE event
- Toolbar: Copy / Download / Open-in-tab actions (same for all artifact types)

---

### 4.4 — Per-Query Artifact Examples

| Query | `artifact_type` | What Renders |
|-------|----------------|-------------|
| `"TCS ka price?"` | `price_ticker` | Simple price card — ₹3,420 ▲ +0.9%, H/L |
| `"TCS ka full analysis"` | `full_analysis` | 3-slot parallel cards (Section 3.5) |
| `"TCS vs Infosys compare"` | `comparison_table` | Side-by-side metric table |
| `"TCS ka RSI dekho"` | `technical_gauge` | RSI gauge + MACD signal only |
| `"HDFC Bank ki news?"` | `news_feed` | Headline list + VADER sentiment badges |
| `"Mera portfolio kaisa hai"` | `portfolio_breakdown` | Holdings + P&L breakdown |
| `"Aaj ke top gainers"` | `screener_table` | Ranked stock screener table |
| `"PE ratio kya hota hai"` | `info_card` | Definition card + formula + example |

---

### 4.5 — Click-to-Expand Behaviour (Resolved)

Each artifact card has a `[▼ View Full Analysis]` button:
- Click → **inline expand below the card** (same panel, no modal)
- Triggers a secondary API call for prose generation of ONLY that section
- The initial JSON card stays visible above; prose streams below it
- `[Generate Full Report]` button at bottom → combines all sections into downloadable Markdown

---

### 4.6 — VERBATIM Q&A — Latency Impact Confirmation

> **This Q&A is preserved verbatim as it documents a critical architectural decision.**

---

**Developer asked:**
> "but isme to latency badh nahin jayegi kya."

**Claude's answer:**

Bilkul nahi bhadegi — aur reason solid hai.

**Kyun nahi badhegi?**

Dekh Phase 2 already LLM call kar raha hai aur ye JSON return kar raha hai:

```python
# ABHI Phase 2 return karta hai:
{"category": "stock", "symbol": "TCS.NS", "confidence": 0.9}

# BAAD MEIN return karega:
{"category": "stock", "symbol": "TCS.NS", "confidence": 0.9, "artifact_type": "full_analysis"}
```

Ek extra field. Same LLM call. Same time. Zero extra latency.

Kyunki ye sab ek hi token generation mein hota hai:

```
LLM ek baar sochta hai:
  "query kya hai?"              → category decide
  "kaunsa stock?"               → symbol decide
  "kitna confident?"            → confidence decide
  "kaunsa layout banana hai?"   → artifact_type decide

Ye sab PARALLEL thinking hai LLM ke andar.
Alag alag calls NAHI hain.
```

**Actually latency kam hogi ek jagah:**

| PEHLE | BAAD MEIN |
|-------|-----------|
| Phase 2 → sirf category pata | Phase 2 → category + artifact_type pata |
| Phase 4 poora response generate karo, PHIR frontend decide kare kaise dikhana hai | Frontend ko PEHLE HI pata hai kaunsa component banana hai |
| — | Jab data aa raha hai tab tak component already mounted hai → faster render |

Frontend ko pehle se pata hai kya render karna hai — **perceived latency actually kam hogi.**

**Ek line mein:**
Ek LLM call mein 3 fields nikalna aur 4 fields nikalna — same time lagta hai.
Tokens thode zyada, lekin milliseconds mein difference nahi aata.

---

### 4.7 — Updated Files Impact (Section 4 Additions)

| File | Change | Notes |
|------|--------|-------|
| `backend/app/agent/graph.py` | `classify_intent()` returns `artifact_type` field | Added to existing JSON output — no structural change |
| `backend/app/api/agent.py` | Emit `artifact_type` SSE event as first event | Additive — existing events unchanged |
| `frontend/src/app/ai-research/page.tsx` | Split-panel layout + `artifact_type` listener | Mounts correct component from registry |
| `frontend/src/lib/artifact-registry.ts` | NEW file — component registry map | Maps `artifact_type` string → React component |
| `frontend/src/components/artifacts/` | NEW directory — individual artifact components | One file per artifact type |

> **Do NOT touch:** All existing components, API routes, auth files, sidebar, topbar.
> Artifact system is a self-contained addition to the AI Research page only.

---

### 4.8 — Open Decision Resolved from Section 3.7

| Section 3.7 Question | Resolution |
|---------------------|-----------|
| Click-to-expand: inline or modal? | **Inline expand below the card** ✅ |
| Full Report trigger format? | **Downloadable Markdown doc** ✅ |
| Skeleton animation style? | **Shimmer effect** (not spinner) — pending final confirmation |
| NVIDIA account count? | **Still pending developer confirmation** ❌ |

---

*Section 4 added: April 29, 2026. Source: Developer session on dynamic artifact component registry,
split-panel UI architecture, query-driven component selection, and zero-latency artifact_type field.*