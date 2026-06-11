# FinSight AI — Master Technical Architecture

> **Who is this for?**
> Any engineer, reviewer, or contributor joining the project for the first time.
> This single document covers the **entire system** — frontend, backend, AI pipeline, database, deployment, and auth.
> No other file needs to be read first. All referenced paths match the actual disk layout as of **May 2026**.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Deployment Topology](#2-deployment-topology)
3. [Authentication Architecture](#3-authentication-architecture)
4. [High-Level Data Flow](#4-high-level-data-flow)
5. [Backend Architecture](#5-backend-architecture)
6. [Services Layer](#6-services-layer)
7. [AI Agent System](#7-ai-agent-system)
8. [RAG Pipeline](#8-rag-pipeline)
9. [Frontend Architecture](#9-frontend-architecture)
10. [API Client Layer](#10-api-client-layer)
11. [Database Models](#11-database-models)
12. [Complete API Reference](#12-complete-api-reference)
13. [Background Jobs](#13-background-jobs)
14. [Environment Variables](#14-environment-variables)
15. [Known Issues & Gotchas](#15-known-issues--gotchas)

---

## 1. System Overview

**FinSight AI** is a production-grade financial research dashboard for **Indian stock markets** (NSE/BSE).
It is a full-stack monorepo with two co-located applications:

| Application | Technology | Purpose |
|-------------|------------|---------|
| **Frontend** | Next.js 14, React 18, TypeScript, TailwindCSS | Dark-themed UI — market dashboard, stock analysis, AI chat, portfolio management, alerts |
| **Backend** | Python 3.11+, FastAPI, Uvicorn | REST API + WebSocket server — market data, AI agent, portfolio CRUD, alerts, RAG |

Both applications live under one repository root: `Full-Stack-Client-Dashboard/`.

### What Users Can Do

| Feature | Description |
|---------|-------------|
| **Live Market Indices** | Real-time NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT |
| **Stock Deep-Dive** | Price, OHLCV history, RSI/SMA/EMA indicators, fundamentals, options chain, shareholding pattern, financials |
| **AI Research Agent** | Multi-model chat interface — natural language financial questions with rich structured artifact responses |
| **Artifact Rendering** | AI responses rendered as interactive cards: verdict banners, metric grids, peer comparison tables, technical gauges, revenue charts |
| **Portfolio Management** | Create portfolios, buy/sell holdings with FIFO P&L calculation, Modern Portfolio Theory optimization |
| **Market Alerts** | Price-triggered and indicator-triggered alert rules; APScheduler polls every 5 minutes |
| **News Feed** | Yahoo Finance RSS + NewsAPI with VADER sentiment scoring |
| **RAG Document Search** | Upload PDFs/TXTs → embed into ChromaDB/Pinecone → semantic search |
| **WebSocket Price Stream** | Live price push per ticker every 5 seconds |
| **Macro Dashboard** | FRED economic data: 10Y Treasury, CPI, Unemployment, Gold, Oil prices |

---

## 2. Deployment Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                  DigitalOcean App Platform                        │
│         https://finsight-app-v8wgj.ondigitalocean.app            │
│                                                                  │
│  ┌────────────────────────┐     ┌──────────────────────────┐    │
│  │    Next.js Frontend    │     │     FastAPI Backend       │    │
│  │    (Static + SSR)      │     │     (Python Worker)       │    │
│  │    Route prefix: /     │     │     Route prefix: /api   │    │
│  │    Port: 3000          │     │     Port: 8080            │    │
│  └───────────┬────────────┘     └─────────────┬────────────┘    │
│              │   HTTP REST + WebSocket          │                 │
│              └─────────────────────────────────┘                 │
└───────────────────────────────┬──────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────────┐
           ▼                    ▼                        ▼
   ┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │   Supabase    │   │  External APIs   │   │   OpenRouter     │
   │  (PostgreSQL) │   │                  │   │  LLM Gateway     │
   │  + GoTrue Auth│   │  • yFinance      │   │  (Claude 3.5,    │
   │  PgBouncer    │   │  • FRED          │   │   GPT-4o,        │
   │  Session Pool │   │  • NewsAPI       │   │   Mistral, etc.) │
   └───────────────┘   │  • Pinecone      │   └──────────────────┘
                       └──────────────────┘
```

### Routing Logic on DigitalOcean

DigitalOcean App Platform routes traffic based on URL path prefix:

| URL Pattern | Routed To |
|-------------|-----------|
| `/` | Next.js static/SSR server |
| `/api` | FastAPI Python worker (port 8080) |

> ⚠️ **Critical — Path Rewrite Middleware:**
> DigitalOcean **strips** the `/api` prefix before forwarding the request to FastAPI.
> The `DOPathRewriteMiddleware` registered as the **outermost middleware in `main.py`** detects this and re-prepends `/api` to the ASGI scope path before FastAPI's router processes it.
> Without this middleware, every `/api/v1/*` route would return `404` in production.

---

## 3. Authentication Architecture

Authentication is **fully delegated to Supabase GoTrue**. There is **zero custom auth logic** in this codebase.

```
Browser (Next.js)            Supabase GoTrue           FastAPI Backend
       │                           │                          │
       │── POST /auth/sign-in ────▶│                          │
       │◀── JWT (ES256/HS256) ─────│                          │
       │                           │                          │
       │── GET /api/v1/portfolio ──────────────────────────▶  │
       │   Header: Authorization: Bearer <jwt>                │
       │                           │   security.py: decode_access_token()
       │                           │   1. Reads SUPABASE_JWT_SECRET
       │                           │   2. Detects HS256 (plain str) or
       │                           │      ES256 (JWK JSON) automatically
       │                           │   3. Verifies token signature
       │                           │   4. Extracts sub (UUID) + email
       │◀── 200 JSON response ────────────────────────────────│
```

### Key Auth Facts

| Item | Detail |
|------|--------|
| **Signup / Login / Logout** | Handled entirely by `@supabase/supabase-js` on the frontend. FastAPI never receives credentials. |
| **Token format** | Supabase issues JWTs. Modern projects use ES256 (ECC P-256 JWK). Legacy projects use HS256 (plain string). |
| **Backend verification file** | `backend/app/core/security.py` → `decode_access_token()` |
| **Algorithm auto-detection** | Reads secret → if starts with `{` → JWK/ES256. Otherwise → plain HS256 string. |
| **User identity storage** | No `public.users` table exists. User records live in Supabase's internal `auth.users` schema only. |
| **Frontend route protection** | `frontend/src/middleware.ts` — runs on every request, redirects unauthenticated users to `/auth/login`. |
| **Supported algorithms** | `HS256`, `ES256`, `RS256` |

---

## 4. High-Level Data Flow

### HTTP Request Flow (Example: Stock Detail Page)

```
1. User opens /stock/RELIANCE.NS in browser
         │
         ▼
2. Next.js page: stock/[symbol]/page.tsx
   Calls: stockApi.getFullData("RELIANCE.NS")
         │
         ▼
3. api-client.ts (apiFetch wrapper)
   GET /api/v1/stock/RELIANCE.NS
   Header: Authorization: Bearer <supabase_jwt>
         │
         ▼
4. FastAPI → api/stock.py
   Depends(get_current_user) → security.py verifies JWT
         │
         ▼
5. services/stock_service.py
   • yfinance → price, OHLCV, fundamentals
   • services/indicators.py → RSI, SMA, EMA
   • services/market_structure.py → support/resistance
   • core/cache.py → skip repeat calls (Redis or in-memory)
         │
         ▼
6. Pydantic StockDataResponse → serialized JSON returned
         │
         ▼
7. Frontend renders: price hero, TradingView chart,
   TechnicalTab, FundamentalTab, OptionsChain
```

### WebSocket Flow (Live Price Streaming)

```
Browser
  WS connect: /api/v1/stream/price/RELIANCE.NS
         │
         ▼
  FastAPI → api/stream.py
  Calls stock_service.get_price() every 5 seconds
  Pushes: { price, change_pct, timestamp }
         │
         ▼
  Frontend: useWebSocketPrice.ts hook
  Updates React state on each message
         │
         ▼
  Live price numbers update in UI without page refresh
```

### AI Agent Flow

```
User types: "Give me a full analysis of RELIANCE"
         │
         ▼
POST /api/v1/agent/chat  { message: "..." }
         │
         ▼
api/agent.py → invoke_agent() OR streamAgent() (SSE)
         │
         ▼
agent/graph.py — LangGraph State Machine
  Step 1: classify_intent  → category = "stock"
  Step 2: route_query      → stock branch selected
  Step 3: tool calls
          • stock_lookup("RELIANCE.NS")
          • detect_trading_setups("RELIANCE.NS")
          • get_market_structure("RELIANCE.NS")
  Step 4: prompt_builder.py assembles full context prompt
  Step 5: LLM call via OpenRouter (Claude 3.5 Sonnet or fallback)
  Step 6: response parser extracts text + artifact JSON
         │
         ▼
Response: {
  response: "RELIANCE is showing bullish momentum...",
  artifact: { type: "hero_price", data: { ... } },
  steps: [ "Fetched stock data", "Ran setup detection", ... ],
  model_used: "anthropic/claude-3-5-sonnet"
}
         │
         ▼
Frontend ArtifactRenderer.tsx → renders interactive verdict card

---

## 5. Backend Architecture

### 5.1 Application Entry Point — `backend/app/main.py`

`main.py` is the root of the FastAPI application. `uvicorn app.main:app` loads this file and the `app` FastAPI instance serves all HTTP and WebSocket traffic.

**Responsibilities (in order of registration):**

| # | Responsibility | Detail |
|---|---------------|--------|
| 1 | **Structured logging** | Python log level from `settings.log_level` |
| 2 | **FastAPI instance** | Title: `"FinSight AI API"`, Swagger at `/docs`, ReDoc at `/redoc` |
| 3 | **`DOPathRewriteMiddleware`** | Outermost layer — re-prepends `/api` when DigitalOcean strips it |
| 4 | **CORS Middleware** | `allow_origins=["*"]` — allows browser from any origin |
| 5 | **`TelemetryMiddleware`** | Logs path + duration of every request |
| 6 | **SlowAPI rate limiting** | Global default: 20 req/min per IP |
| 7 | **Global exception handlers** | `422 RequestValidationError` → structured JSON; `500 Exception` → generic error (no stack trace) |
| 8 | **10 API routers** | See Router Registration table below |
| 9 | **Startup sequence** | `on_startup()` via lifespan |
| 10 | **Shutdown sequence** | `on_shutdown()` via lifespan |

### 5.2 Startup Sequence

Each step is logged with a label (`Step 1`, `Step 2`, …) so cloud logs reveal exactly which phase hangs.

| Step | Action | Failure Behavior |
|------|--------|-----------------|
| **Step 1** | `validate_db_connection()` — issues `SELECT 1` | Logs error, backend starts in degraded mode |
| **Step 2** | `Base.metadata.create_all(bind=engine)` — creates missing tables | **Skipped** if `DATABASE_URL` contains `pooler.supabase.com` (PgBouncer transaction mode cannot handle DDL introspection) |
| **Step 3** | `alert_service.start_scheduler()` | Logs error if fails |
| **Step 4** | `price_update_job.start()` | Logs error if fails |
| **Done** | Logs `"All startup tasks completed successfully."` | — |

> ⚠️ **Pooler Skip:** PgBouncer in transaction mode hangs on `create_all()` DDL queries. For **first-time DB setup**: temporarily use the direct `db.xxx.supabase.co:5432` URL, run once to create tables, then switch back to the pooler URL.

### 5.3 Middleware Stack (Outermost → Innermost)

```
Request arrives
       │
       ▼
[1] DOPathRewriteMiddleware     ← Re-prepends /api if DigitalOcean stripped it
       │
       ▼
[2] CORSMiddleware              ← allow_origins=["*"]
       │
       ▼
[3] TelemetryMiddleware         ← Logs method + path + duration
       │
       ▼
[4] SlowAPI Rate Limiter        ← 20 req/min global default
       │
       ▼
[5] FastAPI Router              ← Matches path to route handler
       │
       ▼
Route Handler (api/*.py)
```

### 5.4 Router Registration

```python
app.include_router(analyze_router)   # POST  /api/v1/analyze
app.include_router(portfolio_router) # CRUD  /portfolios/*
app.include_router(stream_router)    # WS    /api/v1/stream/*
app.include_router(rag_router)       # POST/GET /rag/*
app.include_router(assets_router)    # GET/POST /api/v1/assets/*
app.include_router(alerts_router)    # CRUD  /api/v1/alerts/*
app.include_router(stock.router)     # GET   /api/v1/stock/*
app.include_router(news.router)      # GET   /api/v1/news
app.include_router(market.router)    # GET   /api/v1/indices, /api/v1/movers
app.include_router(agent_router)     # POST  /api/v1/agent/*
```

Health check registered directly on `app`: `GET /health` → `{ "status": "ok" | "degraded" }`

### 5.5 Core Infrastructure Layer (`backend/app/core/`)

| File | Class / Export | Purpose |
|------|---------------|---------|
| `config.py` | `Settings` (Pydantic `BaseSettings`), `settings` singleton | Reads all env vars from `.env`. Key fields: `database_url`, `supabase_jwt_secret`, `gemini_api_key_1` … `gemini_api_key_10`, `gemini_flash_lite_model`, `gemini_flash_model` |
| `database.py` | `engine`, `SessionLocal`, `Base`, `validate_db_connection()` | SQLAlchemy PostgreSQL engine. Pool: `size=5`, `max_overflow=10`, `recycle=1800s`, `pre_ping=True` |
| `dependencies.py` | `get_db()` generator | Per-request DB session via `Depends(get_db)`. Auto-commits on success, auto-rolls back on error, always closes. |
| `security.py` | `decode_access_token(token)` | Verifies Supabase JWTs. Auto-detects HS256 (plain string) vs ES256 (JWK JSON starts with `{`). Uses `python-jose`. Raises `HTTPException(401)` on failure. |
| `cache.py` | `CacheService`, `cache` singleton | Redis-first with silent in-memory fallback. `get(key)`, `set(key, value, ttl)`, `clear(key)`. Non-persistent if Redis unavailable. |
| `circuit_breaker.py` | `CircuitBreaker` (via `pybreaker`) | Wraps external API calls. 3 states: CLOSED → OPEN (fail fast) → HALF-OPEN (trial). Prevents cascading failures from yFinance/FRED/NewsAPI outages. |
| `telemetry.py` | `TelemetryMiddleware` | Starlette middleware. Logs: `method`, `path`, `status_code`, `duration_ms`. |

### 5.6 Shutdown Sequence

```
SIGTERM received
       │
       ▼
alert_service.stop_scheduler()   ← Graceful APScheduler shutdown
       │
       ▼
price_update_job.stop()          ← Graceful APScheduler shutdown
```

---

## 6. Services Layer

All services live in `backend/app/services/`. They are **singletons** — created once at import time. Route handlers import the singleton and call its methods. Services contain all business logic; route handlers are thin controllers.

### 6.1 `stock_service.py` — Market Data (~25KB)

Wraps `yfinance`. Protected by a circuit breaker.

| Method | Returns | Description |
|--------|---------|-------------|
| `get_current_price(symbol)` | `dict` | Real-time snapshot via `yf.Ticker().fast_info`. Fields: `price`, `change`, `change_pct`, `market_state`, `day_high`, `day_low`, `volume`, `previous_close` |
| `get_full_stock_data(symbol)` | `StockDataResponse` | Complete stock data + indicators. Used by `GET /api/v1/stock/{symbol}` |
| `get_historical_data(symbol, period, interval)` | `List[dict]` | OHLCV candle data as list of dicts with ISO timestamp strings |
| `get_indicators(symbol)` | `dict` | Fetches 60 days of daily data → RSI(14), SMA(20), EMA(20) via `indicators.py` |

### 6.2 `indicators.py` — Technical Calculations

Pure-Python, no I/O. Accepts a list of closing prices, returns a float.

| Function | Formula |
|----------|---------|
| `calculate_rsi(prices, period=14)` | Wilder's RSI via EWMA gain/loss smoothing |
| `calculate_sma(prices, period=20)` | Simple arithmetic mean of last `period` prices |
| `calculate_ema(prices, period=20)` | EMA with multiplier `2/(period+1)` |

### 6.3 `news_service.py` — News & Sentiment

Singleton. `get_news(limit=20)` pipeline:
1. Fetches from **Yahoo Finance RSS** (no key needed) — primary source
2. Supplements with **NewsAPI.org** if `NEWS_API_KEY` is configured
3. Deduplicates articles by URL
4. Applies **VADER** sentiment to each title: compound > 0.05 → `positive`, < -0.05 → `negative`, else `neutral`
5. Returns `List[{ title, source, published_at, url, summary, sentiment }]`

### 6.4 `portfolio_service.py` — Portfolio Business Logic

Takes `db: Session` as a parameter (injected via `Depends(get_db)`).

**`record_transaction(db, portfolio_id, symbol, type, quantity, price)`** — Core mutation logic:

```
BUY:
  If holding exists → weighted avg = (old_qty × old_avg + qty × price) / (old_qty + qty)
  If new holding   → create Holding row, cost_basis = qty × price
  Always           → create immutable Transaction record

SELL:
  Validate quantity is sufficient
  FIFO realized P&L = qty × (price - average_price)
  Reduce holding.quantity (delete row if reaches 0)
  Add to holding.realized_pl
  Create immutable Transaction record with realized_pl
```

**`get_portfolio_summary(db, portfolio_id)`** — Aggregates:
- `total_invested` = sum of `cost_basis`
- `total_current_value` = sum of `current_value` (refreshed by background job)
- `total_unrealized_pl` = `total_current_value - total_invested`
- `total_realized_pl` = sum of `realized_pl`

### 6.5 `alert_service.py` — Alert Monitoring

| Method | Description |
|--------|-------------|
| `create_alert(db, symbol, condition, threshold, message, user_id)` | Creates `Alert` row with `status="active"` |
| `get_all_active_alerts(db)` | Returns alerts with `status="active"` |
| `get_recent_alerts(db, limit=10)` | Returns last 10 triggered alerts ordered by `triggered_at` DESC |
| `delete_alert(db, alert_id)` | Deletes alert row |

**APScheduler polling job** (every 300 seconds):
1. Load all active alerts
2. For each: fetch current price/RSI/SMA for `alert.symbol`
3. Evaluate `condition` against `threshold`
4. If met → set `status="triggered"`, `triggered_at=now()`
5. Commit all changes

**Valid `condition` values:** `price_above`, `price_below`, `rsi_above`, `rsi_below`, `sma_cross_above`, `sma_cross_below`

### 6.6 `price_update_job.py` — Background Price Refresh

APScheduler job running every **5 minutes**.

```
update_all_holdings_prices():
  1. Open new DB session
  2. Query all distinct symbols from holdings table
  3. _batch_fetch_prices(symbols) → yf.Tickers(" ".join(symbols))
     (one HTTP request for all symbols at once)
  4. For each holding: update current_price, current_value,
     unrealized_pl, unrealized_pl_pct, last_price_update
  5. Commit in single transaction
  6. Log per-symbol success/failure (one bad ticker doesn't block others)
```

### 6.7 `macro_service.py` — Macroeconomic Data

`get_macro_dashboard()` fetches:
- **10Y Treasury Yield** — FRED `GS10` series via `pandas_datareader`
- **CPI (Inflation)** — FRED `CPIAUCSL`
- **Unemployment** — FRED `UNRATE`
- **Gold Price** — yFinance `GC=F`
- **WTI Crude Oil** — yFinance `CL=F`

> ⚠️ `pandas_datareader` is **incompatible with pandas ≥ 3.0**. Import is in a `try/except`. When broken, FRED fields fall back to hardcoded values: `{ ten_year_treasury: 4.28, cpi: 3.2, unemployment: 3.9 }`.

### 6.8 `options_service.py` — Options Chain

| Method | Description |
|--------|-------------|
| `get_options_chain(symbol)` | `yf.Ticker().option_chain(expiry)` — nearest expiry date's calls + puts |
| `calculate_black_scholes(S, K, T, r, sigma, type)` | Pure math Black-Scholes pricing. `type` = `"call"` or `"put"` |

### 6.9 `mpt_service.py` — Portfolio Optimization

`optimize_portfolio(symbols)`:
1. Fetch 5 years adjusted close via yFinance
2. `pypfopt.expected_returns.mean_historical_return()`
3. `pypfopt.risk_models.sample_cov()`
4. Max-Sharpe optimization via `pypfopt.EfficientFrontier`
5. Return: `weights`, `expected_annual_return`, `annual_volatility`, `sharpe_ratio`

Requires ≥ 2 symbols. Returns `400` if fewer provided.

### 6.10 `setup_engine.py` — Trading Setup Detection

| Setup | Detection Logic |
|-------|----------------|
| **RSI Recovery** | RSI was < 30 (oversold), now recovering above 35 |
| **Volume Breakout** | Today's volume ≥ 2× the 20-day average volume |
| **Trend Alignment** | Price above both SMA and EMA; RSI in 50–70 momentum zone |

### 6.11 `market_structure.py` — Market Structure Analyzer

| Feature | Method |
|---------|--------|
| **Trend** | Compares price to 20-day SMA and 50-day SMA → `"uptrend"` / `"downtrend"` / `"sideways"` |
| **Support levels** | Recent local price minima (swing lows) |
| **Resistance levels** | Recent local price maxima (swing highs) |
| **52-week range position** | `(current_price - 52w_low) / (52w_high - 52w_low) × 100` |

### 6.12 `categorizer.py` — Query Intent Classifier

Classifies user queries so the agent picks the right tools:

| Category | Example Query |
|----------|--------------|
| `stock_analysis` | "Analyze RELIANCE.NS", "What's TCS at?" |
| `news` | "Latest news on Infosys", "What happened to HDFC Bank today?" |
| `portfolio` | "How is my portfolio doing?", "Should I sell WIPRO?" |
| `macro` | "What is the repo rate?", "How is inflation trending?" |
| `general` | "Explain P/E ratio", "What is RSI?" |

### 6.13 `data_provider.py` — Unified Data Abstraction

A facade over multiple external data sources (yFinance, TwelveData, FMP, Finnhub, Alpha Vantage). Agent tools call `data_provider` instead of individual services, making source-swapping transparent.

Priority order (per data type):
- **Live price:** Twelve Data → Alpha Vantage → Yahoo Finance
- **OHLCV history:** Twelve Data (NSE/BSE official) → FMP → Finnhub → Yahoo Finance
- **Fundamentals:** FMP → Finnhub → Yahoo Finance
- **News:** NewsAPI → Yahoo Finance RSS → Finnhub news

---

## 7. AI Agent System

The AI agent lives in `backend/app/agent/`. It is the **sole active AI backbone** — it replaced the deleted `ai/analyst.py` (removed April 29, 2026). It is exposed via `api/agent.py` at `/api/v1/agent/*`.

> ⚠️ **LLM Provider:** The agent uses **Google Gemini Direct API** (via `langchain-google-genai`). OpenRouter, Groq, and OpenAI are **NOT used**. Do not add OpenRouter or Groq calls.

### 7.1 Multi-Key Rotation System

Up to **10 Gemini API keys** (`GEMINI_API_KEY_1` … `GEMINI_API_KEY_10`) handle rate limits via round-robin rotation:

```
KeyManager (graph.py)
  ├── _FLASH_LITE_POOL  → gemini-2.5-flash-lite  (keys 1–10)
  └── _FLASH_POOL       → gemini-2.5-flash        (keys 1–10)

On each LLM call:
  1. Pick next key (round-robin)
  2. Key returns 429 → mark 60-second cooldown, skip it
  3. If ALL keys are cooled down → raise "rate limited" error
```

| Pool | Model | Used By |
|------|-------|---------|
| `_FLASH_LITE_POOL` | `gemini-2.5-flash-lite` | classify_intent, analyze_stock, synthesize_news, audit_portfolio, handle_general, handle_market, Phase 4 technicals + news nodes |
| `_FLASH_POOL` | `gemini-2.5-flash` | Phase 4 fundamentals node (deeper financial reasoning) |

### 7.2 `agent/graph.py` — LangGraph State Machine

The core orchestrator (~79KB). Implements a multi-step LangGraph pipeline:

```
User Message
      │
      ▼
classify_intent            ← gemini-2.5-flash-lite + categorizer.py
      │ intent: stock | news | portfolio | macro | general
      ▼
route_query (conditional edge)
      │
  ┌───┴─────────────────────────────────────┐
  ▼                                         ▼
[stock branch]                        [news | portfolio | macro | general]
  analyze_stock node                    corresponding handler node
  ├── stock_lookup tool
  ├── detect_trading_setups tool
  └── get_market_structure tool
              │
              ▼
          [Phase 4 nodes — stock only]
          ├── phase4_technicals  → gemini-2.5-flash-lite
          ├── phase4_fundamentals→ gemini-2.5-flash  ← full model
          └── phase4_news        → gemini-2.5-flash-lite
              │
              ▼
          prompt_builder.py assembles context-rich prompt
              │
              ▼
          LLM call (45-second timeout per call)
              │
              ▼
          Response parser (text + optional artifact JSON)
              │
              ▼
{ response, artifact, steps, model_used, conversation_id }
```

### 7.3 Artifact Generation

When a query warrants rich UI rendering, the agent includes a structured JSON `artifact` block:

| Artifact Type | When Generated |
|--------------|----------------|
| `hero_price` | Single stock price query |
| `investment_thesis` | Full stock analysis with verdict |
| `technical_focus` | Technical indicators analysis |
| `financials_timeline` | Revenue/profit historical query |
| `news_event` | News-driven query with market impact |
| `three_way_compare` | Multi-stock comparison (2–3 stocks) |

Frontend `artifact-assembler.ts` parses this → `ArtifactRenderer.tsx` renders it as an interactive card.

### 7.4 `agent/prompt_builder.py` — Context-Aware Prompt Assembly

Assembles the full prompt sent to the LLM (~28KB):
1. Determines query category via `categorizer.py`
2. Pre-fetches real-time context based on category:
   - **Stock** → `stock_service.get_full_stock_data()` + `market_structure.analyze()`
   - **News** → `news_service.get_news()` filtered to relevant tickers
   - **Macro** → `macro_service.get_macro_dashboard()`
3. Formats data into a structured context block appended to the user message
4. Selects appropriate system prompt from `prompts.py`

> **Important:** The LLM does **not** call tools to fetch data — all data is **pre-fetched and injected into the prompt**. Tools only provide supplemental structured lookups during graph execution.

### 7.5 `agent/prompts.py` — System Prompt Templates

| Template | Purpose |
|----------|---------|
| `STOCK_ANALYSIS_PROMPT` | Single-stock analysis — technicals, fundamentals, verdict |
| `PEER_COMPARISON_PROMPT` | Multi-stock comparison — structured `three_way_compare` artifact |
| `NEWS_ANALYSIS_PROMPT` | News summarization with sentiment and market impact |
| `MACRO_PROMPT` | Macroeconomic questions → market impact connection |
| `GENERAL_FINANCE_PROMPT` | Educational / general financial questions |
| `ARTIFACT_INSTRUCTIONS` | Appended to prompts needing artifact JSON — specifies exact format |

All prompts instruct the model to: focus on Indian markets (NSE/BSE), format values in ₹, use only the provided context block (prevents hallucination).

### 7.6 `agent/tools.py` — LangChain Tool Functions

| Tool | Input | Returns |
|------|-------|---------|
| `stock_lookup(symbol)` | Ticker string | Real-time price + indicators + market structure dict |
| `get_market_structure(symbol)` | Ticker string | Trend, support levels, resistance levels, 52-week position |
| `detect_trading_setups(symbol)` | Ticker string | Active setups (RSI recovery, volume breakout, trend alignment) |

### 7.7 AI Utility Modules (`backend/app/ai/`)

| File | Purpose |
|------|---------|
| `scoring.py` | Confidence score (0–100) based on signal strength |
| `moderation.py` | Screens queries for unsafe content / misuse |
| `hallucination_check.py` | Post-generation: verifies numeric values match context data |
| `response_limits.py` | Enforces maximum output length; truncates overlong responses |
| `timeout_guard.py` | `asyncio.wait_for(timeout=45)` around all LLM calls |
| `document_loader.py` | Parses PDF/TXT via LangChain; splits via `RecursiveCharacterTextSplitter` |

---

## 8. RAG Pipeline

### 8.1 Upload Flow

```
POST /rag/upload  (multipart file)
  │
  ▼
ai/document_loader.py
  • PDF → PyPDFLoader, TXT → TextLoader
  • Split: 1000-char chunks, 200-char overlap
  • Metadata: source filename + page number
  │
  ▼
Vector Store Selection:
  if Pinecone_Vector_Database env var set → Pinecone (cloud)
  else                                    → ChromaDB (local: backend/vector_db/)
  │
  ▼
Embed chunks + store
  │
  ▼
Returns: { "chunks_indexed": N, "source": "filename.pdf" }
```

### 8.2 Query Flow

```
GET /rag/query?q=...&score_threshold=1.5
  │
  ▼
vector_store.similarity_search_with_score(query, k=5)
  • Embeds query string
  • Finds k nearest chunks by cosine distance
  • Filters by score_threshold (default: 1.5)
  │
  ▼
Returns: [{ "content", "source", "page", "score" }, ...]
```

### 8.3 Vector Store Abstraction

Both implementations extend `ai/interfaces/vector_store.py` (`AbstractVectorStore`):

| Store | File | When Active | Storage |
|-------|------|-------------|---------|
| ChromaDB | `vector_store_chroma.py` | `Pinecone_Vector_Database` **not set** | On-disk at `backend/vector_db/` (gitignored) |
| Pinecone | `vector_store_pinecone.py` | `Pinecone_Vector_Database` **is set** | Cloud (shared across all instances) |

---

## 9. Frontend Architecture

### 9.1 Root Layout and Providers

**`layout.tsx`** wraps every page:
1. Google Fonts: `Outfit` (headings) + `DM Sans` (body)
2. Default `<title>` + `<meta name="description">`
3. `<Providers>` → React Query `QueryClientProvider`
4. `<AuthProvider>` → global Supabase session context
5. Flex row layout: `<Sidebar>` left + `<main>` right (always rendered)

**`providers.tsx`** — QueryClient config:

| Setting | Value | Effect |
|---------|-------|--------|
| `staleTime` | 30,000ms | Fresh for 30s — no background refetch |
| `gcTime` | 300,000ms | Garbage-collected after 5 min inactivity |
| `retry` | `1` | Retry failed requests once |
| `refetchOnWindowFocus` | `false` | No refetch on tab switch |

### 9.2 Route Protection (`middleware.ts`)

Runs on every request before page render:
- Unauthenticated + protected route → redirect `/auth/login`
- Authenticated + visits `/auth/login` or `/auth/signup` → redirect `/dashboard`
- Public routes (no check): `/`, `/auth/login`, `/auth/signup`

### 9.3 Pages

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/dashboard` |
| `/auth/login` | Email+password form → Supabase directly (no FastAPI call) |
| `/auth/signup` | Signup → Supabase sends confirmation email |
| `/dashboard` | Indices (live), movers (live), news (live), portfolio chart (mock), AI insights (mock) |
| `/stock/[symbol]` | Price hero + TradingView chart + 6 tabs (Technical, Fundamental, Financials, Shareholding, Corporate Actions) |
| `/ai-research` | AI chat: input, agent step animation, artifact rendering, session history |
| `/portfolio` | Holdings P&L, buy/sell modals, MPT optimization |
| `/watchlist` | localStorage-based; each symbol fetched live |
| `/news` | Full news feed with sentiment badges |
| `/alerts` | Alert CRUD + triggered notifications |
| `/settings` | Static UI (no backend) |

### 9.4 Shared Components

**Layout:** `Sidebar.tsx` · `TopBar.tsx` · `AppShell.tsx`

**Stock Detail:** `TechnicalTab` · `FundamentalTab` · `FinancialStatements` · `ShareholdingDonut` · `CorporateActionsCard` · `TradingViewWidget` · `IndicatorCard` · `TechnicalSummaryGauge` · `SupportResistanceBar`

**Portfolio Modals:** `AddToPortfolioModal` (buy flow) · `SellHoldingModal` (live FIFO P&L preview)

### 9.5 Artifact Rendering System

**`ArtifactRenderer.tsx`** dispatches by `artifact.type`:

| Type | Skeleton | Shows |
|------|----------|-------|
| `hero_price` | `SkeletonHeroPrice` | Price hero + daily change |
| `investment_thesis` | `SkeletonInvestmentThesis` | Verdict, metrics, risk, news |
| `technical_focus` | `SkeletonTechnicalFocus` | RSI/SMA/EMA gauges, signals, S/R |
| `financials_timeline` | `SkeletonFinancialsTimeline` | Revenue + profit chart |
| `news_event` | `SkeletonNewsEvent` | News summary with sentiment |
| `three_way_compare` | `SkeletonThreeWayCompare` | 3-stock side-by-side table |

**Atoms** (`components/artifact/atoms/`): `VerdictBanner` · `VerdictCard` · `HeroMetric` · `MetricGrid` · `FundamentalGrid` · `PeerComparisonTable` · `CompareColumns` · `SignalRow` · `TechnicalGauges` · `SupportResistanceBar` · `RevenueProfitChart` · `SegmentStrengthBars` · `MiniBarChart` · `MiniPriceCard` · `ProgressBar` · `NewsFeed` · `NewsItem` · `ExpandSection` · `ExpandableRiskPanel`

**Skeletons** (`components/artifact/skeletons/`): One per artifact type + base `Shimmer.tsx`.

**Type System:** `artifact-types.ts` (TypeScript shapes) + `artifact-assembler.ts` (parses raw JSON → typed `Artifact` or `null`)

### 9.6 Landing Page Components (`components/landing/`)

`NavBar` · `HeroSection` · `TickerTape` (infinite scroll animation) · `FeatureGrid` · `ProtocolSection` · `TrustBar` · `LandingFooter`

---

## 10. API Client Layer

### 10.1 Base Fetch Wrapper — `api-client.ts`

```
BASE_URL = NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

apiFetch<T>(endpoint, options?):
  1. supabase.auth.getSession() → JWT (fallback: localStorage)
  2. Construct: BASE_URL + endpoint
  3. Headers: Content-Type: application/json
              Authorization: Bearer <jwt>
  4. fetch() + await
  5. 401 → supabase.auth.signOut() + redirect /auth/login
  6. non-2xx → throw ApiError(status, detail)
  7. Return parsed JSON as type T
```

**`ApiError`**: `class ApiError extends Error { status: number; detail: string }`

### 10.2 API Modules

| Module | Key Methods |
|--------|-------------|
| `auth.api.ts` | `login(email, pw)`, `register(email, pw)`, `logout()`, `getUser()` — Supabase direct, no FastAPI |
| `stock.api.ts` | `getFullData(symbol)`, `getHistory(symbol, period, interval)` |
| `portfolio.api.ts` | `list()`, `create({name})`, `getSummary(id)`, `buyHolding(id, sym, qty, price)`, `sellHolding(id, sym, {qty, price})`, `optimize(id)` |
| `alerts.api.ts` | `getActive()`, `getNotifications()`, `create(payload)`, `delete(id)` |
| `ai.api.ts` | `analyze(question)` → `POST /api/v1/agent/chat` |
| `news.api.ts` | `getLatest(limit)` |
| `market.api.ts` | `getIndices()`, `getMovers()` |

### 10.3 Supabase Client — `supabase.ts`

Singleton `supabase` client using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

> The `ANON_KEY` is safe in the browser — Supabase RLS rules enforce row-level security. Never use `service_role` key on the frontend.

### 10.4 Auth Context — `auth-context.tsx`

`AuthProvider` wraps the app. Exposes `{ user, session, loading }` via `useAuth()`.
- Mount: `supabase.auth.getSession()`
- Reactive: `supabase.auth.onAuthStateChange()`

### 10.5 WebSocket Hook — `useWebSocketPrice.ts`

```
WS_BASE = NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000"
useWebSocketPrice(symbol) → { price, connected, error }

Lifecycle:
  symbol changes → close old WS → open new to {WS_BASE}/api/v1/stream/price/{symbol}
  onopen → connected = true
  each message (every 5s) → parse JSON → update price state
  onerror / close → set error
  unmount → ws.close()
```

### 10.6 Utility Functions — `utils.ts`

| Function | Output |
|----------|--------|
| `formatINR(value)` | `₹1,82,050` |
| `formatPct(value)` | `+8.40%` |
| `formatDate(iso)` | `01 May 2026` |
| `formatTime(iso)` | `10:30 AM` |

---

## 11. Database Models & Pydantic Schemas

### 11.1 Database Overview

All application data is stored in **Supabase (PostgreSQL)**. There is **no local `users` table** — user identity comes entirely from Supabase Auth JWTs.

| Environment | Connection String | Notes |
|-------------|------------------|-------|
| **Local dev** | `postgresql+psycopg2://postgres:[PASS]@db.xxxx.supabase.co:5432/postgres` | Direct; IPv6; `create_all()` works |
| **Production** | `postgresql+psycopg2://postgres.xxxx:[PASS]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` | Session Pooler; IPv4; `create_all()` is skipped |

> ⚠️ **IPv4 Requirement:** DigitalOcean App Platform workers are IPv4-only. The direct Supabase host resolves to IPv6 and will fail in production. Always use the Session Pooler URL on DigitalOcean.

`user_id` columns in `portfolios` and `alerts` are plain `String(255)` UUIDs from Supabase — **no foreign key constraint** pointing to any local table.

### 11.2 ORM Models

#### `portfolios` table — `models/portfolio.py`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, auto-increment | Internal portfolio ID |
| `user_id` | `String(255)` | NOT NULL, indexed | Supabase user UUID |
| `name` | `String(255)` | NOT NULL, indexed | User-defined portfolio name |
| `created_at` | `DateTime(tz=True)` | `server_default=func.now()` | Creation timestamp (UTC) |

Relationships: `holdings` (cascade delete) · `transactions` (cascade delete)
Unique index on `(user_id, name)` — no duplicate names per user.

#### `holdings` table — `models/holding.py`

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Internal ID |
| `portfolio_id` | FK → `portfolios.id` | CASCADE, indexed |
| `symbol` | `String(20)` | e.g. `"INFY.NS"` |
| `quantity` | Float | Shares currently held |
| `average_price` | Float | Weighted avg purchase price per share |
| `cost_basis` | Float NULLABLE | `quantity × average_price`. Added via migration. |
| `current_price` | Float NULLABLE | Refreshed by background job every 5 min |
| `current_value` | Float NULLABLE | `quantity × current_price` |
| `unrealized_pl` | Float NULLABLE | `current_value − cost_basis` |
| `unrealized_pl_pct` | Float NULLABLE | `(unrealized_pl / cost_basis) × 100` |
| `realized_pl` | Float default=0.0 | Cumulative FIFO realized P&L |
| `realized_pl_pct` | Float default=0.0 | `realized_pl` as % of cost basis |
| `first_purchase_date` | `DateTime(tz=True)` | `server_default=func.now()` |
| `last_price_update` | `DateTime(tz=True)` NULLABLE | When price was last refreshed |

> Columns from `cost_basis` onwards were added via `migrate.py`. Databases before April 16, 2026 need the migration run.

#### `transactions` table — `models/transaction.py`

Immutable audit log. Records are never modified after creation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Internal ID |
| `portfolio_id` | FK → `portfolios.id` | CASCADE |
| `symbol` | `String(20)` | Ticker |
| `transaction_type` | `Enum('buy','sell')` | NOT NULL |
| `quantity` | Float | Shares transacted |
| `price` | Float | Per-share price at time of transaction |
| `total_amount` | Float NULLABLE | `quantity × price`. Added via migration. |
| `realized_pl` | Float NULLABLE | FIFO P&L for SELL only; NULL for BUY. Added via migration. |
| `timestamp` | `DateTime(tz=True)` | `server_default=func.now()` |

#### `alerts` table — `models/alert.py`

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Internal ID |
| `user_id` | `String(255)` | Supabase user UUID |
| `symbol` | String | Ticker to monitor |
| `condition` | `Enum(AlertCondition)` | See values below |
| `threshold` | Float | Value to compare against |
| `status` | `Enum('active','triggered','expired')` | default=`'active'` |
| `message` | String NULLABLE | User note for this alert |
| `created_at` | `DateTime(tz=True)` | `server_default=func.now()` |
| `triggered_at` | `DateTime(tz=True)` NULLABLE | When condition was last met |

**`AlertCondition` values:** `price_above` · `price_below` · `rsi_above` · `rsi_below` · `sma_cross_above` · `sma_cross_below`

### 11.3 Pydantic Schemas

| File | Key Schemas |
|------|-------------|
| `schemas/auth.py` | `UserPublic(id: str, email: str)` — returned by `/api/v1/auth/me` |
| `schemas/analyze.py` | `AnalyzeRequest(question: str, min_length=3, max_length=1000)` |
| `schemas/analysis.py` | `FinancialAnalysisResult`, `TechnicalSignal(indicator, value, interpretation)`, `SentimentSignal(source, score, interpretation)` |
| `schemas/stock.py` | `StockDataResponse(symbol, current_price, currency, exchange, market_state, rsi, sma, ema, …)` |
| `schemas/news.py` | `NewsArticle(title, source, published_at, url, summary, sentiment)`, `NewsResponse(articles)` |
| `schemas/portfolio.py` | `PortfolioCreate`, `TransactionCreate(symbol, transaction_type, quantity, price)`, `SellRequest(quantity, price)`, `HoldingResponse`, `PortfolioSummaryResponse` |

---

## 12. Complete API Reference

### Base URLs

| Environment | URL |
|-------------|-----|
| Local dev | `http://localhost:8000` |
| Production | `https://finsight-app-v8wgj.ondigitalocean.app` |

Swagger UI: `{base_url}/docs`

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/v1/auth/me` | ✅ | Returns `{ id, email }` from verified JWT |

### AI Analysis

| Method | Endpoint | Auth | Limit | Description |
|--------|----------|:----:|-------|-------------|
| `POST` | `/api/v1/analyze` | ✅ | 5/min | Structured financial analysis: verdict + confidence + signals |

### AI Agent

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/v1/agent/chat` | ✅ | Free-form chat with optional rich artifact response |
| `GET` | `/api/v1/agent/status` | ✅ | Agent health and model config |

### Portfolio

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/portfolios/` | ✅ | List all portfolios for user |
| `POST` | `/portfolios/` | ✅ | Create portfolio → `{ name }` |
| `GET` | `/portfolios/{id}/summary` | ✅ | Aggregated P&L + holdings |
| `POST` | `/portfolios/{id}/transactions` | ✅ | Record BUY or SELL transaction |
| `POST` | `/portfolios/{id}/holdings/{symbol}/sell` | ✅ | Sell with FIFO P&L |
| `GET` | `/portfolios/{id}/optimize` | ✅ | MPT Max-Sharpe optimization |

### Stock

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/v1/stock/{symbol}` | ✅ | Full data: price + RSI/SMA/EMA + fundamentals |
| `GET` | `/api/v1/stock/{symbol}/history` | ✅ | OHLCV candles. Params: `period`, `interval` |

`period` options: `1d` `5d` `1mo` `3mo` `6mo` `1y` `2y` `5y` `max`
`interval` options: `1m` `5m` `15m` `1h` `1d` `1wk` `1mo`

### Market

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/v1/indices` | ✅ | NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT |
| `GET` | `/api/v1/movers` | ✅ | Top 2 gainers + top 2 losers from large-cap basket |

### News

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/v1/news` | ✅ | News with VADER sentiment. Param: `limit` (default 20) |

### Assets

| Method | Endpoint | Auth | Limit | Description |
|--------|----------|:----:|-------|-------------|
| `GET` | `/api/v1/assets/macro` | ✅ | 10/min | 10Y Treasury, CPI, Unemployment, Gold, WTI Oil |
| `GET` | `/api/v1/assets/options/{symbol}` | ✅ | 10/min | Options chain + Black-Scholes |
| `POST` | `/api/v1/assets/options/pricer` | ✅ | — | Black-Scholes theoretical price |
| `POST` | `/api/v1/assets/mpt/optimize` | ✅ | 5/min | MPT on custom symbol list |

### Alerts

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/v1/alerts/` | ✅ | Create alert rule |
| `GET` | `/api/v1/alerts/active` | ✅ | All active (untriggered) alerts |
| `GET` | `/api/v1/alerts/notifications` | ✅ | Last 10 triggered alerts |
| `DELETE` | `/api/v1/alerts/{id}` | ✅ | Delete alert |

### RAG

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/rag/upload` | ✅ | Upload PDF/TXT for indexing. Returns `{ chunks_indexed, source }` |
| `GET` | `/rag/query` | ✅ | Semantic search. Params: `q`, `score_threshold` (default 1.5) |

### WebSocket

| Protocol | Endpoint | Auth | Description |
|----------|----------|:----:|-------------|
| `WS` | `/api/v1/stream/price/{symbol}` | ❌ | Live price every 5s. Message: `{ symbol, price, change, change_pct, timestamp }` |

### System

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/health` | ❌ | `{ "status": "ok" \| "degraded" }` — DigitalOcean liveness probe |
| `GET` | `/docs` | ❌ | Swagger UI |
| `GET` | `/redoc` | ❌ | ReDoc |

### Rate Limit Summary

| Endpoint | Limit |
|----------|-------|
| `POST /api/v1/analyze` | 5 req/min/IP |
| `POST /api/v1/assets/mpt/optimize` | 5 req/min/IP |
| `GET /api/v1/assets/macro` | 10 req/min/IP |
| `GET /api/v1/assets/options/{symbol}` | 10 req/min/IP |
| All other endpoints | 20 req/min/IP (global default) |

---

## 13. Environment Variables

### Backend — `.env` (project root)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Use direct URL for local dev, Session Pooler URL for production. |
| `SUPABASE_JWT_SECRET` | ✅ | JWT verification secret. Plain HS256 string OR JWK JSON (starts with `{`) for ES256. |
| `GEMINI_API_KEY_1` | ✅ | Primary Google Gemini API key. At least one required. |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_10` | ❌ | Optional additional keys for rate-limit rotation pool. |
| `NEWS_API_KEY` | ❌ | NewsAPI.org key. If absent, news comes from Yahoo Finance RSS only. |
| `FRED_API_KEY` | ❌ | FRED economic data key. If absent, macro data uses yFinance only. |
| `redis_url` | ❌ | Redis connection URL. If absent, in-memory cache is used (non-persistent). |
| `Pinecone_Vector_Database` | ❌ | Pinecone API key. If absent, ChromaDB local store is used for RAG. |
| `TWELVE_DATA_API_KEY` | ❌ | TwelveData key for `data_provider.py`. Falls back to yFinance if absent. |
| `FMP_API_KEY` | ❌ | Financial Modeling Prep key. Falls back to yFinance if absent. |
| `FINNHUB_API_KEY` | ❌ | Finnhub key. Falls back to yFinance if absent. |
| `ALPHA_VANTAGE_API_KEY` | ❌ | Alpha Vantage key. Falls back to yFinance if absent. |
| `DEBUG` | ❌ | `true` / `false`. Default: `false`. |
| `LOG_LEVEL` | ❌ | Python logging level. Default: `INFO`. |

### Frontend — `frontend/.env.local`

| Variable | Required | Description |
|----------|:--------:|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key. Must include `_KEY` suffix — not `_ANON` alone. |
| `NEXT_PUBLIC_API_URL` | Prod only | Backend base URL. Falls back to `http://127.0.0.1:8000` for local dev. |
| `NEXT_PUBLIC_WS_URL` | Prod only | WebSocket base URL. Falls back to `ws://127.0.0.1:8000` for local dev. |

### DigitalOcean — Production Only

Set these in DigitalOcean App → Settings → Environment Variables (not from `.env` files):
- `DATABASE_URL` → Session Pooler URL
- `SUPABASE_JWT_SECRET` → JWK JSON or HS256 string
- `GEMINI_API_KEY_1` through `GEMINI_API_KEY_10`
- `NEXT_PUBLIC_API_URL` → `https://finsight-app-v8wgj.ondigitalocean.app`
- `NEXT_PUBLIC_WS_URL` → `wss://finsight-app-v8wgj.ondigitalocean.app`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 14. Design System

**Theme:** Premium dark mode only. Accent-driven with a single lime highlight color.

### Color Palette (Tailwind tokens)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0B0D11` | Main page background |
| `sidebar` | `#090B0F` | Sidebar (slightly darker) |
| `card` | `#12141B` | Card backgrounds |
| `card2` | `#0E1014` | Nested / secondary cards |
| `dim` | `#1D2028` | Hover states, muted backgrounds |
| `border` | `rgba(255,255,255,0.07)` | Subtle card borders |
| `border-hi` | `rgba(255,255,255,0.13)` | Active/hover borders |
| `text` | `#ECEEF2` | Primary text |
| `muted` | `#636B7A` | Labels, timestamps, subtitles |
| `lime` | `#C8FF00` | Primary accent: CTAs, active nav, chart lines |
| `lime-dim` | `rgba(200,255,0,0.12)` | Lime hover backgrounds |
| `purple` | `#9B72FF` | AI-related elements |
| `green` | `#4ADE80` | Positive P&L, bullish |
| `red` | `#F87171` | Negative P&L, bearish |
| `amber` | `#FBBF24` | Warnings, triggered alerts |

### Typography

| Role | Font | CSS Variable |
|------|------|-------------|
| Headings | **Outfit** | `--font-outfit` → `font-heading` class |
| Body/Labels | **DM Sans** | `--font-dm-sans` → `font-body` class |

Both loaded via `next/font/google` in `layout.tsx`.

### Key Layout Conventions

- Page padding: `p-6` / `p-8`
- Card padding: `p-4` / `p-5`
- Card gap: `gap-4`
- Border radius: cards `rounded-xl` · buttons `rounded-lg` · badges `rounded-full`
- Currency: Indian Rupee `₹` via `formatINR()` (`en-IN` locale: `₹1,82,050`)
- Recharts chart accent: `lime` (`#C8FF00`) fill + stroke, transparent grid lines

---

## 15. Known Issues & Gotchas

### Backend

| # | Issue | Impact | Fix / Status |
|---|-------|--------|--------------|
| 1 | **`pandas_datareader` incompatible with pandas ≥ 3.0** | FRED macro data (10Y Treasury, CPI, Unemployment) returns hardcoded fallback values | `try/except` in place; returns `{ ten_year_treasury: 4.28, cpi: 3.2, unemployment: 3.9 }` |
| 2 | **`structlog` must be in requirements.txt** | RAG upload crashes with `ImportError` if missing | Already added to `requirements.txt` |
| 3 | **Redis optional — silent fallback** | Cache is non-persistent and not shared across workers when Redis is absent | Logged at startup: `WARNING: Redis unreachable, using in-memory cache` |
| 4 | **`create_all()` does NOT add new columns** | New ORM model fields do not appear in DB automatically | Must run `python migrate.py` with `ALTER TABLE … ADD COLUMN IF NOT EXISTS` |
| 5 | **Supabase Session Pooler hangs `create_all()`** | Backend startup hangs on DigitalOcean | `main.py` detects `pooler.supabase.com` in URL and skips `create_all()` |
| 6 | **Mock data on dashboard** | Portfolio chart + AI insights cards use static mock data | Known debt — needs `/portfolios/{id}/summary` historical data endpoint |
| 7 | **Watchlist is client-side only** | Clearing browser data loses the watchlist | No backend persistence; future `/watchlist` endpoint would fix this |
| 8 | **Port 8000 conflict on Windows** | `OSError: [WinError 10048]` when uvicorn crashes without releasing port | `netstat -ano \| findstr :8000` then `taskkill /PID <PID> /F` |
| 9 | **`.env` leading space silently ignored** | Variables with leading spaces are not loaded by pydantic-settings | Ensure all `.env` lines are flush with the left margin |

### Authentication

| # | Issue | Symptom | Fix |
|---|-------|---------|-----|
| 10 | **ES256 vs HS256 JWT algorithm mismatch** | All auth calls return `401`; infinite login redirect | Check Supabase Dashboard → JWT Signing Keys. Set `SUPABASE_JWT_SECRET` to JWK JSON if ES256, plain string if HS256 |
| 11 | **Supabase confirmation email links to localhost** | Mobile users get `ERR_CONNECTION_REFUSED` on email click | Supabase Dashboard → Auth → URL Config → Site URL → set to production domain |
| 12 | **`NEXT_PUBLIC_SUPABASE_ANON` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Auth silently fails | Always use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with `_KEY` suffix) |

### Production (DigitalOcean)

| # | Issue | Symptom | Fix |
|---|-------|---------|-----|
| 13 | **IPv6 host not reachable** | `FATAL: could not connect: No route to host` | Use Supabase Session Pooler URL (IPv4) in production `DATABASE_URL` |
| 14 | **Hidden newline in DigitalOcean env var** | `FATAL: database "postgres\n" does not exist` | After pasting, cursor to end + press Backspace once to clear invisible newline |
| 15 | **DigitalOcean strips `/api` prefix** | All API calls 404 in production | `DOPathRewriteMiddleware` in `main.py` re-prepends `/api`. Already in place. |

### TypeScript / Frontend Build

| # | Issue | Fix Applied |
|---|-------|-------------|
| 16 | `ArtifactRenderer.tsx` — `ProgressBar` import mismatch | Updated import to `ShareholdingProgress` |
| 16 | `SkeletonThreeWayCompare.tsx` — `w`/`h` vs `width`/`height` props | Updated all props to full names |
| 16 | `artifact-assembler.ts` — `s.compare` typed `any[]` but accessed `.peers` | Cast to `(s.compare as any).peers` |

---

## 16. Database Migrations

FinSight AI does **not** use Alembic. It uses a hand-written `migrate.py` at the project root.

### Why Manual Migrations?

`Base.metadata.create_all()` only creates **new tables** — it never modifies existing ones. Whenever a column is added to a model file, that column must be added to the real Supabase DB via `ALTER TABLE`.

### Running the Migration

```bash
# From project root, with .venv active:
python migrate.py
```

Uses `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — idempotent and safe to run multiple times.

> ⚠️ Always use the **direct connection URL** (not the pooler) when running migrations. The Session Pooler cannot handle DDL operations reliably.

### Workflow for Adding a New Column

1. Add column to ORM model (`models/holding.py` etc.)
2. Add `ALTER TABLE … ADD COLUMN IF NOT EXISTS` to `migrate.py`
3. Run `python migrate.py` using the direct connection URL
4. Commit both files together
5. Notify teammates — shared DB is updated; others don't need to run it

### Migration History (as of May 2026)

**`holdings` table columns added via migration:**
`cost_basis` · `current_price` · `current_value` · `unrealized_pl` · `unrealized_pl_pct` · `realized_pl` · `realized_pl_pct` · `first_purchase_date` · `last_price_update`

**`transactions` table columns added via migration:**
`total_amount` · `realized_pl`

After adding `cost_basis`, the migration back-fills existing rows:
```sql
UPDATE holdings SET cost_basis = quantity * average_price WHERE cost_basis IS NULL;
```

---

## 17. Developer Quick Reference

### Local Development

```bash
# Backend
cd Full-Stack-Client-Dashboard
.\.venv\Scripts\activate
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

Health check: `http://localhost:8000/health` → `{"status": "ok"}`

### New Developer Onboarding

1. Clone: `git clone https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git`
2. Get secrets from team lead: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, Supabase URL + anon key, `GEMINI_API_KEY_1`
3. Create `.env` from `.env.example`
4. Create `frontend/.env.local` with Supabase URL and anon key
5. `pip install -r requirements.txt`
6. `cd frontend && npm install`
7. Start both servers and verify `http://localhost:8000/health` + `http://localhost:3000`

### Port 8000 Conflict (Windows)

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Git & Commit Conventions

Feature branches → PRs into `main`. Squash merge preferred.

| Prefix | When |
|--------|------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code restructure (no behavior change) |
| `chore:` | Dependency updates, config changes |

### Never Commit

`.env` · `.venv/` · `frontend/.env.local` · `frontend/node_modules/` · `frontend/.next/` · `backend/vector_db/` · `*.db`

---

*Document complete. Last updated: May 2026. Source of truth: `docs/Updated_gemini.md`.*
