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
