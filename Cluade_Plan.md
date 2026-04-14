# FinSight AI — Full-Stack Integration Master Plan
## Feed This Entire Document to the AI Before Giving Any Instruction

> **CRITICAL NOTICE FOR THE AI READING THIS:**
> This document is a complete, self-contained implementation spec.
> Do NOT invent anything. Do NOT guess any file path, endpoint name, or data shape.
> Every file path, every endpoint, every data field, every TypeScript type is explicitly defined here.
> If something is not written in this document, ask the user before assuming.
> This is a production system. The user's career depends on zero hallucination.

---

## SECTION 0 — WHAT THIS DOCUMENT IS

This document is a complete integration plan for connecting a Next.js 14 frontend to a FastAPI Python backend. Both systems already exist and are partially functional. The goal is to make the static frontend fully functional by replacing all mock data with real API calls to the backend. No UI redesign. No backend rebuild. Integration only.

**The person you are helping has:**
- A fully designed Next.js 14 frontend (dark-themed financial dashboard, all pages built, all components styled, currently reads from static mock data)
- A fully built FastAPI backend (Python 3.11, stock analysis, AI agent with LangGraph, portfolio management, alerts, RAG)
- Moved the backend folder INSIDE the frontend project folder
- Moved the Python `requirements.txt` INSIDE the frontend project folder

**Your job is to implement exactly what this document says, file by file, step by step.**

---

## SECTION 1 — ACTUAL FOLDER STRUCTURE ON DISK

This is the real folder structure after the user moved things. Every file path you reference must match this.

```
Full-Stack-Client-Dashboard/           ← ROOT of entire project (open this in VS Code)
│
├── requirements.txt                   ← Python dependencies (moved here by user)
│
├── backend/                           ← FastAPI Python backend (moved here by user)
│   ├── __init__.py
│   ├── financial_ai.db                ← SQLite database (auto-created on first run)
│   ├── pytest.ini
│   ├── vector_db/                     ← ChromaDB local vector store files
│   ├── tests/
│   │   └── evaluate.py
│   └── app/                           ← FastAPI application core
│       ├── main.py                    ← FastAPI app entry point (THIS IS WHAT UVICORN RUNS)
│       ├── api/
│       │   ├── analyze.py             ← POST /api/v1/analyze
│       │   ├── portfolio.py           ← CRUD /portfolios/*
│       │   ├── assets.py              ← GET /api/v1/assets/*
│       │   ├── alerts.py              ← CRUD /api/v1/alerts/*
│       │   ├── rag.py                 ← POST /rag/upload, GET /rag/query
│       │   └── stream.py              ← WS /api/v1/stream/price/{symbol}
│       ├── core/
│       │   ├── config.py
│       │   ├── database.py
│       │   ├── cache.py
│       │   ├── circuit_breaker.py
│       │   ├── dependencies.py
│       │   └── telemetry.py
│       ├── services/
│       │   ├── stock_service.py
│       │   ├── news_service.py
│       │   ├── macro_service.py
│       │   ├── options_service.py
│       │   ├── mpt_service.py
│       │   ├── portfolio_service.py
│       │   ├── alert_service.py
│       │   ├── pdf_service.py
│       │   ├── indicators.py
│       │   ├── categorizer.py
│       │   └── data_provider.py
│       ├── ai/
│       │   ├── analyst.py
│       │   ├── scoring.py
│       │   ├── moderation.py
│       │   ├── hallucination_check.py
│       │   ├── response_limits.py
│       │   ├── timeout_guard.py
│       │   ├── document_loader.py
│       │   ├── vector_store_chroma.py
│       │   └── vector_store_pinecone.py
│       ├── models/
│       │   ├── portfolio.py
│       │   ├── holding.py
│       │   ├── transaction.py
│       │   └── alert.py
│       └── schemas/
│           ├── analyze.py
│           ├── analysis.py
│           ├── stock.py
│           ├── news.py
│           └── portfolio.py
│
├── src/                               ← Next.js frontend source
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                 ← Root layout — ADD QueryClientProvider here
│   │   ├── page.tsx                   ← Redirects to /dashboard — DO NOT TOUCH
│   │   ├── dashboard/
│   │   │   └── page.tsx               ← MIGRATE: replace mock data imports
│   │   ├── stock/
│   │   │   └── [symbol]/
│   │   │       └── page.tsx           ← MIGRATE: replace mock data imports
│   │   ├── ai-research/
│   │   │   └── page.tsx               ← MIGRATE: replace setTimeout simulation
│   │   ├── portfolio/
│   │   │   └── page.tsx               ← MIGRATE: replace mock data imports
│   │   ├── watchlist/
│   │   │   └── page.tsx               ← MIGRATE: use localStorage + live prices
│   │   ├── news/
│   │   │   └── page.tsx               ← MIGRATE: replace mock data imports
│   │   ├── alerts/
│   │   │   └── page.tsx               ← MIGRATE: replace mock data imports
│   │   └── settings/
│   │       └── page.tsx               ← LEAVE AS IS (static form, no backend needed yet)
│   ├── components/
│   │   ├── Icons.tsx                  ← DO NOT TOUCH
│   │   ├── Sidebar.tsx                ← DO NOT TOUCH
│   │   └── TopBar.tsx                 ← DO NOT TOUCH
│   └── lib/
│       ├── mock.ts                    ← DO NOT DELETE — remove its imports gradually
│       ├── api-client.ts              ← CREATE THIS (base fetch wrapper)
│       ├── stock.api.ts               ← CREATE THIS
│       ├── portfolio.api.ts           ← CREATE THIS
│       ├── alerts.api.ts              ← CREATE THIS
│       ├── ai.api.ts                  ← CREATE THIS
│       ├── news.api.ts                ← CREATE THIS
│       ├── market.api.ts              ← CREATE THIS
│       └── useWebSocketPrice.ts       ← CREATE THIS (custom React hook)
│
├── .env.local                         ← CREATE THIS (Next.js env vars)
├── .env                               ← CREATE THIS (Python backend env vars)
├── .gitignore
├── next.config.js (or .mjs)
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── package.json
└── package-lock.json
```

---

## SECTION 2 — ENVIRONMENT SETUP (DO THIS FIRST, IN ORDER)

### 2.1 — Create Python Virtual Environment from requirements.txt if not already done (I already have a virtual environment just you need to check that it correcly work or not ) (if not then create new for these follow belove instruction)

Run these commands from inside the `Full-Stack-Client-Dashboard/` root folder (where `requirements.txt` now lives):

```bash
# Step 1: Create the venv inside the project root
python -m venv venv

# Step 2: Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Step 3: Upgrade pip first (prevents install errors)
pip install --upgrade pip

# Step 4: Install ALL Python dependencies from the requirements file
pip install -r requirements.txt

# Step 5: Verify FastAPI installed correctly
python -c "import fastapi; print('FastAPI OK:', fastapi.__version__)"

# Step 6: Verify uvicorn installed
uvicorn --version
```

**IMPORTANT:** The venv folder will be created at `Full-Stack-Client-Dashboard/venv/`. Do not commit this to git. Confirm `.gitignore` has `venv/` in it.

### 2.2 — Create the Backend .env File

Create a file named `.env` at `Full-Stack-Client-Dashboard/.env` (the project root, NOT inside the backend folder). This is where Python's `pydantic-settings` will pick it up.

```env
# ─── LLM Keys (at least ONE is required — Groq is free) ───
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# ─── Optional Data Sources ───
NEWS_API_KEY=your_news_api_key_here
FRED_API_KEY=your_fred_api_key_here

# ─── Database (defaults to SQLite if not set) ───
# DATABASE_URL=sqlite:///./financial_ai.db   ← this is the default, leave commented

# ─── Redis (defaults to localhost if not set) ───
# REDIS_URL=redis://localhost:6379/0          ← this is the default, leave commented

# ─── Vector DB (defaults to local ChromaDB if not set) ───
# Pinecone_Vector_Database=your_pinecone_key

# ─── LangSmith Tracing (optional, for debugging AI calls) ───
# LANGCHAIN_TRACING_V2=true
# LANGCHAIN_PROJECT=finsight-ai
# LANGCHAIN_API_KEY=your_langsmith_key
```

### 2.3 — Create the Frontend .env.local File

Create a file named `.env.local` at `Full-Stack-Client-Dashboard/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

`NEXT_PUBLIC_` prefix is mandatory. Without it, Next.js will NOT expose these to the browser. These two variables are the only connection point between frontend and backend.

### 2.4 — Install Frontend Dependency (React Query)

Run this from `Full-Stack-Client-Dashboard/` with Node.js (not inside venv):

```bash
npm install @tanstack/react-query
```

This is the only new npm package required. Everything else is already installed.

### 2.5 — How to Run Both Servers (Two Terminals)

**Terminal 1 — Python Backend:**
```bash
# From Full-Stack-Client-Dashboard/ root
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

cd backend
uvicorn app.main:app --reload --port 8000
```

The backend starts at: `http://localhost:8000`
Swagger docs available at: `http://localhost:8000/docs`
Health check at: `http://localhost:8000/health`

**Terminal 2 — Next.js Frontend:**
```bash
# From Full-Stack-Client-Dashboard/ root (do NOT activate venv here)
npm run dev
```

The frontend starts at: `http://localhost:3000`

---

## SECTION 3 — BACKEND: MISSING ENDPOINTS TO ADD

The existing backend is mostly complete. However, the Next.js frontend needs THREE endpoints that do not exist yet in the backend. You must ADD these to the backend before writing any frontend code.

### 3.1 — Add GET /api/v1/stock/{symbol} Endpoint

**Purpose:** Returns current price + historical candles + technical indicators for a stock symbol in one call.

**Create file:** `Full-Stack-Client-Dashboard/backend/app/api/stock.py`

```python
from fastapi import APIRouter, HTTPException, Query
from app.services.stock_service import stock_service

router = APIRouter(prefix="/api/v1/stock", tags=["Stock"])

@router.get("/{symbol}")
async def get_stock_full(symbol: str):
    """
    Returns price data + 1-month OHLCV history + RSI/SMA/EMA indicators.
    Symbol is uppercased automatically.
    """
    symbol = symbol.upper().strip()
    try:
        data = await stock_service.get_full_stock_data(symbol)
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock data: {str(e)}")


@router.get("/{symbol}/history")
async def get_stock_history(
    symbol: str,
    period: str = Query(default="1mo", description="yfinance period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y"),
    interval: str = Query(default="1d", description="yfinance interval: 1m, 5m, 1h, 1d, 1wk")
):
    """
    Returns OHLCV historical candle data only, for charting.
    """
    symbol = symbol.upper().strip()
    try:
        candles = await stock_service.get_historical_data(symbol, period=period, interval=interval)
        return {"symbol": symbol, "period": period, "interval": interval, "candles": candles}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")
```

### 3.2 — Add GET /api/v1/news Endpoint

**Purpose:** Exposes the existing `news_service.py` (Yahoo Finance RSS) to the frontend.

**Create file:** `Full-Stack-Client-Dashboard/backend/app/api/news.py`

```python
from fastapi import APIRouter, Query
from app.services.news_service import news_service

router = APIRouter(prefix="/api/v1", tags=["News"])

@router.get("/news")
async def get_news(limit: int = Query(default=20, ge=1, le=50)):
    """
    Returns latest financial news articles from Yahoo Finance RSS.
    Each article includes title, source, published_at, url, summary, and sentiment.
    Sentiment values: 'positive', 'neutral', 'negative'
    """
    try:
        articles = await news_service.get_news(limit=limit)
        return {"articles": articles, "count": len(articles)}
    except Exception as e:
        return {"articles": [], "count": 0, "error": str(e)}
```

**NOTE FOR AI:** Check the actual `NewsArticle` Pydantic schema in `backend/app/schemas/news.py`. If the schema does not have a `sentiment` field, add it. The sentiment value should come from VADER scoring which already exists in `news_service.py`. If `news_service.py` does not expose a `get_news(limit)` method, adapt the method call to whatever public method exists on the `news_service` singleton.

### 3.3 — Add GET /api/v1/indices Endpoint

**Purpose:** Returns live data for the 4 Indian market indices shown on the dashboard.

**Create file:** `Full-Stack-Client-Dashboard/backend/app/api/market.py`

```python
from fastapi import APIRouter
from app.services.stock_service import stock_service
import asyncio

router = APIRouter(prefix="/api/v1", tags=["Market"])

# yFinance ticker symbols for Indian market indices
INDICES_MAP = [
    {"name": "NIFTY 50",   "ticker": "^NSEI"},
    {"name": "SENSEX",     "ticker": "^BSESN"},
    {"name": "NIFTY BANK", "ticker": "^NSEBANK"},
    {"name": "NIFTY IT",   "ticker": "NIFTY_IT.NS"},
]

@router.get("/indices")
async def get_market_indices():
    """
    Returns current price and daily change for the 4 Indian market indices.
    Uses the existing stock_service which already handles circuit breaker and retry.
    Returns partial results if some indices fail — never returns an error for the whole endpoint.
    """
    results = []
    for index in INDICES_MAP:
        try:
            data = await stock_service.get_current_price(index["ticker"])
            results.append({
                "name": index["name"],
                "ticker": index["ticker"],
                "price": data.get("price"),
                "change_pct": data.get("change_pct", 0),
                "up": data.get("change_pct", 0) >= 0,
                "day_high": data.get("day_high"),
                "day_low": data.get("day_low"),
                "market_state": data.get("market_state", "CLOSED"),
            })
        except Exception:
            results.append({
                "name": index["name"],
                "ticker": index["ticker"],
                "price": None,
                "change_pct": None,
                "up": None,
                "error": True,
            })
    return {"indices": results}
```

**NOTE FOR AI:** The `stock_service.get_current_price()` method may be async or sync depending on the actual implementation. Check `backend/app/services/stock_service.py` and adjust the `await` keyword accordingly. If it is synchronous, call it without `await`.

### 3.4 — Register All New Routers in main.py

Open `Full-Stack-Client-Dashboard/backend/app/main.py`. Find the section where existing routers are registered with `app.include_router(...)`. Add the three new routers in the same style:

```python
# Add these imports at the top of main.py with the other router imports:
from app.api import stock, news, market

# Add these lines where the other include_router calls are:
app.include_router(stock.router)
app.include_router(news.router)
app.include_router(market.router)
```

**Do not change anything else in main.py.** The middleware, CORS, startup/shutdown lifecycle, health endpoint, and exception handlers must remain untouched.

### 3.5 — Verify CORS in main.py

Open `Full-Stack-Client-Dashboard/backend/app/main.py` and confirm there is a `CORSMiddleware` block. It should already exist. It must include at minimum:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or ["*"] for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

If `allow_origins` is already `["*"]` — leave it as is. Do not change it.

---

## SECTION 4 — COMPLETE BACKEND API REFERENCE

This is the authoritative list of every endpoint the frontend will call. Do not invent any other endpoints. If the frontend needs data not covered by these endpoints, come back to this document — do not guess.

### 4.1 — Endpoints That Already Exist in Backend

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `POST` | `/api/v1/analyze` | Submit question → get LLM analysis | 5/min |
| `GET`  | `/portfolios/` | List all portfolios | default |
| `POST` | `/portfolios/` | Create a new portfolio | default |
| `POST` | `/portfolios/{id}/holdings` | Add or update a holding | default |
| `POST` | `/portfolios/{id}/transactions` | Record BUY or SELL transaction | default |
| `GET`  | `/portfolios/{id}/summary` | Get full portfolio summary with holdings | default |
| `GET`  | `/portfolios/{id}/optimize` | Run MPT optimization on portfolio | 5/min |
| `GET`  | `/api/v1/assets/macro` | Macro indicators (FRED + commodities) | 10/min |
| `GET`  | `/api/v1/assets/options/{symbol}` | Options chain for a ticker | default |
| `POST` | `/api/v1/assets/options/pricer` | Black-Scholes theoretical pricing | default |
| `POST` | `/api/v1/assets/mpt/optimize` | MPT optimization on custom tickers | 5/min |
| `POST` | `/api/v1/alerts/` | Create a new alert rule | default |
| `GET`  | `/api/v1/alerts/active` | List all active alert rules | default |
| `GET`  | `/api/v1/alerts/notifications` | Get last 10 triggered notifications | default |
| `DELETE` | `/api/v1/alerts/{id}` | Delete an alert rule | default |
| `POST` | `/rag/upload` | Upload and embed a document | default |
| `GET`  | `/rag/query?q=...` | Semantic search over documents | default |
| `WS`   | `/api/v1/stream/price/{symbol}` | Live price WebSocket stream | default |
| `GET`  | `/health` | Backend liveness check | none |
| `GET`  | `/docs` | Swagger UI (for testing) | none |

### 4.2 — Endpoints You Will Add (Section 3 above)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/v1/stock/{symbol}` | Full stock data: price + history + indicators |
| `GET`  | `/api/v1/stock/{symbol}/history?period=1mo&interval=1d` | Historical candles only |
| `GET`  | `/api/v1/news?limit=20` | Latest news from Yahoo RSS |
| `GET`  | `/api/v1/indices` | Live data for 4 Indian market indices |

### 4.3 — Exact Request/Response Shapes

#### POST /api/v1/analyze

**Request body:**
```json
{
  "question": "Analyze RELIANCE.NS stock — give investment thesis, risks, and technical signals"
}
```

**Response body** (FinancialAnalysisResult schema):
```json
{
  "verdict": "BULLISH",
  "confidence": 72,
  "reasoning_summary": "Reliance Industries shows strong momentum...",
  "technical_signals": [
    {"indicator": "RSI", "value": "58.3", "interpretation": "Neutral momentum, not overbought"},
    {"indicator": "SMA20", "value": "2847.50", "interpretation": "Price trading above 20-day SMA"}
  ],
  "sentiment_signals": [
    {"source": "Yahoo Finance News", "score": "0.34", "interpretation": "Mildly positive sentiment"}
  ],
  "risk_assessment": "Key risks include global crude price volatility..."
}
```

**Error response** (if rate limited or invalid):
```json
{
  "detail": "Rate limit exceeded"
}
```

#### GET /portfolios/

**Response:**
```json
[
  {"id": 1, "name": "My Portfolio", "created_at": "2024-01-15T10:30:00"},
  {"id": 2, "name": "Retirement Fund", "created_at": "2024-02-20T08:00:00"}
]
```

#### GET /portfolios/{id}/summary

**Response:**
```json
{
  "id": 1,
  "name": "My Portfolio",
  "holdings": [
    {
      "id": 1,
      "portfolio_id": 1,
      "symbol": "RELIANCE.NS",
      "quantity": 50.0,
      "average_price": 2750.0
    },
    {
      "id": 2,
      "portfolio_id": 1,
      "symbol": "TCS.NS",
      "quantity": 20.0,
      "average_price": 3400.0
    }
  ],
  "total_invested": 205500.0
}
```

**NOTE:** The backend summary does NOT include live current prices or P&L. The frontend must fetch the current price separately using `/api/v1/stock/{symbol}` and compute P&L in the frontend. P&L formula: `(current_price - average_price) * quantity`.

#### POST /portfolios/

**Request body:**
```json
{
  "name": "My New Portfolio"
}
```

**Response:**
```json
{
  "id": 3,
  "name": "My New Portfolio",
  "created_at": "2024-04-12T09:00:00"
}
```

#### POST /portfolios/{id}/holdings

**Request body:**
```json
{
  "symbol": "INFY.NS",
  "quantity": 100,
  "average_price": 1450.0
}
```

**Response:** Updated holding object.

#### POST /api/v1/alerts/

**Request body:**
```json
{
  "symbol": "NIFTY50",
  "condition": "price_above",
  "threshold": 22500.0
}
```

Valid `condition` values: `"price_above"`, `"price_below"`, `"rsi_above"`, `"rsi_below"`, `"sma_cross_above"`, `"sma_cross_below"`

**Response:**
```json
{
  "id": 5,
  "symbol": "NIFTY50",
  "condition": "price_above",
  "threshold": 22500.0,
  "status": "active",
  "message": null,
  "created_at": "2024-04-12T10:00:00",
  "triggered_at": null
}
```

#### GET /api/v1/alerts/active

**Response:**
```json
[
  {
    "id": 5,
    "symbol": "NIFTY50",
    "condition": "price_above",
    "threshold": 22500.0,
    "status": "active",
    "message": null,
    "created_at": "2024-04-12T10:00:00",
    "triggered_at": null
  }
]
```

#### GET /api/v1/indices (new endpoint you will add)

**Response:**
```json
{
  "indices": [
    {"name": "NIFTY 50",   "ticker": "^NSEI",      "price": 22450.3,  "change_pct": 0.85,  "up": true,  "day_high": 22510.0, "day_low": 22120.0, "market_state": "CLOSED"},
    {"name": "SENSEX",     "ticker": "^BSESN",     "price": 73890.5,  "change_pct": -0.23, "up": false, "day_high": 74100.0, "day_low": 73600.0, "market_state": "CLOSED"},
    {"name": "NIFTY BANK", "ticker": "^NSEBANK",   "price": 47320.0,  "change_pct": 1.12,  "up": true,  "day_high": 47500.0, "day_low": 47000.0, "market_state": "CLOSED"},
    {"name": "NIFTY IT",   "ticker": "NIFTY_IT.NS","price": 35600.0,  "change_pct": -0.45, "up": false, "day_high": 35900.0, "day_low": 35400.0, "market_state": "CLOSED"}
  ]
}
```

#### GET /api/v1/stock/{symbol} (new endpoint you will add)

**Example:** `GET /api/v1/stock/RELIANCE.NS`

**Response:** This mirrors what `stock_service.get_full_stock_data()` returns. Check the actual return structure of that method in `backend/app/services/stock_service.py` and match your TypeScript types to it exactly.

Expected shape (adapt to actual):
```json
{
  "symbol": "RELIANCE.NS",
  "price_data": {
    "price": 2891.50,
    "currency": "INR",
    "day_high": 2920.00,
    "day_low": 2865.00,
    "market_cap": 19500000000000,
    "pe_ratio": 28.4,
    "market_state": "CLOSED",
    "exchange": "NSE"
  },
  "historical": [
    {"date": "2024-03-12", "open": 2800.0, "high": 2850.0, "low": 2790.0, "close": 2840.0, "volume": 4500000},
    {"date": "2024-03-13", "open": 2840.0, "high": 2900.0, "low": 2830.0, "close": 2891.5, "volume": 5200000}
  ],
  "rsi": 58.3,
  "sma_20": 2847.5,
  "ema_20": 2861.2
}
```

#### GET /api/v1/news (new endpoint you will add)

**Response:**
```json
{
  "articles": [
    {
      "title": "RBI holds interest rates steady amid inflation concerns",
      "source": "Yahoo Finance",
      "published_at": "2024-04-12T08:30:00",
      "url": "https://finance.yahoo.com/...",
      "summary": "The Reserve Bank of India maintained its benchmark...",
      "sentiment": "neutral"
    }
  ],
  "count": 20
}
```

`sentiment` field values: `"positive"`, `"neutral"`, `"negative"` — derived from VADER compound score in `news_service.py`. If VADER score > 0.05 → `"positive"`, < -0.05 → `"negative"`, else → `"neutral"`.

#### WS /api/v1/stream/price/{symbol}

**Connection:** `ws://localhost:8000/api/v1/stream/price/RELIANCE.NS`

**Messages received (every 5 seconds):**
```json
{"symbol": "RELIANCE.NS", "price": 2891.50, "timestamp": "2024-04-12T10:05:00"}
```

Check `backend/app/api/stream.py` for the exact JSON fields sent. Adjust frontend to match.

---

## SECTION 5 — FRONTEND: ALL FILES TO CREATE

Create all of these files. Do not skip any. The order matters.

### 5.1 — src/lib/api-client.ts

This is the single base fetch function. Every other API file imports from here. All error handling is centralized here.

```typescript
// src/lib/api-client.ts

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  public status: number;
  public detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (networkError) {
    throw new ApiError(0, 'Cannot reach backend server. Is it running on port 8000?');
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // response body is not JSON — use default detail
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}
```

### 5.2 — src/lib/stock.api.ts

```typescript
// src/lib/stock.api.ts
import { apiFetch } from './api-client';

export interface StockPriceData {
  price: number;
  currency: string;
  day_high: number;
  day_low: number;
  market_cap: number | null;
  pe_ratio: number | null;
  market_state: string;
  exchange: string;
}

export interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FullStockData {
  symbol: string;
  price_data: StockPriceData;
  historical: HistoricalCandle[];
  rsi: number | null;
  sma_20: number | null;
  ema_20: number | null;
}

export interface StockHistoryResponse {
  symbol: string;
  period: string;
  interval: string;
  candles: HistoricalCandle[];
}

export const stockApi = {
  getFullData: (symbol: string): Promise<FullStockData> =>
    apiFetch<FullStockData>(`/api/v1/stock/${encodeURIComponent(symbol)}`),

  getHistory: (
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y' = '1mo',
    interval: '1m' | '5m' | '1h' | '1d' | '1wk' = '1d'
  ): Promise<StockHistoryResponse> =>
    apiFetch<StockHistoryResponse>(
      `/api/v1/stock/${encodeURIComponent(symbol)}/history?period=${period}&interval=${interval}`
    ),
};
```

### 5.3 — src/lib/portfolio.api.ts

```typescript
// src/lib/portfolio.api.ts
import { apiFetch } from './api-client';

export interface PortfolioListItem {
  id: number;
  name: string;
  created_at: string;
}

export interface HoldingItem {
  id: number;
  portfolio_id: number;
  symbol: string;
  quantity: number;
  average_price: number;
}

export interface PortfolioSummary {
  id: number;
  name: string;
  holdings: HoldingItem[];
  total_invested: number;
}

export interface CreatePortfolioPayload {
  name: string;
}

export interface AddHoldingPayload {
  symbol: string;
  quantity: number;
  average_price: number;
}

export interface RecordTransactionPayload {
  symbol: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

export interface MptOptimizationResult {
  weights: Record<string, number>;
  expected_annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
}

export const portfolioApi = {
  list: (): Promise<PortfolioListItem[]> =>
    apiFetch<PortfolioListItem[]>('/portfolios/'),

  create: (payload: CreatePortfolioPayload): Promise<PortfolioListItem> =>
    apiFetch<PortfolioListItem>('/portfolios/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSummary: (id: number): Promise<PortfolioSummary> =>
    apiFetch<PortfolioSummary>(`/portfolios/${id}/summary`),

  addHolding: (id: number, payload: AddHoldingPayload) =>
    apiFetch(`/portfolios/${id}/holdings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  recordTransaction: (id: number, payload: RecordTransactionPayload) =>
    apiFetch(`/portfolios/${id}/transactions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  optimize: (id: number): Promise<MptOptimizationResult> =>
    apiFetch<MptOptimizationResult>(`/portfolios/${id}/optimize`),
};
```

### 5.4 — src/lib/alerts.api.ts

```typescript
// src/lib/alerts.api.ts
import { apiFetch } from './api-client';

export type AlertCondition =
  | 'price_above'
  | 'price_below'
  | 'rsi_above'
  | 'rsi_below'
  | 'sma_cross_above'
  | 'sma_cross_below';

export type AlertStatus = 'active' | 'triggered' | 'expired';

export interface AlertItem {
  id: number;
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  status: AlertStatus;
  message: string | null;
  created_at: string;
  triggered_at: string | null;
}

export interface CreateAlertPayload {
  symbol: string;
  condition: AlertCondition;
  threshold: number;
}

export const alertsApi = {
  getActive: (): Promise<AlertItem[]> =>
    apiFetch<AlertItem[]>('/api/v1/alerts/active'),

  getNotifications: (): Promise<AlertItem[]> =>
    apiFetch<AlertItem[]>('/api/v1/alerts/notifications'),

  create: (payload: CreateAlertPayload): Promise<AlertItem> =>
    apiFetch<AlertItem>('/api/v1/alerts/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  delete: (id: number): Promise<void> =>
    apiFetch<void>(`/api/v1/alerts/${id}`, { method: 'DELETE' }),
};
```

### 5.5 — src/lib/ai.api.ts

```typescript
// src/lib/ai.api.ts
import { apiFetch } from './api-client';

export interface TechnicalSignal {
  indicator: string;
  value: string;
  interpretation: string;
}

export interface SentimentSignal {
  source: string;
  score: string;
  interpretation: string;
}

export type Verdict = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface AnalyzeResponse {
  verdict: Verdict;
  confidence: number;
  reasoning_summary: string;
  technical_signals: TechnicalSignal[];
  sentiment_signals: SentimentSignal[];
  risk_assessment: string;
}

export const aiApi = {
  analyze: (question: string): Promise<AnalyzeResponse> =>
    apiFetch<AnalyzeResponse>('/api/v1/analyze', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};
```

### 5.6 — src/lib/news.api.ts

```typescript
// src/lib/news.api.ts
import { apiFetch } from './api-client';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface NewsArticle {
  title: string;
  source: string;
  published_at: string;
  url: string;
  summary: string;
  sentiment: SentimentLabel;
}

export interface NewsResponse {
  articles: NewsArticle[];
  count: number;
}

export const newsApi = {
  getLatest: (limit = 20): Promise<NewsResponse> =>
    apiFetch<NewsResponse>(`/api/v1/news?limit=${limit}`),
};
```

### 5.7 — src/lib/market.api.ts

```typescript
// src/lib/market.api.ts
import { apiFetch } from './api-client';

export interface IndexData {
  name: string;
  ticker: string;
  price: number | null;
  change_pct: number | null;
  up: boolean | null;
  day_high: number | null;
  day_low: number | null;
  market_state: string;
  error?: boolean;
}

export interface IndicesResponse {
  indices: IndexData[];
}

export const marketApi = {
  getIndices: (): Promise<IndicesResponse> =>
    apiFetch<IndicesResponse>('/api/v1/indices'),
};
```

### 5.8 — src/lib/useWebSocketPrice.ts

```typescript
// src/lib/useWebSocketPrice.ts
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';

interface WebSocketPriceMessage {
  symbol: string;
  price: number;
  timestamp: string;
}

interface UseWebSocketPriceResult {
  price: number | null;
  connected: boolean;
  error: string | null;
}

export function useWebSocketPrice(symbol: string | null): UseWebSocketPriceResult {
  const [price, setPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!symbol) return;

    const url = `${WS_BASE}/api/v1/stream/price/${encodeURIComponent(symbol)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: WebSocketPriceMessage = JSON.parse(event.data);
        setPrice(data.price);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
      setError('WebSocket connection failed');
    };
  }, [symbol]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { price, connected, error };
}
```

---

## SECTION 6 — FRONTEND: MODIFY EXISTING FILES

### 6.1 — Modify src/app/layout.tsx

Add `QueryClientProvider` from `@tanstack/react-query`. This must wrap all page content. Do not change anything else about the layout — the Sidebar, fonts, and body structure must remain identical.

**Find the existing layout.tsx and add these changes:**

```typescript
// src/app/layout.tsx
'use client';  // ADD THIS — layout must be client component to use QueryClient

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
// ... keep all existing imports (Outfit, DM Sans fonts, Sidebar, etc.)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ADD THIS — create QueryClient inside component to avoid shared state between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,       // data considered fresh for 30 seconds
            gcTime: 5 * 60_000,      // cache kept for 5 minutes after unused
            retry: 1,                // retry failed requests once
            refetchOnWindowFocus: false, // don't refetch just because user switches tabs
          },
        },
      })
  );

  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable}`}>
      <body className="h-screen flex overflow-hidden bg-background text-text">
        {/* WRAP WITH QueryClientProvider — add this wrapper */}
        <QueryClientProvider client={queryClient}>
          <Sidebar />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

**IMPORTANT FOR AI:** The existing layout.tsx already has font setup, Sidebar import, and body styling. Do not rewrite it from scratch. Only add the `QueryClient` state and wrap `{children}` and `<Sidebar />` inside `<QueryClientProvider>`. If the layout is currently a Server Component (no `'use client'`), you must add `'use client'` at the top because `useState` requires it.

---

## SECTION 7 — FRONTEND: PAGE-BY-PAGE MIGRATION

Migrate pages in this exact order. Each migration is self-contained. Do not start the next page until the current one works and shows real data in the browser.

### 7.1 — MIGRATION ORDER (Follow Exactly)

1. `/alerts` page — uses existing backend endpoints, no backend changes, fastest to verify
2. `/portfolio` page — uses existing backend endpoints
3. `/news` page — requires new `/api/v1/news` endpoint (Section 3.2)
4. `/dashboard` page — requires new `/api/v1/indices` endpoint (Section 3.3)
5. `/stock/[symbol]` page — requires new `/api/v1/stock/{symbol}` endpoint (Section 3.1)
6. `/ai-research` page — uses existing `/api/v1/analyze` endpoint
7. `/watchlist` page — uses `localStorage` + live prices from `/api/v1/stock/{symbol}`

### 7.2 — Migration Pattern (Same for Every Page)

Every page follows this identical pattern:

```typescript
'use client';

// REMOVE: import { specificMockExport } from '@/lib/mock';
// ADD:
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { someApi } from '@/lib/some.api';

// Keep ALL existing useState declarations for UI state (toggles, filters, modals)
// Only replace the state that held mock data

export default function SomePage() {
  const { data = defaultValue, isLoading, error, refetch } = useQuery({
    queryKey: ['unique-key'],
    queryFn: someApi.getData,
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-[22px]">
        {/* Keep TopBar visible during loading */}
        <TopBar title="Page Name" />
        <div className="flex items-center justify-center h-64">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-[22px]">
        <TopBar title="Page Name" />
        <div className="rounded-2xl bg-card border border-red/20 p-6 text-center">
          <p className="text-red text-sm">
            {error instanceof Error ? error.message : 'Failed to load data'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-lime text-sm hover:opacity-80"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Render exactly as before, just using `data` instead of the mock variable
  // DO NOT CHANGE ANY JSX STRUCTURE OR STYLING
}
```

### 7.3 — /alerts Page Migration (DETAILED)

**File:** `src/app/alerts/page.tsx`

**Current state:** Reads `alertsData` from `@/lib/mock`. Has `useState` to toggle alert active/inactive status locally.

**What to change:**

```typescript
// REMOVE this import:
// import { alertsData } from '@/lib/mock';

// ADD these imports:
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi, AlertItem } from '@/lib/alerts.api';

// Inside the component, REPLACE the alertsData variable:

const queryClient = useQueryClient();

const { data: alerts = [], isLoading, error, refetch } = useQuery({
  queryKey: ['alerts-active'],
  queryFn: alertsApi.getActive,
  refetchInterval: 60_000,  // re-poll every 60 seconds (alerts fire in background)
});

const deleteMutation = useMutation({
  mutationFn: alertsApi.delete,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['alerts-active'] });
  },
});
```

**Data mapping — current mock shape vs real API shape:**

| Mock field | Real API field | Notes |
|-----------|----------------|-------|
| `sym` | `symbol` | string |
| `cond` | `condition` | string: 'price_above', etc. |
| `type` | `condition` (derive from value) | determine 'price'/'rsi'/'sma' from condition string |
| `active` | `status === 'active'` | boolean |
| `triggered` | `status === 'triggered'` | boolean |

**Alert toggle behavior:** The backend has no PATCH endpoint for toggling alert status. When the user toggles an alert OFF, call `alertsApi.delete(alert.id)` to delete it, then refetch. This matches what the Streamlit app did.

**Alert summary counters:**
```typescript
const activeCount = alerts.filter(a => a.status === 'active').length;
const triggeredCount = alerts.filter(a => a.status === 'triggered').length;
const totalCount = alerts.length;
```

### 7.4 — /portfolio Page Migration (DETAILED)

**File:** `src/app/portfolio/page.tsx`

**Current state:** Reads `holdings` and `alloc` from `@/lib/mock`. Computes total value, gain, return from mock data.

**What to change:**

```typescript
// REMOVE:
// import { holdings, alloc } from '@/lib/mock';

// ADD:
import { useQuery } from '@tanstack/react-query';
import { portfolioApi, HoldingItem } from '@/lib/portfolio.api';
import { stockApi } from '@/lib/stock.api';

// Inside component:
const { data: portfolios = [] } = useQuery({
  queryKey: ['portfolios'],
  queryFn: portfolioApi.list,
});

// Use the first portfolio by default
const portfolioId = portfolios[0]?.id ?? null;

const { data: summary, isLoading } = useQuery({
  queryKey: ['portfolio-summary', portfolioId],
  queryFn: () => portfolioApi.getSummary(portfolioId!),
  enabled: portfolioId !== null,
});

// Get live prices for each holding (separate query per symbol)
// Only fetch after summary loads
const symbols = summary?.holdings.map(h => h.symbol) ?? [];
```

**Computing P&L (backend doesn't provide this — compute in frontend):**

```typescript
// For each holding, fetch live price and compute P&L
// Use a single useQuery that fetches all symbols
const { data: livePrices = {} } = useQuery({
  queryKey: ['live-prices', symbols],
  queryFn: async () => {
    const results: Record<string, number> = {};
    await Promise.allSettled(
      symbols.map(async (sym) => {
        try {
          const data = await stockApi.getFullData(sym);
          results[sym] = data.price_data.price;
        } catch {
          // price unavailable for this symbol
        }
      })
    );
    return results;
  },
  enabled: symbols.length > 0,
  staleTime: 60_000,
});

// Compute enriched holdings with P&L
const enrichedHoldings = (summary?.holdings ?? []).map(holding => {
  const livePrice = livePrices[holding.symbol] ?? holding.average_price;
  const currentValue = livePrice * holding.quantity;
  const invested = holding.average_price * holding.quantity;
  const gain = currentValue - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  return {
    sym: holding.symbol,
    qty: holding.quantity,
    avg: holding.average_price,
    ltp: livePrice,
    val: currentValue,
    gain: gain,
    pct: gainPct,
    up: gain >= 0,
  };
});
```

**Data mapping — current mock shape vs real computed shape:**

| Mock field | Computed field | Formula |
|-----------|----------------|---------|
| `sym` | `holding.symbol` | direct |
| `qty` | `holding.quantity` | direct |
| `avg` | `holding.average_price` | direct |
| `ltp` | `livePrices[symbol]` | from stock API |
| `val` | `livePrice * quantity` | computed |
| `gain` | `val - (avg * qty)` | computed |
| `pct` | `(gain / invested) * 100` | computed |
| `up` | `gain >= 0` | computed |

**Summary cards:**
```typescript
const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.val, 0);
const totalInvested = summary?.total_invested ?? 0;
const totalGain = totalValue - totalInvested;
const totalReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
```

**Allocation pie chart:** Compute from enriched holdings instead of mock `alloc`:
```typescript
const alloc = enrichedHoldings.map(h => ({
  name: h.sym,
  v: h.val,
  color: '', // use same colors as mock — cycle through a fixed color array
}));
```

### 7.5 — /news Page Migration (DETAILED)

**File:** `src/app/news/page.tsx`

**Current state:** Reads `newsData` from `@/lib/mock`. Has `useState` for sentiment filter ('all'/'positive'/'neutral'/'negative').

**What to change:**

```typescript
// REMOVE:
// import { newsData } from '@/lib/mock';

// ADD:
import { useQuery } from '@tanstack/react-query';
import { newsApi, NewsArticle, SentimentLabel } from '@/lib/news.api';

// Inside component (keep existing useState for sentiment filter):
const [sentimentFilter, setSentimentFilter] = useState<'all' | SentimentLabel>('all');

const { data: newsResponse, isLoading } = useQuery({
  queryKey: ['news'],
  queryFn: () => newsApi.getLatest(30),
  staleTime: 5 * 60_000,  // news is fresh for 5 minutes
  refetchInterval: 10 * 60_000, // refresh every 10 minutes
});

const allArticles = newsResponse?.articles ?? [];

// Apply sentiment filter (same logic as before, just on real data)
const filteredArticles = sentimentFilter === 'all'
  ? allArticles
  : allArticles.filter(a => a.sentiment === sentimentFilter);
```

**Data mapping — current mock shape vs real API shape:**

| Mock field | Real API field |
|-----------|----------------|
| `title` | `title` |
| `tag` | `source` |
| `sent` | `sentiment` |
| `time` | `published_at` (format with `new Date(a.published_at).toLocaleTimeString()`) |
| `summary` | `summary` |

**Sentiment distribution badge:**
```typescript
const positiveCount = allArticles.filter(a => a.sentiment === 'positive').length;
const neutralCount = allArticles.filter(a => a.sentiment === 'neutral').length;
const negativeCount = allArticles.filter(a => a.sentiment === 'negative').length;
const total = allArticles.length || 1;
const positivePct = Math.round((positiveCount / total) * 100);
const neutralPct = Math.round((neutralCount / total) * 100);
const negativePct = 100 - positivePct - neutralPct;
```

### 7.6 — /dashboard Page Migration (DETAILED)

**File:** `src/app/dashboard/page.tsx`

**Current state:** Reads `indices`, `portfolioHistory`, `aiInsightsData`, `watchlistData`, `topMovers`, `newsData` from `@/lib/mock`.

**Migration strategy:**
- `indices` → fetch from `/api/v1/indices`
- `newsData` (preview section) → fetch from `/api/v1/news?limit=4`
- `watchlistData` (preview section) → read symbol list from `localStorage`, fetch prices
- `portfolioHistory` → KEEP AS MOCK DATA for now (backend has no historical portfolio value endpoint)
- `aiInsightsData` → KEEP AS MOCK DATA for now (these are marketing cards, not real-time data)
- `topMovers` → KEEP AS MOCK DATA for now (would need a movers screener endpoint)

```typescript
// REMOVE only the imports you're replacing:
// import { indices, newsData } from '@/lib/mock';
// KEEP the others:
import { portfolioHistory, aiInsightsData, topMovers } from '@/lib/mock';

// ADD:
import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/lib/market.api';
import { newsApi } from '@/lib/news.api';

// Inside component:
const { data: indicesData } = useQuery({
  queryKey: ['market-indices'],
  queryFn: marketApi.getIndices,
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
});

const { data: newsResponse } = useQuery({
  queryKey: ['news-preview'],
  queryFn: () => newsApi.getLatest(4),
  staleTime: 5 * 60_000,
});

const indices = indicesData?.indices ?? [];
const newsPreview = newsResponse?.articles ?? [];
```

**Watchlist preview on dashboard:**
```typescript
// Read watchlist from localStorage (same as WatchlistPage)
const [watchlistSymbols] = useState<string[]>(() => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('finsight_watchlist') ?? '[]');
  } catch {
    return [];
  }
});
```

### 7.7 — /stock/[symbol] Page Migration (DETAILED)

**File:** `src/app/stock/[symbol]/page.tsx`

**Current state:** Reads `stockHistory` and `metrics` from `@/lib/mock`. Has `useState` for timeframe selector and AI analysis panel toggle.

```typescript
// REMOVE:
// import { stockHistory, metrics } from '@/lib/mock';

// ADD:
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { stockApi } from '@/lib/stock.api';
import { aiApi } from '@/lib/ai.api';
import { useWebSocketPrice } from '@/lib/useWebSocketPrice';

// Inside component:
const params = useParams();
const symbol = (params.symbol as string)?.toUpperCase() ?? '';

// Timeframe state already exists — keep it
const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');

// Map timeframe labels to yFinance period strings
const periodMap = {
  '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', 'ALL': '5y'
} as const;

const { data: stockData, isLoading: stockLoading } = useQuery({
  queryKey: ['stock', symbol, periodMap[timeframe]],
  queryFn: () => stockApi.getFullData(symbol),
  enabled: symbol.length > 0,
  staleTime: 60_000,
});

// Fetch AI analysis separately (it's slow — LLM call)
const [showAiPanel, setShowAiPanel] = useState(false);
const { data: aiAnalysis, isLoading: aiLoading, refetch: fetchAi } = useQuery({
  queryKey: ['stock-analysis', symbol],
  queryFn: () => aiApi.analyze(
    `Perform a comprehensive financial analysis of ${symbol}. Include investment thesis, key risk factors, and interpretation of current technical indicators (RSI, SMA, EMA). Be specific and data-driven.`
  ),
  enabled: false,   // IMPORTANT: only fetch when user clicks "Analyze" button
  staleTime: 10 * 60_000,
});

// WebSocket for live price updates
const { price: livePrice, connected: wsConnected } = useWebSocketPrice(symbol);

// Current price: prefer WebSocket live price, fall back to API price
const currentPrice = livePrice ?? stockData?.price_data.price ?? null;
```

**Chart data mapping:**
```typescript
// Your existing chart uses array of {d, v} or {m, v} depending on how mock was structured
// Map the real API historical candles to match:
const chartData = (stockData?.historical ?? []).map(candle => ({
  d: candle.date,       // or whatever field name your AreaChart uses for X axis
  v: candle.close,      // closing price for the Y axis value
}));
```

**Key metrics grid mapping:**
```typescript
// Mock `metrics` was: [{label, val}]
// Build the same structure from real data:
const metrics = stockData ? [
  { label: 'Market Cap',   val: formatMarketCap(stockData.price_data.market_cap) },
  { label: 'P/E Ratio',    val: stockData.price_data.pe_ratio?.toFixed(2) ?? 'N/A' },
  { label: 'Day High',     val: `₹${stockData.price_data.day_high?.toFixed(2)}` },
  { label: 'Day Low',      val: `₹${stockData.price_data.day_low?.toFixed(2)}` },
  { label: 'RSI (14)',     val: stockData.rsi?.toFixed(1) ?? 'N/A' },
  { label: 'SMA (20)',     val: stockData.sma_20?.toFixed(2) ?? 'N/A' },
  { label: 'EMA (20)',     val: stockData.ema_20?.toFixed(2) ?? 'N/A' },
  { label: 'Exchange',     val: stockData.price_data.exchange ?? 'N/A' },
] : [];

function formatMarketCap(val: number | null): string {
  if (!val) return 'N/A';
  if (val >= 1e12) return `₹${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `₹${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6)  return `₹${(val / 1e6).toFixed(2)}M`;
  return `₹${val.toFixed(0)}`;
}
```

**AI analysis panel:**
```typescript
// Your existing toggle button for the AI panel — wire it to fetch:
const handleAnalyzeClick = () => {
  setShowAiPanel(true);
  fetchAi();  // triggers the disabled useQuery to actually run
};

// In the AI panel render area, map the real response:
// aiAnalysis.verdict → 'BULLISH' | 'BEARISH' | 'NEUTRAL'
// aiAnalysis.confidence → number 0-100
// aiAnalysis.reasoning_summary → string (show in the expandable text area)
// aiAnalysis.risk_assessment → string
// aiAnalysis.technical_signals → array (each has indicator, value, interpretation)
```

### 7.8 — /ai-research Page Migration (DETAILED)

**File:** `src/app/ai-research/page.tsx`

**Current state:** Has a chat interface. Uses `useState` for messages array. Uses `setTimeout` loops to simulate the 4-step "agent thinking" animation (AGENT_STEPS). On send, appends a hardcoded mock AI response after the timeout.

**What to change — replace only the message sending logic:**

```typescript
// REMOVE the mock setTimeout simulation inside the send handler
// KEEP: useState for messages, AGENT_STEPS array, thinking animation logic

// ADD:
import { aiApi, AnalyzeResponse } from '@/lib/ai.api';

// Inside the component, REPLACE the sendMessage / handleSend function:

const [isThinking, setIsThinking] = useState(false);

const handleSend = async (inputText: string) => {
  if (!inputText.trim() || isThinking) return;

  const userQuestion = inputText.trim();

  // 1. Add user message immediately
  setMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
  setInput('');  // clear the input field

  // 2. Start the thinking animation (your existing AGENT_STEPS animation)
  setIsThinking(true);

  try {
    // 3. Call the real AI backend — this takes 5-30 seconds depending on LLM
    const response = await aiApi.analyze(userQuestion);

    // 4. Format the response into a readable string for the chat UI
    const formattedResponse = formatAiResponse(response);

    // 5. Add AI response to messages
    setMessages(prev => [...prev, { role: 'ai', content: formattedResponse }]);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
    setMessages(prev => [...prev, {
      role: 'ai',
      content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
    }]);
  } finally {
    // 6. Stop thinking animation regardless of success or failure
    setIsThinking(false);
  }
};

// Format the structured AI response into a chat-friendly string
// This uses the existing bold text rendering (**text** → <strong className="text-lime">)
function formatAiResponse(response: AnalyzeResponse): string {
  const verdictEmoji = response.verdict === 'BULLISH' ? '📈' : response.verdict === 'BEARISH' ? '📉' : '➡️';
  return [
    `**Verdict: ${response.verdict}** ${verdictEmoji} (Confidence: ${response.confidence}%)`,
    '',
    response.reasoning_summary,
    '',
    `**Risk Assessment:** ${response.risk_assessment}`,
  ].join('\n');
}
```

**Thinking animation behavior:** The `isThinking` state replaces whatever your existing thinking-step state was called. While `isThinking === true`, show the 4-step agent pipeline animation exactly as before. When it becomes `false`, hide the animation. The animation timing was previously driven by `setTimeout` — you can keep the visual animation running using CSS or a simple interval, but it resolves when the real API call resolves, not after a fixed time.

**Suggestion pills (SUGGESTIONS constant):** Do NOT change these. Keep the hardcoded suggestions. When a suggestion is clicked, pass its text to `handleSend`.

### 7.9 — /watchlist Page Migration (DETAILED)

**File:** `src/app/watchlist/page.tsx`

**Current state:** Reads `watchlistData` from `@/lib/mock`. Has add/remove functionality via `useState`.

**Strategy:** Store symbol list in `localStorage`. Fetch live prices from the backend for each symbol.

```typescript
// REMOVE:
// import { watchlistData } from '@/lib/mock';

// ADD:
import { useQuery } from '@tanstack/react-query';
import { stockApi } from '@/lib/stock.api';

const WATCHLIST_KEY = 'finsight_watchlist';  // must match the key used in dashboard page

// Replace the watchlistData useState with:
const [symbols, setSymbols] = useState<string[]>(() => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
  } catch {
    return [];
  }
});

const [inputSymbol, setInputSymbol] = useState('');

const addSymbol = (sym: string) => {
  const clean = sym.trim().toUpperCase();
  if (!clean || symbols.includes(clean)) return;
  const updated = [...symbols, clean];
  setSymbols(updated);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
  setInputSymbol('');
};

const removeSymbol = (sym: string) => {
  const updated = symbols.filter(s => s !== sym);
  setSymbols(updated);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
};

// Fetch live prices for all symbols in watchlist
const { data: priceData = {} } = useQuery({
  queryKey: ['watchlist-prices', symbols],
  queryFn: async () => {
    const results: Record<string, { price: number; change_pct: number; up: boolean; name: string }> = {};
    await Promise.allSettled(
      symbols.map(async sym => {
        try {
          const data = await stockApi.getFullData(sym);
          results[sym] = {
            price: data.price_data.price,
            change_pct: 0,  // backend doesn't return change_pct in current schema — show 0 for now
            up: true,
            name: sym,
          };
        } catch {
          // symbol fetch failed — skip
        }
      })
    );
    return results;
  },
  enabled: symbols.length > 0,
  staleTime: 60_000,
  refetchInterval: 2 * 60_000,
});

// Build the table rows from symbols + live prices
const watchlistRows = symbols.map(sym => ({
  sym,
  name: sym,
  price: priceData[sym]?.price ?? null,
  chg: priceData[sym]?.change_pct ?? null,
  up: priceData[sym]?.up ?? true,
}));
```

---

## SECTION 8 — UTILITY FUNCTIONS TO ADD

Add these to a new file `src/lib/utils.ts`. These are used across multiple pages.

```typescript
// src/lib/utils.ts

/** Format a number as Indian Rupees with abbreviation */
export function formatINR(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1e12) return `₹${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `₹${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e7)  return `₹${(value / 1e7).toFixed(2)}Cr`;
  if (value >= 1e5)  return `₹${(value / 1e5).toFixed(2)}L`;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Format percentage with sign and fixed decimals */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Format a date string to readable format */
export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

/** Format a date string to time only */
export function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

/** Determine text color class from a boolean (up/down) */
export function changeColor(up: boolean | null): string {
  if (up === null) return 'text-muted';
  return up ? 'text-green' : 'text-red';
}
```

---

## SECTION 9 — COMPLETE LIST OF FILES TO CREATE (SUMMARY)

These are ALL the new files you must create. Nothing else. Do not create any files not in this list.

### Backend (Python) — new files:
1. `Full-Stack-Client-Dashboard/backend/app/api/stock.py`
2. `Full-Stack-Client-Dashboard/backend/app/api/news.py`
3. `Full-Stack-Client-Dashboard/backend/app/api/market.py`

### Backend (Python) — modified files:
4. `Full-Stack-Client-Dashboard/backend/app/main.py` — add 3 router registrations only

### Frontend (TypeScript) — new files:
5. `Full-Stack-Client-Dashboard/.env.local`
6. `Full-Stack-Client-Dashboard/src/lib/api-client.ts`
7. `Full-Stack-Client-Dashboard/src/lib/stock.api.ts`
8. `Full-Stack-Client-Dashboard/src/lib/portfolio.api.ts`
9. `Full-Stack-Client-Dashboard/src/lib/alerts.api.ts`
10. `Full-Stack-Client-Dashboard/src/lib/ai.api.ts`
11. `Full-Stack-Client-Dashboard/src/lib/news.api.ts`
12. `Full-Stack-Client-Dashboard/src/lib/market.api.ts`
13. `Full-Stack-Client-Dashboard/src/lib/useWebSocketPrice.ts`
14. `Full-Stack-Client-Dashboard/src/lib/utils.ts`

### Frontend (TypeScript) — modified files:
15. `Full-Stack-Client-Dashboard/src/app/layout.tsx` — add QueryClientProvider
16. `Full-Stack-Client-Dashboard/src/app/alerts/page.tsx` — replace mock, add useQuery
17. `Full-Stack-Client-Dashboard/src/app/portfolio/page.tsx` — replace mock, add useQuery
18. `Full-Stack-Client-Dashboard/src/app/news/page.tsx` — replace mock, add useQuery
19. `Full-Stack-Client-Dashboard/src/app/dashboard/page.tsx` — partial replace, keep some mocks
20. `Full-Stack-Client-Dashboard/src/app/stock/[symbol]/page.tsx` — replace mock, add useQuery + WS
21. `Full-Stack-Client-Dashboard/src/app/ai-research/page.tsx` — replace setTimeout with real API call
22. `Full-Stack-Client-Dashboard/src/app/watchlist/page.tsx` — replace mock, use localStorage + API

### Files to NOT touch:
- `src/components/Icons.tsx`
- `src/components/Sidebar.tsx`
- `src/components/TopBar.tsx`
- `src/app/page.tsx`
- `src/app/settings/page.tsx`
- `src/lib/mock.ts`
- `tailwind.config.ts`
- `tsconfig.json`
- `postcss.config.js`
- `next.config.js` / `next.config.mjs`
- Any file inside `backend/app/core/`
- Any file inside `backend/app/services/`
- Any file inside `backend/app/ai/`
- Any file inside `backend/app/models/`
- Any file inside `backend/app/schemas/`

---

## SECTION 10 — VERIFICATION CHECKLIST

After implementation, verify each of these in the browser before marking complete:

### Backend verification (test in browser or Swagger at localhost:8000/docs):
- [ ] `GET http://localhost:8000/health` returns `{"status": "ok"}` or similar
- [ ] `GET http://localhost:8000/api/v1/indices` returns JSON with 4 index objects
- [ ] `GET http://localhost:8000/api/v1/news?limit=5` returns JSON with articles array
- [ ] `GET http://localhost:8000/api/v1/stock/RELIANCE.NS` returns price_data, historical, rsi
- [ ] `GET http://localhost:8000/portfolios/` returns empty array `[]` (no portfolios yet)
- [ ] `GET http://localhost:8000/api/v1/alerts/active` returns empty array `[]`

### Frontend verification (test in browser at localhost:3000):
- [ ] `/alerts` — shows real data from backend, delete button works
- [ ] `/portfolio` — shows "no portfolio" state when empty, or real holdings if data exists
- [ ] `/news` — shows real news articles, sentiment filter works on real data
- [ ] `/dashboard` — shows real index prices (NIFTY, SENSEX, etc.)
- [ ] `/stock/RELIANCE.NS` — shows real price chart and metrics
- [ ] `/stock/TCS.NS` — different symbol loads correctly
- [ ] `/ai-research` — sending a message shows real LLM response (will take 10-30 seconds)
- [ ] `/watchlist` — adding a symbol persists on page refresh

---

## SECTION 11 — COMMON ERRORS AND EXACT FIXES

| Error | Cause | Fix |
|-------|-------|-----|
| `CORS error in browser console` | CORS not configured in backend | Check `main.py` has `CORSMiddleware` with `allow_origins` including `localhost:3000` |
| `Cannot reach backend server` | FastAPI not running | Run `uvicorn app.main:app --reload --port 8000` from `backend/` folder with venv activated |
| `NEXT_PUBLIC_API_URL is undefined` | Missing `.env.local` | Create `.env.local` in `Full-Stack-Client-Dashboard/` root with the two env vars |
| `ModuleNotFoundError: No module named 'fastapi'` | venv not activated | Activate venv: `venv\Scripts\activate` on Windows |
| `404 Not Found on /api/v1/stock/{symbol}` | New router not registered in main.py | Add `app.include_router(stock.router)` to `main.py` |
| `useQuery is not a function` | React Query not installed | Run `npm install @tanstack/react-query` |
| `Hydration error in layout.tsx` | Layout is Server Component but uses useState | Add `'use client'` at the very top of `layout.tsx` |
| `WebSocket connection failed` | Backend WebSocket path wrong | Check exact path in `backend/app/api/stream.py` and match in `useWebSocketPrice.ts` |
| `TypeError: Cannot read properties of undefined (reading 'price_data')` | API returned different shape | Open `localhost:8000/docs`, test the endpoint, compare actual response with TypeScript interface |
| `Rate limit exceeded (429)` | Too many API calls during dev | Add `staleTime: 60_000` to relevant `useQuery` calls to reduce refetch frequency |

---

## SECTION 12 — IMPORTANT CONSTRAINTS (DO NOT VIOLATE)

1. **Do NOT redesign any UI.** Every component, color, layout, and Tailwind class must stay exactly as it is. Only data sources change.

2. **Do NOT delete `src/lib/mock.ts`.** Other mock imports you are not migrating yet (like `portfolioHistory`, `aiInsightsData`, `topMovers`) still need it. Only remove specific named imports from pages as you migrate them.

3. **Do NOT use a Next.js API route (`src/app/api/...`) as a proxy.** Call the FastAPI backend directly from the browser using `NEXT_PUBLIC_API_URL`. There is no Next.js API layer in this architecture.

4. **Do NOT add authentication.** The user has stated they will handle auth separately. No middleware, no session handling, no JWT tokens.

5. **Do NOT install additional npm packages** except `@tanstack/react-query`. Everything else needed is already in `package.json`.

6. **Do NOT add additional Python packages.** Everything needed is in `requirements.txt`. Do not add any `pip install` commands for individual packages.

7. **The backend Python import path matters.** The backend is run from inside the `backend/` subfolder: `cd backend && uvicorn app.main:app`. All Python imports in backend files use `from app.xxx import yyy`. This is correct and must not change.

8. **Do NOT use `localStorage` for anything except the watchlist symbol list.** No other state should be persisted to localStorage.

9. **Every page component must remain a Client Component** (keep `'use client'` at the top). Do not convert any page to a Server Component.

10. **When in doubt about a backend return shape, check `localhost:8000/docs`** and look at the actual response schema. Never guess. TypeScript types must match actual API responses exactly.

---

*End of Integration Master Plan — FinSight AI v2.0*
*Generated: April 2026*
*Backend: FastAPI (Python 3.11) | Frontend: Next.js 14 (TypeScript)*