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
