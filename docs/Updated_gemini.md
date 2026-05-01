# FinSight AI — Project Overview

> **CRITICAL NOTICE FOR ANY AI OR HUMAN READING THIS:**
> This is a split documentation set for the FinSight AI project.
> All files in the `docs/` directory together form the single source of truth for the current system architecture as of **May 1, 2026**.
> Every file path, endpoint, data shape, and architectural decision documented here reflects the ACTUAL state of the codebase.
> Do NOT invent any file, endpoint, or data field that is not listed here.
> If something is not covered, ask the developer before assuming.
>
> **Merge order for combining into a single `GEMINI.md`:**
> `00_OVERVIEW.md` → `01_FOLDER_STRUCTURE.md` → `02_TECH_STACK.md` → `03_ENVIRONMENT_SETUP.md` → `04_CONNECTIVITY.md` → `05_BACKEND_ARCHITECTURE.md` → `06_API_REFERENCE.md` → `07_DATABASE_MODELS.md` → `08_FRONTEND_ARCHITECTURE.md` → `09_API_CLIENT_LAYER.md` → `10_DESIGN_SYSTEM.md` → `11_SERVICES.md` → `12_AI_AGENT_AND_RAG.md` → `13_KNOWN_ISSUES.md` → `14_GIT_AND_COLLABORATION.md` → `15_DATABASE_MIGRATIONS.md` → `16_GRAPHIFY.md`

---

> [!CAUTION]
> ## STRICT RULE — PROTECTING EXISTING FEATURES FROM NEW MD FILES
>
> **This rule is NON-NEGOTIABLE and takes the HIGHEST PRIORITY over any conflicting instruction.**
>
> When the developer provides a **new Markdown (.md) file** containing detailed instructions for implementing a new feature, the AI **MUST** follow this exact protocol:
>
> ### Step 1 — Identify All Existing Feature Files
> Cross-reference the **folder structure listed in `01_FOLDER_STRUCTURE.md`** to build a complete inventory of every file that already exists in the project. These are **protected files**.
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

## What FinSight AI Is

FinSight AI is a **production-grade financial research dashboard** built for Indian stock markets. It is a full-stack monorepo application combining:

- A **Next.js 14 React frontend** — a dark-themed, fully responsive dashboard UI for researching and monitoring Indian stocks, managing portfolios, and interacting with an AI financial research agent.
- A **FastAPI Python backend** — a high-performance API server handling AI agents, real-time market data, portfolio CRUD, alert monitoring, document intelligence (RAG), and WebSocket price streaming.

Both the frontend and backend live inside a **single monorepo** called `Full-Stack-Client-Dashboard`.

### Communication Model

The frontend communicates with the backend over two channels:
1. **HTTP REST APIs** — for all CRUD operations, data fetching, and AI analysis requests.
2. **WebSocket connections** — for live, real-time price streaming per ticker symbol.

The backend orchestrates multiple external systems:
- **Yahoo Finance (via yfinance)** — live prices, OHLCV history, news RSS.
- **Supabase (PostgreSQL)** — cloud-hosted relational database for portfolios, holdings, transactions, and alerts.
- **OpenRouter** — LLM routing layer for the multi-model AI agent.
- **ChromaDB / Pinecone** — vector databases for RAG document search.
- **FRED (Federal Reserve Economic Data)** — macroeconomic indicators via `pandas_datareader`.
- **Redis** — optional caching layer (falls back to in-memory dict if unavailable).

### Production Deployment

The application is deployed on **DigitalOcean App Platform** at:
`https://finsight-app-v8wgj.ondigitalocean.app`

- Route `/` → Next.js Frontend (static + SSR)
- Route `/api` → FastAPI Backend (Python worker, port 8080)
- Database → Supabase Session Pooler (IPv4-compatible, PgBouncer)
- Auth → Supabase GoTrue (JWT-based, ES256/ECC P-256 or HS256)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Live Indian Market Indices** | Real-time NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT data |
| **Individual Stock Data** | Price, RSI, SMA, EMA, fundamental data, options chain |
| **AI Research Agent** | Multi-model chat interface (OpenRouter) for financial Q&A with rich artifact rendering |
| **Artifact Rendering System** | Structured AI responses rendered as interactive cards — verdict banners, metric grids, peer comparison tables, technical gauges, news feeds, revenue charts |
| **Portfolio Management** | Full CRUD: create portfolios, buy/sell holdings with FIFO P&L calculation |
| **Market Alerts** | Price-based and indicator-based alert rules; APScheduler polls every 5 minutes |
| **News Aggregation** | Yahoo Finance RSS + NewsAPI with VADER sentiment scoring |
| **RAG Document Intelligence** | Upload PDFs/TXTs → embed into ChromaDB or Pinecone → semantic search |
| **WebSocket Price Streaming** | Live price stream per symbol pushed every 5 seconds |
| **MPT Portfolio Optimization** | Modern Portfolio Theory Max-Sharpe optimization via PyPortfolioOpt |
| **Macro Economic Dashboard** | FRED economic indicators: 10Y Treasury, CPI, Unemployment, Gold, Oil |
| **Shareholding Pattern Display** | Donut chart visualization of promoter vs. institutional vs. public holdings |
| **Financial Statements** | Income statement, balance sheet, cash flow data rendered in the stock detail page |
| **Corporate Actions** | Dividend history and stock split information per ticker |

---

## Authentication Architecture (Current System)

Authentication is **fully delegated to Supabase GoTrue**. There is NO custom auth in this codebase.

- **Signup / Login / Logout:** Handled entirely by the Supabase JavaScript client (`@supabase/supabase-js`) on the frontend. The frontend never sends credentials to the FastAPI backend.
- **Session tokens:** Supabase issues JWTs directly to the browser. The frontend attaches these as `Authorization: Bearer <token>` headers on all backend API calls.
- **Backend verification:** `backend/app/core/security.py`'s `decode_access_token()` verifies the JWT signature using the `SUPABASE_JWT_SECRET`. It auto-detects HS256 (legacy plain string) vs. ES256/ECC P-256 (modern JWK JSON) format dynamically.
- **User identity:** The backend extracts the user's UUID and email from the verified JWT payload. There is no `public.users` table — user records live exclusively in Supabase's internal `auth.users` schema.
- **Protected routes (frontend):** `frontend/src/middleware.ts` runs on every request and redirects unauthenticated users to `/auth/login`.

---

## What Was Removed (Historical Context Only)

The following items existed in earlier versions of the codebase and have been **permanently deleted**. They are documented here to prevent confusion if seen in old Git history or branch diffs:

| Deleted Item | Reason |
|-------------|--------|
| `backend/app/models/user.py` | `public.users` table dropped; Supabase Auth handles identity |
| `backend/app/services/auth_service.py` | Auth logic fully delegated to Supabase |
| `backend/app/ai/analyst.py` | Replaced by the new `backend/app/agent/` package (OpenRouter multi-model agent) |
| `backend/app/schemas/auth.py` → `UserCreate`, `Token` schemas | Removed; only `UserPublic` retained |
| `wipe_users.py`, `drop_users_table.py`, `migrate_user_id.py`, `verify_migration.py`, `test_jwt.py` | One-time migration scripts; no longer needed |
| `app/data/`, `app/sentiment/`, `app/portfolio/`, `app/utils/` | Empty placeholder packages; deleted |
| `financial_ai.db` | Local SQLite development file; superseded by Supabase |
# FinSight AI — Complete Folder Structure

> This document defines the exact folder and file layout of the project on disk as of **May 1, 2026**.
> Every file path referenced anywhere in the documentation must match this structure exactly.
> Files marked `[DELETED]` existed in earlier versions and are **permanently removed** from the codebase.

---

```
Full-Stack-Client-Dashboard/              ← ROOT (open this in your editor)
│
├── .env                                  ← Python backend secrets (GITIGNORED — never commit)
├── .env.example                          ← Safe template for .env (empty values, committed to Git)
├── .gitignore                            ← Blocks node_modules/, .venv/, .env, *.db, .next/ from Git
├── requirements.txt                      ← Python dependencies (pip install -r requirements.txt)
├── migrate.py                            ← Manual database migration script (ALTER TABLE statements)
├── redundancy_cleanup.md                 ← Master cleanup log from April 29, 2026
│
├── .agents/                              ← Antigravity AI assistant configuration
│   ├── rules/
│   │   └── graphify.md                  ← Instructs AI to read GRAPH_REPORT.md before architecture questions
│   └── workflows/
│       └── graphify-workflow.md          ← Registers /graphify command to rebuild the knowledge graph
│
├── graphify-out/                         ← Graphify knowledge graph output (auto-generated, do not edit)
│   ├── graph.json                        ← Full project knowledge graph (695 nodes, 1,243 edges, 82 communities)
│   ├── graph.html                        ← Interactive browser visualization — open locally to explore
│   ├── GRAPH_REPORT.md                  ← Human-readable architecture summary (AI reads this first)
│   └── cache/                            ← Per-file AST cache for fast incremental graph rebuilds
│
├── docs/                                 ← THIS DOCUMENTATION SET
│   ├── 00_OVERVIEW.md                   ← Project overview, features, auth model
│   ├── 01_FOLDER_STRUCTURE.md           ← This file
│   ├── 02_TECH_STACK.md                 ← All technologies and versions
│   ├── 03_ENVIRONMENT_SETUP.md          ← Environment variables, dev server setup
│   ├── 04_CONNECTIVITY.md               ← How frontend and backend connect (local + production)
│   ├── 05_BACKEND_ARCHITECTURE.md       ← main.py, core layer, startup sequence
│   ├── 06_API_REFERENCE.md              ← Every HTTP and WebSocket endpoint
│   ├── 07_DATABASE_MODELS.md            ← SQLAlchemy ORM models and Pydantic schemas
│   ├── 08_FRONTEND_ARCHITECTURE.md      ← Pages, components, routing, artifact system
│   ├── 09_API_CLIENT_LAYER.md           ← Frontend API modules and WebSocket hook
│   ├── 10_DESIGN_SYSTEM.md              ← Design tokens, typography, currency formatting
│   ├── 11_SERVICES.md                   ← Backend service layer deep-dive
│   ├── 12_AI_AGENT_AND_RAG.md           ← OpenRouter agent system + RAG pipeline
│   ├── 13_KNOWN_ISSUES.md               ← Known bugs, gotchas, and deployment notes
│   ├── 14_GIT_AND_COLLABORATION.md      ← Git workflow and branch strategy
│   ├── 15_DATABASE_MIGRATIONS.md        ← Manual migration guide (migrate.py)
│   └── 16_GRAPHIFY.md                   ← Graphify knowledge graph setup and usage
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
│       ├── api/                          ← HTTP route handlers — thin controllers, no business logic here
│       │   ├── __init__.py
│       │   ├── auth.py                   ← GET /api/v1/auth/me
│       │   ├── analyze.py                ← POST /api/v1/analyze
│       │   ├── portfolio.py              ← CRUD /portfolios/*
│       │   ├── assets.py                 ← GET /api/v1/assets/* (macro, options, MPT)
│       │   ├── alerts.py                 ← CRUD /api/v1/alerts/*
│       │   ├── stock.py                  ← GET /api/v1/stock/*
│       │   ├── news.py                   ← GET /api/v1/news
│       │   ├── market.py                 ← GET /api/v1/indices, /api/v1/movers
│       │   ├── rag.py                    ← POST /rag/upload, GET /rag/query
│       │   ├── stream.py                 ← WS /api/v1/stream/price/{symbol}
│       │   └── agent.py                  ← /api/v1/agent/* (OpenRouter multi-model AI agent)
│       │
│       ├── core/                         ← Infrastructure / cross-cutting concerns
│       │   ├── __init__.py
│       │   ├── config.py                 ← Pydantic Settings, reads .env from project root
│       │   ├── security.py               ← Supabase JWT verification; auto-detects HS256 vs ES256/ECC P-256
│       │   ├── database.py               ← SQLAlchemy engine, SessionLocal, Base, validate_db_connection()
│       │   ├── cache.py                  ← Redis-backed cache with silent in-memory fallback
│       │   ├── circuit_breaker.py        ← Circuit breaker pattern for resilient external API calls
│       │   ├── dependencies.py           ← FastAPI get_db() dependency injection generator
│       │   └── telemetry.py              ← HTTP middleware for request duration logging
│       │
│       ├── agent/                        ← OpenRouter AI agent system (the active agent — replaced ai/analyst.py)
│       │   ├── __init__.py
│       │   ├── graph.py                  ← Main agent orchestrator: multi-model routing, timeout-aware (~79KB)
│       │   ├── prompt_builder.py         ← Builds context-aware prompts from stock/news/portfolio data (~28KB)
│       │   ├── prompts.py                ← System prompt templates and per-task instructions (~19KB)
│       │   └── tools.py                  ← Agent tool functions: stock lookup, market structure, setup detection (~10KB)
│       │
│       ├── services/                     ← Business logic layer (all service instances are singletons)
│       │   ├── __init__.py
│       │   ├── stock_service.py          ← yFinance wrapper: current price, history, RSI/SMA/EMA indicators (~25KB)
│       │   ├── news_service.py           ← Yahoo RSS + NewsAPI + VADER sentiment analysis
│       │   ├── macro_service.py          ← FRED economic data (10Y T-note, CPI, Unemployment) + commodity prices
│       │   ├── options_service.py        ← Options chain fetching + Black-Scholes theoretical pricing
│       │   ├── mpt_service.py            ← PyPortfolioOpt Max-Sharpe Ratio portfolio optimization
│       │   ├── portfolio_service.py      ← Portfolio CRUD, buy/sell with FIFO P&L, transaction recording
│       │   ├── price_update_job.py       ← APScheduler job: batch-refreshes all holding prices every 5 minutes
│       │   ├── alert_service.py          ← APScheduler job: polls active alert conditions every 5 minutes
│       │   ├── pdf_service.py            ← PDF parsing service (used by RAG upload)
│       │   ├── indicators.py             ← Pure-Python RSI, SMA, EMA calculation functions
│       │   ├── categorizer.py            ← Classifies incoming user queries by intent (stock/news/general)
│       │   ├── data_provider.py          ← Unified data-fetching abstraction over multiple sources
│       │   ├── setup_engine.py           ← Trading setup detection (RSI recovery, volume breakout, trend alignment)
│       │   └── market_structure.py       ← Market structure analysis (trend detection, support/resistance levels)
│       │
│       ├── ai/                           ← AI utility modules (shared infrastructure, NOT the active agent)
│       │   ├── __init__.py
│       │   ├── scoring.py                ← Confidence scoring for AI outputs
│       │   ├── moderation.py             ← Input safety and moderation checks
│       │   ├── hallucination_check.py    ← Post-generation hallucination detection
│       │   ├── response_limits.py        ← Output length and format enforcement
│       │   ├── timeout_guard.py          ← Wraps LLM calls with configurable timeouts
│       │   ├── document_loader.py        ← PDF/TXT document chunking and parsing (uses structlog)
│       │   ├── vector_store_chroma.py    ← ChromaDB local vector store implementation
│       │   ├── vector_store_pinecone.py  ← Pinecone cloud vector store implementation
│       │   └── interfaces/
│       │       ├── __init__.py
│       │       └── vector_store.py       ← Abstract base class for vector store implementations
│       │
│       ├── models/                       ← SQLAlchemy ORM models — each maps to a database table
│       │   ├── __init__.py               ← Imports all models so Base.metadata.create_all() sees them
│       │   ├── portfolio.py              ← `portfolios` table
│       │   ├── holding.py                ← `holdings` table (many holdings belong to one portfolio)
│       │   ├── transaction.py            ← `transactions` table (immutable audit trail of all buys/sells)
│       │   └── alert.py                  ← `alerts` table (market alert rules per user)
│       │   ← NOTE: user.py DELETED April 29, 2026. public.users table dropped. Auth is Supabase-only.
│       │
│       └── schemas/                      ← Pydantic request/response validation models
│           ├── __init__.py
│           ├── auth.py                   ← UserPublic schema (returned by /api/v1/auth/me)
│           ├── analyze.py                ← AnalyzeRequest, AnalyzeResponse, HealthResponse
│           ├── analysis.py               ← FinancialAnalysisResult, TechnicalSignal, SentimentSignal
│           ├── stock.py                  ← StockDataResponse
│           ├── news.py                   ← NewsArticle, NewsResponse
│           └── portfolio.py              ← Portfolio request/response schemas (PortfolioCreate, HoldingCreate, etc.)
│
└── frontend/                             ← Next.js 14 React frontend
    ├── .env.local                        ← Frontend env vars (GITIGNORED — never commit)
    ├── package.json                      ← Node.js dependencies
    ├── package-lock.json                 ← Lockfile (commit this)
    ├── tailwind.config.ts                ← Tailwind CSS custom dark theme configuration
    ├── tsconfig.json                     ← TypeScript compiler configuration
    ├── postcss.config.js                 ← PostCSS configuration for Tailwind
    ├── next-env.d.ts                     ← Next.js TypeScript declarations (auto-generated)
    ├── Frontend.md                       ← Legacy frontend documentation file
    │
    └── src/
        ├── middleware.ts                 ← Next.js Middleware: redirects unauthenticated users to /auth/login
        │
        ├── app/                          ← Next.js App Router: all pages live here
        │   ├── globals.css               ← Global styles: Tailwind base layers, custom scrollbar, resets
        │   ├── layout.tsx                ← Root layout: wraps all pages in <Providers> + <Sidebar>
        │   ├── providers.tsx             ← React Query (TanStack) QueryClientProvider setup
        │   ├── page.tsx                  ← Route "/" — immediately redirects to /dashboard
        │   │
        │   ├── auth/
        │   │   ├── login/page.tsx        ← Login page (calls Supabase directly)
        │   │   └── signup/page.tsx       ← Signup page (calls Supabase directly)
        │   │
        │   ├── dashboard/
        │   │   └── page.tsx              ← Main dashboard: indices, portfolio chart, watchlist, movers, news
        │   ├── stock/
        │   │   └── [symbol]/
        │   │       └── page.tsx          ← Individual stock detail page (dynamic route)
        │   ├── ai-research/
        │   │   └── page.tsx              ← AI chat interface: agent step animation + artifact rendering
        │   ├── portfolio/
        │   │   └── page.tsx              ← Portfolio management: list portfolios, holdings, P&L
        │   ├── watchlist/
        │   │   └── page.tsx              ← Watchlist (localStorage-based, no backend persistence)
        │   ├── news/
        │   │   └── page.tsx              ← Full news feed with sentiment badges
        │   ├── alerts/
        │   │   └── page.tsx              ← Alert CRUD: view, create, delete alert rules
        │   └── settings/
        │       └── page.tsx              ← Static settings form (no backend integration)
        │
        ├── components/                   ← Shared UI components
        │   ├── Icons.tsx                 ← All SVG icon components (IcSend, IcPlus, IcPortfolio, etc.)
        │   ├── Sidebar.tsx               ← Navigation sidebar with route links
        │   ├── TopBar.tsx                ← Top page header bar (shows page title, user info)
        │   ├── AppShell.tsx              ← App shell wrapper component
        │   ├── AIInsights.tsx            ← Dashboard AI insights card with live agent status
        │   │
        │   ├── AddToPortfolioModal.tsx   ← Modal: buy holdings into a portfolio
        │   ├── SellHoldingModal.tsx      ← Modal: sell shares with live FIFO P&L preview
        │   │
        │   ├── FundamentalTab.tsx        ← Stock detail page: fundamental data tab
        │   ├── TechnicalTab.tsx          ← Stock detail page: RSI/SMA/EMA indicators tab
        │   ├── FinancialStatements.tsx   ← Stock detail page: income statement, balance sheet, cash flow
        │   ├── ShareholdingDonut.tsx     ← Stock detail page: promoter/FII/DII/public donut chart
        │   ├── CorporateActionsCard.tsx  ← Stock detail page: dividend history and stock splits
        │   ├── IndicatorCard.tsx         ← Reusable card for displaying a single indicator value + label
        │   ├── TechnicalSummaryGauge.tsx ← Visual gauge for overall technical buy/sell/neutral rating
        │   ├── SupportResistanceBar.tsx  ← Horizontal bar showing support and resistance price range
        │   ├── TradingViewWidget.tsx     ← Embedded TradingView advanced chart widget
        │   │
        │   ├── artifact/                 ← Artifact rendering system (used in /ai-research page)
        │   │   ├── ArtifactRenderer.tsx  ← Root artifact renderer: routes artifact type to correct skeleton or layout
        │   │   ├── atoms/                ← Primitive artifact UI building blocks
        │   │   │   ├── CompareColumns.tsx         ← Side-by-side peer comparison columns
        │   │   │   ├── ExpandSection.tsx           ← Collapsible expand/collapse section
        │   │   │   ├── ExpandableRiskPanel.tsx     ← Risk factors panel with expand/collapse
        │   │   │   ├── FundamentalGrid.tsx         ← Grid layout for fundamental data metrics
        │   │   │   ├── HeroMetric.tsx              ← Large hero metric with label and delta
        │   │   │   ├── MetricGrid.tsx              ← Compact grid of multiple metrics
        │   │   │   ├── MiniBarChart.tsx             ← Inline mini bar chart component
        │   │   │   ├── MiniPriceCard.tsx            ← Compact price card with change indicator
        │   │   │   ├── NewsFeed.tsx                ← News feed list container
        │   │   │   ├── NewsItem.tsx                ← Single news item with sentiment badge
        │   │   │   ├── PeerComparisonTable.tsx     ← Full peer comparison table with sortable columns
        │   │   │   ├── ProgressBar.tsx              ← Labeled progress bar (used for shareholding %)
        │   │   │   ├── RevenueProfitChart.tsx      ← Revenue vs. profit bar/line chart
        │   │   │   ├── SegmentStrengthBars.tsx     ← Business segment strength visualization bars
        │   │   │   ├── SignalRow.tsx               ← Technical signal row with indicator name + rating
        │   │   │   ├── SupportResistanceBar.tsx    ← Support/resistance range bar (artifact version)
        │   │   │   ├── TechnicalGauges.tsx         ← Set of technical indicator gauges
        │   │   │   ├── VerdictBanner.tsx            ← Full-width BULLISH/BEARISH/NEUTRAL verdict banner
        │   │   │   └── VerdictCard.tsx              ← Compact verdict card with confidence score
        │   │   └── skeletons/            ← Loading skeleton screens for artifact types
        │   │       ├── Shimmer.tsx                  ← Base shimmer animation component
        │   │       ├── SkeletonFinancialsTimeline.tsx ← Skeleton for financial timeline artifact
        │   │       ├── SkeletonHeroPrice.tsx         ← Skeleton for hero price artifact
        │   │       ├── SkeletonInvestmentThesis.tsx  ← Skeleton for investment thesis artifact
        │   │       ├── SkeletonNewsEvent.tsx         ← Skeleton for news/event artifact
        │   │       ├── SkeletonTechnicalFocus.tsx    ← Skeleton for technical analysis artifact
        │   │       └── SkeletonThreeWayCompare.tsx   ← Skeleton for three-way peer comparison artifact
        │   │
        │   └── landing/                  ← Landing page components (shown before auth)
        │       ├── FeatureGrid.tsx        ← Feature showcase grid
        │       ├── HeroSection.tsx        ← Hero banner with CTA buttons
        │       ├── LandingFooter.tsx      ← Landing page footer
        │       ├── NavBar.tsx             ← Landing page top navigation bar
        │       ├── ProtocolSection.tsx    ← "How it works" / methodology section
        │       ├── TickerTape.tsx         ← Horizontally scrolling live stock ticker animation
        │       └── TrustBar.tsx           ← Trust indicators / social proof bar
        │
        └── lib/                          ← API clients, React hooks, types, and utilities
            ├── api-client.ts             ← Base fetch wrapper: apiFetch() + ApiError class
            ├── auth.api.ts               ← authApi: login(), register(), logout(), getUser() — wraps Supabase Auth
            ├── supabase.ts               ← Supabase JS client instance (singleton)
            ├── auth-context.tsx          ← AuthProvider: React context for global auth state
            ├── stock.api.ts              ← stockApi: getFullData(symbol), getHistory(symbol, period, interval)
            ├── portfolio.api.ts          ← portfolioApi: list(), create(), getSummary(), buyHolding(), sellHolding(), optimize()
            ├── alerts.api.ts             ← alertsApi: getActive(), getNotifications(), create(), delete()
            ├── ai.api.ts                 ← aiApi: analyze(question) — calls the agent endpoint
            ├── news.api.ts               ← newsApi: getLatest(limit)
            ├── market.api.ts             ← marketApi: getIndices(), getMovers()
            ├── useWebSocketPrice.ts      ← React hook: connects to WS price stream, returns { price, connected, error }
            ├── artifact-types.ts         ← TypeScript type definitions for all artifact data shapes
            ├── artifact-assembler.ts     ← Parses raw agent response JSON into typed artifact objects
            ├── utils.ts                  ← Utility functions: formatINR(), formatPct(), formatDate(), formatTime()
            └── mock.ts                   ← Static mock data (portfolio chart history, AI insight cards on dashboard)
```

---

## Directory Purposes at a Glance

| Directory | Layer | Purpose |
|-----------|-------|---------|
| `backend/app/api/` | HTTP Controllers | Thin route handlers — validate input, call services, return responses |
| `backend/app/core/` | Infrastructure | Config, DB connection, caching, security, dependency injection |
| `backend/app/agent/` | AI Agent | Active LLM agent: OpenRouter multi-model orchestration |
| `backend/app/services/` | Business Logic | All domain logic: portfolios, stocks, news, alerts, market data |
| `backend/app/ai/` | AI Utilities | Shared AI infrastructure: vector stores, doc loading, moderation, scoring |
| `backend/app/models/` | Data Models | SQLAlchemy ORM table definitions |
| `backend/app/schemas/` | Validation | Pydantic request/response schemas |
| `frontend/src/app/` | Pages | Next.js App Router pages (one folder per route) |
| `frontend/src/components/` | UI Components | Reusable React components: layout, artifact rendering, modals |
| `frontend/src/lib/` | Client Layer | API fetch wrappers, React hooks, type definitions, utilities |
# FinSight AI — Technology Stack

> This document lists every technology used in the project as of **May 1, 2026**, including versions, purpose, and any critical notes. Do not add dependencies outside of this list without updating this document.

---

## Backend Technologies

The backend is a **FastAPI** Python application deployed on DigitalOcean App Platform.

| Technology | Purpose | Version | Critical Notes |
|-----------|---------|---------|---------------|
| **Python** | Runtime language | 3.11+ | Use 3.11+ specifically; older versions may break pydantic-settings or SQLAlchemy 2.x |
| **FastAPI** | Web framework and API server | Latest (0.111+) | Uses async request handling; all route handlers are async |
| **Uvicorn** | ASGI server that runs FastAPI | Latest with `[standard]` extras | Run with `uvicorn app.main:app --reload` for development; `--reload` must be disabled in production |
| **SQLAlchemy** | ORM and database abstraction layer | 2.x | Uses declarative base, relationship() cascades, and `engine.connect()` for raw migration SQL |
| **Supabase (PostgreSQL)** | Cloud-hosted relational database | Latest | All application tables (portfolios, holdings, transactions, alerts) live here. User auth lives in Supabase's internal `auth.users` schema. |
| **psycopg2-binary** | PostgreSQL driver for Python | Latest | Required for SQLAlchemy to speak to Supabase's PostgreSQL. The `-binary` variant requires no C compilation. |
| **SQLite** | Local fallback database | Built-in | Used only for offline development when `DATABASE_URL` is not set. Never used in production. |
| **Pydantic** | Data validation for request/response bodies | v2 | v2 syntax is used throughout (model_config, model_validator, etc.) |
| **pydantic-settings** | Config management via environment variables | v2 | Reads `.env` file automatically via `BaseSettings`. Config is in `backend/app/core/config.py`. |
| **yfinance** | Yahoo Finance market data client | Latest | Used for live prices, OHLCV history, options chain, news RSS. Primary market data source. |
| **LangChain** | LLM orchestration framework | Latest | Used by the agent system for tool calling, chain composition, and prompt management |
| **LangGraph** | Stateful agent workflow graphs | Latest | Used in `agent/graph.py` for multi-step agent state machines |
| **langchain-groq** | Groq LLM provider adapter | Latest | Groq is free-tier; good for development testing |
| **langchain-openai** | OpenAI LLM provider adapter | Latest | GPT-4o and GPT-4o-mini |
| **langchain-google-genai** | Gemini LLM provider adapter | Latest | Gemini 1.5 Pro / Flash |
| **OpenRouter** | LLM routing and multi-model API gateway | Latest | The primary production LLM provider used by `agent/graph.py`. Routes requests to the best available model. |
| **ChromaDB** | Local vector database for RAG | Latest | Stores document embeddings on disk at `backend/vector_db/`. Used when Pinecone key is absent. |
| **Pinecone** | Cloud vector database for RAG | Latest | Optional. Used when `Pinecone_Vector_Database` env var is set. Falls back to ChromaDB. |
| **PyPortfolioOpt** | Modern Portfolio Theory optimization | Latest | Used by `mpt_service.py` for Max-Sharpe Ratio portfolio weights |
| **APScheduler** | Background job scheduler | Latest | Powers two background jobs: alert polling (every 5 min) and holding price refresh (every 5 min) |
| **SlowAPI** | Rate limiting middleware for FastAPI | Latest | Wraps FastAPI with rate limit decorators. Default: 20 req/min globally, stricter on LLM endpoints. |
| **VADER Sentiment** | Rule-based sentiment analysis | Latest | Applied to news article titles in `news_service.py`. Returns compound score → `positive/neutral/negative` label. |
| **pandas** | Data processing and numerical analysis | Latest | Used throughout services for time-series data manipulation |
| **pandas-datareader** | FRED economic data fetching | Latest | **Known incompatibility with pandas ≥ 3.0.** Import is wrapped in try/except to prevent crashes. FRED data falls back to hardcoded values when broken. |
| **Redis** | Optional caching layer | Latest | Used by `core/cache.py`. Falls back silently to in-memory dict if Redis is not running. |
| **structlog** | Structured logging | Latest | Used by `ai/document_loader.py`. Must be in `requirements.txt` or the RAG upload will crash on import. |
| **pybreaker** | Circuit breaker pattern | Latest | Wraps external API calls in `core/circuit_breaker.py` to prevent cascading failures |

---

## Frontend Technologies

The frontend is a **Next.js 14** application with the App Router.

| Technology | Purpose | Version | Critical Notes |
|-----------|---------|---------|---------------|
| **Next.js** | React framework with App Router, SSR, and static optimization | 14.2.5 | Uses the `app/` directory (App Router), NOT the legacy `pages/` directory |
| **React** | UI component library | 18.3.1 | |
| **TypeScript** | Static typing for JavaScript | 5.x | Strict mode is enabled in `tsconfig.json`. All components must be fully typed. |
| **TailwindCSS** | Utility-first CSS framework | 3.4.4 | Extended with a custom dark theme. See `tailwind.config.ts` and `10_DESIGN_SYSTEM.md` for all custom tokens. |
| **@tanstack/react-query** | Server state management (data fetching, caching, invalidation) | 5.x | All API calls in page components use `useQuery()`. Cache config: `staleTime: 30s`, `gcTime: 5min`. |
| **Recharts** | Chart rendering library | 2.12.7 | Used for the AreaChart on the dashboard portfolio value chart |
| **Lucide React** | Icon component library | 0.428.0 | Used throughout the UI for icons (alongside custom `Icons.tsx` SVG components) |
| **@supabase/supabase-js** | Supabase JavaScript client | Latest | Handles all auth (login, signup, logout, session management, token refresh) entirely on the frontend |
| **Outfit** (Google Font) | Heading typography | — | Loaded via Next.js `next/font/google` |
| **DM Sans** (Google Font) | Body typography | — | Loaded via Next.js `next/font/google` |

---

## External Services

| Service | Purpose | Required? | Configuration |
|---------|---------|-----------|---------------|
| **Supabase** | PostgreSQL cloud database + Auth (GoTrue JWT) | **Yes — required** | `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **OpenRouter** | Multi-model LLM API gateway for AI agent | **Yes — for AI features** | Configure in `agent/graph.py` — uses OpenRouter API key |
| **Groq** | Free LLM provider (Llama 3, Mixtral) | Optional | `GROQ_API_KEY` in `.env` |
| **OpenAI** | GPT-4o / GPT-4o-mini provider | Optional | `OPENAI_API_KEY` in `.env` |
| **Google Gemini** | Gemini 1.5 Pro / Flash provider | Optional | `GEMINI_API_KEY` in `.env` |
| **NewsAPI** | Supplementary news articles | Optional | `NEWS_API_KEY` in `.env`. Falls back to Yahoo RSS only if absent. |
| **FRED (Federal Reserve)** | Macroeconomic indicators | Optional | `FRED_API_KEY` in `.env`. Falls back to hardcoded values if absent or pandas incompatibility occurs. |
| **Pinecone** | Cloud vector database for RAG | Optional | `Pinecone_Vector_Database` in `.env`. Falls back to local ChromaDB if absent. |
| **Redis** | Caching layer | Optional | `redis_url` in `.env`. Falls back silently to in-memory dict if unreachable. |
| **LangSmith** | LangChain observability and tracing | Optional | `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` in `.env` |
| **DigitalOcean App Platform** | Production hosting for both frontend and backend | **Production only** | Frontend on route `/`, Backend on route `/api`, port `8080` |

---

## Dependency Installation

### Python (Backend)
```bash
# From project root, with virtual environment active:
pip install -r requirements.txt
```

### Node.js (Frontend)
```bash
# From frontend/ directory:
npm install
```

---

## Key Dependency Notes

### Why OpenRouter over direct LLM providers?
`agent/graph.py` uses OpenRouter as a unified gateway, which means:
- A single API key can route to GPT-4o, Claude 3.5, Gemini 1.5, and open-source models.
- Model fallback and load balancing are handled by OpenRouter automatically.
- No code changes are needed to switch models — just change the model ID string.

### Why both ChromaDB and Pinecone?
The RAG system supports both vector stores through an abstract interface (`ai/interfaces/vector_store.py`). At runtime, if `Pinecone_Vector_Database` is set in `.env`, Pinecone is used for cloud-scale semantic search. If absent, ChromaDB stores embeddings locally in `backend/vector_db/`. This allows the same codebase to work in both local development and production without code changes.

### Why APScheduler instead of Celery?
The background jobs (alert polling, price updates) are simple, time-based, and low-throughput. APScheduler runs inside the same FastAPI process, requiring zero additional infrastructure. Celery would require a separate worker process and message broker (Redis/RabbitMQ), which is excessive for two 5-minute polling jobs.
# FinSight AI — Environment Setup & Local Development

> This document covers everything needed to get both the backend and frontend running locally from scratch.
> All commands assume the working directory is the project root (`Full-Stack-Client-Dashboard/`) unless otherwise noted.

---

## Prerequisites

Before starting, ensure these are installed and available in your system PATH:

| Tool | Minimum Version | Check Command |
|------|----------------|--------------|
| **Python** | 3.11+ | `python --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Git** | Any recent | `git --version` |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git
cd Full-Stack-Client-Dashboard
```

---

## Step 2 — Python Virtual Environment

Create and activate a Python virtual environment. This isolates Python dependencies from your global system packages.

```bash
# Create the virtual environment in a folder called .venv
python -m venv .venv

# Activate it
# Windows (PowerShell):
.\.venv\Scripts\activate

# Windows (Command Prompt):
.venv\Scripts\activate.bat

# macOS / Linux:
source .venv/bin/activate
```

After activation, your terminal prompt should show `(.venv)`.

```bash
# Install all Python dependencies
pip install -r requirements.txt

# Verify key packages are installed correctly
python -c "import fastapi; print('FastAPI OK:', fastapi.__version__)"
python -c "import sqlalchemy; print('SQLAlchemy OK:', sqlalchemy.__version__)"
python -c "import yfinance; print('yfinance OK:', yfinance.__version__)"
```

> **IMPORTANT:** The `.venv/` folder is machine-specific and is GITIGNORED. Each developer creates their own from `requirements.txt`. Never copy `.venv/` between computers.

---

## Step 3 — Backend Environment Variables

The backend reads its configuration from a `.env` file in the **project root** (`Full-Stack-Client-Dashboard/.env`).

This file is **GITIGNORED** for security — it contains secrets and must never be committed.

A safe template with empty values is committed as `.env.example`. New developers must:
1. Copy `.env.example` to `.env`
2. Fill in the actual values (ask the team lead)

```bash
# Copy the template
copy .env.example .env     # Windows
cp .env.example .env       # macOS/Linux
```

### Full Backend `.env` Reference

```env
# ─────────────────────────────────────────────────────────
# DATABASE CONNECTION (required)
# ─────────────────────────────────────────────────────────

# For LOCAL DEVELOPMENT — use the direct Supabase connection:
DATABASE_URL=postgresql+psycopg2://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres

# For PRODUCTION on DigitalOcean — use the Session Pooler (IPv4-compatible):
# DATABASE_URL=postgresql+psycopg2://postgres.xxxx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# ─────────────────────────────────────────────────────────
# SUPABASE AUTH (required for protected API endpoints)
# ─────────────────────────────────────────────────────────

# This field supports TWO formats — the backend auto-detects which one:
#
# Format A — Legacy HS256 (plain string from Supabase Dashboard → Authentication → JWT Settings → "Legacy JWT Secret" tab):
#   SUPABASE_JWT_SECRET=your-long-random-string-here
#
# Format B — Modern ES256/ECC P-256 (paste the JWK JSON as a single line):
#   SUPABASE_JWT_SECRET={"x":"...","y":"...","alg":"ES256","crv":"P-256","kty":"EC","key_ops":["verify"]}
#
# To find your current key type: Supabase Dashboard → Authentication → JWT Signing Keys
# If you see "ECC P-256", use Format B and paste the full JSON.
# If you only see a "Legacy JWT Secret" tab, use Format A.
#
SUPABASE_JWT_SECRET=your_jwt_secret_or_jwk_json_here

# ─────────────────────────────────────────────────────────
# LLM PROVIDERS (at least one is required for AI features)
# ─────────────────────────────────────────────────────────

# Groq — free tier, best for development testing
GROQ_API_KEY=

# OpenAI — GPT-4o and GPT-4o-mini
OPENAI_API_KEY=

# Google Gemini — Gemini 1.5 Pro / Flash
GEMINI_API_KEY=

# ─────────────────────────────────────────────────────────
# OPTIONAL EXTERNAL DATA SOURCES
# ─────────────────────────────────────────────────────────

# NewsAPI.org — supplementary news articles (falls back to Yahoo RSS if absent)
NEWS_API_KEY=

# FRED (Federal Reserve Economic Data) — macroeconomic indicators
# Without this, macro data falls back to hardcoded static values
FRED_API_KEY=

# ─────────────────────────────────────────────────────────
# OPTIONAL VECTOR DATABASE
# ─────────────────────────────────────────────────────────

# Pinecone cloud vector store (falls back to local ChromaDB if absent)
Pinecone_Vector_Database=

# ─────────────────────────────────────────────────────────
# OPTIONAL CACHING
# ─────────────────────────────────────────────────────────

# Redis connection URL (falls back to in-memory dict if not set or unreachable)
# redis_url=redis://localhost:6379

# ─────────────────────────────────────────────────────────
# OPTIONAL OBSERVABILITY (LangSmith tracing)
# ─────────────────────────────────────────────────────────

LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=financial-research-agent
LANGCHAIN_API_KEY=
```

### How Config is Loaded

`backend/app/core/config.py` contains a `Settings` class extending Pydantic's `BaseSettings`. It calculates the project root by going **3 levels up** from its own file location (`backend/app/core/config.py` → `backend/app/core/` → `backend/app/` → `backend/` → project root) and reads `.env` from there automatically.

The `settings` singleton is imported throughout the backend:
```python
from app.core.config import settings
settings.database_url   # → value from .env
settings.groq_api_key   # → value from .env
```

---

## Step 4 — Frontend Environment Variables

File: `frontend/.env.local` (GITIGNORED — never commit)

```env
# Backend API base URL (no trailing slash)
# Local development:
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Production (DigitalOcean):
# NEXT_PUBLIC_API_URL=https://finsight-app-v8wgj.ondigitalocean.app
# NEXT_PUBLIC_WS_URL=wss://finsight-app-v8wgj.ondigitalocean.app

# Supabase (required for authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
```

> **Critical:** The `NEXT_PUBLIC_` prefix is mandatory. Next.js only exposes variables with this prefix to the browser. Variables without it remain server-side only and will be `undefined` in client components.

> **Critical:** The Supabase key variable MUST be named `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with `_KEY` suffix). If named without `_KEY`, Supabase auth will silently fail in production.

### Where to find your Supabase values:
- **URL:** Supabase Dashboard → Project Settings → API → Project URL
- **Anon Key:** Supabase Dashboard → Project Settings → API → `anon` `public` key (NOT the `service_role` key)

---

## Step 5 — Install Frontend Dependencies

```bash
cd frontend
npm install
```

This reads `package.json` and `package-lock.json` and installs all Node.js dependencies into `frontend/node_modules/`.

---

## Step 6 — Running Both Servers

You need **two simultaneous terminal windows**, both kept open while developing.

### Terminal 1 — Backend (port 8000)

```bash
# From project root, with .venv active:
.\.venv\Scripts\activate   # Windows
source .venv/bin/activate  # macOS/Linux

cd backend
uvicorn app.main:app --reload
```

Verify the backend is running:
- **Health check:** `http://localhost:8000/health` → should return `{"status": "ok"}`
- **Swagger UI:** `http://localhost:8000/docs` → interactive API documentation
- **ReDoc:** `http://localhost:8000/redoc` → alternative API docs

### Terminal 2 — Frontend (port 3000)

```bash
# From project root:
cd frontend
npm run dev
```

Visit `http://localhost:3000` — the root page redirects to `http://localhost:3000/dashboard`.

---

## The `uvicorn` Command Explained

`uvicorn app.main:app --reload` breaks down as:

| Part | Meaning |
|------|---------|
| `uvicorn` | The ASGI web server binary (installed in `.venv/Scripts/uvicorn`) |
| `app.main` | Python module path: folder `app/`, file `main.py` (from inside `backend/`) |
| `:app` | The FastAPI instance variable named `app` inside `main.py` |
| `--reload` | Watch for file changes and auto-restart (development only — never use in production) |

> **Must run from `backend/` directory**, not from the project root. This ensures `app.main` resolves to `backend/app/main.py`.

---

## Port Conflicts (Windows)

On Windows, if a previous uvicorn process crashes without releasing port 8000, you may get `OSError: [Errno 10048] address already in use`.

```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process by PID (replace <PID> with actual number)
taskkill /PID <PID> /F
```

---

## Production Environment Variables (DigitalOcean)

When deployed to DigitalOcean App Platform, environment variables are set in the DigitalOcean dashboard (App → Settings → Environment Variables), not from `.env` files.

**Backend env vars required in DigitalOcean:**
- `DATABASE_URL` → Session Pooler URL (`aws-1-ap-southeast-1.pooler.supabase.com`)
- `SUPABASE_JWT_SECRET` → JWK JSON or plain HS256 string
- At least one LLM key (`GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`)

**Frontend env vars required in DigitalOcean:**
- `NEXT_PUBLIC_API_URL` → `https://finsight-app-v8wgj.ondigitalocean.app`
- `NEXT_PUBLIC_WS_URL` → `wss://finsight-app-v8wgj.ondigitalocean.app`
- `NEXT_PUBLIC_SUPABASE_URL` → Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Your Supabase anon public key

> **Hidden newline gotcha:** When pasting `DATABASE_URL` into DigitalOcean's UI, an invisible newline character can be appended. This causes `FATAL: database "postgres\n" does not exist`. Always delete and retype the last few characters of the value after pasting to ensure no trailing whitespace.
# FinSight AI — Frontend ↔ Backend Connectivity

> This document explains the communication model between the Next.js frontend and the FastAPI backend in both local development and production environments.

---

## Overview

The frontend and backend are **completely separate processes** that communicate exclusively over the network:
- **HTTP REST** for all data fetching, CRUD operations, and AI requests.
- **WebSocket** for live real-time price streaming.

There is no shared memory, no server-side rendering of backend data (Next.js calls the API via client-side fetch, not server actions), and no direct database access from the frontend.

---

## Local Development Architecture

```
┌─────────────────────────────┐         HTTP / WebSocket          ┌─────────────────────────────┐
│     Next.js Frontend        │ ◄──────────────────────────────► │     FastAPI Backend         │
│     localhost:3000          │                                    │     localhost:8000          │
│                             │  GET /api/v1/indices               │                             │
│  React components           │  GET /api/v1/stock/RELIANCE.NS     │  Python services            │
│  call apiFetch()            │  POST /api/v1/agent/chat           │  yFinance + Supabase        │
│  or useQuery()              │  WS /api/v1/stream/price/INFY.NS   │  OpenRouter LLMs            │
│                             │                                    │                             │
└─────────────────────────────┘                                    └─────────────────────────────┘
                  │                                                              │
                  │ Supabase Auth (login/signup/session)                        │ Supabase PostgreSQL
                  ▼                                                              ▼
     ┌─────────────────────────┐                              ┌────────────────────────────────┐
     │  Supabase GoTrue        │                              │  Supabase PostgreSQL           │
     │  (Auth service)         │                              │  portfolios, holdings,         │
     │  Issues JWTs            │                              │  transactions, alerts tables   │
     └─────────────────────────┘                              └────────────────────────────────┘
```

---

## Production Architecture (DigitalOcean App Platform)

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│         DigitalOcean App Platform                                                         │
│         https://finsight-app-v8wgj.ondigitalocean.app                                    │
│                                                                                           │
│   ┌──────────────────────────────────┐   ┌──────────────────────────────────────────┐   │
│   │  Next.js Frontend Component      │   │  FastAPI Backend Component               │   │
│   │  Route: /  (all non-/api paths)  │   │  Route: /api  (all /api/* paths)         │   │
│   │  Type: Static + SSR build        │   │  Type: Python worker                     │   │
│   │                                  │   │  Port: 8080                              │   │
│   └──────────────────────────────────┘   └──────────────────────────────────────────┘   │
│                                                          │                               │
└──────────────────────────────────────────────────────────│───────────────────────────────┘
                                                           │
                                                           ▼
                                        ┌──────────────────────────────────────┐
                                        │  Supabase Session Pooler             │
                                        │  (PgBouncer, transaction mode)       │
                                        │  aws-1-ap-southeast-1.pooler.        │
                                        │  supabase.com:5432                   │
                                        │  IPv4 — required for DigitalOcean    │
                                        └──────────────────────────────────────┘
```

---

## How API Calls Work Step-by-Step

### 1. Frontend Makes an API Request

Every API call goes through `frontend/src/lib/api-client.ts`:

```typescript
// Reads NEXT_PUBLIC_API_URL from env; falls back to http://127.0.0.1:8000 for local dev
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>
```

**What `apiFetch()` does on every call:**
1. Retrieves the current Supabase session via `supabase.auth.getSession()` to get the JWT access token.
2. Falls back to `localStorage` for the token if the Supabase session is unavailable.
3. Constructs the full URL: `BASE_URL + endpoint`.
4. Sets `Content-Type: application/json` and `Authorization: Bearer <token>` headers.
5. If the response is `401 Unauthorized`: auto-signs out via Supabase and redirects to `/auth/login`.
6. If the response is any other non-2xx: throws an `ApiError(status, detail)` instance.
7. Returns the parsed JSON response body typed as `T`.

### 2. Request Arrives at the Backend

In production, DigitalOcean routes all `/api/*` requests to the FastAPI worker. However, DigitalOcean **strips the `/api` prefix** before forwarding the request to FastAPI.

To compensate, `main.py` registers `DOPathRewriteMiddleware` as the outermost ASGI middleware. This middleware inspects every incoming path and, if it does NOT start with `/api`, re-prepends `/api` before passing the request to FastAPI's router.

```
Browser sends:  GET https://finsight-app-v8wgj.ondigitalocean.app/api/v1/indices
DigitalOcean routes to FastAPI and strips prefix: GET /v1/indices (arrives at FastAPI)
DOPathRewriteMiddleware re-prepends:              GET /api/v1/indices (FastAPI routes correctly)
```

### 3. Backend Verifies Authentication

For protected endpoints, FastAPI uses `Depends(get_current_user)` in the route definition. This:
1. Extracts the `Authorization: Bearer <token>` header from the request.
2. Calls `decode_access_token()` in `core/security.py`.
3. Auto-detects the JWT algorithm: if `SUPABASE_JWT_SECRET` starts with `{`, treats it as JWK JSON (ES256); otherwise treats it as a plain HS256 string.
4. Calls `jwt.get_unverified_header()` to read the `alg` field from the token, then verifies the signature with the matching key format.
5. Returns the user's UUID (`sub` claim) and email from the verified payload.
6. If verification fails: raises `HTTPException(401)`.

### 4. Backend Returns Response

The route handler calls the appropriate service(s), formats the response into a Pydantic schema, and returns it as JSON. FastAPI serializes Pydantic models to JSON automatically.

---

## WebSocket Connection Flow

Live stock price streaming uses a WebSocket connection managed by `frontend/src/lib/useWebSocketPrice.ts`:

```typescript
// Reads NEXT_PUBLIC_WS_URL from env; falls back to ws://127.0.0.1:8000 for local dev
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";

function useWebSocketPrice(symbol: string | null): {
  price: number | null;
  connected: boolean;
  error: string | null;
}
```

**Connection lifecycle:**
1. When `symbol` changes, the hook closes any existing WebSocket and opens a new one to `{WS_BASE}/api/v1/stream/price/{symbol}`.
2. The backend `stream.py` handler polls yFinance every 5 seconds and pushes JSON: `{"symbol": "INFY.NS", "price": 1825.60, "timestamp": "..."}`.
3. The hook updates `price` state on each message, causing the stock detail page to re-render with the latest price.
4. On component unmount (user navigates away), the hook calls `ws.close()` to clean up the connection.

---

## CORS Configuration

The backend's CORS middleware is configured with `allow_origins=["*"]` to permit all origins. This is intentional for a dashboard application where the frontend domain may vary between development and production environments.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Error Handling

| Scenario | What Happens |
|----------|-------------|
| Backend is not running (local dev) | `apiFetch()` catches `TypeError: Failed to fetch`. The UI shows an error state with a retry button. |
| JWT expired or invalid | Backend returns `401`. `apiFetch()` calls `supabase.auth.signOut()` and redirects to `/auth/login`. |
| Rate limit exceeded | Backend returns `429`. `apiFetch()` throws `ApiError(429, "Too many requests")`. UI shows error. |
| Backend validation error | Backend returns `422`. `apiFetch()` throws `ApiError(422, details)`. |
| Unexpected backend crash | Backend returns `500`. `apiFetch()` throws `ApiError(500, "Internal server error")`. |

---

## Environment Variable Summary

| Variable | Used By | Required | Purpose |
|----------|---------|----------|---------|
| `NEXT_PUBLIC_API_URL` | `api-client.ts` | Yes (production) | Base URL for all HTTP API calls |
| `NEXT_PUBLIC_WS_URL` | `useWebSocketPrice.ts` | Yes (production) | Base URL for WebSocket connections |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase.ts` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase.ts` | Yes | Supabase public anon key |
| `DATABASE_URL` | `core/database.py` | Yes | SQLAlchemy PostgreSQL connection string |
| `SUPABASE_JWT_SECRET` | `core/security.py` | Yes | JWT signature verification secret |
# FinSight AI — Backend Architecture

> This document covers the FastAPI application entry point (`main.py`), the core infrastructure layer, startup sequence, middleware stack, and router registration.

---

## Application Entry Point — `main.py`

**Location:** `backend/app/main.py`

`main.py` is the root of the FastAPI application. When uvicorn is started with `uvicorn app.main:app`, this file is loaded and the `app` FastAPI instance is used to serve all HTTP and WebSocket traffic.

### Responsibilities

1. **Configure structured logging** — Sets up the Python logging level from `settings.log_level`. All backend logs use this configuration.

2. **Create the FastAPI app instance** — Initializes FastAPI with:
   - `title="FinSight AI API"`
   - Swagger UI at `/docs`
   - ReDoc at `/redoc`

3. **Register `DOPathRewriteMiddleware`** — The outermost middleware layer. Detects when DigitalOcean strips the `/api` prefix from incoming requests and re-prepends it before FastAPI's router processes the path. This is required for production routing to work correctly. See `04_CONNECTIVITY.md` for the full explanation.

4. **Register CORS Middleware** — Allows cross-origin requests from any domain (`allow_origins=["*"]`). Required for the browser-based frontend to call the API.

5. **Register `TelemetryMiddleware`** — HTTP middleware that logs the path and duration of every request. Useful for identifying slow endpoints in production.

6. **Register SlowAPI rate limiting** — Attaches the `Limiter` from SlowAPI to the FastAPI app. Default global rate: 20 requests/minute per IP. Individual sensitive endpoints have stricter limits.

7. **Register global exception handlers:**
   - `422 RequestValidationError` — Returns structured JSON with field-level validation errors
   - `500 Exception` — Catches any unhandled exception and returns a generic error response (prevents stack trace exposure)

8. **Register all 10 API routers** — See Router Registration section below.

9. **Execute the startup sequence** on app start (lifespan `on_startup`).

10. **Execute the shutdown sequence** on app stop (lifespan `on_shutdown`).

---

## Startup Sequence

When the backend starts, `on_startup()` runs the following steps in order. Each step is logged with a numbered label (`Step 1`, `Step 2`, etc.) to allow instant identification of which phase is hanging in cloud deployment logs.

| Step | Action | Failure Behavior |
|------|--------|-----------------|
| **Step 1** | `validate_db_connection()` — Tests the database connection by issuing a `SELECT 1` query | Logs error but continues; backend starts in degraded mode |
| **Step 2** | `Base.metadata.create_all(bind=engine)` — Creates any missing tables | **Skipped entirely** if `DATABASE_URL` contains `pooler.supabase.com` (see Pooler Skip note below) |
| **Step 3** | `alert_service.start_scheduler()` — Starts the APScheduler instance for alert polling | Logs error if scheduler fails to start |
| **Step 4** | `price_update_job.start()` — Starts the APScheduler instance for background price updates | Logs error if scheduler fails to start |
| **Completion** | Logs: `"All startup tasks completed successfully."` | — |

### Pooler Skip — Why `create_all()` is Conditionally Disabled

`Base.metadata.create_all()` sends DDL introspection queries (listing existing tables, checking column types) before creating new tables. The Supabase Session Pooler runs PgBouncer in **transaction mode**, which cannot handle these multi-statement DDL transactions. This causes the startup to hang indefinitely, eventually failing DigitalOcean's health check probe (which kills the container after multiple failed attempts).

**The fix:** At startup, `main.py` checks if `DATABASE_URL` contains the string `"pooler.supabase.com"`. If it does, `create_all()` is skipped — the assumption being that all tables already exist in the cloud database (either from a prior `create_all()` via direct connection, or from manual Supabase migrations).

**For first-time fresh database setup:** Temporarily use the direct connection URL (`db.xxx.supabase.co:5432`) instead of the pooler URL, start the backend once to trigger `create_all()`, then switch back to the pooler URL.

---

## Router Registration

The 10 routers are registered in this order. The order matters because FastAPI routes are matched in registration order for ambiguous paths:

```python
app.include_router(analyze_router)      # POST /api/v1/analyze
app.include_router(portfolio_router)    # GET/POST/DELETE /portfolios/*
app.include_router(stream_router)       # WS /api/v1/stream/*
app.include_router(rag_router)          # POST/GET /rag/*
app.include_router(assets_router)       # GET/POST /api/v1/assets/*
app.include_router(alerts_router)       # GET/POST/DELETE /api/v1/alerts/*
app.include_router(stock.router)        # GET /api/v1/stock/*
app.include_router(news.router)         # GET /api/v1/news
app.include_router(market.router)       # GET /api/v1/indices, /api/v1/movers
app.include_router(agent_router)        # POST /api/v1/agent/*
```

Additionally, the root health check is registered directly:
```python
@app.get("/health")
async def health_check() -> dict:
    # Returns {"status": "ok"} or {"status": "degraded"}
```

---

## Core Infrastructure Layer

The `backend/app/core/` directory contains all cross-cutting infrastructure components that are shared across the entire application.

### `config.py` — Application Configuration

Defines the `Settings` class using Pydantic's `BaseSettings`. Settings are read from environment variables and the `.env` file at the project root.

**Available settings fields:**

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `app_name` | `str` | Hardcoded default | `"FinSight AI"` |
| `debug` | `bool` | `DEBUG` env var | Enables debug mode (default: False) |
| `log_level` | `str` | `LOG_LEVEL` env var | Python logging level (default: `"INFO"`) |
| `database_url` | `str` | `DATABASE_URL` env var | **Required.** PostgreSQL connection string |
| `supabase_jwt_secret` | `str` | `SUPABASE_JWT_SECRET` env var | JWT verification secret (HS256 string or JWK JSON) |
| `openai_api_key` | `str` | `OPENAI_API_KEY` env var | Optional OpenAI key |
| `gemini_api_key` | `str` | `GEMINI_API_KEY` env var | Optional Gemini key |
| `groq_api_key` | `str` | `GROQ_API_KEY` env var | Optional Groq key |
| `news_api_key` | `str` | `NEWS_API_KEY` env var | Optional NewsAPI key |
| `fred_api_key` | `str` | `FRED_API_KEY` env var | Optional FRED key |
| `redis_url` | `str` | `redis_url` env var | Optional Redis URL |

A singleton `settings` object is exported and used throughout the backend:
```python
from app.core.config import settings
```

### `database.py` — Database Connection

Creates and exports the SQLAlchemy engine and session factory.

**PostgreSQL connection pool settings:**
- `pool_pre_ping=True` — Tests connection validity before each use
- `pool_size=5` — Maximum persistent connections in pool
- `max_overflow=10` — Additional connections allowed beyond `pool_size` under load
- `pool_recycle=1800` — Recycle connections after 30 minutes to prevent stale connections

**Exports:**
- `engine` — The SQLAlchemy engine instance
- `SessionLocal` — Session factory (`sessionmaker(autocommit=False, autoflush=False, bind=engine)`)
- `Base` — Declarative base class for all ORM models
- `validate_db_connection()` — Issues `SELECT 1` to test connectivity; returns `True`/`False`

### `dependencies.py` — FastAPI Dependency Injection

Provides the `get_db()` generator function, used throughout route handlers via `Depends(get_db)`.

```python
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

This ensures:
- Every request gets its own database session.
- Successful requests auto-commit.
- Failed requests auto-rollback.
- Sessions are always closed, even on exception.

### `security.py` — JWT Verification

`decode_access_token(token: str)` verifies Supabase-issued JWTs.

**Algorithm auto-detection logic:**
1. Reads `SUPABASE_JWT_SECRET` from settings.
2. Strips surrounding quotes (handles copy-paste from cloud dashboards that wrap values in `'` or `"`).
3. If the value starts with `{` → parses it as JWK JSON (for ES256/ECC P-256 modern Supabase projects).
4. If the value is a plain string → treats it as an HS256 symmetric secret.
5. Calls `jwt.get_unverified_header(token)` to read the `alg` field from the token header.
6. Verifies the signature using `python-jose`'s `jwt.decode()` with the appropriate key and algorithm.
7. Returns the decoded payload dict (contains `sub` = user UUID, `email`, `exp`, etc.).
8. Raises `HTTPException(401)` if verification fails for any reason.

**Supported algorithms:** `HS256`, `ES256`, `RS256`

### `cache.py` — Caching Layer

`CacheService` class with a try-Redis-first, fall-back-to-memory-dict approach.

```python
# Usage:
from app.core.cache import cache

value = await cache.get("key")
await cache.set("key", value, ttl=300)  # 300 seconds
await cache.clear("key")
```

If Redis is unreachable at startup, the service logs a warning and uses an in-memory dictionary for the process lifetime. This means the cache is non-persistent (lost on restart) and not shared across multiple workers.

### `circuit_breaker.py` — External API Resilience

Implements the circuit breaker pattern using `pybreaker`. Wraps calls to external APIs (yFinance, FRED, NewsAPI) so that if an external service fails repeatedly:
1. The circuit "opens" and subsequent calls fail fast (without waiting for timeout).
2. After a cooldown period, the circuit "half-opens" and allows one trial call.
3. If the trial succeeds, the circuit "closes" and normal operation resumes.

This prevents a failing external API from causing the entire backend to slow down.

### `telemetry.py` — Request Logging Middleware

A simple Starlette middleware that wraps every HTTP request and logs:
- The request path
- The HTTP method
- The response status code
- The total request duration in milliseconds

Output goes to the Python logger configured in `main.py`.

---

## Shutdown Sequence

When the backend receives a shutdown signal (SIGTERM in production, Ctrl+C in development), `on_shutdown()` runs:

1. Stops the alert polling scheduler (`alert_service.stop_scheduler()`)
2. Stops the price update scheduler (`price_update_job.stop()`)

Both schedulers are shut down gracefully, allowing any currently-running job to complete before the process exits.
# FinSight AI — Complete API Reference

> This document lists every HTTP endpoint and WebSocket connection exposed by the FastAPI backend.
> All endpoints that require authentication expect `Authorization: Bearer <supabase_jwt>` in the request headers.

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local Development | `http://localhost:8000` |
| Production | `https://finsight-app-v8wgj.ondigitalocean.app` |

Interactive docs (Swagger UI): `{base_url}/docs`

---

## Authentication Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/v1/auth/me` | ✅ Yes | Validates the Supabase JWT in the Authorization header and returns the authenticated user's public profile |

### `GET /api/v1/auth/me` — Response

```json
{
  "id": "uuid-string-from-supabase",
  "email": "user@example.com"
}
```

**Notes:** This endpoint is primarily used by the frontend to verify the current session is valid. The backend does not maintain a user table — identity comes entirely from the JWT payload.

---

## AI Analysis Endpoint

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|:---:|-----------|-------------|
| `POST` | `/api/v1/analyze` | ✅ Yes | 5/min | Submit a financial question to the AI analysis pipeline |

### `POST /api/v1/analyze` — Request Body

```json
{
  "question": "Analyze RELIANCE.NS stock — is it a good buy?"
}
```

Constraints:
- `question`: string, `min_length=3`, `max_length=1000`

### `POST /api/v1/analyze` — Response

```json
{
  "verdict": "BULLISH",
  "confidence": 72,
  "reasoning_summary": "Reliance Industries shows strong momentum with RSI at 58...",
  "technical_signals": [
    { "indicator": "RSI", "value": 58.3, "interpretation": "Neutral momentum, room to run" },
    { "indicator": "SMA(20)", "value": 2810.50, "interpretation": "Price trading above 20-day SMA" }
  ],
  "sentiment_signals": [
    { "source": "Yahoo Finance News", "score": 0.34, "interpretation": "Mildly positive news sentiment" }
  ],
  "risk_assessment": "Key risks include crude oil price volatility and Jio subscriber growth deceleration."
}
```

| Field | Type | Values |
|-------|------|--------|
| `verdict` | Literal string | `"BULLISH"` \| `"BEARISH"` \| `"NEUTRAL"` |
| `confidence` | Integer | `0` to `100` |
| `reasoning_summary` | String | Free-form AI-generated analysis |
| `technical_signals` | Array | Each: `{ indicator, value, interpretation }` |
| `sentiment_signals` | Array | Each: `{ source, score, interpretation }` |
| `risk_assessment` | String | Free-form risk description |

---

## AI Agent Endpoints

The agent system at `api/agent.py` exposes the OpenRouter multi-model chat agent.

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/v1/agent/chat` | ✅ Yes | Send a message to the financial AI agent; returns a structured response with optional artifacts |
| `GET` | `/api/v1/agent/models` | ✅ Yes | List available LLM models via OpenRouter |
| `GET` | `/api/v1/agent/status` | ✅ Yes | Agent health and configuration status |

### `POST /api/v1/agent/chat` — Request Body

```json
{
  "message": "Compare TCS vs Infosys for long-term investment",
  "conversation_id": "optional-uuid-for-session-continuity",
  "model": "optional-model-override"
}
```

### `POST /api/v1/agent/chat` — Response

The response includes the text answer plus an optional `artifact` block containing structured data for rich UI rendering:

```json
{
  "response": "Based on my analysis, TCS offers better dividend consistency while Infosys has stronger margin improvement...",
  "artifact": {
    "type": "three_way_compare",
    "data": { ... }
  },
  "steps": [
    { "tool": "stock_lookup", "input": "TCS.NS", "status": "done" },
    { "tool": "stock_lookup", "input": "INFY.NS", "status": "done" }
  ],
  "model_used": "anthropic/claude-3.5-sonnet",
  "conversation_id": "uuid"
}
```

---

## Portfolio Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/portfolios/` | ✅ Yes | List all portfolios for the authenticated user |
| `POST` | `/portfolios/` | ✅ Yes | Create a new portfolio |
| `GET` | `/portfolios/{id}/summary` | ✅ Yes | Get aggregated portfolio summary with live P&L |
| `POST` | `/portfolios/{id}/holdings` | ✅ Yes | Add or update a holding directly (legacy — prefer `/transactions`) |
| `POST` | `/portfolios/{id}/transactions` | ✅ Yes | Record a BUY or SELL transaction (preferred method) |
| `POST` | `/portfolios/{id}/holdings/{symbol}/sell` | ✅ Yes | Sell shares with FIFO realized P&L calculation |
| `GET` | `/portfolios/{id}/optimize` | ✅ Yes | Run MPT Max-Sharpe optimization on portfolio holdings |

### `POST /portfolios/` — Request Body

```json
{ "name": "My Long-Term Portfolio" }
```

Returns `409 Conflict` if a portfolio with the same name already exists for the user.

### `POST /portfolios/{id}/transactions` — Request Body

```json
{
  "symbol": "INFY.NS",
  "transaction_type": "buy",
  "quantity": 10,
  "price": 1820.50
}
```

| Field | Values |
|-------|--------|
| `transaction_type` | `"buy"` or `"sell"` |
| `quantity` | Positive float |
| `price` | Positive float (per share price) |

**For BUY:** Creates/updates the holding using a weighted average cost formula. Creates an immutable `Transaction` record.
**For SELL:** Validates that enough shares exist, calculates FIFO realized P&L, reduces holding quantity (or deletes row if quantity reaches 0), creates a `Transaction` record with `realized_pl`.

### `GET /portfolios/{id}/summary` — Response

```json
{
  "portfolio_id": 1,
  "portfolio_name": "My Long-Term Portfolio",
  "total_invested": 182050.0,
  "total_current_value": 197350.0,
  "total_unrealized_pl": 15300.0,
  "total_unrealized_pl_pct": 8.40,
  "total_realized_pl": 4200.0,
  "holdings": [
    {
      "symbol": "INFY.NS",
      "quantity": 10,
      "average_price": 1820.50,
      "cost_basis": 18205.0,
      "current_price": 1973.50,
      "current_value": 19735.0,
      "unrealized_pl": 1530.0,
      "unrealized_pl_pct": 8.40,
      "realized_pl": 420.0,
      "last_price_update": "2026-05-01T10:00:00Z"
    }
  ]
}
```

**Note:** `current_price` and `current_value` are populated by the background `price_update_job.py` every 5 minutes, not on-demand per request.

### `GET /portfolios/{id}/optimize` — Response

```json
{
  "weights": {
    "INFY.NS": 0.42,
    "TCS.NS": 0.35,
    "HDFCBANK.NS": 0.23
  },
  "expected_annual_return": 0.18,
  "annual_volatility": 0.14,
  "sharpe_ratio": 1.29
}
```

Requires at least 2 holdings in the portfolio. Uses 5 years of historical returns from yFinance.

---

## Stock Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/v1/stock/{symbol}` | ✅ Yes | Full stock data: current price + RSI, SMA, EMA indicators |
| `GET` | `/api/v1/stock/{symbol}/history` | ✅ Yes | OHLCV historical candle data |

### `GET /api/v1/stock/{symbol}` — Response

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
  "timestamp": "2026-05-01T10:00:00Z"
}
```

### `GET /api/v1/stock/{symbol}/history` — Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `period` | `"1mo"` | Data range: `"1d"`, `"5d"`, `"1mo"`, `"3mo"`, `"6mo"`, `"1y"`, `"2y"`, `"5y"`, `"max"` |
| `interval` | `"1d"` | Candle resolution: `"1m"`, `"5m"`, `"15m"`, `"1h"`, `"1d"`, `"1wk"`, `"1mo"` |

Returns OHLCV array: `[{ "date": "2026-04-30", "open": 2800, "high": 2860, "low": 2795, "close": 2847, "volume": 4200000 }, ...]`

---

## Market Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/v1/indices` | ✅ Yes | Live data for 4 major Indian market indices |
| `GET` | `/api/v1/movers` | ✅ Yes | Top 2 gainers and top 2 losers from a basket of large-cap Indian stocks |

### `GET /api/v1/indices` — Response

Returns data for:
- `^NSEI` — NIFTY 50
- `^BSESN` — SENSEX (BSE 30)
- `^NSEBANK` — NIFTY BANK
- `NIFTYIT.NS` — NIFTY IT

Each entry: `{ "symbol": "^NSEI", "name": "NIFTY 50", "price": 22450.50, "change": 125.30, "change_pct": 0.56 }`

### `GET /api/v1/movers` — Response

Scans a basket of 10 large-cap Indian stocks and returns:
```json
{
  "gainers": [
    { "symbol": "HDFCBANK.NS", "name": "HDFC Bank", "price": 1650, "change_pct": 2.4 },
    { "symbol": "TCS.NS", "name": "TCS", "price": 3820, "change_pct": 1.8 }
  ],
  "losers": [
    { "symbol": "WIPRO.NS", "name": "Wipro", "price": 465, "change_pct": -1.2 },
    { "symbol": "ICICIBANK.NS", "name": "ICICI Bank", "price": 1145, "change_pct": -0.8 }
  ]
}
```

---

## News Endpoints

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|:---:|-----------|-------------|
| `GET` | `/api/v1/news` | ✅ Yes | — | Latest financial news with sentiment labels |

### `GET /api/v1/news` — Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `20` | Maximum number of articles to return |

### `GET /api/v1/news` — Response

```json
{
  "articles": [
    {
      "title": "RBI holds repo rate at 6.5% for sixth consecutive meeting",
      "source": "Yahoo Finance",
      "published_at": "2026-05-01T08:00:00Z",
      "url": "https://finance.yahoo.com/...",
      "summary": "The Monetary Policy Committee voted unanimously to maintain the benchmark rate...",
      "sentiment": "neutral"
    }
  ]
}
```

`sentiment` values: `"positive"` | `"neutral"` | `"negative"` (derived from VADER compound score)

---

## Assets Endpoints

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|:---:|-----------|-------------|
| `GET` | `/api/v1/assets/macro` | ✅ Yes | 10/min | Macro economic indicators from FRED + commodity prices |
| `GET` | `/api/v1/assets/options/{symbol}` | ✅ Yes | 10/min | Full options chain for a ticker |
| `POST` | `/api/v1/assets/options/pricer` | ✅ Yes | — | Black-Scholes theoretical option pricing |
| `POST` | `/api/v1/assets/mpt/optimize` | ✅ Yes | 5/min | MPT Max-Sharpe optimization on custom ticker list |

### `GET /api/v1/assets/macro` — Response

```json
{
  "ten_year_treasury": 4.28,
  "cpi": 3.2,
  "unemployment": 3.9,
  "gold_price": 2350.40,
  "oil_price_wti": 81.20
}
```

**Note:** If FRED is unavailable (due to `pandas_datareader` incompatibility), returns hardcoded fallback values.

### `POST /api/v1/assets/mpt/optimize` — Request Body

```json
{
  "symbols": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"],
  "period": "5y"
}
```

Returns same structure as `GET /portfolios/{id}/optimize`.

---

## Alerts Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/v1/alerts/` | ✅ Yes | Create a new alert rule |
| `GET` | `/api/v1/alerts/active` | ✅ Yes | List all active (untriggered) alerts for the user |
| `GET` | `/api/v1/alerts/notifications` | ✅ Yes | Get last 10 triggered alert notifications |
| `DELETE` | `/api/v1/alerts/{id}` | ✅ Yes | Delete an alert by ID |

### `POST /api/v1/alerts/` — Request Body

```json
{
  "symbol": "INFY.NS",
  "condition": "price_above",
  "threshold": 2000.0,
  "message": "Infosys broke through ₹2000 resistance"
}
```

**Valid `condition` values:**

| Condition | Description |
|-----------|-------------|
| `price_above` | Triggers when current price > threshold |
| `price_below` | Triggers when current price < threshold |
| `rsi_above` | Triggers when RSI > threshold |
| `rsi_below` | Triggers when RSI < threshold |
| `sma_cross_above` | Triggers when price crosses above SMA |
| `sma_cross_below` | Triggers when price crosses below SMA |

---

## RAG (Document Intelligence) Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/rag/upload` | ✅ Yes | Upload a document (PDF, TXT, MD, CSV) for indexing |
| `GET` | `/rag/query` | ✅ Yes | Semantic search across indexed documents |

### `POST /rag/upload`

Accepts multipart form upload. The document is:
1. Parsed by `ai/document_loader.py` using LangChain's document loaders.
2. Split into chunks (default: 1000 chars with 200-char overlap).
3. Embedded using the configured embedding model.
4. Stored in ChromaDB (local) or Pinecone (cloud) vector store.

### `GET /rag/query` — Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | (required) | Search query string |
| `score_threshold` | `1.5` | Maximum distance threshold for relevance filtering |

Returns: `[{ "content": "...", "source": "document.pdf", "page": 3, "score": 0.82 }, ...]`

---

## WebSocket Endpoints

| Protocol | Endpoint | Auth | Description |
|----------|----------|:---:|-------------|
| `WS` | `/api/v1/stream/price/{symbol}` | None | Live price stream for the given stock symbol |

### WebSocket Message Format (server → client)

```json
{
  "symbol": "INFY.NS",
  "price": 1825.60,
  "change": 12.40,
  "change_pct": 0.68,
  "timestamp": "2026-05-01T10:30:05Z"
}
```

Messages are pushed every **5 seconds**. The WebSocket connection remains open until the client disconnects or the server restarts.

**Usage:** The frontend hook `useWebSocketPrice(symbol)` manages this connection. See `09_API_CLIENT_LAYER.md` for details.

---

## System Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/health` | ❌ No | Liveness probe — used by DigitalOcean health checks |
| `GET` | `/docs` | ❌ No | Swagger UI interactive API documentation |
| `GET` | `/redoc` | ❌ No | ReDoc API documentation |

### `GET /health` — Response

```json
{ "status": "ok" }
```

Returns `"degraded"` if the database connection check fails.

---

## Rate Limit Summary

| Endpoint | Limit |
|----------|-------|
| `POST /api/v1/analyze` | 5 requests/minute/IP |
| `POST /api/v1/assets/mpt/optimize` | 5 requests/minute/IP |
| `GET /api/v1/assets/macro` | 10 requests/minute/IP |
| `GET /api/v1/assets/options/{symbol}` | 10 requests/minute/IP |
| All other endpoints | 20 requests/minute/IP (global default) |
# FinSight AI — Database Models & Pydantic Schemas

> This document covers all SQLAlchemy ORM models (database table definitions) and Pydantic request/response validation schemas used in the backend.

---

## Database: Supabase (PostgreSQL)

All application data is stored in a **Supabase cloud-hosted PostgreSQL** database.

### Connection String Formats

| Environment | Format | When to Use |
|-------------|--------|-------------|
| **Local development** | `postgresql+psycopg2://postgres:[PASS]@db.xxxx.supabase.co:5432/postgres` | Direct connection; IPv6; supports `create_all()` |
| **Production (DigitalOcean)** | `postgresql+psycopg2://postgres.xxxx:[PASS]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` | Session Pooler; IPv4; `create_all()` is skipped |

> **⚠️ IPv4 Requirement:** DigitalOcean App Platform workers are IPv4-only. The direct Supabase connection (`db.xxx.supabase.co`) resolves to IPv6 and will fail. Always use the Session Pooler URL in production.

### Table Creation Behaviour

- Tables are created by `Base.metadata.create_all(bind=engine)` on backend startup.
- **This ONLY creates new tables — it never alters existing tables.**
- When the pooler URL is detected, `create_all()` is skipped entirely (it would hang PgBouncer).
- For fresh deployments, use the direct connection temporarily to run `create_all()` once, then switch back.
- For adding columns to existing tables, use `migrate.py` (see `15_DATABASE_MIGRATIONS.md`).

---

## User Authentication — No Local User Table

> **IMPORTANT:** There is no `users` table in the application database.

User identity is managed entirely by **Supabase Auth** (`auth.users` schema, internal to Supabase). The backend:
1. Receives JWTs from the frontend.
2. Verifies them in `core/security.py`.
3. Extracts user UUID (`sub` claim) and email from the verified JWT payload.
4. Uses the UUID as `user_id` (string) in the `portfolios` and `alerts` tables.

The `user_id` columns are plain strings (UUIDs from Supabase) with no foreign key constraint pointing to any local table.

---

## ORM Models

### Portfolio — `portfolios` table

**File:** `backend/app/models/portfolio.py`

Represents a named investment portfolio owned by a user.

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `Integer` | PK, auto-increment | Internal portfolio ID |
| `user_id` | `String(255)` | NOT NULL, indexed | Supabase user UUID |
| `name` | `String(255)` | NOT NULL, indexed | User-defined portfolio name |
| `created_at` | `DateTime(timezone=True)` | `server_default=func.now()` | Creation timestamp (stored in UTC) |

**Relationships:**
- `holdings` → one-to-many with `Holding` (cascade delete: deleting a portfolio deletes all its holdings)
- `transactions` → one-to-many with `Transaction` (cascade delete)

**Constraints:** A unique index on `(user_id, name)` enforces that no user can have two portfolios with the same name.

---

### Holding — `holdings` table

**File:** `backend/app/models/holding.py`

Represents an active stock position (shares currently held) within a portfolio.

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `Integer` | PK, auto-increment | Internal holding ID |
| `portfolio_id` | `Integer` | FK → `portfolios.id`, CASCADE, indexed | Owning portfolio |
| `symbol` | `String(20)` | NOT NULL, indexed | Stock ticker symbol (e.g., `"INFY.NS"`) |
| `quantity` | `Float` | NOT NULL | Number of shares currently held |
| `average_price` | `Float` | NOT NULL | Weighted average purchase price per share |
| `cost_basis` | `Float` | NULLABLE | Total invested amount: `quantity × average_price`. Populated by migration. |
| `current_price` | `Float` | NULLABLE | Last fetched market price (updated by background job every 5 min) |
| `current_value` | `Float` | NULLABLE | `quantity × current_price` |
| `unrealized_pl` | `Float` | NULLABLE | `current_value − cost_basis` |
| `unrealized_pl_pct` | `Float` | NULLABLE | `(unrealized_pl / cost_basis) × 100` |
| `realized_pl` | `Float` | default=`0.0` | Cumulative realized P&L from all completed FIFO sales for this position |
| `realized_pl_pct` | `Float` | default=`0.0` | `realized_pl` as a % of the original cost basis |
| `first_purchase_date` | `DateTime(timezone=True)` | `server_default=func.now()` | When the position was first opened |
| `last_price_update` | `DateTime(timezone=True)` | NULLABLE | When `current_price` was last refreshed by the background job |

> **Migration Note:** Columns from `cost_basis` onward were added via `migrate.py` (ALTER TABLE). Databases created before April 16, 2026 will have NULL in these columns until the migration is run. See `15_DATABASE_MIGRATIONS.md`.

**Logic notes:**
- When a BUY transaction is recorded, if the holding already exists: `new_avg_price = (old_qty × old_avg + new_qty × new_price) / (old_qty + new_qty)`.
- When a SELL transaction depletes all shares, the holding row is **deleted** (not zeroed out).

---

### Transaction — `transactions` table

**File:** `backend/app/models/transaction.py`

An immutable audit log of every buy and sell event. Records are never modified after creation.

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `Integer` | PK, auto-increment | Internal transaction ID |
| `portfolio_id` | `Integer` | FK → `portfolios.id`, CASCADE, indexed | Owning portfolio |
| `symbol` | `String(20)` | NOT NULL, indexed | Stock ticker symbol |
| `transaction_type` | `Enum('buy', 'sell')` | NOT NULL | Buy or sell |
| `quantity` | `Float` | NOT NULL | Number of shares transacted |
| `price` | `Float` | NOT NULL | Per-share price at time of transaction |
| `total_amount` | `Float` | NULLABLE | `quantity × price`. Added via migration. |
| `realized_pl` | `Float` | NULLABLE | FIFO realized P&L for SELL transactions only. `NULL` for BUY transactions. Added via migration. |
| `timestamp` | `DateTime(timezone=True)` | `server_default=func.now()` | Exact time of transaction (UTC) |

---

### Alert — `alerts` table

**File:** `backend/app/models/alert.py`

A market alert rule created by a user. Polled every 5 minutes by the APScheduler background job.

| Column | SQLAlchemy Type | Constraints | Description |
|--------|----------------|-------------|-------------|
| `id` | `Integer` | PK, indexed | Internal alert ID |
| `user_id` | `String(255)` | NOT NULL, indexed | Supabase user UUID |
| `symbol` | `String` | NOT NULL, indexed | Ticker to monitor |
| `condition` | `Enum(AlertCondition)` | NOT NULL | The condition type |
| `threshold` | `Float` | NOT NULL | The value to compare against |
| `status` | `Enum('active', 'triggered', 'expired')` | default=`'active'` | Current state |
| `message` | `String` | NULLABLE | Optional user note for this alert |
| `created_at` | `DateTime(timezone=True)` | `server_default=func.now()` | When the alert was created |
| `triggered_at` | `DateTime(timezone=True)` | NULLABLE | When the alert condition was last met |

**AlertCondition enum values:**

| Value | Trigger Condition |
|-------|-----------------|
| `price_above` | Current price > threshold |
| `price_below` | Current price < threshold |
| `rsi_above` | RSI value > threshold |
| `rsi_below` | RSI value < threshold |
| `sma_cross_above` | Price crossed from below to above SMA |
| `sma_cross_below` | Price crossed from above to below SMA |

---

## Pydantic Schemas

Pydantic schemas are used for two purposes:
1. **Request validation** — FastAPI validates incoming request bodies against these schemas before the handler runs.
2. **Response serialization** — FastAPI serializes return values using these schemas to produce JSON responses.

### Auth Schemas — `schemas/auth.py`

#### `UserPublic`
Returned by `GET /api/v1/auth/me`.

```python
class UserPublic(BaseModel):
    id: str          # Supabase UUID from JWT "sub" claim
    email: str       # Email from JWT "email" claim
```

---

### Analysis Schemas — `schemas/analyze.py` and `schemas/analysis.py`

#### `AnalyzeRequest`
```python
class AnalyzeRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
```

#### `FinancialAnalysisResult`
```python
class TechnicalSignal(BaseModel):
    indicator: str        # e.g., "RSI", "SMA(20)", "EMA(50)"
    value: float          # The computed indicator value
    interpretation: str   # AI-generated natural language interpretation

class SentimentSignal(BaseModel):
    source: str           # e.g., "Yahoo Finance News"
    score: float          # VADER compound score: -1.0 to +1.0
    interpretation: str   # Natural language sentiment description

class FinancialAnalysisResult(BaseModel):
    verdict: Literal["BULLISH", "BEARISH", "NEUTRAL"]
    confidence: int                          # 0–100
    reasoning_summary: str
    technical_signals: List[TechnicalSignal]
    sentiment_signals: List[SentimentSignal]
    risk_assessment: str
```

---

### Stock Schemas — `schemas/stock.py`

#### `StockDataResponse`
```python
class StockDataResponse(BaseModel):
    symbol: str
    current_price: float
    currency: str                   # "INR" for Indian stocks
    exchange: str                   # "NSI", "BSE"
    market_state: str               # "OPEN", "CLOSED", "PRE", "POST"
    previous_close: float
    day_high: float
    day_low: float
    volume: int
    market_cap: Optional[float]
    pe_ratio: Optional[float]
    rsi: Optional[float]            # 14-period RSI
    sma: Optional[float]            # 20-period Simple Moving Average
    ema: Optional[float]            # 20-period Exponential Moving Average
    timestamp: datetime
```

---

### News Schemas — `schemas/news.py`

#### `NewsArticle`
```python
class NewsArticle(BaseModel):
    title: str
    source: str
    published_at: datetime
    url: str
    summary: Optional[str]
    sentiment: Literal["positive", "neutral", "negative"]

class NewsResponse(BaseModel):
    articles: List[NewsArticle]
```

---

### Portfolio Schemas — `schemas/portfolio.py`

```python
class PortfolioCreate(BaseModel):
    name: str

class HoldingCreate(BaseModel):
    symbol: str
    quantity: float
    price: float

class TransactionCreate(BaseModel):
    symbol: str
    transaction_type: Literal["buy", "sell"]
    quantity: float
    price: float

class SellRequest(BaseModel):
    quantity: float
    price: float

class HoldingResponse(BaseModel):
    id: int
    symbol: str
    quantity: float
    average_price: float
    cost_basis: Optional[float]
    current_price: Optional[float]
    current_value: Optional[float]
    unrealized_pl: Optional[float]
    unrealized_pl_pct: Optional[float]
    realized_pl: float
    last_price_update: Optional[datetime]

class PortfolioSummaryResponse(BaseModel):
    portfolio_id: int
    portfolio_name: str
    total_invested: float
    total_current_value: float
    total_unrealized_pl: float
    total_unrealized_pl_pct: float
    total_realized_pl: float
    holdings: List[HoldingResponse]
```
# FinSight AI — Frontend Architecture

> This document covers the Next.js 14 App Router structure, all pages and their data sources, shared components, the artifact rendering system, and the landing page components.

---

## Root Layout (`layout.tsx`)

**Location:** `frontend/src/app/layout.tsx`

The root layout wraps every page in the application. It provides:

1. **Google Fonts** — Loads `Outfit` (headings) and `DM Sans` (body) via Next.js `next/font/google`. Font variables are applied to the `<html>` element.
2. **Metadata** — Sets the default `<title>` and `<meta name="description">` for the app.
3. **`<Providers>`** — Wraps all content in the React Query `QueryClientProvider` for server-state management.
4. **`<AuthProvider>`** — Wraps all content in the global authentication context, making the current Supabase session available to all components.
5. **Layout structure** — Full-height flex row: `<Sidebar>` on the left, `<main>` content area on the right.

The Sidebar is **always rendered** by the root layout. Individual pages that need to suppress it (e.g., landing page, auth pages) must handle their own conditional rendering.

---

## Providers (`providers.tsx`)

**Location:** `frontend/src/app/providers.tsx`

Creates the `QueryClient` with application-wide caching configuration:

| Setting | Value | Effect |
|---------|-------|--------|
| `staleTime` | `30_000` (30 seconds) | API data is considered fresh for 30s; no refetch during this window |
| `gcTime` | `5 * 60_000` (5 minutes) | Inactive queries are garbage collected after 5 minutes |
| `retry` | `1` | Failed requests are retried once before showing an error |
| `refetchOnWindowFocus` | `false` | Does not re-fetch when user switches browser tabs |

---

## Middleware (`middleware.ts`)

**Location:** `frontend/src/middleware.ts`

Next.js Middleware runs on every incoming request before any page is rendered. This middleware:

1. Checks for a valid Supabase session in the request cookies.
2. If the user is **not authenticated** and the route is **not** a public path (`/`, `/auth/login`, `/auth/signup`), redirects to `/auth/login`.
3. If the user **is authenticated** and tries to visit `/auth/login` or `/auth/signup`, redirects to `/dashboard`.

This creates a protected-by-default application — all routes behind `/dashboard`, `/portfolio`, `/ai-research`, etc. require authentication.

---

## Pages

### Root (`/`) — `page.tsx`
Immediately performs a client-side redirect to `/dashboard`. No content is rendered.

---

### Auth Pages

#### Login (`/auth/login`) — `auth/login/page.tsx`
- Email + password form that calls `authApi.login()`.
- On success, Supabase issues a session; the middleware redirects to `/dashboard`.
- No backend FastAPI calls — auth goes directly to Supabase.

#### Signup (`/auth/signup`) — `auth/signup/page.tsx`
- Email + password + name form that calls `authApi.register()`.
- Supabase sends a confirmation email. The user must click the link before the session is active.
- **Critical:** The Supabase Dashboard → Authentication → URL Configuration → Site URL must be set to the production domain, otherwise confirmation emails link to `localhost`.

---

### Dashboard (`/dashboard`) — `dashboard/page.tsx`

The primary landing page after authentication. Data sources:

| Section | Data Source | Live? |
|---------|------------|-------|
| Indian Market Indices (4 cards) | `marketApi.getIndices()` via `useQuery` | ✅ Live |
| Portfolio Value Chart | `mock.ts → portfolioHistory` | ❌ Mock |
| Watchlist (sidebar) | `stockApi.getFullData()` for each symbol in localStorage | ✅ Live |
| Top Movers (gainers/losers) | `marketApi.getMovers()` via `useQuery` | ✅ Live |
| News Preview | `newsApi.getLatest(5)` via `useQuery` | ✅ Live |
| AI Insights Cards (3 cards) | `mock.ts → aiInsightsData` | ❌ Mock |

> **Known limitation:** The portfolio value area chart and AI insight cards still use mock data from `mock.ts`. Replacing these with live API calls is a future task.

---

### Stock Detail (`/stock/[symbol]`) — `stock/[symbol]/page.tsx`

Dynamic route — `[symbol]` is the stock ticker (e.g., `RELIANCE.NS`).

Tabs on the page:

| Tab | Component | Data Source |
|-----|-----------|------------|
| Overview / Price | Inline in page + `TradingViewWidget` | `stockApi.getFullData(symbol)` + `useWebSocketPrice(symbol)` |
| Technical | `TechnicalTab` | Stock data from `stockApi` (RSI, SMA, EMA) |
| Fundamental | `FundamentalTab` | Extended fundamental data from `stockApi` |
| Financials | `FinancialStatements` | Financial statements from the stock API |
| Shareholding | `ShareholdingDonut` | Shareholding pattern data from the stock API |
| Corporate Actions | `CorporateActionsCard` | Dividend + split history from the stock API |

Live price is updated via `useWebSocketPrice(symbol)` — the price displayed in the hero section refreshes every 5 seconds without a page reload.

---

### AI Research (`/ai-research`) — `ai-research/page.tsx`

The AI agent chat interface. Features:

1. **Chat input** — User types a financial question or command.
2. **Agent step animation** — While the agent is processing, each tool call step is shown progressively as an animated list (`[→ Fetching stock data for INFY.NS...]`).
3. **Artifact rendering** — The agent response may include a structured `artifact` block (see Artifact Rendering System below). These are rendered as rich interactive cards instead of plain text.
4. **Conversation history** — The chat history is maintained in component state for the current session (not persisted between page reloads).

Data flow: `aiApi.analyze(question)` → `POST /api/v1/agent/chat` → agent processes → response with optional artifact → `ArtifactRenderer` displays it.

---

### Portfolio (`/portfolio`) — `portfolio/page.tsx`

Portfolio management page. Features:

| Feature | Implementation |
|---------|---------------|
| List portfolios | `portfolioApi.list()` → renders portfolio selector |
| View holdings + P&L | `portfolioApi.getSummary(id)` → table with live P&L from backend |
| Buy shares | Opens `AddToPortfolioModal` → calls `portfolioApi.buyHolding()` |
| Sell shares | Opens `SellHoldingModal` → shows FIFO P&L preview → calls `portfolioApi.sellHolding()` |
| Optimize portfolio | `portfolioApi.optimize(id)` → displays MPT weight suggestions |

P&L values (unrealized gain/loss, current value) are pre-computed by the backend's background price update job and stored in the database. The frontend does **not** calculate P&L — it reads the pre-computed values from the portfolio summary response.

---

### Watchlist (`/watchlist`) — `watchlist/page.tsx`

- The user's watchlist is stored in `localStorage` under key `finsight_watchlist` as a JSON array of ticker symbol strings.
- On page load, each symbol is fetched live via `stockApi.getFullData(symbol)`.
- Users can add/remove symbols; changes are immediately persisted to localStorage.
- **No backend persistence** — clearing browser data clears the watchlist.

---

### News (`/news`) — `news/page.tsx`

- Fetches articles from `newsApi.getLatest(limit)`.
- Displays articles in a card grid with source, timestamp, and a color-coded sentiment badge (`positive` = green, `neutral` = gray, `negative` = red).

---

### Alerts (`/alerts`) — `alerts/page.tsx`

Full alert management:
- List active alerts from `alertsApi.getActive()`.
- Create new alert rules via a form (symbol, condition, threshold, optional message).
- Delete alerts via `alertsApi.delete(id)`.
- View last 10 triggered alerts from `alertsApi.getNotifications()`.

---

### Settings (`/settings`) — `settings/page.tsx`

Static settings form with UI controls (theme, notifications, etc.). No backend integration — changes are not persisted. Placeholder for future account management features.

---

## Shared Components

### Layout Components

| Component | Description |
|-----------|-------------|
| `Sidebar.tsx` | Left navigation sidebar with route links to all main pages. Uses Next.js `usePathname()` to highlight the active route. |
| `TopBar.tsx` | Top header bar shown on most pages. Displays the current page title and the authenticated user's email. |
| `AppShell.tsx` | Thin wrapper component around page content areas for consistent padding and max-width constraints. |

### Icon Components (`Icons.tsx`)

Contains all custom SVG icon components used throughout the UI:
- `IcSend` — Send/submit icon (used in AI chat input)
- `IcPlus` — Plus/add icon (used in portfolio and alert creation)
- `IcPortfolio` — Portfolio briefcase icon
- `IcAlerts` — Bell/alert icon
- `IcChart` — Chart/trend icon
... and more.

### Stock Detail Components

| Component | Description |
|-----------|-------------|
| `FundamentalTab.tsx` | Displays P/E ratio, EPS, dividend yield, book value, sector, market cap, 52-week high/low, and other fundamental metrics |
| `TechnicalTab.tsx` | Displays RSI, SMA, EMA with interpretation badges (Overbought/Neutral/Oversold) and a summary gauge |
| `FinancialStatements.tsx` | Tabbed view of income statement, balance sheet, and cash flow data |
| `ShareholdingDonut.tsx` | Recharts PieChart showing promoter, FII, DII, and public shareholding % breakdown |
| `CorporateActionsCard.tsx` | Table of historical dividends and stock split events |
| `IndicatorCard.tsx` | Reusable card for one technical indicator value with label, value, and interpretation text |
| `TechnicalSummaryGauge.tsx` | Visual semicircle gauge showing overall Buy / Neutral / Sell rating |
| `SupportResistanceBar.tsx` | Horizontal bar chart showing the current price relative to support and resistance levels |
| `TradingViewWidget.tsx` | Embeds a TradingView Advanced Chart widget using an iframe. Reads the stock symbol from props. |

### Portfolio Modal Components

| Component | Description |
|-----------|-------------|
| `AddToPortfolioModal.tsx` | Modal dialog for buying/adding shares: portfolio selector, symbol input, quantity, price. Calls `portfolioApi.buyHolding()`. |
| `SellHoldingModal.tsx` | Modal dialog for selling shares. Shows live FIFO P&L preview as quantity is changed. Calls `portfolioApi.sellHolding()`. |

### Dashboard AI Component

| Component | Description |
|-----------|-------------|
| `AIInsights.tsx` | Card shown on the main dashboard sidebar. Displays 3 AI insight items from `mock.ts`. Shows a live status indicator (green dot + "AI Active"). |

---

## Artifact Rendering System

The artifact system provides rich, structured output rendering for the AI Research page. When the AI agent returns a response with an `artifact` block, the `ArtifactRenderer` parses the type and renders an appropriate interactive UI instead of raw text.

### `ArtifactRenderer.tsx`

**Location:** `frontend/src/components/artifact/ArtifactRenderer.tsx`

The root renderer component. Accepts an `artifact` object with a `type` field and routes it to the appropriate skeleton or custom layout:

| Artifact Type | Renderer Used | Description |
|--------------|--------------|-------------|
| `hero_price` | `SkeletonHeroPrice` | Large hero display of a stock's current price and daily change |
| `investment_thesis` | `SkeletonInvestmentThesis` | Full investment thesis: verdict banner, metric grid, risk panel, news feed |
| `technical_focus` | `SkeletonTechnicalFocus` | Technical analysis breakdown: RSI/SMA/EMA gauges, signal rows, support/resistance |
| `financials_timeline` | `SkeletonFinancialsTimeline` | Revenue and profit over multiple years as a bar/line chart |
| `news_event` | `SkeletonNewsEvent` | News event summary with sentiment and impact assessment |
| `three_way_compare` | `SkeletonThreeWayCompare` | Side-by-side comparison of three stocks across multiple metrics |

### Artifact Atoms (`components/artifact/atoms/`)

Primitive building blocks used inside skeleton layouts. Each atom is a focused, reusable component that renders one type of data:

| Atom | What It Renders |
|------|----------------|
| `VerdictBanner.tsx` | Full-width BULLISH / BEARISH / NEUTRAL banner with confidence bar |
| `VerdictCard.tsx` | Compact verdict card with confidence score (used in comparisons) |
| `HeroMetric.tsx` | Large metric display with label, value, and delta indicator |
| `MetricGrid.tsx` | 2-3 column grid of compact key-value metrics |
| `FundamentalGrid.tsx` | Layout grid optimized for fundamental financial data |
| `PeerComparisonTable.tsx` | Full table comparing multiple stocks across rows |
| `CompareColumns.tsx` | Side-by-side column layout for peer data |
| `SignalRow.tsx` | One technical signal: indicator name + value + buy/sell/neutral badge |
| `TechnicalGauges.tsx` | Set of mini circular gauges for RSI, SMA position, EMA position |
| `SupportResistanceBar.tsx` | Horizontal bar showing current price between support and resistance |
| `RevenueProfitChart.tsx` | Bar/line combo chart for revenue and net profit over years |
| `SegmentStrengthBars.tsx` | Horizontal bar visualization of business segment contributions |
| `MiniBarChart.tsx` | Tiny inline bar chart for trend visualization |
| `MiniPriceCard.tsx` | Compact price card with change percentage indicator |
| `ProgressBar.tsx` | Labeled horizontal progress bar (used for shareholding %) |
| `NewsFeed.tsx` | Container for a list of `NewsItem` components |
| `NewsItem.tsx` | Single news headline with source, timestamp, and sentiment badge |
| `ExpandSection.tsx` | Collapsible section with expand/collapse toggle |
| `ExpandableRiskPanel.tsx` | Expandable risk factors panel with warning styling |

### Artifact Skeletons (`components/artifact/skeletons/`)

Loading states shown while the AI agent is generating a response. Each skeleton matches the layout of the corresponding artifact type, using animated shimmer effects.

| Skeleton | For Artifact Type |
|----------|-----------------|
| `SkeletonHeroPrice.tsx` | `hero_price` |
| `SkeletonInvestmentThesis.tsx` | `investment_thesis` |
| `SkeletonTechnicalFocus.tsx` | `technical_focus` |
| `SkeletonFinancialsTimeline.tsx` | `financials_timeline` |
| `SkeletonNewsEvent.tsx` | `news_event` |
| `SkeletonThreeWayCompare.tsx` | `three_way_compare` |
| `Shimmer.tsx` | Base shimmer animation — imported by all other skeleton components |

### Artifact Type System (`lib/artifact-types.ts` and `lib/artifact-assembler.ts`)

- **`artifact-types.ts`** — TypeScript type definitions for every artifact variant's data shape. These types match what the AI agent returns in its `artifact.data` field.
- **`artifact-assembler.ts`** — Parses the raw agent JSON response and constructs typed `Artifact` objects. Handles validation, defaults, and edge cases (e.g., `s.compare as any` cast for dynamic `peers` property access when the type is `any[]`).

---

## Landing Page Components (`components/landing/`)

Components used on the public-facing landing page (shown before authentication):

| Component | Description |
|-----------|-------------|
| `NavBar.tsx` | Top navigation bar with logo, links, and CTA button |
| `HeroSection.tsx` | Hero banner: headline, subtext, call-to-action buttons, and dashboard preview image |
| `TickerTape.tsx` | Infinitely scrolling horizontal ticker tape animation showing live Indian stock prices |
| `FeatureGrid.tsx` | Grid of feature cards with icons describing FinSight AI's capabilities |
| `ProtocolSection.tsx` | "How It Works" section explaining the AI research pipeline |
| `TrustBar.tsx` | Social proof bar: data sources, model providers, and trust indicators |
| `LandingFooter.tsx` | Page footer with links and copyright |
# FinSight AI — API Client Layer (Frontend → Backend)

> This document covers all frontend API modules, the base fetch wrapper, the Supabase client, auth context, the WebSocket hook, utility functions, and the artifact type system.

---

## Base Fetch Wrapper — `api-client.ts`

**Location:** `frontend/src/lib/api-client.ts`

All HTTP communication with the FastAPI backend goes through `apiFetch()`. No component or API module should call `fetch()` directly.

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>
```

### What `apiFetch()` Does

1. Reads `NEXT_PUBLIC_API_URL` from the environment. Falls back to `http://127.0.0.1:8000` for local development.
2. Calls `supabase.auth.getSession()` to get the current JWT access token. Falls back to checking `localStorage` for a token if Supabase returns no session.
3. Constructs the full URL: `BASE_URL + endpoint`.
4. Sets default headers: `Content-Type: application/json` and `Authorization: Bearer <token>`.
5. Merges caller-provided `options` (body, method, additional headers).
6. Calls `fetch()` and awaits the response.
7. If status is `401`: calls `supabase.auth.signOut()` and redirects to `/auth/login`.
8. If status is any other non-2xx: throws `ApiError(response.status, detail_from_body)`.
9. Returns the parsed JSON response as type `T`.

### `ApiError` Class

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(`API Error ${status}: ${detail}`);
  }
}
```

Used in component-level `try/catch` blocks to distinguish network/API errors from unexpected JavaScript errors.

---

## Supabase Client — `supabase.ts`

**Location:** `frontend/src/lib/supabase.ts`

Creates and exports a singleton Supabase JavaScript client:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

This client is used:
- In `auth.api.ts` for all authentication operations.
- In `api-client.ts` to retrieve the current session JWT.
- In `auth-context.tsx` to listen for auth state changes.

> **Security:** The `ANON_KEY` is safe to expose in the browser — it has row-level security (RLS) applied in Supabase. Never use the `service_role` key in the frontend.

---

## Auth Context — `auth-context.tsx`

**Location:** `frontend/src/lib/auth-context.tsx`

Provides a React context (`AuthContext`) that makes the current Supabase session available to all components without prop drilling.

```typescript
interface AuthContextValue {
  user: User | null;         // Supabase user object (null if not logged in)
  session: Session | null;   // Full Supabase session (contains access_token)
  loading: boolean;          // True while initial session check is in progress
}
```

The `AuthProvider` component:
1. Calls `supabase.auth.getSession()` on mount to load the initial session.
2. Subscribes to `supabase.auth.onAuthStateChange()` to reactively update state when the user logs in, logs out, or the token refreshes.
3. Sets `loading = false` once the initial check is complete.

**Usage in components:**
```typescript
const { user, loading } = useAuth();  // useAuth() is the context consumer hook
```

---

## Auth API — `auth.api.ts`

**Location:** `frontend/src/lib/auth.api.ts`

Wraps Supabase Auth operations. Does NOT call the FastAPI backend directly.

```typescript
export const authApi = {
  // Login with email + password
  login: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  // Register new user with email + password
  register: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  // Sign out current user
  logout: () => supabase.auth.signOut(),

  // Get current user object
  getUser: () => supabase.auth.getUser(),
};
```

---

## Stock API — `stock.api.ts`

**Location:** `frontend/src/lib/stock.api.ts`

```typescript
export const stockApi = {
  // Full stock data: price + RSI/SMA/EMA + fundamentals
  getFullData: (symbol: string): Promise<StockDataResponse> =>
    apiFetch(`/api/v1/stock/${encodeURIComponent(symbol)}`),

  // Historical OHLCV candle data
  getHistory: (symbol: string, period = "1mo", interval = "1d"): Promise<CandleData[]> =>
    apiFetch(`/api/v1/stock/${encodeURIComponent(symbol)}/history?period=${period}&interval=${interval}`),
};
```

---

## Portfolio API — `portfolio.api.ts`

**Location:** `frontend/src/lib/portfolio.api.ts`

```typescript
export const portfolioApi = {
  // List all portfolios for authenticated user
  list: (): Promise<Portfolio[]> =>
    apiFetch("/portfolios/"),

  // Create a new portfolio
  create: (payload: { name: string }): Promise<Portfolio> =>
    apiFetch("/portfolios/", { method: "POST", body: JSON.stringify(payload) }),

  // Get portfolio summary with live P&L
  getSummary: (id: number): Promise<PortfolioSummaryResponse> =>
    apiFetch(`/portfolios/${id}/summary`),

  // Add holding directly (legacy)
  addHolding: (portfolioId: number, payload: HoldingCreate): Promise<Holding> =>
    apiFetch(`/portfolios/${portfolioId}/holdings`, { method: "POST", body: JSON.stringify(payload) }),

  // Record a BUY or SELL transaction (preferred)
  recordTransaction: (portfolioId: number, payload: TransactionCreate): Promise<Transaction> =>
    apiFetch(`/portfolios/${portfolioId}/transactions`, { method: "POST", body: JSON.stringify(payload) }),

  // Convenience wrapper for buying
  buyHolding: (portfolioId: number, symbol: string, qty: number, price: number) =>
    portfolioApi.recordTransaction(portfolioId, { symbol, transaction_type: "buy", quantity: qty, price }),

  // Sell shares (dedicated endpoint)
  sellHolding: (portfolioId: number, symbol: string, payload: SellRequest): Promise<SellResponse> =>
    apiFetch(`/portfolios/${portfolioId}/holdings/${symbol}/sell`, { method: "POST", body: JSON.stringify(payload) }),

  // MPT optimization
  optimize: (portfolioId: number): Promise<OptimizeResponse> =>
    apiFetch(`/portfolios/${portfolioId}/optimize`),
};
```

---

## Alerts API — `alerts.api.ts`

**Location:** `frontend/src/lib/alerts.api.ts`

```typescript
export const alertsApi = {
  getActive: (): Promise<Alert[]> =>
    apiFetch("/api/v1/alerts/active"),

  getNotifications: (): Promise<Alert[]> =>
    apiFetch("/api/v1/alerts/notifications"),

  create: (payload: AlertCreate): Promise<Alert> =>
    apiFetch("/api/v1/alerts/", { method: "POST", body: JSON.stringify(payload) }),

  delete: (id: number): Promise<void> =>
    apiFetch(`/api/v1/alerts/${id}`, { method: "DELETE" }),
};
```

---

## AI API — `ai.api.ts`

**Location:** `frontend/src/lib/ai.api.ts`

Calls the AI agent chat endpoint:

```typescript
export const aiApi = {
  analyze: (question: string): Promise<AgentChatResponse> =>
    apiFetch("/api/v1/agent/chat", {
      method: "POST",
      body: JSON.stringify({ message: question }),
    }),
};
```

The `AgentChatResponse` type includes: `response` (string), `artifact` (optional typed artifact object), `steps` (agent tool calls), `model_used`, `conversation_id`.

---

## News API — `news.api.ts`

**Location:** `frontend/src/lib/news.api.ts`

```typescript
export const newsApi = {
  getLatest: (limit = 20): Promise<NewsResponse> =>
    apiFetch(`/api/v1/news?limit=${limit}`),
};
```

---

## Market API — `market.api.ts`

**Location:** `frontend/src/lib/market.api.ts`

```typescript
export const marketApi = {
  getIndices: (): Promise<IndexData[]> =>
    apiFetch("/api/v1/indices"),

  getMovers: (): Promise<MoversResponse> =>
    apiFetch("/api/v1/movers"),
};
```

---

## WebSocket Price Hook — `useWebSocketPrice.ts`

**Location:** `frontend/src/lib/useWebSocketPrice.ts`

```typescript
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";

function useWebSocketPrice(symbol: string | null): {
  price: number | null;
  connected: boolean;
  error: string | null;
}
```

### Behaviour

1. Reads `NEXT_PUBLIC_WS_URL` from environment (falls back to `ws://127.0.0.1:8000` locally).
2. On mount or when `symbol` changes: closes any existing WebSocket, opens a new connection to `{WS_BASE}/api/v1/stream/price/{symbol}`.
3. Sets `connected = true` on the `onopen` event.
4. Parses each incoming JSON message and updates the `price` state.
5. Sets `error` on connection failure or unexpected close.
6. On component unmount: calls `ws.close()` for proper cleanup.

### Usage in Stock Detail Page

```typescript
const { price, connected } = useWebSocketPrice("INFY.NS");
// `price` updates every 5 seconds; `connected` shows the stream status indicator
```

---

## Artifact Type System

### `artifact-types.ts`

**Location:** `frontend/src/lib/artifact-types.ts`

Defines TypeScript types for every artifact variant's data payload. These types are used throughout the artifact system for type safety.

Key types:

```typescript
type ArtifactType =
  | "hero_price"
  | "investment_thesis"
  | "technical_focus"
  | "financials_timeline"
  | "news_event"
  | "three_way_compare";

interface Artifact {
  type: ArtifactType;
  data: HeroPriceData | InvestmentThesisData | TechnicalFocusData | ... ;
}
```

Each data type matches the structure that `ArtifactRenderer.tsx` passes to the corresponding skeleton component.

### `artifact-assembler.ts`

**Location:** `frontend/src/lib/artifact-assembler.ts`

Parses the raw agent response body and assembles a typed `Artifact` object:

1. Checks if `response.artifact` exists.
2. Reads `artifact.type` to determine which data shape to expect.
3. Validates and transforms `artifact.data` into the correct typed structure.
4. Returns `null` if the artifact type is unknown or data is malformed.

**Known implementation detail:** When `s.compare` is typed as `any[]` but has object properties like `.peers`, it is cast as `(s.compare as any).peers` to avoid TypeScript strict-mode errors. This was fixed in the May 1, 2026 TypeScript build fixes.

---

## Utility Functions — `utils.ts`

**Location:** `frontend/src/lib/utils.ts`

```typescript
// Format a number as Indian Rupees: ₹1,82,050
formatINR(value: number): string

// Format a percentage with sign: +2.4% or -1.2%
formatPct(value: number): string

// Format a Date or ISO string as: "01 May 2026"
formatDate(date: Date | string): string

// Format a Date or ISO string as: "10:30 AM"
formatTime(date: Date | string): string
```

All price displays across the frontend use `formatINR()` for consistency. All percentage changes use `formatPct()`.

---

## Mock Data — `mock.ts`

**Location:** `frontend/src/lib/mock.ts`

Contains static data used in two places where live API integration is not yet implemented:

| Mock Export | Used By | Description |
|------------|---------|-------------|
| `portfolioHistory` | `dashboard/page.tsx` | Array of `{ date, value }` for the portfolio area chart |
| `aiInsightsData` | `AIInsights.tsx` | Array of 3 AI insight card objects |

These should eventually be replaced with live API data. Until then, they provide a realistic-looking dashboard even without real portfolio data.
# FinSight AI — Design System & Styling

> This document covers the complete visual design system: color palette, typography, spacing conventions, currency formatting, and component styling patterns.

---

## Theme Philosophy

FinSight AI uses a **premium dark mode** design as its primary (and only) theme. The design language is:
- **Minimal and data-dense** — Information is organized into cards with subtle borders, not heavy dividers.
- **Accent-driven** — A single bright accent color (lime `#C8FF00`) is used sparingly for calls-to-action, chart lines, and key highlights.
- **Legible** — High contrast primary text on dark backgrounds, with muted secondary text for labels.

---

## Color Palette

All colors are defined in `frontend/tailwind.config.ts` as custom Tailwind tokens under the `colors` key. These are the only colors used in the UI — generic Tailwind colors (plain `red`, `blue`, `green`, etc.) are not used.

### Background Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `background` | `#0B0D11` | Main page background |
| `sidebar` | `#090B0F` | Sidebar navigation background (slightly darker) |
| `card` | `#12141B` | Card backgrounds (portfolios, news, indices) |
| `card2` | `#0E1014` | Nested cards, secondary card variants |
| `dim` | `#1D2028` | Muted background elements (dividers, hover states) |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `border` | `rgba(255,255,255,0.07)` | Default card borders — very subtle |
| `border-hi` | `rgba(255,255,255,0.13)` | Higher contrast borders (hover, active states) |

### Text Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `text` | `#ECEEF2` | Primary text: headings, values, important labels |
| `muted` | `#636B7A` | Secondary text: field labels, timestamps, subtitles |

### Accent Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `lime` | `#C8FF00` | Primary accent: CTA buttons, active nav items, chart lines, key metrics |
| `lime-dim` | `rgba(200,255,0,0.12)` | Lime-tinted backgrounds (hover states, active badges) |
| `purple` | `#9B72FF` | Secondary accent: AI-related elements, badges |
| `pink` | `#FF4FD8` | Tertiary accent: select highlights |

### Semantic Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `green` | `#4ADE80` | Positive values: price gains, positive P&L, bullish sentiment |
| `red` | `#F87171` | Negative values: price drops, negative P&L, bearish sentiment |
| `amber` | `#FBBF24` | Warning states: triggered alerts, neutral sentiment badges |

---

## Typography

### Font Families

| Role | Font | Source | CSS Variable |
|------|------|--------|-------------|
| **Headings** | Outfit | Google Fonts | `--font-outfit` |
| **Body / Labels** | DM Sans | Google Fonts | `--font-dm-sans` |

Both fonts are loaded via Next.js `next/font/google` in `layout.tsx` and applied to the `<html>` element as CSS variables. Tailwind uses `font-heading` and `font-body` utility classes mapped to these variables.

### Type Scale

| Element | Tailwind Classes | Notes |
|---------|-----------------|-------|
| Page titles | `text-2xl font-heading font-semibold text-text` | |
| Section headings | `text-lg font-heading font-medium text-text` | |
| Card headings | `text-base font-semibold text-text` | |
| Body text | `text-sm font-body text-text` | |
| Labels / captions | `text-xs font-body text-muted` | |
| Numbers (prices) | `text-2xl font-heading font-bold text-text` | Larger for hero values |
| Positive values | add `text-green` | Always paired with `+` prefix |
| Negative values | add `text-red` | Always paired with `-` prefix |

---

## Spacing & Layout Conventions

- **Page padding:** `p-6` or `p-8` on the main content area.
- **Card padding:** `p-4` or `p-5` inside cards.
- **Card gap:** `gap-4` between cards in grid layouts.
- **Border radius:** Cards use `rounded-xl` (12px). Buttons use `rounded-lg` (8px). Badges use `rounded-full`.
- **Card border:** `border border-border` (uses the `border` color token).
- **Grid layout:** Dashboard uses CSS grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) for responsive index cards.

---

## Component Visual Patterns

### Cards

Standard card pattern:
```html
<div class="bg-card border border-border rounded-xl p-4">
  <!-- content -->
</div>
```

Hover-interactive cards add:
```html
class="hover:border-border-hi transition-colors duration-200"
```

### Buttons

Primary CTA button (lime):
```html
<button class="bg-lime text-background font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
  Buy
</button>
```

Destructive button (red):
```html
<button class="bg-red/10 text-red border border-red/20 font-medium px-4 py-2 rounded-lg hover:bg-red/20">
  Delete
</button>
```

### Badges / Pills

Sentiment badge pattern:
```html
<!-- Positive -->
<span class="bg-green/10 text-green text-xs px-2 py-0.5 rounded-full font-medium">positive</span>

<!-- Negative -->
<span class="bg-red/10 text-red text-xs px-2 py-0.5 rounded-full font-medium">negative</span>

<!-- Neutral -->
<span class="bg-amber/10 text-amber text-xs px-2 py-0.5 rounded-full font-medium">neutral</span>
```

### Value Display (Gain/Loss)

```html
<!-- Positive -->
<span class="text-green font-semibold">+₹1,530.00 (+8.40%)</span>

<!-- Negative -->
<span class="text-red font-semibold">-₹420.00 (-2.30%)</span>
```

---

## Custom Scrollbar Styling

Defined in `frontend/src/app/globals.css`:

```css
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

This creates a thin (4px), transparent-backed scrollbar that blends into the dark theme while remaining visible on hover.

---

## Currency Formatting

All monetary values displayed in the UI are in **Indian Rupees (₹)**.

The `formatINR()` utility in `lib/utils.ts` uses:
```typescript
value.toLocaleString('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
```

This produces the Indian number formatting convention:
- `₹1,82,050.00` (lakhs grouping: 1,00,000 = 1 lakh)
- `₹19,28,00,00,00,000.00` (crores)

---

## Chart Styling (Recharts)

The portfolio value area chart on the dashboard uses Recharts `AreaChart` with:
- **Fill color:** `lime` (`#C8FF00`) with opacity gradient (100% → 0%)
- **Stroke color:** `lime` (`#C8FF00`)
- **Grid lines:** `rgba(255,255,255,0.05)` — barely visible
- **Tooltip background:** `card` (`#12141B`) with `border-border`
- **Axis text:** `muted` (`#636B7A`)
- **No dot markers** on the line (clean look)

---

## TailwindCSS Configuration Summary

`frontend/tailwind.config.ts` extends the default Tailwind theme with:

```typescript
theme: {
  extend: {
    colors: {
      background: "#0B0D11",
      sidebar: "#090B0F",
      card: "#12141B",
      card2: "#0E1014",
      border: "rgba(255,255,255,0.07)",
      "border-hi": "rgba(255,255,255,0.13)",
      lime: "#C8FF00",
      "lime-dim": "rgba(200,255,0,0.12)",
      text: "#ECEEF2",
      muted: "#636B7A",
      dim: "#1D2028",
      green: "#4ADE80",
      red: "#F87171",
      amber: "#FBBF24",
      purple: "#9B72FF",
      pink: "#FF4FD8",
    },
    fontFamily: {
      heading: ["var(--font-outfit)", "sans-serif"],
      body: ["var(--font-dm-sans)", "sans-serif"],
    },
  },
}
```

`content` is set to scan all `.tsx` and `.ts` files under `src/` for class usage.
# FinSight AI — Backend Services Deep-Dive

> This document provides detailed coverage of every service in `backend/app/services/`. Services contain all business logic — route handlers (API layer) only call services and return results.

---

## Design Principle

All service instances are **singletons** — created once at module import time and reused for the lifetime of the backend process. This avoids repeated initialization overhead (e.g., loading API clients, configuring circuit breakers).

Route handlers access services by importing the singleton:
```python
from app.services.stock_service import stock_service
result = await stock_service.get_current_price("INFY.NS")
```

---

## `stock_service.py` — Market Data Service

**Location:** `backend/app/services/stock_service.py` (~25KB, the largest service)

Wraps `yfinance` for all market data operations. Protected by a circuit breaker to handle Yahoo Finance API instability gracefully.

### Key Methods

#### `get_current_price(symbol: str) -> dict`
Returns a real-time price snapshot for a single ticker.

Response shape:
```python
{
    "symbol": "INFY.NS",
    "price": 1825.60,
    "change": 12.40,
    "change_pct": 0.68,
    "market_state": "CLOSED",     # "OPEN" | "CLOSED" | "PRE" | "POST"
    "day_high": 1840.00,
    "day_low": 1810.00,
    "previous_close": 1813.20,
    "volume": 3820000,
}
```

Implementation: Uses `yfinance.Ticker(symbol).fast_info` for speed (avoids the heavier `.info` dict fetch). Falls back to `previous_close` if `last_price` is unavailable.

#### `get_full_stock_data(symbol: str) -> StockDataResponse`
Returns complete stock data including technical indicators, fundamentals (P/E, market cap), and all price fields. This is what `GET /api/v1/stock/{symbol}` returns.

#### `get_historical_data(symbol: str, period: str, interval: str) -> List[dict]`
Returns OHLCV candle data for charting. Delegates to `yf.Ticker(symbol).history(period=period, interval=interval)`. Converts the pandas DataFrame to a list of dicts with ISO timestamp strings.

#### `get_indicators(symbol: str) -> dict`
Calculates technical indicators by fetching 60 days of daily data and calling functions from `services/indicators.py`:
- **RSI** (14-period Relative Strength Index)
- **SMA** (20-period Simple Moving Average)
- **EMA** (20-period Exponential Moving Average)

---

## `indicators.py` — Technical Indicator Calculations

**Location:** `backend/app/services/indicators.py`

Pure mathematical functions — no I/O, no external calls.

```python
def calculate_rsi(prices: List[float], period: int = 14) -> float:
    """Wilder's RSI using EWMA gain/loss smoothing."""

def calculate_sma(prices: List[float], period: int = 20) -> float:
    """Simple arithmetic mean of the last `period` prices."""

def calculate_ema(prices: List[float], period: int = 20) -> float:
    """Exponential Moving Average with multiplier = 2/(period+1)."""
```

These functions accept a plain list of closing prices and return a single float. Used by `stock_service.py` and `agent/tools.py`.

---

## `news_service.py` — News & Sentiment Service

**Location:** `backend/app/services/news_service.py`

Singleton `news_service` instance.

### `get_news(limit: int = 20) -> List[dict]`

1. Fetches articles from **Yahoo Finance RSS feed** (primary source, no API key needed).
2. If `NEWS_API_KEY` is configured, supplements with articles from **NewsAPI.org**.
3. Deduplicates articles by URL.
4. For each article title, runs **VADER (Valence Aware Dictionary and sEntiment Reasoner)** sentiment analysis:
   - Compound score > 0.05 → `"positive"`
   - Compound score < -0.05 → `"negative"`
   - Otherwise → `"neutral"`
5. Returns list of `{ title, source, published_at, url, summary, sentiment }` dicts.

---

## `portfolio_service.py` — Portfolio Business Logic

**Location:** `backend/app/services/portfolio_service.py`

All portfolio CRUD operations. Takes a SQLAlchemy `Session` as a parameter (injected via `Depends(get_db)`).

### `get_all_portfolios(db: Session) -> List[Portfolio]`
Returns all Portfolio ORM objects. The route handler filters by `user_id` from the JWT.

### `create_portfolio(db: Session, name: str, user_id: str) -> Portfolio`
Creates a new Portfolio row. Returns `409 HTTPException` if `(user_id, name)` already exists.

### `record_transaction(db, portfolio_id, symbol, transaction_type, quantity, price) -> dict`

The core portfolio mutation logic:

**For BUY transactions:**
1. Checks if a holding for `symbol` already exists in the portfolio.
2. If **exists**: computes new weighted average: `new_avg = (old_qty × old_avg + qty × price) / (old_qty + qty)`. Updates `quantity`, `average_price`, `cost_basis`.
3. If **new holding**: creates a new `Holding` row with `quantity`, `average_price = price`, `cost_basis = quantity × price`.
4. Creates an immutable `Transaction` record with `transaction_type="buy"`, `quantity`, `price`, `total_amount = qty × price`.

**For SELL transactions:**
1. Verifies holding exists and has sufficient quantity.
2. Calculates FIFO realized P&L: `realized = qty × (price - average_price)` (simplified FIFO — uses weighted average as cost basis).
3. Reduces `holding.quantity` by `qty`. If quantity reaches 0, **deletes the holding row**.
4. Adds `realized` to `holding.realized_pl` and updates `realized_pl_pct`.
5. Creates an immutable `Transaction` record with `transaction_type="sell"`, `realized_pl = realized`.

### `get_portfolio_summary(db: Session, portfolio_id: int) -> PortfolioSummaryResponse`

Aggregates portfolio-level data:
1. Loads all holdings for the portfolio.
2. Sums `cost_basis` → `total_invested`.
3. Sums `current_value` (populated by background job) → `total_current_value`.
4. Computes `total_unrealized_pl = total_current_value - total_invested`.
5. Sums `realized_pl` → `total_realized_pl`.
6. Returns the aggregated summary with the full holdings list.

### `update_holding_prices(db, holding_id, current_price) -> None`

Called by the background price update job. Updates:
- `holding.current_price = current_price`
- `holding.current_value = holding.quantity × current_price`
- `holding.unrealized_pl = holding.current_value - holding.cost_basis`
- `holding.unrealized_pl_pct = (holding.unrealized_pl / holding.cost_basis) × 100`
- `holding.last_price_update = datetime.utcnow()`

---

## `price_update_job.py` — Background Price Refresh

**Location:** `backend/app/services/price_update_job.py`

A background APScheduler job registered at startup, running every **5 minutes**.

### `update_all_holdings_prices()`

Main job function:
1. Opens a new database session.
2. Queries all distinct `symbol` values from the `holdings` table.
3. Calls `_batch_fetch_prices(symbols)` to fetch current prices for all symbols at once via yFinance.
4. For each holding in each portfolio: calls `portfolio_service.update_holding_prices(db, holding_id, price)`.
5. Commits all updates in a single transaction.
6. Logs success/failure per symbol so one bad ticker doesn't block others.

### `_batch_fetch_prices(symbols: List[str]) -> dict[str, float]`

Uses `yfinance.Tickers(" ".join(symbols))` to batch-fetch prices for multiple symbols in one HTTP request to Yahoo Finance. Falls back to `fast_info.previous_close` if `last_price` is not available (market closed).

---

## `alert_service.py` — Alert Monitoring Service

**Location:** `backend/app/services/alert_service.py`

### `create_alert(db, symbol, condition, threshold, message, user_id) -> Alert`
Creates a new `Alert` row with `status="active"`.

### `get_all_active_alerts(db) -> List[Alert]`
Returns alerts with `status="active"`.

### `get_recent_alerts(db, limit=10) -> List[Alert]`
Returns the 10 most recently triggered alerts (`status="triggered"`) ordered by `triggered_at` descending.

### `delete_alert(db, alert_id) -> None`
Deletes the alert row by ID.

### Alert Polling Job
APScheduler job running every **300 seconds** (5 minutes):

1. Loads all active alerts from the database.
2. For each alert:
   - Fetches current price/RSI/SMA for `alert.symbol`.
   - Evaluates `alert.condition` against `alert.threshold`.
   - If condition is met: sets `alert.status = "triggered"`, sets `alert.triggered_at = now()`.
3. Commits all state changes.

### `start_scheduler()` / `stop_scheduler()`
Control the APScheduler instance lifecycle. Called by `main.py` on startup and shutdown.

---

## `macro_service.py` — Macroeconomic Data Service

**Location:** `backend/app/services/macro_service.py`

### `get_macro_dashboard() -> dict`

Fetches and returns:
- **10Y US Treasury Yield** — From FRED (`GS10` series) via `pandas_datareader`.
- **CPI (Inflation)** — From FRED (`CPIAUCSL` series).
- **Unemployment Rate** — From FRED (`UNRATE` series).
- **Gold Price** — From yFinance (`GC=F` future).
- **WTI Crude Oil Price** — From yFinance (`CL=F` future).

**Known issue:** `pandas_datareader` is incompatible with `pandas >= 3.0`. The import is wrapped in a `try/except`. When the import fails, FRED values fall back to hardcoded static estimates. See `13_KNOWN_ISSUES.md` for details.

Hardcoded fallback values (used when FRED is unavailable):
```python
{"ten_year_treasury": 4.28, "cpi": 3.2, "unemployment": 3.9}
```

---

## `options_service.py` — Options Chain Service

**Location:** `backend/app/services/options_service.py`

### `get_options_chain(symbol: str) -> dict`
Uses `yfinance.Ticker(symbol).option_chain(expiry)` to fetch calls and puts. Returns the nearest expiry date's chain.

### `calculate_black_scholes(S, K, T, r, sigma, option_type) -> float`
Pure mathematical Black-Scholes pricing formula:
- `S` = current stock price
- `K` = strike price
- `T` = time to expiry (years)
- `r` = risk-free rate
- `sigma` = implied volatility
- `option_type` = `"call"` or `"put"`

---

## `mpt_service.py` — Portfolio Optimization Service

**Location:** `backend/app/services/mpt_service.py`

### `optimize_portfolio(symbols: List[str]) -> dict`

1. Fetches 5 years of adjusted close prices for all symbols via yFinance.
2. Calculates expected returns using `pypfopt.expected_returns.mean_historical_return()`.
3. Computes the covariance matrix using `pypfopt.risk_models.sample_cov()`.
4. Runs Max-Sharpe Ratio optimization via `pypfopt.EfficientFrontier`.
5. Returns cleaned weights (zero-weight assets removed), expected annual return, annual volatility, and Sharpe ratio.

Requires a minimum of 2 symbols. Returns `400 HTTPException` if fewer are provided.

---

## `categorizer.py` — Query Intent Classifier

**Location:** `backend/app/services/categorizer.py`

Classifies incoming user questions by intent to help the agent choose the right tools and data sources:

| Category | Example Query |
|----------|-------------|
| `stock_analysis` | "Analyze RELIANCE.NS", "What's TCS trading at?" |
| `news` | "Latest news on Infosys", "What happened to HDFC Bank today?" |
| `portfolio` | "How is my portfolio doing?", "Should I sell WIPRO?" |
| `macro` | "What is the current repo rate?", "How is inflation trending?" |
| `general` | "Explain P/E ratio", "What is RSI?" |

---

## `data_provider.py` — Unified Data Abstraction

**Location:** `backend/app/services/data_provider.py`

A facade over multiple data sources that provides a single `get_data(symbol, data_type)` interface. The agent's tools call `data_provider` instead of calling individual services directly, making it easier to swap or add data sources.

---

## `setup_engine.py` — Trading Setup Detection

**Location:** `backend/app/services/setup_engine.py`

Analyzes a stock's technical indicators to detect actionable trading setups:

| Setup Type | Detection Logic |
|-----------|----------------|
| **RSI Recovery** | RSI was oversold (<30) and is now recovering (rising above 35) |
| **Volume Breakout** | Today's volume is 2× the 20-day average volume |
| **Trend Alignment** | Price is above both SMA and EMA; RSI is in momentum zone (50–70) |

Used by `agent/tools.py` to populate setup information in AI agent responses.

---

## `market_structure.py` — Market Structure Analyzer

**Location:** `backend/app/services/market_structure.py`

Analyzes historical price data to identify structural market features:

| Feature | Method |
|---------|--------|
| **Trend** | Compares current price to 20-day SMA and 50-day SMA. Labels as `"uptrend"`, `"downtrend"`, or `"sideways"` |
| **Support levels** | Identifies recent local price minima (swing lows) |
| **Resistance levels** | Identifies recent local price maxima (swing highs) |
| **52-week range position** | Current price as % between 52-week low and high |

Used by `agent/tools.py` to provide the AI agent with structural market context.

---

## `pdf_service.py` — PDF Parsing Service

**Location:** `backend/app/services/pdf_service.py`

Thin wrapper around PDF parsing for the RAG upload endpoint. Uses LangChain's `PyPDFLoader` internally. Returns text content split into page-level chunks. Used by `api/rag.py` before passing content to the vector store.
# FinSight AI — AI Agent System & RAG Pipeline

> This document covers the OpenRouter-powered multi-model AI agent (the active system) and the RAG (Retrieval-Augmented Generation) document intelligence pipeline.

---

## AI Agent System

The AI agent system lives in `backend/app/agent/`. It is the **currently active** AI backbone, replacing the old `ai/analyst.py` (which was deleted April 29, 2026). The agent is exposed via `api/agent.py` at `/api/v1/agent/*`.

The agent uses **OpenRouter** as its LLM gateway — a routing layer that allows sending requests to multiple model providers (Anthropic Claude, OpenAI GPT-4o, Mistral, etc.) through a single API with automatic fallback.

---

## `agent/graph.py` — Agent Orchestrator (~79KB)

**Location:** `backend/app/agent/graph.py`

This is the core of the AI agent. It implements a **LangGraph state machine** that processes user messages through a multi-step pipeline:

### Agent Architecture

```
User Message
      │
      ▼
┌─────────────────┐
│  Input Router   │ ← categorizer.py: stock / news / portfolio / macro / general
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Executor  │ ← Selects and calls relevant tools from agent/tools.py
└────────┬────────┘
         │ tool results (stock data, news, market structure, setup patterns)
         ▼
┌─────────────────┐
│ Prompt Builder  │ ← agent/prompt_builder.py: assembles context-rich prompt
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   LLM Call      │ ← OpenRouter API: routes to best available model
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response Parser │ ← Extracts text response + optional artifact JSON block
└────────┬────────┘
         │
         ▼
   Structured Response
   { response, artifact, steps, model_used }
```

### Multi-Model Routing

`graph.py` supports multiple model tiers:
- **Primary model:** Selected based on query complexity (e.g., `anthropic/claude-3.5-sonnet` for complex analysis, `openai/gpt-4o-mini` for simple lookups).
- **Fallback model:** If the primary model times out or returns an error, the orchestrator retries with a fallback model.
- **Timeout protection:** Each LLM call has a configurable timeout (default 45 seconds). If exceeded, the agent returns a degraded response rather than hanging indefinitely.

### Artifact Generation

The agent is instructed (via system prompts) to include a structured JSON `artifact` block in its response when the query warrants rich UI rendering. The artifact contains:
- `type`: one of `"hero_price"`, `"investment_thesis"`, `"technical_focus"`, `"financials_timeline"`, `"news_event"`, `"three_way_compare"`
- `data`: type-specific structured data matching the TypeScript types in `frontend/src/lib/artifact-types.ts`

The frontend `ArtifactRenderer` reads this block and renders the appropriate interactive card.

---

## `agent/prompt_builder.py` — Context-Aware Prompt Assembly (~28KB)

**Location:** `backend/app/agent/prompt_builder.py`

Responsible for assembling the complete prompt sent to the LLM. It:

1. Determines the query category (using `services/categorizer.py`).
2. Fetches relevant real-time context based on the category:
   - **Stock queries:** Calls `stock_service.get_full_stock_data()` and `market_structure.analyze()`.
   - **News queries:** Calls `news_service.get_news()` filtered to relevant tickers.
   - **Portfolio queries:** Loads portfolio data from the database (if user context is provided).
   - **Macro queries:** Calls `macro_service.get_macro_dashboard()`.
3. Formats this data into a structured context block appended to the user message.
4. Selects the appropriate system prompt template from `prompts.py`.
5. Returns the fully assembled prompt ready for the LLM call.

This separation means the LLM always receives pre-fetched, formatted, real-time data — it does not need to call tools to get market data. The tools handle additional structured lookups triggered during graph execution.

---

## `agent/prompts.py` — System Prompt Templates (~19KB)

**Location:** `backend/app/agent/prompts.py`

Contains all system prompt templates used by the agent:

| Template | Purpose |
|----------|---------|
| `STOCK_ANALYSIS_PROMPT` | For single-stock analysis queries — instructs the model to assess technicals, fundamentals, and provide a verdict |
| `PEER_COMPARISON_PROMPT` | For multi-stock comparison — instructs the model to produce a structured comparison artifact |
| `NEWS_ANALYSIS_PROMPT` | For news-driven queries — instructs summarization with sentiment and impact assessment |
| `MACRO_PROMPT` | For macroeconomic questions — instructs connection of macro data to market impact |
| `GENERAL_FINANCE_PROMPT` | For educational or general financial questions |
| `ARTIFACT_INSTRUCTIONS` | Appended to relevant prompts to instruct the model on the exact JSON format for artifact output |

All prompts explicitly instruct the model to:
- Focus on Indian stock markets (NSE/BSE)
- Format monetary values in Indian Rupees (₹)
- Only use data provided in the context block (prevents hallucination of prices)
- Return a specific artifact JSON structure when appropriate

---

## `agent/tools.py` — Agent Tool Functions (~10KB)

**Location:** `backend/app/agent/tools.py`

LangChain `@tool`-decorated functions that the agent can call during graph execution. Tools provide structured data lookups that supplement the prompt-built context.

### Available Tools

#### `stock_lookup(symbol: str) -> dict`
Fetches real-time price, indicators, and market structure for a stock symbol. Returns a structured dict that the agent can reference in its response. Calls `stock_service`, `indicators`, and `market_structure`.

#### `get_market_structure(symbol: str) -> dict`
Returns the detailed market structure analysis: trend direction, identified support levels, resistance levels, and 52-week range position. Delegates to `services/market_structure.py`.

#### `detect_trading_setups(symbol: str) -> dict`
Runs setup detection and returns any active patterns (RSI recovery, volume breakout, trend alignment). Delegates to `services/setup_engine.py`.

---

## AI Utility Modules (`backend/app/ai/`)

The `ai/` directory contains shared AI infrastructure modules that are used by multiple systems (the agent, the RAG pipeline, and the analyze endpoint).

> **Note:** These are utility modules, not the active agent. The active agent lives in `agent/`. The `ai/` directory provides safety rails and vector store implementations used by the full system.

| File | Purpose |
|------|---------|
| `scoring.py` | Computes a confidence score (0–100) for AI-generated verdicts based on signal strength and data quality |
| `moderation.py` | Screens incoming user queries for unsafe content, off-topic requests, or attempts to misuse the system |
| `hallucination_check.py` | Post-generation check: verifies that numeric values cited in the response (prices, RSI, etc.) match the data provided in the context block |
| `response_limits.py` | Enforces maximum output length and strips or truncates responses that exceed limits |
| `timeout_guard.py` | Wraps async LLM calls with `asyncio.wait_for(timeout=N)`. Raises a structured error if the LLM does not respond within the timeout window. |
| `document_loader.py` | Parses uploaded PDF and TXT files using LangChain's `PyPDFLoader` and `TextLoader`. Splits into chunks using `RecursiveCharacterTextSplitter`. Uses `structlog` for structured logging. |

---

## RAG Pipeline (Document Intelligence)

The RAG (Retrieval-Augmented Generation) system allows users to upload financial documents (annual reports, research papers, regulatory filings) and semantically query them.

### Upload Flow

```
User uploads PDF/TXT via POST /rag/upload
                │
                ▼
        api/rag.py (route handler)
                │
                ▼
        ai/document_loader.py
        - Detects file type
        - Parses content (PyPDFLoader or TextLoader)
        - Splits into chunks (1000 chars, 200 overlap)
        - Adds metadata (source filename, page number)
                │
                ▼
        Vector Store (ChromaDB or Pinecone)
        - Generates embeddings via the configured embedding model
        - Stores chunk text + embedding + metadata
                │
                ▼
        Returns: { "chunks_indexed": N, "source": "filename.pdf" }
```

### Query Flow

```
User sends GET /rag/query?q=...&score_threshold=1.5
                │
                ▼
        api/rag.py (route handler)
                │
                ▼
        Vector Store .similarity_search_with_score(query, k=5)
        - Embeds the query string
        - Finds the k nearest document chunks by cosine distance
        - Filters by score_threshold
                │
                ▼
        Returns ranked results:
        [
          { "content": "...", "source": "annual_report.pdf", "page": 12, "score": 0.87 },
          ...
        ]
```

### Vector Store Selection

| Condition | Vector Store Used |
|-----------|-----------------|
| `Pinecone_Vector_Database` env var is set | Pinecone cloud vector store (`ai/vector_store_pinecone.py`) |
| No Pinecone key | Local ChromaDB (`ai/vector_store_chroma.py`) |

Both implementations extend the abstract base class in `ai/interfaces/vector_store.py`, ensuring they are interchangeable with no code changes in the route or service layer.

### `ai/interfaces/vector_store.py` — Abstract Base

```python
class AbstractVectorStore(ABC):
    @abstractmethod
    def add_documents(self, documents: List[Document]) -> None: ...

    @abstractmethod
    def similarity_search_with_score(self, query: str, k: int = 5) -> List[Tuple[Document, float]]: ...
```

### ChromaDB Details (`vector_store_chroma.py`)
- Stores embeddings on-disk at `backend/vector_db/`.
- Uses the default embedding model configured via LangChain (typically OpenAI embeddings or a local model).
- The `vector_db/` directory is GITIGNORED — each developer's local vector store is independent.

### Pinecone Details (`vector_store_pinecone.py`)
- Connects to the Pinecone index specified in the `Pinecone_Vector_Database` env var.
- Embeddings are cloud-stored — shared across all instances that use the same Pinecone index.
- Suitable for production deployments where persistent, searchable document storage is needed.

---

## The `POST /api/v1/analyze` Endpoint

The `/api/v1/analyze` endpoint (in `api/analyze.py`) provides a simplified analysis interface separate from the full agent chat. It:
1. Validates the question via `AnalyzeRequest` schema.
2. Applies input moderation (`ai/moderation.py`).
3. Calls the agent pipeline for a structured verdict response.
4. Returns a `FinancialAnalysisResult` with verdict, confidence, technical signals, sentiment signals, and risk assessment.

This is distinct from `/api/v1/agent/chat` — the analyze endpoint always returns a fixed structured format, while the agent chat endpoint supports free-form conversation and rich artifacts.
# FinSight AI — Known Issues & Operational Notes

> This document catalogs known bugs, technical gotchas, environment-specific issues, and operational notes that every developer must be aware of.

---

## Backend Known Issues

### 1. `pandas_datareader` Incompatibility with pandas ≥ 3.0

**Affected service:** `macro_service.py`
**Impact:** FRED macroeconomic data (10Y Treasury, CPI, Unemployment) returns hardcoded static fallback values instead of live data.

The `pandas_datareader` library has not been updated to support `pandas >= 3.0`. The import in `macro_service.py` is wrapped in a `try/except` block so the backend does not crash — it silently degrades:

```python
try:
    import pandas_datareader as pdr
    PANDAS_DATAREADER_AVAILABLE = True
except ImportError:
    PANDAS_DATAREADER_AVAILABLE = False
```

When `PANDAS_DATAREADER_AVAILABLE` is `False`, `get_macro_dashboard()` returns:
```python
{"ten_year_treasury": 4.28, "cpi": 3.2, "unemployment": 3.9, ...}
```

**Resolution path:** Either pin `pandas < 3.0` in `requirements.txt`, switch to the FRED REST API directly, or accept the static fallback values.

---

### 2. `structlog` Must Be in `requirements.txt`

**Affected file:** `ai/document_loader.py`
**Impact:** The RAG upload endpoint will crash with `ImportError: No module named 'structlog'` if structlog is not installed.

`structlog` was missing from the original `requirements.txt`. It has since been added. If you encounter this error, run:
```bash
pip install structlog
pip freeze > requirements.txt
```

---

### 3. Redis is Optional — Silent Fallback

**Affected file:** `core/cache.py`

If Redis is not running or `redis_url` is not set in `.env`, the `CacheService` silently switches to an in-memory Python dictionary. This is logged at startup:

```
WARNING: Redis is unreachable. Falling back to in-memory dictionary cache.
```

**Implications of in-memory fallback:**
- Cache is lost on every backend restart.
- Cache is not shared between multiple worker processes (if horizontal scaling is ever used).
- For development, this is perfectly acceptable.

---

### 4. `create_all()` Does NOT Add New Columns

**Affected component:** `backend/app/main.py` → `Base.metadata.create_all()`

SQLAlchemy's `create_all()` creates tables that don't exist yet. It **never** modifies existing tables — no new columns, no type changes, no index additions.

**When this matters:** Every time a new column is added to a model file (`models/holding.py`, `models/transaction.py`, etc.), that column must be manually added to the real database via an `ALTER TABLE` statement in `migrate.py`.

See `15_DATABASE_MIGRATIONS.md` for the full migration workflow.

---

### 5. Supabase Session Pooler Hangs `create_all()`

**Affected component:** `backend/app/main.py` startup sequence

The Supabase Session Pooler uses PgBouncer in transaction mode. PgBouncer cannot handle multi-statement DDL introspection queries that SQLAlchemy sends before `CREATE TABLE`. This causes the startup to hang indefinitely, failing DigitalOcean health checks.

**Fix already in place:** `main.py` detects `"pooler.supabase.com"` in `DATABASE_URL` and skips `create_all()`. Tables must exist before deploying with the pooler URL.

**For fresh setup:** Use the direct connection URL temporarily → start backend once → `create_all()` runs → switch back to pooler URL.

---

### 6. Mock Data Still in Use (Dashboard)

**Affected file:** `frontend/src/app/dashboard/page.tsx`
**Affected mock:** `frontend/src/lib/mock.ts`

Two sections of the main dashboard still use static mock data instead of live API calls:

| Section | Mock Data Source | Future Fix |
|---------|-----------------|-----------|
| Portfolio Value Area Chart | `mock.ts → portfolioHistory` | Wire to `/portfolios/{id}/summary` historical data |
| AI Insights Cards (3 items) | `mock.ts → aiInsightsData` | Wire to a new agent-powered insights endpoint |

This does not break any functionality — the dashboard works correctly. It's a known debt item.

---

### 7. Watchlist is Client-Side Only

**Affected page:** `frontend/src/app/watchlist/page.tsx`
**Storage:** `localStorage` under key `finsight_watchlist`

The watchlist has no backend persistence. Clearing browser data, using a different browser, or switching devices loses the watchlist. This is by design for the current version — a future backend `/watchlist` endpoint would enable persistence.

---

### 8. Port 8000 Conflict on Windows

When a uvicorn process crashes without releasing port 8000, the next `uvicorn` start fails with:
```
OSError: [WinError 10048] Only one usage of each socket address (protocol/network address/port) is normally permitted.
```

**Fix:**
```powershell
# Find the PID occupying port 8000
netstat -ano | findstr :8000

# Kill it (replace 12345 with actual PID)
taskkill /PID 12345 /F
```

---

### 9. `.env` Leading Spaces Issue

Lines in `.env` that start with a leading space are **silently ignored** by pydantic-settings:
```env
 LANGCHAIN_TRACING_V2=true    ← WRONG: leading space, this variable will be ignored
LANGCHAIN_TRACING_V2=true     ← CORRECT: flush with left margin
```

This is especially common when copying variables from documentation or browser interfaces that add indentation.

---

## Authentication-Specific Issues

### 10. Supabase JWT Algorithm: ES256 vs HS256

**Context:** Supabase rotated its JWT signing key from Legacy HS256 to modern ECC P-256 (`ES256`) in 2025.

**Symptom if misconfigured:** All authenticated API calls return `401 Unauthorized`. The frontend enters an infinite login redirect loop.

**Resolution:**
1. Check your Supabase project: Dashboard → Authentication → JWT Signing Keys.
2. If you see "ECC P-256 (ES256)", copy the JWK JSON and set `SUPABASE_JWT_SECRET={...json...}` in `.env`.
3. If you only see a "Legacy JWT Secret" tab, copy the plain string and set `SUPABASE_JWT_SECRET=plain-string-here`.

The backend `security.py` auto-detects the format — no code changes needed.

---

### 11. Supabase Email Confirmation Links to Localhost

**Context:** By default, Supabase sends email confirmations that redirect to `http://localhost:3000`.

**Symptom:** Mobile users or users on different machines click the confirmation link and see `ERR_CONNECTION_REFUSED`.

**Fix:** Update Supabase Dashboard → Authentication → URL Configuration → **Site URL** to your production domain (`https://finsight-app-v8wgj.ondigitalocean.app`). No code change needed.

---

### 12. `NEXT_PUBLIC_SUPABASE_ANON` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The Supabase JS client specifically looks for `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with the `_KEY` suffix). If the variable is named `NEXT_PUBLIC_SUPABASE_ANON` (missing `_KEY`), the Supabase client initializes without the anon key. Auth will appear to work in the Supabase dashboard but silently fail in the app.

Always use the exact name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Production-Specific Issues (DigitalOcean)

### 13. DigitalOcean Workers Cannot Reach IPv6 Hosts

**Context:** DigitalOcean App Platform workers are IPv4-only. The default Supabase direct connection (`db.xxx.supabase.co`) resolves to an IPv6 address.

**Symptom:** `FATAL: could not connect to server: No route to host` in backend logs.

**Fix:** Always use the **Supabase Session Pooler URL** for production:
```
postgresql+psycopg2://postgres.PROJECTREF:[PASS]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

---

### 14. Hidden Newline in DigitalOcean Environment Variables

When pasting `DATABASE_URL` (or any multiline value) into DigitalOcean's environment variable UI, an invisible newline (`\n`) can be appended to the end.

**Symptom:** `FATAL: database "postgres\n" does not exist`

**Fix:** After pasting the value, place your cursor at the end and press Backspace once or twice to ensure no trailing whitespace. Then delete and retype the last character to confirm.

---

### 15. DigitalOcean Route Stripping and `DOPathRewriteMiddleware`

DigitalOcean App Platform routes `/api/*` traffic to the FastAPI worker but strips the `/api` prefix before forwarding the request. This means FastAPI receives `/v1/indices` instead of `/api/v1/indices`.

**Fix already in place:** `main.py` registers `DOPathRewriteMiddleware` as the outermost ASGI middleware. It detects when a request path doesn't start with `/api` and re-prepends it.

This middleware is **harmless in local development** — locally, the browser sends the full `/api/v1/...` path, which already starts with `/api`, so the middleware is a no-op.

---

## TypeScript-Specific Issues (Frontend Build)

### 16. Three TypeScript Build Errors Fixed (May 1, 2026)

Three TypeScript strict-mode errors were blocking the DigitalOcean production build. All three are fixed:

| File | Error | Fix Applied |
|------|-------|------------|
| `ArtifactRenderer.tsx` | `ProgressBar` imported but export was renamed to `ShareholdingProgress` | Updated import to match the actual export name |
| `SkeletonThreeWayCompare.tsx` | Passed `w`/`h` shorthand props to `<Shimmer>` but interface requires `width`/`height` | Updated all prop names to `width` and `height` |
| `artifact-assembler.ts` | `s.compare` typed as `any[]` but accessed `.peers` property (object member, not array) | Cast to `(s.compare as any).peers` |

These fixes are present in the current codebase. They are documented here for historical awareness.

---

## Operational Checklist

When setting up a new developer environment, verify all of the following:

- [ ] Python 3.11+ installed
- [ ] `.venv` created and activated
- [ ] `pip install -r requirements.txt` completed without errors
- [ ] `.env` created from `.env.example` with real values filled in
- [ ] `SUPABASE_JWT_SECRET` format matches your Supabase project (HS256 string or JWK JSON)
- [ ] `DATABASE_URL` uses direct connection for local dev (not pooler)
- [ ] `frontend/.env.local` created with Supabase URL and anon key
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` named with `_KEY` suffix
- [ ] `npm install` completed in `frontend/`
- [ ] Backend starts at `http://localhost:8000/health` → `{"status": "ok"}`
- [ ] Frontend starts at `http://localhost:3000` → redirects to login
- [ ] Login works end-to-end (Supabase session issued, dashboard loads)
# FinSight AI — Git & Collaboration

> This document covers the Git workflow, branch strategy, collaboration conventions, and key files for onboarding new developers.

---

## Repository

| Item | Value |
|------|-------|
| **GitHub Repository** | `https://github.com/Tilak1452/Full-Stack-Client-Dashboard` |
| **Primary Branch** | `main` |
| **Monorepo** | Yes — frontend and backend are in the same repository |

---

## Branch Strategy

This project uses **feature branches** with pull requests into `main`. Direct commits to `main` are prohibited.

### Workflow

```bash
# 1. Always start from an up-to-date main
git checkout main
git pull origin main

# 2. Create a feature branch (use descriptive names)
git checkout -b feature/add-crypto-watchlist
# or: fix/portfolio-pl-calculation, refactor/agent-prompts, docs/update-api-ref

# 3. Make your changes and commit in logical chunks
git add .
git commit -m "feat: add crypto symbols to watchlist API"

# 4. Push your branch to GitHub
git push origin feature/add-crypto-watchlist

# 5. Open a Pull Request on GitHub
# - Add a description of what changed and why
# - Reference any related issues
# - Request review from a teammate

# 6. After approval, merge via GitHub UI (squash merge preferred for clean history)

# 7. Delete the feature branch after merge
git branch -d feature/add-crypto-watchlist
```

---

## Commit Message Conventions

Use the conventional commits format for clarity:

| Prefix | When to Use |
|--------|------------|
| `feat:` | New feature (e.g., `feat: add portfolio export to CSV`) |
| `fix:` | Bug fix (e.g., `fix: RSI calculation wrong for weekend data`) |
| `docs:` | Documentation only (e.g., `docs: update API reference for agent endpoint`) |
| `refactor:` | Code restructure without behavior change |
| `chore:` | Dependency updates, config changes (e.g., `chore: update yfinance to 0.2.38`) |
| `test:` | Adding or modifying tests |

---

## What Is GITIGNORED

The following are in `.gitignore` and must **never** be committed:

| Path | Reason |
|------|--------|
| `.env` | Contains secrets (database URL, API keys, JWT secrets) |
| `.venv/` | Machine-specific Python virtual environment |
| `frontend/node_modules/` | Node.js dependencies (installed from `package-lock.json`) |
| `frontend/.next/` | Next.js build output |
| `frontend/.env.local` | Frontend environment secrets |
| `*.db` | SQLite local database files |
| `backend/vector_db/` | ChromaDB local vector store (machine-specific) |
| `graphify-out/cache/` | Graphify incremental build cache |
| `__pycache__/` | Python bytecode cache |
| `.vscode/` | Editor-specific settings |

---

## What IS Committed

| Path | Reason |
|------|--------|
| `.env.example` | Safe template showing required variable names with empty values |
| `requirements.txt` | Python dependency list (the source of truth for Python deps) |
| `package.json` + `package-lock.json` | Node.js dependency list and lockfile |
| `frontend/tailwind.config.ts` | Design system configuration |
| `graphify-out/graph.json` | Knowledge graph (updated by git hook) |
| `graphify-out/GRAPH_REPORT.md` | Human-readable architecture summary |
| All source code | `backend/`, `frontend/src/`, `docs/` |

---

## Key Collaboration Files

| File | Purpose |
|------|---------|
| `requirements.txt` | Python dependencies — update after `pip install <pkg>` with `pip freeze > requirements.txt` |
| `frontend/package-lock.json` | Node.js lockfile — always commit this; do not regenerate without reason |
| `.env.example` | Template for `.env` — always keep in sync when adding new env vars |
| `docs/` | This documentation set — update when adding features |
| `redundancy_cleanup.md` | Historical log of what was deleted on April 29, 2026 (for reference) |

---

## Adding New Dependencies

### Python Backend

```bash
# Activate venv
.\.venv\Scripts\activate

# Install the package
pip install <package-name>

# Freeze to requirements.txt
pip freeze > requirements.txt

# Commit the updated requirements.txt
git add requirements.txt
git commit -m "chore: add <package-name> dependency"
```

### Frontend (Node.js)

```bash
cd frontend

# Install and save to package.json
npm install <package-name>

# Commit both package.json and package-lock.json
git add package.json package-lock.json
git commit -m "chore: add <package-name> dependency"
```

---

## Onboarding a New Developer

Steps for a new team member to get the project running from scratch:

1. **Clone the repo:** `git clone https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git`
2. **Read `docs/03_ENVIRONMENT_SETUP.md`** — covers Python venv, `.env` creation, frontend setup.
3. **Get secrets from the team lead:** `DATABASE_URL`, `SUPABASE_JWT_SECRET`, Supabase URL and anon key, at least one LLM API key.
4. **Create `.env`** from `.env.example` and fill in the secrets.
5. **Create `frontend/.env.local`** with Supabase URL and anon key.
6. **Install Python deps:** `pip install -r requirements.txt`
7. **Install Node deps:** `cd frontend && npm install`
8. **Run both servers** per `docs/03_ENVIRONMENT_SETUP.md` Section 6.
9. **Verify:** `http://localhost:8000/health` → `{"status":"ok"}` and `http://localhost:3000` → login page.

For detailed step-by-step instructions with screenshots, see `git_guide.md` in the project root.

---

## Database Migrations and Team Coordination

Because all developers share the **same Supabase PostgreSQL database**, database migrations have immediate effect on everyone.

**Protocol when adding a new model column:**
1. Add the column to the SQLAlchemy model file.
2. Add the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` statement to `migrate.py`.
3. Run `python migrate.py` **once** — this fixes the shared cloud database for all team members.
4. Commit the updated model file and `migrate.py` together.
5. Notify the team: *"Migration run for `<column_name>` on `<table>`"*.

Team members do **not** need to run the migration themselves — since the database is shared, one run fixes it for everyone.

See `15_DATABASE_MIGRATIONS.md` for full details.
# FinSight AI — Database Migrations Guide

> This document explains the manual migration workflow for adding columns to existing database tables. FinSight AI does NOT use Alembic — it uses a hand-written `migrate.py` script instead.

---

## Why Manual Migrations?

SQLAlchemy's `Base.metadata.create_all()` only creates tables that **don't yet exist**. It never modifies existing tables — no column additions, no type changes, no constraint modifications.

This means: whenever a new column is added to a model file (`models/holding.py`, `models/transaction.py`, etc.), that column will exist in the Python code but **not** in the actual Supabase PostgreSQL database until an `ALTER TABLE` statement is run.

`migrate.py` provides a safe, re-runnable way to apply these `ALTER TABLE` statements.

---

## `migrate.py` Script

**Location:** `Full-Stack-Client-Dashboard/migrate.py` (project root)

Uses raw SQL via SQLAlchemy's `engine.connect()` to issue `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. The `IF NOT EXISTS` clause makes every migration **idempotent** — safe to run multiple times without error.

---

## Running the Migration

```bash
# From the project root (not from backend/)
# Activate the virtual environment first:
.\.venv\Scripts\activate           # Windows
source .venv/bin/activate          # macOS/Linux

# Run the migration
python migrate.py
```

Expected output when all columns already exist (after the first run):
```
Starting schema migration for existing tables...
Holdings table: column 'cost_basis' already exists, skipping.
Holdings table: column 'current_price' already exists, skipping.
... (one line per column, already-exists messages are harmless)
Successfully updated 'holdings' table.
Successfully updated 'transactions' table.
Successfully updated existing cost_basis data.
Migration completed successfully.
```

Expected output on first run (on a database without the new columns):
```
Starting schema migration for existing tables...
Holdings table: added column 'cost_basis'.
Holdings table: added column 'current_price'.
...
Successfully updated 'holdings' table.
Successfully updated 'transactions' table.
Back-filling cost_basis for 12 existing holdings...
Migration completed successfully.
```

---

## What the Current Migration Does

### `holdings` Table — Columns Added

These columns were added via `ALTER TABLE` (not present in the original table schema):

| Column Added | SQL Type | Notes |
|-------------|---------|-------|
| `cost_basis` | `FLOAT` | `quantity × average_price`; back-filled for existing rows |
| `current_price` | `FLOAT` | Updated by `price_update_job.py` every 5 minutes |
| `current_value` | `FLOAT` | `quantity × current_price` |
| `unrealized_pl` | `FLOAT` | `current_value − cost_basis` |
| `unrealized_pl_pct` | `FLOAT` | `(unrealized_pl / cost_basis) × 100` |
| `realized_pl` | `FLOAT DEFAULT 0.0` | Cumulative realized P&L from FIFO sells |
| `realized_pl_pct` | `FLOAT DEFAULT 0.0` | `realized_pl` as % of cost basis |
| `first_purchase_date` | `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` | When position was first opened |
| `last_price_update` | `TIMESTAMP WITH TIME ZONE` | Nullable; when price was last refreshed |

### `holdings` Back-fill

After adding `cost_basis`, the migration runs:
```sql
UPDATE holdings
SET cost_basis = quantity * average_price
WHERE cost_basis IS NULL;
```

This ensures existing holdings have a valid `cost_basis` value rather than NULL.

### `transactions` Table — Columns Added

| Column Added | SQL Type | Notes |
|-------------|---------|-------|
| `total_amount` | `FLOAT` | `quantity × price` at time of transaction |
| `realized_pl` | `FLOAT` | FIFO realized P&L for SELL transactions; NULL for BUY |

---

## When to Run `migrate.py`

| Situation | Action Required |
|-----------|----------------|
| You pulled new code and a teammate added a model column | Run `python migrate.py` |
| You added a new column to a model yourself | Add the `ALTER TABLE` to `migrate.py`, commit it, run it, notify the team |
| First-time project setup on a completely fresh Supabase database | **NOT needed** — `create_all()` at startup handles brand-new tables |
| You are a teammate sharing the same `DATABASE_URL` | **NOT needed** — the shared database is already updated when one person ran the migration |

---

## Adding a New Column (Developer Workflow)

When you add a new field to a model file, follow this exact workflow:

### Step 1 — Add to the ORM model

```python
# In backend/app/models/holding.py, for example:
class Holding(Base):
    # ... existing columns ...
    new_column = Column(Float, nullable=True)  # ← Add here
```

### Step 2 — Add the ALTER TABLE to `migrate.py`

```python
# In migrate.py, add to the relevant section:
with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE holdings
        ADD COLUMN IF NOT EXISTS new_column FLOAT;
    """))
    conn.commit()
    print("Holdings table: added column 'new_column'.")
```

### Step 3 — Test locally with direct connection

Temporarily ensure `DATABASE_URL` points to the **direct connection** (not the pooler), then run:
```bash
python migrate.py
```

Verify the column was added in Supabase Dashboard → Table Editor → holdings.

### Step 4 — Commit both files together

```bash
git add backend/app/models/holding.py migrate.py
git commit -m "feat: add new_column to holdings table"
```

### Step 5 — Notify teammates

Post in your team channel:
> "Migration run: added `new_column` to `holdings` table. No action needed by others — shared DB is updated."

---

## Supabase Session Pooler and Migrations

> **WARNING:** Do NOT run `migrate.py` while your `DATABASE_URL` points to the Supabase Session Pooler URL (`pooler.supabase.com`).

PgBouncer in transaction mode cannot handle multi-statement DDL operations. `migrate.py` uses `engine.connect()` with explicit commits, which may not work reliably through the pooler.

**Always run migrations using the direct connection:**
```env
DATABASE_URL=postgresql+psycopg2://postgres:[PASS]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

After the migration is complete, switch back to the pooler URL for production use.

---

## Why Not Alembic?

Alembic is the standard SQLAlchemy migration tool. The decision to use a manual `migrate.py` instead was made for simplicity:

- The project has a small, stable schema (4 tables).
- Migrations are infrequent.
- Alembic requires a separate `alembic/` directory, `alembic.ini`, and understanding of revision files.
- The `IF NOT EXISTS` pattern in `migrate.py` provides sufficient safety for a small team.

If the schema grows significantly or the team expands, migrating to Alembic would be the appropriate next step.
# FinSight AI — Graphify Knowledge Graph

> This document covers the Graphify code intelligence tool: what it generates, how to use it, how to keep it updated, and how the AI assistant integrates with it.

---

## What is Graphify?

Graphify is a code intelligence tool that analyzes the entire codebase using AST (Abstract Syntax Tree) parsing and generates a **navigable knowledge graph** of all files, functions, classes, imports, and their relationships.

The AI assistant reads this graph to answer architecture and codebase questions accurately without needing to scan raw source files one by one.

**Package name:** `graphifyy` (double 'y' — this is the correct package name on PyPI)

---

## What Graphify Generates

All output is stored in `graphify-out/` in the project root.

| File | Size | Description |
|------|------|-------------|
| `graphify-out/graph.json` | Large | Full project knowledge graph in JSON format |
| `graphify-out/graph.html` | Medium | Self-contained interactive browser visualization — open in any browser to explore |
| `graphify-out/GRAPH_REPORT.md` | Small | Human-readable summary: god nodes, communities, key architectural clusters |
| `graphify-out/cache/` | Varies | Per-file AST cache for fast incremental rebuilds |

---

## Current Graph Statistics

As of **April 21, 2026** (last full rebuild):

| Metric | Value |
|--------|-------|
| **Total nodes** | 695 (files, functions, classes, methods) |
| **Total edges** | 1,243 (imports, function calls, dependencies) |
| **Communities** | 82 (functional clusters auto-detected by Graphify) |

### Core "God Nodes" (Highest Connectivity)

Nodes with the most incoming and outgoing edges — understanding these is key to understanding the architecture:

| Node | Why It's a God Node |
|------|---------------------|
| `stock_service.py` | Called by route handlers, the agent, the price update job, and multiple other services |
| `api/stock.py` | The primary HTTP interface for stock data — many paths lead through it |
| `lib/api-client.ts` | Every frontend API module goes through this single base fetch wrapper |

---

## How the AI Assistant Uses Graphify

When you ask architecture or codebase-wide questions (e.g., "How does the portfolio P&L get calculated?", "What calls stock_service?", "Where is the JWT verified?"), the AI assistant is instructed by `.agents/rules/graphify.md` to:

1. **Read `graphify-out/GRAPH_REPORT.md` first** — to get an overview of god nodes and community clusters.
2. **Navigate graph edges** to trace call chains and dependency paths.
3. Only open raw source files when the graph summary is insufficient.

This makes architecture Q&A faster and more accurate than blind file searching.

---

## Automation — Git Hook

A `post-commit` hook is installed at `.git/hooks/post-commit`. Every time you run `git commit`, Graphify automatically rebuilds only the changed files using its AST cache:

```bash
# What the hook runs (automatically, you don't run this manually):
python -m graphify update .
```

The incremental update is fast (typically < 5 seconds) because Graphify caches each file's AST and only reprocesses files that changed in the commit.

---

## Manual Graph Update

If you need to update the graph outside of a git commit (e.g., after editing files without committing):

```bash
# From the project root, with .venv active:
python -m graphify update .
```

For a complete rebuild from scratch (if the cache is corrupted or stale):
```bash
python -m graphify extract .
```

---

## Installation (New Developer Setup)

Graphify must be installed on each developer's machine separately:

```bash
# From the project root, with .venv active:

# Step 1: Install the package (note: double 'y')
pip install graphifyy

# Step 2: Initialize for the Antigravity AI assistant
python -m graphify antigravity install

# Step 3: Build the full graph from scratch (first time only)
python -m graphify extract .

# Step 4: Install the git hook for automatic updates
python -m graphify hook install
```

After this, every `git commit` will automatically trigger a graph update.

---

## AI Assistant Configuration Files

### `.agents/rules/graphify.md`

This file instructs the Antigravity AI assistant to always read `GRAPH_REPORT.md` before answering architecture or codebase-wide questions. The rule is:

> "Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure."

### `.agents/workflows/graphify-workflow.md`

Registers the `/graphify` slash command in the AI assistant. When the developer types `/graphify` in the chat, the assistant triggers a graph rebuild:

```bash
python -m graphify update .
```

---

## Exploring the Graph Interactively

To browse the knowledge graph visually:

1. Open `graphify-out/graph.html` in any browser (no server needed — it's self-contained).
2. Click on nodes to see their connections.
3. Hover over edges to see relationship types (imports, calls, etc.).
4. Use the community filter to zoom into specific functional clusters.

This is especially useful for tracing dependency chains (e.g., "What does `portfolio_service.py` depend on?") or for understanding which files belong to a specific feature area.

---

## Graphify and the `graphify-out/` Directory

The `graphify-out/` directory is committed to Git (excluding `cache/` which is gitignored). This means:
- The current graph state is always available in the repo for the AI assistant to read.
- New team members immediately have graph access without needing to run a full rebuild.
- The `GRAPH_REPORT.md` serves as a continuously-updated architecture summary.

The `cache/` subdirectory is gitignored because it is machine-specific (contains absolute file paths baked into the cache entries).
