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
