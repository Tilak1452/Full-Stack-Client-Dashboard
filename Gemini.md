# FinSight AI — Full-Stack Project Reference Document

> **CRITICAL NOTICE FOR ANY AI OR HUMAN READING THIS:**
> This is the single source of truth for the FinSight AI project.
> Every file path, endpoint, data shape, and architectural decision documented here
> reflects the ACTUAL state of the codebase as of April 2026.
> Do NOT invent any file, endpoint, or data field that is not listed here.
> If something is not covered, ask the developer before assuming.
>
> **Last updated: April 20, 2026** — Migrated to Supabase Auth (GoTrue). Frontend directly calls Supabase for login/signup. Backend `get_current_user` now verifies Supabase JWTs. Removed custom JWT creation and DB password hashing. Added Supabase SDK client and pure ASGI path rewrite middleware for DigitalOcean deployed routing.

---

> [!CAUTION]
> ## STRICT RULE — PROTECTING EXISTING FEATURES FROM NEW MD FILES
>
> **This rule is NON-NEGOTIABLE and takes the HIGHEST PRIORITY over any conflicting instruction.**
>
> When the developer provides a **new Markdown (.md) file** containing detailed instructions for implementing a new feature, the AI **MUST** follow this exact protocol:
>
> ### Step 1 — Identify All Existing Feature Files
> Cross-reference the **folder structure and file listings in this Gemini.md document** (Section 1) to build a complete inventory of every file that already exists in the project. These are **protected files**.
>
> ### Step 2 — Analyze the New MD File for Conflicts
> Read the new MD file thoroughly and compare its proposed changes against the existing codebase. Specifically check for:
> - Files it wants to **modify, overwrite, or restructure** that already exist
> - Endpoints, database models, schemas, services, or components it wants to **replace or redefine** that are already implemented
> - Logic, styling, or behavior it wants to **alter** in files that are already working
>
> ### Step 3 — Resolve Conflicts by Preserving Existing Code
> If **ANY** conflict is detected between the new MD file's instructions and the existing implementation:
> - **NEVER modify, overwrite, or touch the existing feature file.** The current implementation is final and must remain exactly as it is.
> - **NEVER rename, restructure, or move existing files** to accommodate the new feature.
> - **Adapt the NEW feature's implementation** so that it integrates cleanly without disturbing any existing code.
> - If the new MD file says "replace X with Y" and X already exists in this project — **ignore that instruction** and find an alternative approach that leaves X untouched.
>
> ### Step 4 — Only Create or Modify NEW Files
> The AI should **only** create brand-new files or modify files that **do not yet exist** in the project. If the new feature requires touching a shared file (e.g., `main.py`, `layout.tsx`, `Sidebar.tsx`), the AI must **add to it** (append new imports, register new routers, add new nav items) without removing, rewriting, or reorganizing any existing code within that file.
>
> ### Step 5 — Report Conflicts Before Proceeding
> Before writing any code, the AI **MUST** present a clear summary of:
> - Which files from the new MD file conflict with existing features
> - What the AI will do differently to avoid breaking existing functionality
> - Which new files will be created
>
> The developer must approve this conflict-resolution plan before the AI proceeds.
>
> **In short: Our existing code is sacred. New features must work AROUND it, never THROUGH it.**

---

## TABLE OF CONTENTS

- [Section 0 — What This Project Is](#section-0--what-this-project-is)
- [Section 1 — Complete Folder Structure](#section-1--complete-folder-structure)
- [Section 2 — Technology Stack](#section-2--technology-stack)
- [Section 3 — Environment Setup](#section-3--environment-setup)
- [Section 4 — How Frontend and Backend Connect](#section-4--how-frontend-and-backend-connect)
- [Section 5 — Backend Architecture](#section-5--backend-architecture)
- [Section 6 — Complete API Reference](#section-6--complete-api-reference)
- [Section 7 — Database Models & Schemas](#section-7--database-models--schemas)
- [Section 8 — Frontend Architecture](#section-8--frontend-architecture)
- [Section 9 — API Client Layer (Frontend → Backend)](#section-9--api-client-layer-frontend--backend)
- [Section 10 — Design System & Styling](#section-10--design-system--styling)
- [Section 11 — Services Deep-Dive (Backend)](#section-11--services-deep-dive-backend)
- [Section 12 — AI & RAG Pipeline](#section-12--ai--rag-pipeline)
- [Section 13 — Known Issues & Notes](#section-13--known-issues--notes)
- [Section 14 — Git & Collaboration](#section-14--git--collaboration)
- [Section 15 — Database Migrations Guide](#section-15--database-migrations-guide)

---

## SECTION 0 — WHAT THIS PROJECT IS

FinSight AI is a **production-grade financial research dashboard** that combines:
- A **Next.js 14 React frontend** (dark-themed, responsive UI for Indian stock markets)
- A **FastAPI Python backend** (AI agents, portfolio management, real-time data, alerts)

Both the frontend and backend live inside a **single monorepo** called `Full-Stack-Client-Dashboard`.

The frontend communicates with the backend over HTTP REST APIs and WebSocket connections. The backend fetches live market data from Yahoo Finance, runs technical analysis, manages portfolios in a Supabase (PostgreSQL) cloud database, and can perform AI-powered stock analysis using LLMs (Groq, OpenAI, or Gemini).

**Key Features:**
- Live Indian market indices (NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT)
- Individual stock data with RSI, SMA, EMA technical indicators
- AI Research Agent (chat interface for financial Q&A)
- Portfolio management (CRUD operations with holdings and transactions)
- Market alerts system (price-based and indicator-based triggers)
- News aggregation from Yahoo Finance RSS with VADER sentiment analysis
- RAG (Retrieval-Augmented Generation) document upload and semantic search
- WebSocket live price streaming
- Modern Portfolio Theory (MPT) optimization using PyPortfolioOpt

---

## SECTION 1 — COMPLETE FOLDER STRUCTURE

This is the exact folder structure on disk. Every file path referenced anywhere must match this.

```
Full-Stack-Client-Dashboard/              ← ROOT (open this in your editor)
│
├── .env                                  ← Python backend secrets (GITIGNORED — never commit)
├── .env.example                          ← Safe template for .env (empty values, committed to Git)
├── .gitignore                            ← Blocks node_modules, .venv, .env, *.db from Git
├── requirements.txt                      ← Python dependencies (pip install -r requirements.txt)
├── git_guide.md                          ← Team collaboration guide for Git/GitHub workflow
│
├── backend/                              ← FastAPI Python backend
│   ├── __init__.py
│   ├── pytest.ini                        ← Pytest configuration
│   ├── vector_db/                        ← ChromaDB local vector store files (for RAG)
│   ├── tests/                            ← Test files
│   └── app/                              ← FastAPI application core
│       ├── __init__.py
│       ├── main.py                       ← FastAPI app entry point (uvicorn runs this)
│       │
│       ├── api/                          ← API route handlers (thin controllers, no business logic)
│       │   ├── __init__.py
│       │   ├── auth.py                   ← GET /api/v1/auth/me (Returns user info from verified Supabase JWT)
│       │   ├── analyze.py                ← POST /api/v1/analyze (AI analysis)
│       │   ├── portfolio.py              ← CRUD /portfolios/* (portfolio management)
│       │   ├── assets.py                 ← GET /api/v1/assets/* (macro, options, MPT)
│       │   ├── alerts.py                 ← CRUD /api/v1/alerts/* (market alerts)
│       │   ├── stock.py                  ← GET /api/v1/stock/* (stock data + history)
│       │   ├── news.py                   ← GET /api/v1/news (Yahoo Finance RSS)
│       │   ├── market.py                 ← GET /api/v1/indices, /api/v1/movers
│       │   ├── rag.py                    ← POST /rag/upload, GET /rag/query
│       │   └── stream.py                 ← WS /api/v1/stream/price/{symbol}
│       │
│       ├── core/                         ← Infrastructure layer
│       │   ├── __init__.py
│       │   ├── config.py                 ← Pydantic Settings loaded from root .env
│       │   ├── security.py               ← Supabase JWT verification (decode_access_token)
│       │   ├── database.py               ← SQLAlchemy engine, session factory, Base
│       │   ├── cache.py                  ← Redis (with in-memory fallback) caching layer
│       │   ├── circuit_breaker.py         ← Circuit breaker pattern for external APIs
│       │   ├── dependencies.py           ← FastAPI get_db() dependency injection
│       │   └── telemetry.py              ← Performance metrics middleware
│       │
│       ├── services/                     ← Business logic layer
│       │   ├── __init__.py
│       │   ├── auth_service.py           ← Stub file (Authentication logic moved to Supabase)
│       │   ├── stock_service.py          ← yFinance wrapper: price, history, indicators (25KB)
│       │   ├── news_service.py           ← Yahoo RSS + NewsAPI + VADER sentiment
│       │   ├── macro_service.py          ← FRED economic data + commodity prices
│       │   ├── options_service.py        ← Options chain + Black-Scholes pricing
│       │   ├── mpt_service.py            ← PyPortfolioOpt Max Sharpe optimization
│       │   ├── portfolio_service.py      ← Portfolio CRUD + FIFO P&L + transaction recording
│       │   ├── price_update_job.py       ← APScheduler background job: refreshes holding prices every 5 min
│       │   ├── alert_service.py          ← APScheduler background alert polling
│       │   ├── pdf_service.py            ← PDF parsing service
│       │   ├── indicators.py             ← RSI, SMA, EMA technical indicator calculations
│       │   ├── categorizer.py            ← Query categorization for the AI agent
│       │   └── data_provider.py          ← Unified data fetching abstraction
│       │
│       ├── ai/                           ← AI and LLM modules
│       │   ├── __init__.py
│       │   ├── analyst.py                ← LangChain/LangGraph AI agent orchestrator (15KB)
│       │   ├── scoring.py                ← AI confidence scoring
│       │   ├── moderation.py             ← Input moderation and safety checks
│       │   ├── hallucination_check.py    ← LLM output hallucination detection
│       │   ├── response_limits.py        ← Output length and format enforcement
│       │   ├── timeout_guard.py          ← LLM call timeout protection
│       │   ├── document_loader.py        ← PDF/TXT document parser (uses structlog)
│       │   ├── vector_store_chroma.py    ← Local ChromaDB vector store implementation
│       │   └── vector_store_pinecone.py  ← Cloud Pinecone vector store implementation
│       │
│       ├── models/                       ← SQLAlchemy ORM models (database table definitions)
│       │   ├── __init__.py               ← Registers all models for Base.metadata.create_all()
│       │   ├── user.py                   ← User table (Authentication)
│       │   ├── portfolio.py              ← Portfolio table
│       │   ├── holding.py                ← Holding table (belongs to Portfolio)
│       │   ├── transaction.py            ← Transaction table (immutable audit trail)
│       │   └── alert.py                  ← Alert table (market alert rules)
│       │
│       ├── schemas/                      ← Pydantic request/response validation models
│       │   ├── __init__.py
│       │   ├── auth.py                   ← UserCreate, Token Request/Response schemas
│       │   ├── analyze.py                ← AnalyzeRequest, AnalyzeResponse, HealthResponse
│       │   ├── analysis.py               ← FinancialAnalysisResult, TechnicalSignal, SentimentSignal
│       │   ├── stock.py                  ← StockDataResponse
│       │   ├── news.py                   ← NewsArticle, NewsResponse
│       │   └── portfolio.py              ← Portfolio request/response schemas
│       │
│       ├── data/                         ← Empty placeholder package
│       ├── sentiment/                    ← Empty placeholder package
│       ├── portfolio/                    ← Empty placeholder package
│       └── utils/                        ← Empty placeholder package
│
├── frontend/                             ← Next.js 14 React frontend
│   ├── .env.local                        ← Frontend env vars (NEXT_PUBLIC_API_URL, WS_URL)
│   ├── package.json                      ← Node.js dependencies
│   ├── package-lock.json
│   ├── tailwind.config.ts                ← Tailwind CSS with custom dark theme
│   ├── tsconfig.json                     ← TypeScript configuration
│   ├── postcss.config.js
│   ├── next-env.d.ts
│   ├── Frontend.md                       ← Frontend documentation
│   │
│   └── src/
│       ├── middleware.ts                 ← Next.js Middleware for protected routes
│       ├── app/                          ← Next.js App Router pages
│       │   ├── globals.css               ← Global styles (Tailwind base + scrollbar + reset)
│       │   ├── layout.tsx                ← Root layout: Sidebar + Providers wrapper
│       │   ├── providers.tsx             ← React Query (TanStack) QueryClientProvider
│       │   ├── page.tsx                  ← Root "/" → redirects to /dashboard
│       │   │
│       │   ├── auth/
│       │   │   ├── login/page.tsx        ← Login page
│       │   │   └── signup/page.tsx       ← Signup page
│       │   │
│       │   ├── dashboard/
│       │   │   └── page.tsx              ← Main dashboard: indices, chart, watchlist, movers, news
│       │   ├── stock/
│       │   │   └── [symbol]/
│       │   │       └── page.tsx          ← Individual stock detail page (dynamic route)
│       │   ├── ai-research/
│       │   │   └── page.tsx              ← AI chat interface with agent step animation
│       │   ├── portfolio/
│       │   │   └── page.tsx              ← Portfolio management page
│       │   ├── watchlist/
│       │   │   └── page.tsx              ← Watchlist (localStorage-based)
│       │   ├── news/
│       │   │   └── page.tsx              ← Full news feed page
│       │   ├── alerts/
│       │   │   └── page.tsx              ← Alert management page (CRUD via API)
│       │   └── settings/
│       │       └── page.tsx              ← Static settings page (no backend needed)
│       │
│       ├── components/                   ← Shared UI components
│       │   ├── Icons.tsx                 ← SVG icon components (IcSend, IcPlus, etc.)
│       │   ├── Sidebar.tsx               ← Navigation sidebar
│       │   ├── TopBar.tsx                ← Page header bar
│       │   ├── AddToPortfolioModal.tsx   ← Modal: add/buy holdings into a portfolio
│       │   ├── SellHoldingModal.tsx      ← Modal: sell shares with FIFO P&L preview
│       │   ├── FundamentalTab.tsx        ← Stock detail: fundamental data tab
│       │   ├── TechnicalTab.tsx          ← Stock detail: RSI/SMA/EMA indicators tab
│       │   ├── IndicatorCard.tsx         ← Reusable card for displaying a single indicator value
│       │   ├── TechnicalSummaryGauge.tsx ← Visual gauge for overall technical rating
│       │   ├── SupportResistanceBar.tsx  ← Bar showing support/resistance price range
│       │   └── TradingViewWidget.tsx     ← Embedded TradingView chart widget
│       │
│       └── lib/                          ← API clients, hooks, and utilities
│           ├── api-client.ts             ← Base fetch wrapper (apiFetch + ApiError class)
│           ├── auth.api.ts               ← authApi: login(), register(), logout() via Supabase
│           ├── supabase.ts               ← Supabase JS client instance
│           ├── auth-context.tsx          ← AuthProvider for global auth state
│           ├── stock.api.ts              ← stockApi: getFullData(), getHistory()
│           ├── portfolio.api.ts          ← portfolioApi: list(), create(), getSummary(), buyHolding(), sellHolding(), optimize()
│           ├── alerts.api.ts             ← alertsApi: getActive(), create(), delete()
│           ├── ai.api.ts                 ← aiApi: analyze()
│           ├── news.api.ts               ← newsApi: getLatest()
│           ├── market.api.ts             ← marketApi: getIndices(), getMovers()
│           ├── useWebSocketPrice.ts       ← Custom React hook for live WebSocket prices
│           ├── utils.ts                  ← formatINR(), formatPct(), formatDate(), formatTime()
│           └── mock.ts                   ← Static mock data (used for portfolio chart + AI insights)
```

---

## SECTION 2 — TECHNOLOGY STACK

### Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Python** | Runtime | 3.11+ |
| **FastAPI** | Web framework / API server | Latest |
| **Uvicorn** | ASGI server (runs FastAPI) | Latest (with `[standard]` extras) |
| **SQLAlchemy** | ORM / database abstraction | 2.x |
| **Supabase (PostgreSQL)** | Cloud-hosted relational database | Latest |
| **psycopg2-binary** | PostgreSQL Python adapter | Latest |
| **SQLite** | Local database (development fallback only) | Built-in |
| **Pydantic** + **pydantic-settings** | Data validation + config management | v2 |
| **yfinance** | Yahoo Finance market data | Latest |
| **LangChain** + **LangGraph** | LLM orchestration framework | Latest |
| **langchain-groq** / **langchain-openai** / **langchain-google-genai** | LLM providers | Latest |
| **ChromaDB** | Local vector database (RAG) | Latest |
| **Pinecone** | Cloud vector database (RAG, optional) | Latest |
| **PyPortfolioOpt** | Modern Portfolio Theory optimizer | Latest |
| **APScheduler** | Background job scheduler (alert polling) | Latest |
| **SlowAPI** | Rate limiting middleware | Latest |
| **VADER Sentiment** | News sentiment scoring | Latest |
| **pandas** + **pandas-datareader** | Data processing + FRED economic data | Latest |
| **Redis** | Optional caching (falls back to in-memory) | Latest |
| **structlog** | Structured logging (used in document_loader) | Latest |

### Frontend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Next.js** | React framework (App Router) | 14.2.5 |
| **React** | UI library | 18.3.1 |
| **TypeScript** | Type safety | 5.x |
| **TailwindCSS** | Utility-first CSS framework | 3.4.4 |
| **@tanstack/react-query** | Server state management (data fetching/caching) | 5.x |
| **Recharts** | Charting library (AreaChart) | 2.12.7 |
| **Lucide React** | Icon library | 0.428.0 |
| **Outfit** + **DM Sans** | Google Fonts (typography) | — |

---

## SECTION 3 — ENVIRONMENT SETUP

### 3.1 — Prerequisites
- **Python 3.11+** installed and available in PATH
- **Node.js 18+** and `npm` installed
- **Git** installed (for collaboration)

### 3.2 — Create Python Virtual Environment

Run from the project root (`Full-Stack-Client-Dashboard/`):

```bash
# Create the virtual environment
python -m venv .venv

# Activate it
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt

# Verify
python -c "import fastapi; print('FastAPI OK:', fastapi.__version__)"
```

> **IMPORTANT:** The `.venv/` folder is machine-specific and is GITIGNORED. Each developer must create their own from `requirements.txt`. Never copy `.venv/` between computers.

### 3.3 — Backend Environment Variables

The backend reads its config from `Full-Stack-Client-Dashboard/.env` using pydantic-settings. The `.env` file is **GITIGNORED** for security.

A safe template with empty values is committed as `.env.example`. New developers should:
1. Copy `.env.example` to `.env`
2. Fill in the actual API keys (ask the team lead privately)

**Required variables:**
```env
# Supabase PostgreSQL connection string (required)
DATABASE_URL=postgresql+psycopg2://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres

# Supabase Auth Secret (required for verifying backend API calls)
SUPABASE_JWT_SECRET=your_jwt_secret_from_api_settings

# At least ONE LLM key is required (Groq is free)
GROQ_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Optional external data sources
NEWS_API_KEY=
FRED_API_KEY=

# Optional vector DB (falls back to local ChromaDB if missing)
Pinecone_Vector_Database=

# Optional observability
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=financial-research-agent
LANGCHAIN_API_KEY=
```

**Config loading path:** `backend/app/core/config.py` calculates the root directory by going up 3 levels from its own location (`backend/app/core/`) and looks for `.env` there.

### 3.4 — Frontend Environment Variables

File: `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
```

The `NEXT_PUBLIC_` prefix is mandatory — without it, Next.js will not expose these to the browser.

### 3.5 — Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3.6 — Running Both Servers

You need **two simultaneous terminal windows**:

**Terminal 1 — Backend (runs on port 8000):**
```bash
# From project root
.\.venv\Scripts\activate
cd backend
uvicorn app.main:app --reload
```
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

**Terminal 2 — Frontend (runs on port 3000):**
```bash
# From project root
cd frontend
npm run dev
```
- Dashboard: `http://localhost:3000`

### 3.7 — The `uvicorn` Command Explained

`uvicorn app.main:app --reload` breaks down as:
- **`uvicorn`** — The ASGI web server (installed via pip, located in `.venv/Scripts/`)
- **`app.main`** — Python module path: folder `app/`, file `main.py`
- **`:app`** — The FastAPI instance variable inside `main.py`
- **`--reload`** — Auto-restart on file changes (development mode only)

---

## SECTION 4 — HOW FRONTEND AND BACKEND CONNECT

The frontend and backend are **completely separate processes** communicating over HTTP on localhost.

```
┌─────────────────────┐         HTTP / WebSocket          ┌─────────────────────┐
│   Next.js Frontend  │ ◄──────────────────────────────► │   FastAPI Backend   │
│   localhost:3000     │                                   │   localhost:8000    │
│                      │  GET /api/v1/indices              │                     │
│   React components   │  POST /api/v1/analyze             │   Python services   │
│   call apiFetch()    │  WS /api/v1/stream/price/AAPL     │   Supabase + yFinance│
└─────────────────────┘                                   └─────────────────────┘
```

**Connection mechanism:**
1. `frontend/.env.local` sets `NEXT_PUBLIC_API_URL=http://localhost:8000`
2. `frontend/src/lib/api-client.ts` reads this and creates a base `apiFetch()` function
3. All API modules (`stock.api.ts`, `portfolio.api.ts`, etc.) call `apiFetch()` with specific endpoints
4. The backend's CORS middleware (`allow_origins=["*"]`) permits requests from port 3000

**If the backend is not running**, the frontend catches the network error and surfaces: *"Cannot reach backend server. Is it running on port 8000?"*

---

## SECTION 5 — BACKEND ARCHITECTURE

### main.py — Application Entry Point

Location: `backend/app/main.py`

**Responsibilities:**
1. Configures structured logging (level from `settings.log_level`)
2. Creates the FastAPI app instance with Swagger/ReDoc documentation
3. Registers SlowAPI rate limiting middleware (20 requests/minute default)
4. Registers CORS middleware (`allow_origins=["*"]` for development)
5. Registers global exception handlers (422 validation, 500 catch-all)
6. On startup: validates DB connection, runs `Base.metadata.create_all()`, starts APScheduler for alerts, starts APScheduler for price updates (every 5 min via `price_update_job.py`)
7. On shutdown: stops both APScheduler instances
8. Registers all 9 routers

> **IMPORTANT:** `Base.metadata.create_all()` only creates **new tables**. It does NOT add new columns to existing tables. If new columns are added to a model, you MUST run `migrate.py` manually. See Section 15.

**Router registration order:**
```python
app.include_router(analyze_router)      # /api/v1/analyze
app.include_router(portfolio_router)    # /portfolios/*
app.include_router(stream_router)       # /api/v1/stream/*
app.include_router(rag_router)          # /rag/*
app.include_router(assets_router)       # /api/v1/assets/*
app.include_router(alerts_router)       # /api/v1/alerts/*
app.include_router(stock.router)        # /api/v1/stock/*
app.include_router(news.router)         # /api/v1/news
app.include_router(market.router)       # /api/v1/indices, /api/v1/movers
```

### Core Layer

| File | Purpose |
|------|---------|
| `config.py` | Loads `.env` from project root via pydantic-settings. Exposes `settings` singleton. Fields: `app_name`, `debug`, `log_level`, `database_url` (required, from env), `openai_api_key`, `gemini_api_key`, `groq_api_key`, `news_api_key`, `redis_url`. |
| `database.py` | Creates SQLAlchemy engine (Supabase PostgreSQL with connection pooling, SQLite fallback supported). Exports `engine`, `SessionLocal`, `Base`, `validate_db_connection()`. PostgreSQL uses `pool_pre_ping`, `pool_size=5`, `max_overflow=10`, `pool_recycle=1800`. |
| `dependencies.py` | `get_db()` generator: yields a session, commits on success, rollbacks on error, always closes. Used via `Depends(get_db)`. |
| `cache.py` | `CacheService` class: tries Redis, falls back to in-memory dict. Exports `cache` singleton with `.get()`, `.set()`, `.clear()`. |
| `circuit_breaker.py` | Circuit breaker pattern using `pybreaker` for external API calls. |
| `telemetry.py` | HTTP middleware that logs request duration and path. |

---

## SECTION 6 — COMPLETE API REFERENCE

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/me` | Validates Supabase JWT and returns user details |

### Analyze
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `POST` | `/api/v1/analyze` | Submit a financial question → get AI analysis result | 5/min |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/portfolios/` | List all portfolios |
| `POST` | `/portfolios/` | Create a new portfolio |
| `POST` | `/portfolios/{id}/holdings` | Add or update a holding (legacy — prefer /transactions) |
| `POST` | `/portfolios/{id}/transactions` | Record a BUY or SELL transaction (preferred) |
| `GET` | `/portfolios/{id}/summary` | Get aggregated portfolio summary with live P&L |
| `POST` | `/portfolios/{id}/holdings/{symbol}/sell` | Dedicated sell endpoint — calculates FIFO realized P&L |
| `GET` | `/portfolios/{id}/optimize` | Run MPT optimization (needs ≥2 holdings) |

### Stock
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/stock/{symbol}` | Full stock data: price + RSI/SMA/EMA indicators |
| `GET` | `/api/v1/stock/{symbol}/history?period=1mo&interval=1d` | OHLCV historical candle data |

### Market
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/indices` | Live data for 4 Indian market indices (NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT) |
| `GET` | `/api/v1/movers` | Top 2 gainers + Top 2 losers from a basket of 10 large-cap Indian stocks |

### News
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/news?limit=20` | Latest financial news with sentiment labels |

### Assets
| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `GET` | `/api/v1/assets/macro` | Macro indicators (FRED 10Y Treasury, CPI, Unemployment, Gold, Oil) | 10/min |
| `GET` | `/api/v1/assets/options/{symbol}` | Options chain for a ticker | 10/min |
| `POST` | `/api/v1/assets/options/pricer` | Black-Scholes theoretical option pricing | — |
| `POST` | `/api/v1/assets/mpt/optimize` | MPT optimization on custom tickers | 5/min |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/alerts/` | Create a new alert rule |
| `GET` | `/api/v1/alerts/active` | List all active alerts |
| `GET` | `/api/v1/alerts/notifications` | Get last 10 triggered notifications |
| `DELETE` | `/api/v1/alerts/{id}` | Delete an alert |

### RAG (Document Intelligence)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/rag/upload` | Upload PDF/TXT/MD/CSV → parse, split, embed into vector store |
| `GET` | `/rag/query?q=...&score_threshold=1.5` | Semantic search over embedded documents |

### WebSocket
| Protocol | Endpoint | Description |
|----------|----------|-------------|
| `WS` | `/api/v1/stream/price/{symbol}` | Live price stream (pushes JSON every 5 seconds) |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness probe: returns `"ok"` or `"degraded"` |
| `GET` | `/docs` | Swagger UI (interactive API docs) |
| `GET` | `/redoc` | ReDoc API documentation |

---

## SECTION 7 — DATABASE MODELS & SCHEMAS

### Database: Supabase (PostgreSQL)

Location: Supabase cloud (PostgreSQL).
Connection configured via `DATABASE_URL` in `.env`.
Tables are auto-created by SQLAlchemy on first backend startup via `Base.metadata.create_all(bind=engine)`.
Supabase dashboard: https://supabase.com/dashboard

### ORM Models (backend/app/models/)

#### User (table: `users`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `email` | String(255) | NOT NULL, UNIQUE, INDEXED |
| `hashed_password` | String | NOT NULL |
| `created_at` | DateTime(tz) | server_default=now() |

#### Portfolio (table: `portfolios`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `name` | String(255) | NOT NULL, UNIQUE, INDEXED |
| `created_at` | DateTime(tz) | server_default=now() |

Relationships: `holdings` (one-to-many, cascade delete), `transactions` (one-to-many, cascade delete)

#### Holding (table: `holdings`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `portfolio_id` | Integer | FK → portfolios.id, CASCADE, INDEXED |
| `symbol` | String(20) | NOT NULL, INDEXED |
| `quantity` | Float | NOT NULL |
| `average_price` | Float | NOT NULL |
| `cost_basis` | Float | NULLABLE — total invested (quantity × average_price) |
| `current_price` | Float | NULLABLE — last fetched market price (updated by background job) |
| `current_value` | Float | NULLABLE — quantity × current_price |
| `unrealized_pl` | Float | NULLABLE — current_value − cost_basis |
| `unrealized_pl_pct` | Float | NULLABLE — (unrealized_pl / cost_basis) × 100 |
| `realized_pl` | Float | default=0.0 — cumulative P&L from completed FIFO sales |
| `realized_pl_pct` | Float | default=0.0 — realized_pl as % of original cost_basis |
| `first_purchase_date` | DateTime(tz) | server_default=now() — when position was first opened |
| `last_price_update` | DateTime(tz) | NULLABLE — when current_price was last refreshed |

> **NOTE:** The columns `cost_basis` through `last_price_update` were added via `migrate.py` (ALTER TABLE). They do NOT exist in databases created before April 16, 2026 unless the migration was run.

#### Transaction (table: `transactions`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `portfolio_id` | Integer | FK → portfolios.id, CASCADE, INDEXED |
| `symbol` | String(20) | NOT NULL, INDEXED |
| `transaction_type` | Enum('buy', 'sell') | NOT NULL |
| `quantity` | Float | NOT NULL |
| `price` | Float | NOT NULL |
| `total_amount` | Float | NULLABLE — quantity × price (added via migration) |
| `realized_pl` | Float | NULLABLE — FIFO realized P&L for SELL transactions (added via migration) |
| `timestamp` | DateTime(tz) | server_default=now() |

#### Alert (table: `alerts`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Integer | PK, INDEXED |
| `symbol` | String | NOT NULL, INDEXED |
| `condition` | Enum(AlertCondition) | NOT NULL |
| `threshold` | Float | NOT NULL |
| `status` | Enum('active','triggered','expired') | default='active' |
| `message` | String | NULLABLE |
| `created_at` | DateTime(tz) | server_default=now() |
| `triggered_at` | DateTime(tz) | NULLABLE |

Valid `condition` values: `price_above`, `price_below`, `rsi_above`, `rsi_below`, `sma_cross_above`, `sma_cross_below`

### Pydantic Schemas (backend/app/schemas/)

#### AnalyzeRequest
```json
{ "question": "Analyze RELIANCE.NS stock" }
```
Constraints: `min_length=3`, `max_length=1000`

#### FinancialAnalysisResult (Response for /api/v1/analyze)
```json
{
  "verdict": "BULLISH",          // Literal: "BULLISH" | "BEARISH" | "NEUTRAL"
  "confidence": 72,              // 0-100
  "reasoning_summary": "...",
  "technical_signals": [
    { "indicator": "RSI", "value": 58.3, "interpretation": "Neutral momentum" }
  ],
  "sentiment_signals": [
    { "source": "Yahoo Finance News", "score": 0.34, "interpretation": "Mildly positive" }
  ],
  "risk_assessment": "Key risks include..."
}
```

#### StockDataResponse
```json
{
  "symbol": "RELIANCE.NS",
  "current_price": 2847.50,
  "currency": "INR",
  "exchange": "NSI",
  "market_state": "CLOSED",
  "previous_close": 2820.00,
  "day_high": 2860.00,
  "day_low": 2835.00,
  "volume": 4210000,
  "market_cap": 19280000000000,
  "pe_ratio": 24.8,
  "rsi": 58.3,
  "sma": 2810.50,
  "ema": 2825.30,
  "timestamp": "2026-04-14T10:00:00Z"
}
```

#### NewsArticle
```json
{
  "title": "RBI holds repo rate at 6.5%",
  "source": "Yahoo Finance",
  "published_at": "2026-04-14T08:00:00Z",
  "url": "https://...",
  "summary": "Monetary Policy Committee voted...",
  "sentiment": "neutral"
}
```

---

## SECTION 8 — FRONTEND ARCHITECTURE

### Root Layout (`layout.tsx`)
- Wraps entire app in `<Providers>` (React Query) + `<Sidebar>`
- Uses Google Fonts: **Outfit** (headings) and **DM Sans** (body)
- Full-height flex layout: sidebar on left, content on right

### Providers (`providers.tsx`)
- Creates a `QueryClient` with:
  - `staleTime: 30_000` (30 seconds before data is considered stale)
  - `gcTime: 5 * 60_000` (5 minutes garbage collection)
  - `retry: 1` (retry failed requests once)
  - `refetchOnWindowFocus: false` (don't refetch when switching tabs)

### Pages

| Route | File | Data Source | Description |
|-------|------|------------|-------------|
| `/` | `page.tsx` | — | Redirects to `/dashboard` |
| `/dashboard` | `dashboard/page.tsx` | `marketApi`, `newsApi`, `stockApi`, `mock.ts` | Main dashboard with indices cards, portfolio chart, watchlist, movers, news preview |
| `/stock/[symbol]` | `stock/[symbol]/page.tsx` | `stockApi`, `useWebSocketPrice` | Individual stock detail with chart, indicators, live price |
| `/ai-research` | `ai-research/page.tsx` | `aiApi` | Chat interface: sends questions to `/api/v1/analyze`, shows animated agent steps |
| `/portfolio` | `portfolio/page.tsx` | `portfolioApi` | Portfolio management: list portfolios, view holdings, add holdings |
| `/watchlist` | `watchlist/page.tsx` | `stockApi` + localStorage | User's watchlist stored in `localStorage('finsight_watchlist')` |
| `/news` | `news/page.tsx` | `newsApi` | Full news feed with sentiment badges |
| `/alerts` | `alerts/page.tsx` | `alertsApi` | Alert management: view active alerts, delete, toggle status |
| `/settings` | `settings/page.tsx` | — | Static settings form (no backend integration yet) |

### What Still Uses Mock Data
The dashboard page (`dashboard/page.tsx`) still imports from `mock.ts` for:
- `portfolioHistory` — The portfolio value area chart data
- `aiInsightsData` — The 3 AI insight cards in the sidebar panel

Everything else (indices, movers, news, watchlist prices) is fetched live from the backend.

---

## SECTION 9 — API CLIENT LAYER (FRONTEND → BACKEND)

### Base Client (`api-client.ts`)
```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>
```
- Auto-prepends `BASE_URL` to all endpoints
- Sets `Content-Type: application/json` header
- Throws `ApiError(0, ...)` on network failure (backend unreachable)
- Throws `ApiError(status, detail)` on non-200 responses
- Returns parsed JSON response

### API Modules

| Module | Object | Methods |
|--------|--------|---------|
| `stock.api.ts` | `stockApi` | `getFullData(symbol)`, `getHistory(symbol, period, interval)` |
| `auth.api.ts` | `authApi` | Maps to Supabase Auth (`login`, `register`, `logout`, `getUser`) |
| `portfolio.api.ts` | `portfolioApi` | `list()`, `create(payload)`, `getSummary(id)`, `addHolding(id, payload)`, `recordTransaction(id, payload)`, `buyHolding(portfolioId, symbol, qty, price)`, `sellHolding(portfolioId, symbol, payload)`, `optimize(id)` |
| `alerts.api.ts` | `alertsApi` | `getActive()`, `getNotifications()`, `create(payload)`, `delete(id)` |
| `ai.api.ts` | `aiApi` | `analyze(question)` |
| `news.api.ts` | `newsApi` | `getLatest(limit)` |
| `market.api.ts` | `marketApi` | `getIndices()`, `getMovers()` |

### WebSocket Hook (`useWebSocketPrice.ts`)
```typescript
function useWebSocketPrice(symbol: string | null): {
  price: number | null;
  connected: boolean;
  error: string | null;
}
```
- Connects to `ws://localhost:8000/api/v1/stream/price/{symbol}`
- Auto-reconnects on symbol change
- Cleans up WebSocket on component unmount

---

## SECTION 10 — DESIGN SYSTEM & STYLING

### Theme: Premium Dark Mode

Defined in `frontend/tailwind.config.ts`:

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0B0D11` | Page background |
| `sidebar` | `#090B0F` | Sidebar background |
| `card` | `#12141B` | Card backgrounds |
| `card2` | `#0E1014` | Nested card / secondary card |
| `border` | `rgba(255,255,255,0.07)` | Subtle card borders |
| `border-hi` | `rgba(255,255,255,0.13)` | Higher contrast borders |
| `lime` | `#C8FF00` | Primary accent (buttons, highlights, charts) |
| `lime-dim` | `rgba(200,255,0,0.12)` | Lime backgrounds |
| `text` | `#ECEEF2` | Primary text |
| `muted` | `#636B7A` | Secondary/label text |
| `dim` | `#1D2028` | Muted backgrounds |
| `green` | `#4ADE80` | Positive/up indicators |
| `red` | `#F87171` | Negative/down indicators |
| `amber` | `#FBBF24` | Warning / triggered alerts |
| `purple` | `#9B72FF` | Accent color |
| `pink` | `#FF4FD8` | Accent color |

### Typography
- **Headings:** Outfit (Google Font)
- **Body:** DM Sans (Google Font)
- Custom scrollbar styling (4px thin, transparent track)

### Currency
All prices are displayed in **Indian Rupees (₹)** using `toLocaleString('en-IN')`.

---

## SECTION 11 — SERVICES DEEP-DIVE (BACKEND)

### stock_service.py (15KB — the largest service)
- Singleton `stock_service` instance
- `get_current_price(symbol)` → Returns dict with `price`, `change_pct`, `market_state`, `day_high`, `day_low`, `previous_close`, `volume`
- `get_full_stock_data(symbol)` → Returns price + RSI/SMA/EMA indicators
- `get_historical_data(symbol, period, interval)` → Returns OHLCV candle data
- Uses `yfinance.Ticker` with `fast_info` for speed
- Uses circuit breaker (`pybreaker`) for resilience

### news_service.py
- Singleton `news_service` instance
- `get_news(limit)` → Fetches from Yahoo Finance RSS feed
- Applies VADER sentiment analysis to each article title
- Returns list of dicts with `title`, `source`, `published_at`, `url`, `summary`, `sentiment`

### portfolio_service.py
- `get_all_portfolios(db)` → Returns all Portfolio ORM objects
- `create_portfolio(db, name)` → Creates portfolio (409 if duplicate name)
- `add_holding(db, portfolio_id, symbol, quantity, price)` → Upserts holding with weighted average cost formula
- `record_transaction(db, portfolio_id, symbol, transaction_type, quantity, price)` → Creates immutable transaction + updates holding. For BUY: upserts holding with weighted avg cost. For SELL: validates quantity, calculates FIFO realized P&L, reduces holding quantity (deletes row if all shares sold).
- `update_holding_prices(db, holding_id, current_price)` → Updates `current_price`, `current_value`, `unrealized_pl`, `unrealized_pl_pct`, `last_price_update` on a holding. Called by `price_update_job.py`.
- `get_portfolio_summary(db, portfolio_id)` → Returns aggregated summary with `total_invested`, `total_current_value`, `total_unrealized_pl`, `total_unrealized_pl_pct`, `total_realized_pl`, and full `holdings` list with per-holding P&L.

### price_update_job.py *(NEW)*
- Background job registered with APScheduler in `main.py` — runs every **5 minutes**
- `update_all_holdings_prices()` → Queries all distinct symbols with active holdings, batch-fetches prices via `yfinance`, calls `update_holding_prices()` for each holding, commits all updates in one transaction
- `_batch_fetch_prices(symbols)` → Uses `yfinance.Ticker.fast_info.last_price` (falls back to `previous_close`)  
- Errors are caught per-symbol so one bad ticker doesn't block others

### alert_service.py
- `create_alert(symbol, condition, threshold)` → Persists to DB
- `get_all_active_alerts()` → Returns alerts with status='active'
- `get_recent_alerts()` → Last 10 triggered alerts
- `delete_alert(id)` → Deletes from DB
- `start_scheduler()` / `stop_scheduler()` → APScheduler that polls every 300s to evaluate alert conditions against live prices

### macro_service.py
- `get_macro_dashboard()` → Returns 10Y Treasury, CPI, Unemployment (from FRED) + Gold, Oil (from yFinance)
- Has hardcoded fallback values when the circuit breaker trips
- **Known issue:** `pandas_datareader` is incompatible with latest `pandas`. A try/except wrapper in the import prevents the backend from crashing. FRED data may return fallback values.

### mpt_service.py
- `optimize_portfolio(symbols)` → Uses PyPortfolioOpt to compute Max Sharpe Ratio portfolio weights
- Requires ≥2 symbols
- Fetches 5 years of historical data via yFinance

---

## SECTION 12 — AI & RAG PIPELINE

### AI Agent (`ai/analyst.py`)
- LangChain-based financial analysis agent
- Supports multiple LLM providers: **Groq** (free), **OpenAI**, **Gemini**
- Input goes through `moderation.py` (safety check) → `categorizer.py` (query type detection) → data fetching → LLM analysis
- Output is validated against `FinancialAnalysisResult` Pydantic schema
- Protected by `timeout_guard.py` and `hallucination_check.py`

### RAG System (`rag.py` + `ai/document_loader.py` + vector stores)
- **Upload flow:** PDF/TXT → `DocumentProcessor.load_and_split()` → chunks with metadata → vector store `.add_documents()`
- **Query flow:** User query → vector store `.similarity_search_with_score()` → ranked results
- **Vector store selection:** Pinecone (cloud, if key is present) or ChromaDB (local, fallback)
- ChromaDB stores data locally in `backend/vector_db/`

---

## SECTION 13 — KNOWN ISSUES & NOTES

1. **pandas_datareader incompatibility:** The `pandas_datareader` library is incompatible with `pandas >= 3.0`. The import is wrapped in a try/except in `macro_service.py` to prevent backend crashes. FRED macro data falls back to hardcoded values.

2. **structlog dependency:** The `structlog` package was missing from the original `requirements.txt` but is required by `ai/document_loader.py`. It has been added.

3. **Redis not required:** Redis is optional. If Redis is not running, the cache silently falls back to an in-memory dictionary. The startup log will show: *"Redis is unreachable. Falling back to in-memory dictionary cache."*

4. **Analyze endpoint is a stub:** The `/api/v1/analyze` endpoint currently returns a hardcoded stub response. It does not actually run LLM analysis yet. The AI agent infrastructure exists in `ai/analyst.py` but is not wired into the endpoint.

5. **Portfolio P&L is now computed on the backend:** The `/portfolios/{id}/summary` endpoint returns fully pre-computed P&L values (`unrealized_pl`, `unrealized_pl_pct`, `total_current_value`, etc.) populated by the background `price_update_job.py`. The frontend **does not** need to call `/api/v1/stock/{symbol}` per holding anymore. *(This obsoletes the old note about frontend-side P&L computation.)*

6. **Database is Supabase (PostgreSQL) — shared cloud DB:** All teammates sharing the same `DATABASE_URL` in their `.env` are connecting to the same Supabase instance. Migrations run by one developer affect everyone. See Section 15 for the migration workflow.

7. **`create_all()` does NOT add new columns:** `Base.metadata.create_all()` at startup only creates missing *tables* — it never alters existing tables. Whenever a new column is added to a model, `migrate.py` must be run manually. See Section 15.

8. **Mock data still in use:** The dashboard portfolio value chart and AI insight cards still read from `frontend/src/lib/mock.ts`. These should be replaced with live API calls in a future task.

9. **Watchlist is client-side only:** The watchlist is stored in `localStorage` under key `finsight_watchlist` as a JSON array of symbols. There is no backend persistence for the watchlist.

10. **Port 8000 conflict:** On Windows, if a previous uvicorn process crashes without releasing the port, port 8000 may remain occupied by a zombie Python process. Check with `netstat -ano | findstr :8000` and kill the PID with `taskkill /PID <pid> /F`.

11. **`.env` leading spaces issue:** Lines in `.env` starting with a leading space (e.g., `·LANGCHAIN_TRACING_V2=true`) are silently ignored by pydantic-settings. Keep all variable names flush with the left margin.

---

## SECTION 14 — GIT & COLLABORATION

The project uses **Git** and **GitHub** for version control and team collaboration.

- **Repository:** `https://github.com/Tilak1452/Full-Stack-Client-Dashboard`
- **Branch strategy:** Feature branches → Pull Request → Merge to `main`
- **Never commit directly to `main`.** Always create a branch (e.g., `git checkout -b feature-name`)

Key files for collaboration:
- `.gitignore` — Blocks `node_modules/`, `.venv/`, `.env`, `*.db`, `.next/`, `.vscode/`
- `.env.example` — Safe template for environment variables (empty values)
- `git_guide.md` — Full onboarding guide with step-by-step instructions for new team members

**For detailed Git workflow instructions, see `git_guide.md` in the project root.**

---

## SECTION 15 — DATABASE MIGRATIONS GUIDE

This project does **not** use Alembic. Instead it has a manual migration script: `migrate.py` in the project root.

### Why migrations are needed

`SQLAlchemy`'s `Base.metadata.create_all()` only creates tables that **don't exist yet**. It never adds, removes, or changes columns on existing tables. So whenever a developer adds a new field to a model file (e.g., `models/holding.py`), that column must be manually added to the real database via a SQL `ALTER TABLE` statement.

### The `migrate.py` script

Location: `Full-Stack-Client-Dashboard/migrate.py`

This script uses raw SQL via SQLAlchemy's `engine.connect()` to ALTER existing tables. It uses `ADD COLUMN IF NOT EXISTS` so it is **safe to re-run** — it won't crash if the column already exists.

**Run it from the project root:**
```bash
# Activate venv first
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS/Linux

# Run the migration
python migrate.py
```

Expected output:
```
Starting schema migration for existing tables...
Successfully updated 'holdings' table.
Successfully updated 'transactions' table.
Successfully updated existing cost_basis data.
Migration completed.
```

### What the current migration does

**`holdings` table** — adds:
- `cost_basis FLOAT`
- `current_price FLOAT`
- `current_value FLOAT`
- `unrealized_pl FLOAT`
- `unrealized_pl_pct FLOAT`
- `realized_pl FLOAT DEFAULT 0.0`
- `realized_pl_pct FLOAT DEFAULT 0.0`
- `first_purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `last_price_update TIMESTAMP WITH TIME ZONE`

Also back-fills `cost_basis = quantity * average_price` for any existing rows where it is NULL.

**`transactions` table** — adds:
- `total_amount FLOAT`
- `realized_pl FLOAT`

### When to run migrate.py

| Situation | Action needed |
|-----------|---------------|
| You pulled new code and a teammate added a model column | Run `python migrate.py` |
| You added a new column to a model yourself | Add the `ALTER TABLE` to `migrate.py`, commit it, tell teammates to run it |
| First-time project setup on a fresh Supabase DB | NOT needed — `create_all()` handles brand-new tables |
| Teammate sharing your Supabase URL | NOT needed — migrations affect the shared cloud DB, so one run fixes everyone |

### Important Supabase behaviour

Because the Supabase database is **shared** (all team members point `DATABASE_URL` to the same instance), running `migrate.py` on one machine fixes the database for **everyone simultaneously**. You do not need each developer to run it independently, as long as they are all using the same `DATABASE_URL`.


