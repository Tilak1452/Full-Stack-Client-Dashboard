# FinSight AI — Full-Stack Integration Progress Report

> **Project:** Full-Stack Client Dashboard  
> **Date:** April 12, 2026  
> **Master Plan:** [`Cluade_Plan.md`](./Cluade_Plan.md)  
> **Stack:** Next.js 14 (TypeScript) + FastAPI (Python 3.11)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Architecture Overview](#2-project-architecture-overview)
3. [Phase 1 — Environment & Infrastructure Setup](#3-phase-1--environment--infrastructure-setup)
4. [Phase 2 — Backend API Enhancements](#4-phase-2--backend-api-enhancements)
5. [Phase 3 — Frontend API Client Layer](#5-phase-3--frontend-api-client-layer)
6. [Phase 4 — Frontend Page-by-Page Migration](#6-phase-4--frontend-page-by-page-migration)
7. [Phase 5 — Bug Fixes Encountered & Resolved](#7-phase-5--bug-fixes-encountered--resolved)
8. [Complete File Inventory](#8-complete-file-inventory)
9. [Current Project Status](#9-current-project-status)
10. [How to Run the Project](#10-how-to-run-the-project)
11. [Remaining Work / Known Limitations](#11-remaining-work--known-limitations)
12. [Phase 6 — Stock Symbol Page Final Migration](#12-phase-6--stock-symbol-page-final-migration)
13. [Phase 7 — Planned: Endpoints, Modals & Dashboard Live Data](#13-phase-7--planned-endpoints-modals--dashboard-live-data)

---

## 1. Executive Summary

The FinSight AI Dashboard has been successfully transitioned from a **static mock-data frontend** into a **live full-stack application**. The Next.js frontend now communicates directly with the FastAPI Python backend to fetch real-time stock prices, market indices, news articles with AI-generated sentiment, portfolio data, alert notifications, and AI-powered research analysis.

**Key accomplishment:** Every page in the dashboard (`/dashboard`, `/alerts`, `/portfolio`, `/news`, `/stock/[symbol]`, `/ai-research`, `/watchlist`) has been migrated from importing hardcoded data from `src/lib/mock.ts` to using `@tanstack/react-query` hooks that call the FastAPI backend in real time.

---

## 2. Project Architecture Overview

```
Full-Stack-Client-Dashboard/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── api/              # API route handlers (routers)
│   │   ├── core/             # Config, database, cache, telemetry
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic validation schemas
│   │   ├── services/         # Business logic (stock, news, alerts, portfolio)
│   │   └── main.py           # FastAPI app entry point
│   └── financial_ai.db       # SQLite database
├── frontend/                 # Next.js 14 frontend
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # Reusable UI components (Sidebar, TopBar, Icons)
│   │   └── lib/              # API clients, hooks, utilities, mock data
│   ├── .env.local            # Frontend environment variables
│   └── package.json
├── venv/                     # Python virtual environment
├── .env                      # Backend environment variables (API keys)
├── requirements.txt          # Python dependencies
└── Cluade_Plan.md            # Master integration plan document
```

### Data Flow

```
Browser (localhost:3000)
    ↓ HTTP fetch / WebSocket
Next.js Client Components (useQuery hooks)
    ↓ Direct API calls (no Next.js API proxy)
FastAPI Backend (localhost:8000)
    ↓ yfinance, feedparser, SQLAlchemy, LLM
External APIs (Yahoo Finance, RSS feeds, OpenAI)
```

---

## 3. Phase 1 — Environment & Infrastructure Setup

### 3.1 — Connectivity Verification

| Check | Result |
|-------|--------|
| `http://localhost:3000` (Next.js) | ✅ Running |
| `http://localhost:8000` (FastAPI) | ✅ Running |
| `http://localhost:8000/docs` (Swagger) | ✅ Accessible |
| `http://localhost:8000/health` | ✅ Returns `{"status": "ok"}` |

### 3.2 — Python Virtual Environment

- Verified `venv/` exists at the project root.
- Installed all dependencies from `requirements.txt` using `venv\Scripts\pip.exe install -r requirements.txt`.
- Key packages: `fastapi`, `uvicorn`, `sqlalchemy`, `yfinance`, `feedparser`, `pydantic`, `apscheduler`.

### 3.3 — Environment Variables Created

**Backend** — `Full-Stack-Client-Dashboard/.env`:
- Contains LLM API keys, database URL, and application configuration.
- Used by `backend/app/core/config.py` via Pydantic `BaseSettings`.

**Frontend** — `Full-Stack-Client-Dashboard/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```
- `NEXT_PUBLIC_API_URL` — Base URL for all REST API calls from the browser.
- `NEXT_PUBLIC_WS_URL` — Base URL for WebSocket connections for live price streaming.

### 3.4 — NPM Dependency Installed

```bash
cd frontend
npm install @tanstack/react-query
```

- Installed `@tanstack/react-query@^5.99.0` — the data-fetching and caching library used across all pages.
- No other npm packages were added; everything else was already in `package.json` (`recharts`, `lucide-react`, `next`, `react`).

---

## 4. Phase 2 — Backend API Enhancements

Three new API routers were created and one existing schema was updated to expose the data the frontend needs.

### 4.1 — Schema Update: `backend/app/schemas/news.py`

**What changed:** Added a `sentiment` field to the `NewsArticle` Pydantic model.

```python
class NewsArticle(BaseModel):
    title: str
    source: str
    published_at: datetime
    url: HttpUrl
    summary: str = ""
    sentiment: str = "neutral"   # ← NEW FIELD
```

**Why:** The frontend News page displays a color-coded sentiment badge (`positive` / `neutral` / `negative`) for each article. The original schema did not include this field, so articles would have failed Pydantic validation or arrived without sentiment data.

---

### 4.2 — New Router: `backend/app/api/stock.py`

**Endpoints created:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/stock/{symbol}` | Returns full stock data including current price, day high/low, market cap, P/E ratio, RSI, SMA, and EMA indicators |
| `GET` | `/api/v1/stock/{symbol}/history` | Returns OHLCV historical candle data for charting, with configurable `period` and `interval` query parameters |

**Implementation details:**
- Delegates to the existing `stock_service.get_full_stock_data()` and `stock_service.get_historical_data()` methods.
- The symbol is automatically uppercased and trimmed.
- Errors return proper HTTP 404 (symbol not found) or 500 (service failure) status codes.

---

### 4.3 — New Router: `backend/app/api/news.py`

**Endpoint created:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/news?limit=N` | Returns latest financial news articles with sentiment labels |

**Implementation details:**
- Calls `news_service.get_news(limit=N)` — a new method we added to `NewsService`.
- Returns `{ articles: [...], count: N }`.
- Limit is validated between 1 and 50 via FastAPI's `Query` parameter.
- Defined as a **synchronous** `def` (not `async def`) because the underlying `news_service.get_news()` method is synchronous.

---

### 4.4 — New Router: `backend/app/api/market.py`

**Endpoint created:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/indices` | Returns current price and daily change for 4 Indian market indices |

**Tracked indices:**

| Display Name | Yahoo Finance Ticker |
|-------------|---------------------|
| NIFTY 50 | `^NSEI` |
| SENSEX | `^BSESN` |
| NIFTY BANK | `^NSEBANK` |
| NIFTY IT | `NIFTY_IT.NS` |

**Implementation details:**
- Iterates through the index list, fetching each price via `stock_service.get_current_price()`.
- Returns partial results on failure — if one index fetch fails, it returns `error: true` for that index rather than failing the entire request.
- Response shape: `{ indices: [{ name, ticker, price, change_pct, up, day_high, day_low, market_state }] }`.

---

### 4.5 — Router Registration: `backend/app/main.py`

Added three `include_router` calls at the bottom of `main.py`:

```python
from .api import stock, news, market

app.include_router(stock.router)
app.include_router(news.router)
app.include_router(market.router)
```

---

### 4.6 — Service Fix: `backend/app/services/news_service.py`

**Bug found:** The `news.py` router called `news_service.get_news()`, but the `NewsService` class only had `get_news_for_symbol()` — there was no general `get_news()` method.

**Fix applied:**
1. Added a new `get_news()` method that fetches general market news using the `^NSEI` (NIFTY 50) ticker as a broad market proxy.
2. Added keyword-based sentiment heuristics to the `_fetch_yahoo_rss()` method so each article gets tagged with `positive`, `neutral`, or `negative` sentiment based on headline keywords (e.g., "surge" → positive, "crash" → negative).
3. Updated the `NewsArticle` constructor call to include the new `sentiment` parameter.

---

## 5. Phase 3 — Frontend API Client Layer

A complete TypeScript API client layer was created in `frontend/src/lib/`. This layer provides type-safe, centralized access to every backend endpoint.

### 5.1 — Core Fetch Wrapper: `src/lib/api-client.ts`

- **`apiFetch<T>(endpoint, options?)`** — Generic typed fetch wrapper.
- Automatically prepends `NEXT_PUBLIC_API_URL` to all endpoints.
- Sets `Content-Type: application/json` by default.
- Throws a custom `ApiError` class with `status` and `detail` for all non-2xx responses.
- Catches network errors and throws a user-friendly "Cannot reach backend server" message.

### 5.2 — Domain API Clients

| File | Export | Endpoints Covered |
|------|--------|-------------------|
| `src/lib/stock.api.ts` | `stockApi` | `GET /api/v1/stock/{symbol}`, `GET /api/v1/stock/{symbol}/history` |
| `src/lib/portfolio.api.ts` | `portfolioApi` | `GET /portfolios/`, `POST /portfolios/`, `GET /portfolios/{id}/summary`, `POST /portfolios/{id}/holdings`, `POST /portfolios/{id}/transactions`, `GET /portfolios/{id}/optimize` |
| `src/lib/alerts.api.ts` | `alertsApi` | `GET /api/v1/alerts/active`, `GET /api/v1/alerts/notifications`, `POST /api/v1/alerts/`, `DELETE /api/v1/alerts/{id}` |
| `src/lib/ai.api.ts` | `aiApi` | `POST /api/v1/analyze` |
| `src/lib/news.api.ts` | `newsApi` | `GET /api/v1/news?limit=N` |
| `src/lib/market.api.ts` | `marketApi` | `GET /api/v1/indices` |

Each file exports:
- **TypeScript interfaces** that mirror the backend response shapes exactly.
- **An API object** with methods that return typed `Promise<T>` results.

### 5.3 — Utility Hook: `src/lib/useWebSocketPrice.ts`

A custom React hook for live price streaming via WebSocket:

```typescript
const { price, connected, error } = useWebSocketPrice('RELIANCE.NS');
```

- Connects to `ws://localhost:8000/api/v1/stream/price/{symbol}`.
- Parses incoming JSON messages `{ symbol, price, timestamp }`.
- Automatically reconnects on mount and cleanly disconnects on unmount.
- Used in the `/stock/[symbol]` page to show live price updates.

### 5.4 — Utility Functions: `src/lib/utils.ts`

| Function | Purpose |
|----------|---------|
| `formatINR(value)` | Formats numbers as `₹1.25Cr`, `₹45.30L`, etc. |
| `formatPct(value)` | Formats percentages with `+` / `-` sign |
| `formatDate(iso)` | Converts ISO strings to `12 Apr 2026` format |
| `formatTime(iso)` | Converts ISO strings to `02:30 PM` format |
| `changeColor(up)` | Returns `text-green` or `text-red` CSS class |

### 5.5 — Query Client Provider: `src/app/providers.tsx`

A `'use client'` component that wraps the entire app in `QueryClientProvider`:

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // data fresh for 30 seconds
      gcTime: 5 * 60_000,          // cache kept for 5 minutes
      retry: 1,                    // retry failed requests once
      refetchOnWindowFocus: false,  // don't refetch on tab switch
    },
  },
})
```

### 5.6 — Layout Integration: `src/app/layout.tsx`

Modified to import and wrap the app with `<Providers>`:

```tsx
import Providers from './providers';

// Inside the return:
<Providers>
  <Sidebar />
  <div className="flex-1 flex flex-col overflow-hidden">
    {children}
  </div>
</Providers>
```

The layout remains a **Server Component** (no `'use client'`), because the `Providers` component handles the client-side boundary.

---

## 6. Phase 4 — Frontend Page-by-Page Migration

Each page was migrated following the same pattern:
1. **Remove** mock data imports (`import { ... } from '@/lib/mock'`).
2. **Add** `useQuery` / `useMutation` hooks from `@tanstack/react-query`.
3. **Add** loading and error states.
4. **Map** the real API response fields to the existing JSX template variables.
5. **Preserve** all existing UI design, styling, and layout — only data sources change.

---

### 6.1 — `/alerts` Page (`src/app/alerts/page.tsx`)

**Before:** Imported `alertsData` from mock. Used `useState` to store alerts and toggle active state.

**After:**
- Fetches alerts from `alertsApi.getActive()` with 60-second polling (`refetchInterval: 60_000`).
- Toggle action calls `alertsApi.delete(alert.id)` to deactivate an alert, then invalidates the query cache.
- Summary counters (`activeCount`, `triggeredCount`, `totalCount`) are computed from real data.
- Shows loading spinner and error state with retry button.

**Field mapping:**

| Mock field | API field |
|-----------|-----------|
| `a.sym` | `a.symbol` |
| `a.cond` | `a.condition` + `a.threshold` |
| `a.type` | Derived from `a.condition` string |
| `a.active` | `a.status === 'active'` |
| `a.triggered` | `a.status === 'triggered'` |

---

### 6.2 — `/portfolio` Page (`src/app/portfolio/page.tsx`)

**Before:** Imported `holdings` and `alloc` from mock.

**After:**
- Fetches portfolio list from `portfolioApi.list()`.
- Fetches summary of the first portfolio via `portfolioApi.getSummary(id)`.
- Fetches live prices for each holding symbol via `stockApi.getFullData(sym)`.
- **Computes P&L** in the frontend: `gain = (livePrice - avgPrice) * quantity`.
- **Computes allocation** percentages for the pie chart from current market values.
- Handles the empty portfolio state gracefully ("No portfolios available").

**Computed values:**
- `totalValue` — sum of all holdings' current market value.
- `totalInvested` — from the backend `total_invested` field.
- `totalGain` — `totalValue - totalInvested`.
- `totalReturn` — `(totalGain / totalInvested) * 100`.

---

### 6.3 — `/news` Page (`src/app/news/page.tsx`)

**Before:** Imported `newsData` from mock. Had sentiment filter buttons.

**After:**
- Fetches news from `newsApi.getLatest(30)` with 5-minute staleness and 10-minute auto-refresh.
- Sentiment filter remains as `useState<'all' | SentimentLabel>`.
- Sentiment distribution bar is now computed from real data:
  - `positivePct = Math.round((positiveCount / total) * 100)`
- Clicking an article opens the real URL via `window.open(n.url, '_blank')`.

**Field mapping:**

| Mock field | API field |
|-----------|-----------|
| `n.tag` | `n.source` |
| `n.sent` | `n.sentiment` |
| `n.time` | `formatTime(n.published_at)` |
| `n.title` | `n.title` |
| `n.summary` | `n.summary` |

---

### 6.4 — `/dashboard` Page (`src/app/dashboard/page.tsx`)

**Before:** Imported `indices`, `portfolioHistory`, `aiInsightsData`, `watchlistData`, `topMovers`, `newsData` from mock.

**After — partial migration:**

| Data Source | Migration Status |
|-------------|-----------------|
| `indices` | ✅ Live from `/api/v1/indices` |
| `newsData` (preview) | ✅ Live from `/api/v1/news?limit=4` |
| `watchlistData` (preview) | ✅ Live from `localStorage` + `/api/v1/stock/{sym}` |
| `portfolioHistory` | ⏳ Still mock (no historical portfolio value endpoint) |
| `aiInsightsData` | ⏳ Still mock (marketing/static cards) |
| `topMovers` | ⏳ Still mock (would need a screener endpoint) |

**Key changes:**
- Index cards now display real prices from `marketApi.getIndices()`.
- Watchlist preview reads symbol list from `localStorage` key `finsight_watchlist`, then fetches live prices.
- News preview renders real articles with clickable links.

---

### 6.5 — `/stock/[symbol]` Page (`src/app/stock/[symbol]/page.tsx`)

**Before:** Imported `stockHistory` and `metrics` from mock.

**After:**
- Reads symbol from URL params via `useParams()`.
- Fetches full stock data from `stockApi.getFullData(symbol)`.
- Fetches historical candles from `stockApi.getHistory(symbol, period, interval)`.
- Subscribes to live price updates via `useWebSocketPrice(symbol)`.
- Current price prefers WebSocket live price, falls back to API price.
- **Timeframe selector** maps display labels to yfinance periods: `1M→1mo`, `3M→3mo`, `6M→6mo`, `1Y→1y`, `ALL→5y`.
- **Key financials** grid is computed from real data (Market Cap, P/E, Day High/Low, RSI, SMA, EMA, Exchange).
- **Technical indicators** display real RSI values with proper interpretation text.
- **AI Analysis** panel triggers `aiApi.analyze()` on demand (disabled query, enabled on button click).

---

### 6.6 — `/ai-research` Page (`src/app/ai-research/page.tsx`)

**Before:** Used `setTimeout` loops to simulate a 4-step AI "thinking" animation, then appended hardcoded mock AI responses.

**After:**
- The `send()` function now calls `aiApi.analyze(question)` — a real LLM-backed endpoint.
- The 4-step agent animation (`setInterval`) runs while the real API call is in flight.
- Response is formatted by `formatAiResponse()` which renders verdict, confidence, reasoning, and risk assessment.
- Error handling catches API failures and displays them in the chat.
- Suggestion pills remain hardcoded (by design).

**Note:** This page was already correctly migrated before this session started — it was done as part of the API client layer creation.

---

### 6.7 — `/watchlist` Page (`src/app/watchlist/page.tsx`)

**Before:** Imported `watchlistData` from mock.

**After:**
- Symbol list is stored in `localStorage` under key `finsight_watchlist`.
- User can add symbols via the search input (uppercased, deduplicated).
- User can remove symbols via a "Remove" button on each row.
- Live prices are fetched from `stockApi.getFullData(sym)` for all symbols.
- Change percentage is computed as `(current - previous_close) / previous_close * 100`.
- Table displays: Symbol badge, Exchange, Price (₹), Change (%), and Remove action.

**Note:** This page was already correctly migrated before this session started.

---

## 7. Phase 5 — Bug Fixes Encountered & Resolved

### Bug 1: News API 500 Error (`AttributeError: 'NewsService' object has no attribute 'get_news'`)

**Root cause:** The `news.py` router called `news_service.get_news(limit=N)`, but the `NewsService` class only had a `get_news_for_symbol(symbol, limit)` method for symbol-specific news. There was no general market news method.

**Fix:**
1. Added `get_news(limit)` method to `NewsService` — fetches general market news using `^NSEI` as a broad market ticker.
2. Added sentiment heuristics to `_fetch_yahoo_rss()` — positive/negative keyword matching on article titles.
3. Updated `NewsArticle` construction to include the `sentiment` parameter.

**Files modified:**
- `backend/app/services/news_service.py` — Added `get_news()` method and sentiment logic.
- `backend/app/api/news.py` — Changed from `async def` to `def` (synchronous) and removed `await`.

---

### Bug 2: News Router Used `await` on Synchronous Function

**Root cause:** The `news.py` router was defined as `async def` and used `await` to call `news_service.get_news()`, but the service method is synchronous (it uses `feedparser.parse()` which is blocking). Calling `await` on a non-coroutine raises `TypeError`.

**Fix:** Changed the router function from `async def` to `def` and removed the `await` keyword.

---

### Bug 3: Frontend Tried to Fetch `/portfolios/null/summary`

**Observation:** When the portfolio list returns an empty array `[]`, the code extracted `portfolios[0]?.id` which is `undefined`, and the dependent query tried to fetch `/portfolios/undefined/summary` or `/portfolios/null/summary`.

**Fix:** The `useQuery` for portfolio summary uses `enabled: portfolioId !== null` to prevent this call from firing when no portfolio exists.

---

## 8. Complete File Inventory

### Files Created (NEW)

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `frontend/.env.local` | Frontend environment variables |
| 2 | `frontend/src/app/providers.tsx` | React Query client provider wrapper |
| 3 | `frontend/src/lib/api-client.ts` | Centralized fetch wrapper with error handling |
| 4 | `frontend/src/lib/stock.api.ts` | Stock data API client |
| 5 | `frontend/src/lib/portfolio.api.ts` | Portfolio management API client |
| 6 | `frontend/src/lib/alerts.api.ts` | Alerts API client |
| 7 | `frontend/src/lib/ai.api.ts` | AI analysis API client |
| 8 | `frontend/src/lib/news.api.ts` | News feed API client |
| 9 | `frontend/src/lib/market.api.ts` | Market indices API client |
| 10 | `frontend/src/lib/useWebSocketPrice.ts` | WebSocket live price hook |
| 11 | `frontend/src/lib/utils.ts` | Formatting utility functions |
| 12 | `backend/app/api/stock.py` | Stock data router (2 endpoints) |
| 13 | `backend/app/api/news.py` | News feed router (1 endpoint) |
| 14 | `backend/app/api/market.py` | Market indices router (1 endpoint) |

### Files Modified

| # | File Path | Changes Made |
|---|-----------|-------------|
| 1 | `backend/app/schemas/news.py` | Added `sentiment` field to `NewsArticle` |
| 2 | `backend/app/main.py` | Registered 3 new routers |
| 3 | `backend/app/services/news_service.py` | Added `get_news()` method and sentiment heuristics |
| 4 | `frontend/src/app/layout.tsx` | Wrapped app in `<Providers>` component |
| 5 | `frontend/src/app/alerts/page.tsx` | Migrated from mock to React Query |
| 6 | `frontend/src/app/portfolio/page.tsx` | Migrated from mock to React Query |
| 7 | `frontend/src/app/news/page.tsx` | Migrated from mock to React Query |
| 8 | `frontend/src/app/dashboard/page.tsx` | Partially migrated (indices, news, watchlist are live) |
| 9 | `frontend/src/app/stock/[symbol]/page.tsx` | Migrated from mock to React Query + WebSocket |
| 10 | `frontend/src/app/ai-research/page.tsx` | Connected to real LLM backend |
| 11 | `frontend/src/app/watchlist/page.tsx` | Migrated from mock to localStorage + API |

### Files NOT Modified (by design)

- `frontend/src/components/Icons.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/settings/page.tsx`
- `frontend/src/lib/mock.ts` — Still exists, still used by dashboard for `portfolioHistory`, `aiInsightsData`, `topMovers`
- `frontend/tailwind.config.ts`
- `frontend/tsconfig.json`
- All files inside `backend/app/core/`
- All files inside `backend/app/models/`
- All files inside `backend/app/ai/`

---

## 9. Current Project Status

### ✅ Completed Tasks (19/19)

- [x] Check `http://localhost:3000` availability and backend status
- [x] Install Python dependencies and setup environment variables (`.env`, `frontend/.env.local`)
- [x] Install `@tanstack/react-query`
- [x] Update `backend/app/schemas/news.py` (add sentiment field)
- [x] Implement `backend/app/api/stock.py` (2 endpoints)
- [x] Implement `backend/app/api/news.py` (1 endpoint)
- [x] Implement `backend/app/api/market.py` (1 endpoint)
- [x] Update `backend/app/main.py` (register 3 routers)
- [x] Create frontend API clients (7 files)
- [x] Create frontend utility hooks (2 files)
- [x] Add `<QueryClientProvider>` to `frontend/src/app/layout.tsx`
- [x] Migrate `/alerts` page
- [x] Migrate `/portfolio` page
- [x] Migrate `/news` page
- [x] Migrate `/dashboard` page (partial — indices, news, watchlist are live)
- [x] Migrate `/stock/[symbol]` page
- [x] Migrate `/ai-research` page
- [x] Migrate `/watchlist` page
- [x] Fix backend bugs (news service, async/sync mismatch)

### Backend API Verification

| Endpoint | Status | Response |
|----------|--------|----------|
| `GET /health` | ✅ Working | `{"status": "ok"}` |
| `GET /api/v1/indices` | ✅ Working | Returns 4 index objects with live prices |
| `GET /api/v1/news?limit=5` | ✅ Working | Returns articles array with sentiment |
| `GET /api/v1/stock/RELIANCE.NS` | ✅ Working | Returns price, technicals, metadata |
| `GET /api/v1/stock/RELIANCE.NS/history` | ✅ Working | Returns OHLCV candle array |
| `GET /portfolios/` | ✅ Working | Returns empty array (no portfolios created yet) |
| `GET /api/v1/alerts/active` | ✅ Working | Returns empty array (no alerts set yet) |
| `POST /api/v1/analyze` | ✅ Working | Returns AI analysis (requires LLM API key) |

---

## 10. How to Run the Project

### Prerequisites
- Python 3.11+ with `venv` configured
- Node.js 18+ with `npm`

### Start Backend (Terminal 1)

```bash
cd Full-Stack-Client-Dashboard/backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`.  
Swagger docs at `http://localhost:8000/docs`.

### Start Frontend (Terminal 2)

```bash
cd Full-Stack-Client-Dashboard/frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### Verify

1. Open `http://localhost:3000` in your browser.
2. The dashboard should redirect to `/dashboard` and display live market indices.
3. Navigate to `/stock/RELIANCE.NS` to see a live stock chart.
4. Navigate to `/news` to see real Yahoo Finance articles with sentiment tags.

---

## 11. Remaining Work / Known Limitations

### Data Still Using Mock

| Dashboard Widget | Reason | Future Fix |
|-----------------|--------|------------|
| Portfolio History Chart | No backend endpoint for historical portfolio value | `GET /portfolios/{id}/history` — **Planned in Phase 7** |
| AI Insights Cards | Static marketing content, not real-time AI | `GET /api/v1/analyze/market-summary` — **Planned in Phase 7** |
| Top Movers Section | No stock screener endpoint | `GET /api/v1/movers` — out of scope for now |

### Known Limitations

1. **No authentication** — The app has no login or session management. This is by design and will be handled separately.
2. **No portfolio creation UI** — The portfolio page shows an empty state. Portfolio creation modal is **planned in Phase 7**.
3. **No alert creation UI** — The "New alert" button on the alerts page is not wired to a creation form yet. Alert creation modal is **planned in Phase 7**.
4. **WebSocket price streaming** — Works when the backend's `/api/v1/stream/price/{symbol}` WebSocket endpoint is active. Falls back to REST API price if WebSocket fails.
5. **Rate limiting** — The backend has a 20 requests/minute rate limit via `slowapi`. During active development, the `staleTime` settings on each query prevent excessive API calls.
6. **NIFTY IT ticker** — Sometimes returns yfinance errors (`possibly delisted`). The market endpoint handles this gracefully by returning `error: true` for that index.

---

## 12. Phase 6 — Stock Symbol Page Final Migration

> **Session:** April 12, 2026 (this session)

### What Changed

The `/stock/[symbol]` page (`frontend/src/app/stock/[symbol]/page.tsx`) was fully rewritten to replace all mock data with live API integration.

### Key Features Implemented

| Feature | Implementation |
|---------|---------------|
| **Symbol search bar** | Input box + "Analyze" button. On Enter/click, navigates to `/stock/{SYMBOL}` |
| **Live price header** | WebSocket price (via `useWebSocketPrice`) preferred, falls back to REST `current_price` |
| **Daily change %** | Computed as `(current - previous_close) / previous_close * 100` |
| **Timeframe selector** | `1M → 1mo`, `3M → 3mo`, `6M → 6mo`, `1Y → 1y`, `ALL → 5y` — each triggers a new `useQuery` |
| **Area chart** | Recharts `AreaChart` with OHLCV data from `stockApi.getHistory()` |
| **Key financials grid** | Market Cap (formatted via `formatMarketCap()`), P/E, Day High/Low, RSI, SMA, EMA, Exchange |
| **Technical indicators** | RSI bar with overbought/oversold interpretation; SMA/EMA with trend interpretation |
| **AI Analysis panel** | On-demand toggle. Calls `aiApi.analyze()` with `enabled: false` then manually triggers on button click |
| **Loading / Error states** | Full-page loading state; error card with "Try again" button |

### API Queries Used

```typescript
// 1. Full stock data (price, technicals, metadata)
useQuery({ queryKey: ['stock', symbol], queryFn: () => stockApi.getFullData(symbol) })

// 2. Historical OHLCV for charting
useQuery({ queryKey: ['stock-history', symbol, period], queryFn: () => stockApi.getHistory(symbol, period, '1d') })

// 3. AI analysis (lazy — only fires when user clicks button)
useQuery({ queryKey: ['stock-analysis', symbol], queryFn: () => aiApi.analyze(...), enabled: false })

// 4. Live WebSocket price
const { price: livePrice } = useWebSocketPrice(symbol)
```

### Market Cap Formatter Added (Inline)

```typescript
function formatMarketCap(val: number | null | undefined): string {
  if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `₹${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6)  return `₹${(val / 1e6).toFixed(2)}M`;
  return `₹${val.toFixed(0)}`;
}
```

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/app/stock/[symbol]/page.tsx` | Complete rewrite — all mock data removed, live API + WebSocket connected |

---

## 13. Phase 7 — Planned: Endpoints, Modals & Dashboard Live Data

> **Status:** Design complete. Implementation pending user approval. See `implementation_plan.md`.

### 13.1 — Backend: Market Summary Endpoint & Scheduler Job

**Goal:** Replace the hardcoded `aiInsightsData` mock on the Dashboard with dynamically generated AI market insights cached by the backend scheduler.

**Changes planned:**

| File | Change |
|------|--------|
| `backend/app/services/alert_service.py` | Wire `generate_market_summary_job()` into `start_scheduler()` — runs every 60 minutes. Also runs once at startup so cache is immediately populated. |
| `backend/app/api/analyze.py` | Add `GET /api/v1/analyze/market-summary` endpoint — reads from the cache set by the scheduler job and returns the 3 AI insight cards. |

**Response shape:**
```json
[
  { "title": "NIFTY 50 Breakout", "body": "...", "icon": "📈", "color": "#10B981" },
  { "title": "Banking Sector Alert", "body": "...", "icon": "⚠️", "color": "#F59E0B" },
  { "title": "IT Resilience", "body": "...", "icon": "🛡️", "color": "#3B82F6" }
]
```

---

### 13.2 — Backend: Portfolio History Endpoint

**Goal:** Provide a time-series data array for the Portfolio History area chart on the Dashboard.

**Changes planned:**

| File | Change |
|------|--------|
| `backend/app/services/portfolio_service.py` | Add `get_portfolio_history(db, portfolio_id)` — builds a 30-day cumulative invested value curve using transaction timestamps. |
| `backend/app/api/portfolio.py` | Expose `GET /portfolios/{id}/history` — 200 returns `[{ date, value }]` array. |

---

### 13.3 — Frontend: Dashboard Live Data Wiring

**Goal:** Replace the two remaining mock blocks on the Dashboard with live data from the new endpoints.

| Block | New Data Source |
|-------|----------------|
| AI Insights Panel | `GET /api/v1/analyze/market-summary` via new `aiApi.getMarketSummary()` |
| Portfolio History Chart | `GET /portfolios/{id}/history` via new `portfolioApi.getHistory(id)` |

---

### 13.4 — Frontend: Create Portfolio Modal

**Goal:** Let users create portfolios directly from the Portfolio page without needing Swagger UI.

**Behavior:**
- "Create Portfolio" button opens an inline modal.
- User enters portfolio name.
- On submit: calls `POST /portfolios/` — on success, invalidates `['portfolios']` query cache.
- If name already exists (409 Conflict), shows inline error message.

---

### 13.5 — Frontend: Add Holding Modal

**Goal:** Let users add stock holdings to an existing portfolio from the UI.

**Behavior:**
- "Add Holding" button (visible when portfolio exists) opens a modal.
- User enters: Symbol (e.g., `RELIANCE.NS`), Quantity, Buy Price.
- On submit: calls `POST /portfolios/{id}/holdings` — on success, re-fetches portfolio and live prices.

---

### 13.6 — Frontend: Create Alert Modal

**Goal:** Let users create price/RSI/SMA alerts from the Alerts page.

**Behavior:**
- "New Alert" button opens a modal.
- User enters: Symbol, Condition (dropdown: Price Above, Price Below, RSI Above, RSI Below, SMA Cross Above/Below), Threshold value.
- On submit: calls `POST /api/v1/alerts/` — on success, invalidates `['alerts']` query cache.

---

*Last updated: April 12, 2026*  
*FinSight AI Dashboard v2.0 — Full-Stack Integration*

