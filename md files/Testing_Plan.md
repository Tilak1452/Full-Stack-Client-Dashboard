# FinSight AI — Complete Testing & Verification Plan
## Production-Level QA Document for AI Agent Execution

> **Project:** Full-Stack-Client-Dashboard (FinSight AI v2.0)
> **Stack:** Next.js 14 (TypeScript) + FastAPI (Python 3.11)
> **Prepared for:** Gemini 3.1 Pro (Antigravity) — AI Agent Execution
> **Document Version:** 1.0 — April 2026

---

## CRITICAL INSTRUCTIONS FOR THE AI AGENT READING THIS

This document is a **complete, self-contained testing specification**. You must execute every test case exactly as written.

**Rules you must follow:**
1. Execute tests **in the order they appear**. Infrastructure tests first. Unit tests before integration tests. Integration tests before end-to-end tests.
2. **Never assume a test passes** without running it and seeing the actual output.
3. **Record the actual output** of every test — pass, fail, or error — before moving to the next.
4. If a test fails, **record the exact error message**. Do not skip or work around it.
5. **Do not modify application code** to make a test pass unless the test section explicitly says a fix is required.
6. Both servers must be running before any test that hits an HTTP endpoint. Backend on port 8000, frontend on port 3000.
7. When a test says "verify in browser," it means open `http://localhost:3000` in an actual browser — not curl. UI rendering must be verified visually.
8. All curl commands must be run from a terminal with both servers running.

---

## TABLE OF CONTENTS

1. [Infrastructure & Environment Tests](#section-1--infrastructure--environment-tests)
2. [Backend Unit Tests — Individual Services](#section-2--backend-unit-tests--individual-services)
3. [Backend API Endpoint Tests](#section-3--backend-api-endpoint-tests)
4. [Backend Data Integrity Tests](#section-4--backend-data-integrity-tests)
5. [Frontend Build & Compilation Tests](#section-5--frontend-build--compilation-tests)
6. [Frontend API Client Layer Tests](#section-6--frontend-api-client-layer-tests)
7. [Frontend Page Rendering Tests](#section-7--frontend-page-rendering-tests)
8. [Integration Tests — Frontend to Backend](#section-8--integration-tests--frontend-to-backend)
9. [WebSocket Live Price Tests](#section-9--websocket-live-price-tests)
10. [AI Agent Pipeline Tests](#section-10--ai-agent-pipeline-tests)
11. [Portfolio & Database Tests](#section-11--portfolio--database-tests)
12. [Alerts System Tests](#section-12--alerts-system-tests)
13. [Error Handling & Resilience Tests](#section-13--error-handling--resilience-tests)
14. [Rate Limiting Tests](#section-14--rate-limiting-tests)
15. [Cross-Page Navigation & State Tests](#section-15--cross-page-navigation--state-tests)
16. [Data Accuracy Verification Tests](#section-16--data-accuracy-verification-tests)
17. [Performance & Load Tests](#section-17--performance--load-tests)
18. [Security & Configuration Tests](#section-18--security--configuration-tests)
19. [Regression Tests — Mock Data Removal](#section-19--regression-tests--mock-data-removal)
20. [Final System Health Check](#section-20--final-system-health-check)

---

## SECTION 1 — Infrastructure & Environment Tests

**Objective:** Verify all processes, environment variables, dependencies, and connectivity are correctly configured before any functional testing begins.

---

### TEST 1.1 — Python Virtual Environment Integrity

**Type:** Infrastructure
**Command to run:**

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe --version
```

**Expected output:** `Python 3.11.x` (must be 3.11 or higher)

**Then run:**
```bash
venv\Scripts\pip.exe list | findstr -i "fastapi uvicorn sqlalchemy yfinance langchain langgraph pydantic apscheduler"
```

**Expected output:** Each of these packages must appear in the list with a version number. If any are missing, run `venv\Scripts\pip.exe install -r requirements.txt` first.

**Pass criteria:** All 9 packages listed above are present. Python version is 3.11+.

---

### TEST 1.2 — Backend Environment Variables Loaded

**Type:** Infrastructure
**Command to run:**

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
from backend.app.core.config import settings
print('DB URL:', settings.database_url)
print('Groq Key:', 'SET' if settings.groq_api_key else 'MISSING')
print('OpenAI Key:', 'SET' if settings.openai_api_key else 'MISSING')
print('Gemini Key:', 'SET' if settings.gemini_api_key else 'MISSING')
"
```

**Expected output:**
```
DB URL: sqlite:///./financial_ai.db
Groq Key: SET          ← at least one of these three MUST be SET
OpenAI Key: SET or MISSING
Gemini Key: SET or MISSING
```

**Pass criteria:** `database_url` is populated. At least one LLM key shows `SET`. If all three show `MISSING`, the AI analysis endpoint will fail — this must be fixed before running Section 10 tests.

---

### TEST 1.3 — Backend Server Startup

**Type:** Infrastructure
**Start the backend server (Terminal 1):**

```bash
cd Full-Stack-Client-Dashboard/backend
..\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Wait 10 seconds. Then in Terminal 2:**
```bash
curl -s http://localhost:8000/health
```

**Expected output:**
```json
{"status": "ok"}
```

**Also verify startup logs contain NO Python errors.** Common acceptable startup messages:
- `INFO: Application startup complete.`
- `INFO: Started server process`
- `INFO: Waiting for application startup.`

**Failure indicators (must be absent):**
- `ModuleNotFoundError`
- `ImportError`
- `AttributeError`
- `sqlalchemy.exc.OperationalError`
- `No LLM API keys configured` — this is acceptable as a warning but must not crash startup

**Pass criteria:** `/health` returns `{"status": "ok"}`. No Python exceptions in startup logs.

---

### TEST 1.4 — Frontend Server Startup

**Type:** Infrastructure
**Start the frontend server (Terminal 3):**

```bash
cd Full-Stack-Client-Dashboard/frontend
npm run dev
```

**Wait 15 seconds. Then in Terminal 2:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

**Expected output:** `200`

**Also verify Terminal 3 shows:**
- `✓ Ready in Xms` or `ready - started server on 0.0.0.0:3000`
- NO TypeScript compilation errors
- NO missing module errors

**Pass criteria:** `http://localhost:3000` returns HTTP 200. No build errors in terminal output.

---

### TEST 1.5 — Frontend Environment Variables

**Type:** Infrastructure
**Check the file exists and is correct:**

```bash
cat Full-Stack-Client-Dashboard/frontend/.env.local
```

**Expected output:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

**Both variables must be present.** If either is missing, the frontend cannot communicate with the backend.

**Then verify the variable is exposed to the browser by checking the compiled output:**
```bash
grep -r "NEXT_PUBLIC_API_URL" Full-Stack-Client-Dashboard/frontend/src/lib/api-client.ts
```

**Expected:** The file references `process.env.NEXT_PUBLIC_API_URL`

**Pass criteria:** Both env vars present in `.env.local`. `api-client.ts` references `NEXT_PUBLIC_API_URL`.

---

### TEST 1.6 — React Query Installation Verification

**Type:** Infrastructure

```bash
cat Full-Stack-Client-Dashboard/frontend/package.json | grep -i "react-query\|tanstack"
```

**Expected output contains:**
```
"@tanstack/react-query": "^5.x.x"
```

**Also verify it's installed:**
```bash
ls Full-Stack-Client-Dashboard/frontend/node_modules/@tanstack/react-query
```

**Expected:** Directory exists and is not empty.

**Pass criteria:** `@tanstack/react-query` is in `package.json` dependencies AND the `node_modules` directory for it exists.

---

### TEST 1.7 — Swagger UI Accessibility

**Type:** Infrastructure

Open in browser: `http://localhost:8000/docs`

**Expected:** The Swagger UI loads successfully. You should see:
- A page titled "Financial Research AI Agent" or similar
- Expandable endpoint sections including: **Analysis**, **Portfolio**, **Stock**, **News**, **Market**, **Alerts**, **Stream**, **System**
- The new endpoints added in Phase 2 must appear: `GET /api/v1/stock/{symbol}`, `GET /api/v1/news`, `GET /api/v1/indices`

**Pass criteria:** Swagger UI loads without error. All 3 new endpoints are visible in the interface.

---

### TEST 1.8 — SQLite Database File Exists

**Type:** Infrastructure

```bash
ls -la Full-Stack-Client-Dashboard/backend/financial_ai.db
```

**Expected:** File exists. Size may be 0 bytes or larger depending on whether tables have been created. If the file doesn't exist at all:

```bash
cd Full-Stack-Client-Dashboard/backend
..\venv\Scripts\python.exe -c "from app.core.database import Base, engine; Base.metadata.create_all(bind=engine); print('Tables created')"
```

**Then verify the tables were created:**
```bash
venv\Scripts\python.exe -c "
import sqlite3
conn = sqlite3.connect('backend/financial_ai.db')
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()
print('Tables:', [t[0] for t in tables])
"
```

**Expected output:** `Tables: ['portfolios', 'holdings', 'transactions', 'alerts']` (order may vary, but all 4 must be present)

**Pass criteria:** Database file exists. All 4 tables are present.

---

## SECTION 2 — Backend Unit Tests — Individual Services

**Objective:** Verify each backend service works correctly in isolation before testing the API layer above it.

---

### TEST 2.1 — StockService: Valid Symbol Fetch

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import asyncio
import sys
sys.path.insert(0, 'backend')
from app.services.stock_service import stock_service

async def test():
    data = await stock_service.get_current_price('RELIANCE.NS')
    print('Type:', type(data))
    print('Keys:', list(data.keys()))
    print('Price:', data.get('price'))
    print('Currency:', data.get('currency'))

asyncio.run(test())
"
```

**Expected output:**
```
Type: <class 'dict'>
Keys: ['price', 'currency', 'day_high', 'day_low', 'market_cap', ...]
Price: <a numeric value like 2891.5>
Currency: INR
```

**Pass criteria:** Returns a dict. `price` is a positive float. `currency` is `INR`.

---

### TEST 2.2 — StockService: Invalid Symbol Handling

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import asyncio
import sys
sys.path.insert(0, 'backend')
from app.services.stock_service import stock_service

async def test():
    try:
        data = await stock_service.get_current_price('THISDOESNOTEXIST99999')
        print('ERROR: Should have raised an exception but got:', data)
    except ValueError as e:
        print('CORRECT: ValueError raised:', str(e))
    except Exception as e:
        print('ACCEPTABLE: Exception raised:', type(e).__name__, str(e))

asyncio.run(test())
"
```

**Expected output:** Either `CORRECT: ValueError raised:` or `ACCEPTABLE: Exception raised:` — NOT a plain dict return with `price: None`. The service must raise an exception for invalid symbols, not silently return nulls.

**Pass criteria:** An exception is raised. No crash that would kill the server process.

---

### TEST 2.3 — StockService: Historical Data Format

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import asyncio
import sys
sys.path.insert(0, 'backend')
from app.services.stock_service import stock_service

async def test():
    data = await stock_service.get_historical_data('TCS.NS', period='1mo', interval='1d')
    print('Type:', type(data))
    print('Record count:', len(data))
    if data:
        print('First record keys:', list(data[0].keys()))
        print('First record:', data[0])

asyncio.run(test())
"
```

**Expected output:**
```
Type: <class 'list'>
Record count: (between 15 and 25 for 1-month period)
First record keys: ['date', 'open', 'high', 'low', 'close', 'volume']
First record: {'date': '2024-03-12', 'open': ..., 'high': ..., 'low': ..., 'close': ..., 'volume': ...}
```

**Pass criteria:** Returns a list. Each record has all 6 fields: `date`, `open`, `high`, `low`, `close`, `volume`. Count is between 15 and 25 for a 1-month period.

---

### TEST 2.4 — NewsService: General News Fetch

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import sys
sys.path.insert(0, 'backend')
from app.services.news_service import news_service

articles = news_service.get_news(limit=5)
print('Type:', type(articles))
print('Count:', len(articles))
if articles:
    a = articles[0]
    print('Fields:', dir(a) if hasattr(a, '__dict__') else list(a.keys()) if isinstance(a, dict) else type(a))
    if hasattr(a, 'title'): print('Title:', a.title)
    if hasattr(a, 'sentiment'): print('Sentiment:', a.sentiment)
    if hasattr(a, 'source'): print('Source:', a.source)
"
```

**Expected output:**
```
Type: <class 'list'>
Count: 5
Fields: (list of attributes including title, sentiment, source, published_at, url, summary)
Title: (some news headline string)
Sentiment: positive OR neutral OR negative
Source: Yahoo Finance or similar
```

**Pass criteria:** Returns a list of up to 5 articles. Each article has `title`, `sentiment`, `source` attributes. `sentiment` value is one of `positive`, `neutral`, `negative` — never `None` or empty string.

---

### TEST 2.5 — NewsService: Sentiment Values Are Valid

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import sys
sys.path.insert(0, 'backend')
from app.services.news_service import news_service

articles = news_service.get_news(limit=20)
valid_sentiments = {'positive', 'neutral', 'negative'}
invalid = []
for a in articles:
    sent = a.sentiment if hasattr(a, 'sentiment') else a.get('sentiment')
    if sent not in valid_sentiments:
        invalid.append({'title': a.title if hasattr(a, 'title') else 'unknown', 'sentiment': sent})

if invalid:
    print('FAIL: Invalid sentiment values found:', invalid)
else:
    print('PASS: All', len(articles), 'articles have valid sentiment values')
"
```

**Expected output:** `PASS: All X articles have valid sentiment values`

**Pass criteria:** Zero articles have invalid or missing sentiment values.

---

### TEST 2.6 — Technical Indicators: RSI Calculation

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import sys
sys.path.insert(0, 'backend')
from app.services.indicators import calculate_rsi, calculate_sma, calculate_ema

# Generate test price series (20 values needed for RSI-14)
prices = [100.0 + i * 1.5 + (i % 3) * (-2.0) for i in range(30)]

rsi = calculate_rsi(prices)
sma = calculate_sma(prices)
ema = calculate_ema(prices)

print('RSI:', rsi)
print('SMA:', sma)
print('EMA:', ema)
print('RSI in valid range (0-100):', 0 <= (rsi or 50) <= 100)
"
```

**Expected output:**
```
RSI: <float between 0 and 100>
SMA: <float>
EMA: <float>
RSI in valid range (0-100): True
```

**Pass criteria:** RSI is a float between 0 and 100. SMA and EMA are positive floats. None of them are `None` when given 30 data points.

---

### TEST 2.7 — AlertService: CRUD Operations

**Type:** Backend Unit

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import sys
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from app.services.alert_service import alert_service

db = SessionLocal()

# Create an alert
alert = alert_service.create_alert(db, symbol='TESTSTOCK', condition='price_above', threshold=500.0)
print('Created alert ID:', alert.id)
print('Created alert symbol:', alert.symbol)
print('Created alert status:', alert.status)

# List active alerts
active = alert_service.get_all_active_alerts(db)
print('Active alerts count:', len(active))

# Delete the alert
alert_service.delete_alert(db, alert.id)
active_after = alert_service.get_all_active_alerts(db)
print('Active alerts after delete:', len(active_after))

db.close()
"
```

**Expected output:**
```
Created alert ID: <integer>
Created alert symbol: TESTSTOCK
Created alert status: active
Active alerts count: 1 (or more if other alerts exist)
Active alerts after delete: (count decreased by 1)
```

**Pass criteria:** Alert is created with `active` status. It appears in the active list. After deletion, the count decreases by exactly 1.

---

### TEST 2.8 — Macro Service: FRED Data (Optional — requires FRED_API_KEY)

**Type:** Backend Unit (Skip if `FRED_API_KEY` is not set)

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import sys
sys.path.insert(0, 'backend')
from app.core.config import settings

if not settings.fred_api_key:
    print('SKIP: FRED_API_KEY not set — macro service will use fallback values')
else:
    from app.services.macro_service import macro_service
    data = macro_service.get_macro_data()
    print('Macro data keys:', list(data.keys()))
    print('Treasury yield:', data.get('treasury_yield_10y'))
    print('CPI:', data.get('cpi'))
"
```

**Pass criteria:** Either prints `SKIP` (acceptable) or prints macro data with numeric values.

---

## SECTION 3 — Backend API Endpoint Tests

**Objective:** Test every HTTP endpoint using curl. Both servers must be running.

**Note for AI agent:** Run every curl command and compare the actual response to the expected output. A test fails if the HTTP status code is wrong OR if the response body is missing expected fields.

---

### TEST 3.1 — Health Check Endpoint

```bash
curl -s -X GET "http://localhost:8000/health" -H "Content-Type: application/json"
```

**Expected HTTP status:** 200
**Expected response body:**
```json
{"status": "ok", "database": "connected"}
```
or minimally: `{"status": "ok"}`

**Pass criteria:** HTTP 200. Body contains `"status"` field with value `"ok"`.

---

### TEST 3.2 — GET /api/v1/indices — Market Indices

```bash
curl -s -X GET "http://localhost:8000/api/v1/indices" -H "Content-Type: application/json"
```

**Expected HTTP status:** 200
**Expected response body structure:**
```json
{
  "indices": [
    {
      "name": "NIFTY 50",
      "ticker": "^NSEI",
      "price": <number>,
      "change_pct": <number>,
      "up": <boolean>,
      "day_high": <number>,
      "day_low": <number>,
      "market_state": <string>
    },
    ...
  ]
}
```

**Specific validations:**
1. `indices` array must have exactly 4 elements
2. The 4 names must be: `"NIFTY 50"`, `"SENSEX"`, `"NIFTY BANK"`, `"NIFTY IT"`
3. Each element must have `name`, `ticker`, `price`, `change_pct`, `up`, `market_state`
4. Elements that errored (yfinance timeout) may have `"error": true` and `price: null` — this is acceptable but at least 2 of the 4 must have non-null prices

**Pass criteria:** HTTP 200. Response has `indices` array with 4 elements. At least 2 have valid prices.

---

### TEST 3.3 — GET /api/v1/news — News Feed

```bash
curl -s -X GET "http://localhost:8000/api/v1/news?limit=5" -H "Content-Type: application/json"
```

**Expected HTTP status:** 200
**Expected response body structure:**
```json
{
  "articles": [
    {
      "title": <non-empty string>,
      "source": <string>,
      "published_at": <ISO datetime string>,
      "url": <URL string>,
      "summary": <string>,
      "sentiment": "positive" OR "neutral" OR "negative"
    }
  ],
  "count": 5
}
```

**Specific validations:**
1. `articles` array is present and not empty
2. `count` matches the actual length of `articles`
3. Every article has all 6 fields
4. `sentiment` on every article is one of the three valid values
5. No article has `sentiment: null` or `sentiment: ""`

**Pass criteria:** HTTP 200. At least 1 article returned. All articles have valid sentiment.

---

### TEST 3.4 — GET /api/v1/news — Limit Parameter Validation

```bash
# Test with limit=2
curl -s -X GET "http://localhost:8000/api/v1/news?limit=2"

# Test with limit=0 (should fail validation)
curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "http://localhost:8000/api/v1/news?limit=0"

# Test with limit=100 (exceeds max of 50 — should fail or clamp)
curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "http://localhost:8000/api/v1/news?limit=100"
```

**Expected for limit=2:** Returns exactly 2 articles (or fewer if only fewer are available)
**Expected for limit=0:** HTTP 422 (validation error) — FastAPI validates `ge=1`
**Expected for limit=100:** HTTP 422 (validation error) — FastAPI validates `le=50`

**Pass criteria:** Valid limits return articles. Invalid limits (0, 100) return HTTP 422.

---

### TEST 3.5 — GET /api/v1/stock/{symbol} — Valid Symbol

```bash
curl -s -X GET "http://localhost:8000/api/v1/stock/RELIANCE.NS" -H "Content-Type: application/json"
```

**Expected HTTP status:** 200
**Expected response body structure:**
```json
{
  "symbol": "RELIANCE.NS",
  "price_data": {
    "price": <positive number>,
    "currency": "INR",
    "day_high": <number>,
    "day_low": <number>,
    "market_cap": <number or null>,
    "pe_ratio": <number or null>,
    "market_state": <string>,
    "exchange": <string>
  },
  "historical": [
    {"date": <string>, "open": <number>, "high": <number>, "low": <number>, "close": <number>, "volume": <number>},
    ...
  ],
  "rsi": <number between 0-100 or null>,
  "sma_20": <number or null>,
  "ema_20": <number or null>
}
```

**Specific validations:**
1. `price_data.price` is a positive number
2. `price_data.currency` is `"INR"`
3. `historical` array has at least 10 elements (1 month of trading days)
4. Each candle in `historical` has all 6 fields: `date`, `open`, `high`, `low`, `close`, `volume`
5. `rsi` if not null, is between 0 and 100
6. `symbol` in response matches the request (uppercased)

**Pass criteria:** HTTP 200. All structural validations pass.

---

### TEST 3.6 — GET /api/v1/stock/{symbol} — Case Insensitivity

```bash
curl -s -X GET "http://localhost:8000/api/v1/stock/reliance.ns" | grep -i "\"symbol\""
```

**Expected:** `"symbol": "RELIANCE.NS"` — the backend must uppercase the input.

**Pass criteria:** Symbol in response is uppercased regardless of input case.

---

### TEST 3.7 — GET /api/v1/stock/{symbol} — Invalid Symbol

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "http://localhost:8000/api/v1/stock/THISSYMBOLISABSOLUTELYFAKE99999"
```

**Expected HTTP status:** 404
**Expected response body:**
```json
{"detail": "...some error message about symbol not found or invalid..."}
```

**Pass criteria:** HTTP 404 (not 200, not 500). Response has a `detail` field.

---

### TEST 3.8 — GET /api/v1/stock/{symbol}/history — With Period and Interval

```bash
curl -s -X GET "http://localhost:8000/api/v1/stock/TCS.NS/history?period=3mo&interval=1d"
```

**Expected HTTP status:** 200
**Expected response:**
```json
{
  "symbol": "TCS.NS",
  "period": "3mo",
  "interval": "1d",
  "candles": [...]
}
```

**Specific validations:**
1. `period` in response matches the request parameter (`3mo`)
2. `interval` in response matches the request parameter (`1d`)
3. `candles` array has ~60-65 elements (3 months of trading days)
4. Each candle has all 6 OHLCV fields

**Pass criteria:** HTTP 200. Period/interval reflected in response. Candle count is appropriate for 3 months.

---

### TEST 3.9 — GET /portfolios/ — Empty Portfolio List

```bash
curl -s -X GET "http://localhost:8000/portfolios/" -H "Content-Type: application/json"
```

**Expected HTTP status:** 200
**Expected response:** `[]` (empty array if no portfolios exist) OR a JSON array of portfolio objects

**Pass criteria:** HTTP 200. Response is a valid JSON array (empty or populated).

---

### TEST 3.10 — POST /portfolios/ — Create Portfolio

```bash
curl -s -X POST "http://localhost:8000/portfolios/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Portfolio QA"}'
```

**Expected HTTP status:** 200 or 201
**Expected response:**
```json
{
  "id": <integer>,
  "name": "Test Portfolio QA",
  "created_at": <ISO datetime string>
}
```

**Record the `id` from this response — you will need it for subsequent tests.**

**Pass criteria:** HTTP 200 or 201. Response has `id`, `name`, and `created_at`.

---

### TEST 3.11 — POST /portfolios/{id}/holdings — Add Holding

*Replace `{id}` with the actual ID from TEST 3.10.*

```bash
curl -s -X POST "http://localhost:8000/portfolios/1/holdings" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "INFY.NS", "quantity": 50, "average_price": 1450.0}'
```

**Expected HTTP status:** 200 or 201
**Expected response:** Contains `symbol`, `quantity`, `average_price` matching the input.

**Pass criteria:** HTTP 200/201. Holding created with correct field values.

---

### TEST 3.12 — GET /portfolios/{id}/summary — Verify Holding Appears

```bash
curl -s -X GET "http://localhost:8000/portfolios/1/summary" -H "Content-Type: application/json"
```

**Expected HTTP status:** 200
**Expected response:**
```json
{
  "id": 1,
  "name": "Test Portfolio QA",
  "holdings": [
    {
      "symbol": "INFY.NS",
      "quantity": 50.0,
      "average_price": 1450.0
    }
  ],
  "total_invested": 72500.0
}
```

**Specific validations:**
1. `holdings` array contains the `INFY.NS` holding created in TEST 3.11
2. `total_invested` = `quantity * average_price` = `50 * 1450 = 72500`

**Pass criteria:** HTTP 200. Holding is present. `total_invested` is mathematically correct.

---

### TEST 3.13 — POST /api/v1/alerts/ — Create Alert

```bash
curl -s -X POST "http://localhost:8000/api/v1/alerts/" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NIFTY50", "condition": "price_above", "threshold": 22500.0}'
```

**Expected HTTP status:** 200 or 201
**Expected response:**
```json
{
  "id": <integer>,
  "symbol": "NIFTY50",
  "condition": "price_above",
  "threshold": 22500.0,
  "status": "active",
  "message": null,
  "created_at": <datetime>,
  "triggered_at": null
}
```

**Pass criteria:** HTTP 200/201. `status` is `"active"`. `triggered_at` is `null`.

---

### TEST 3.14 — GET /api/v1/alerts/active — Alert Appears in List

```bash
curl -s -X GET "http://localhost:8000/api/v1/alerts/active"
```

**Expected HTTP status:** 200
**Expected:** The alert created in TEST 3.13 appears in the response array.

**Pass criteria:** HTTP 200. At least 1 alert in array. The NIFTY50 `price_above` alert is present.

---

### TEST 3.15 — POST /api/v1/alerts/ — All Condition Types

Test each of the 6 valid alert conditions:

```bash
for condition in "price_above" "price_below" "rsi_above" "rsi_below" "sma_cross_above" "sma_cross_below"; do
  echo "Testing condition: $condition"
  curl -s -X POST "http://localhost:8000/api/v1/alerts/" \
    -H "Content-Type: application/json" \
    -d "{\"symbol\": \"TCS.NS\", \"condition\": \"$condition\", \"threshold\": 100.0}" \
    | python -m json.tool | grep '"status"'
done
```

**Expected output for each:** `"status": "active"`

**Pass criteria:** All 6 condition types create successfully with `status: active`.

---

### TEST 3.16 — DELETE /api/v1/alerts/{id}

*Use the alert ID from TEST 3.13.*

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "http://localhost:8000/api/v1/alerts/1"
```

**Expected HTTP status:** 200 or 204

**Then verify it's gone:**
```bash
curl -s -X GET "http://localhost:8000/api/v1/alerts/active"
```

**Expected:** The deleted alert does not appear in the list.

**Pass criteria:** DELETE returns 200 or 204. Alert is absent from subsequent GET.

---

### TEST 3.17 — POST /api/v1/alerts/ — Invalid Condition Rejected

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://localhost:8000/api/v1/alerts/" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "TCS.NS", "condition": "INVALID_CONDITION", "threshold": 100.0}'
```

**Expected HTTP status:** 422 (Unprocessable Entity — Pydantic rejects invalid enum value)

**Pass criteria:** HTTP 422. Pydantic validation blocks invalid condition values from being stored.

---

### TEST 3.18 — POST /api/v1/analyze — AI Analysis Endpoint

**Note:** This test requires at least one LLM API key to be set. If none are set, expect a 500 error — document this and proceed.

```bash
curl -s -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the current outlook for TCS.NS stock?"}' \
  --max-time 60
```

**Expected HTTP status:** 200
**Expected response structure:**
```json
{
  "verdict": "BULLISH" OR "BEARISH" OR "NEUTRAL",
  "confidence": <integer 0-100>,
  "reasoning_summary": <non-empty string>,
  "technical_signals": [
    {"indicator": <string>, "value": <string>, "interpretation": <string>}
  ],
  "sentiment_signals": [
    {"source": <string>, "score": <string>, "interpretation": <string>}
  ],
  "risk_assessment": <non-empty string>
}
```

**Specific validations:**
1. `verdict` is exactly one of `"BULLISH"`, `"BEARISH"`, `"NEUTRAL"`
2. `confidence` is an integer between 0 and 100
3. `reasoning_summary` is a non-empty string (minimum 50 characters)
4. `technical_signals` is an array (may be empty)
5. `risk_assessment` is a non-empty string

**Pass criteria:** HTTP 200. All 6 fields present with valid values.

---

### TEST 3.19 — GET /api/v1/assets/macro — Macro Data

```bash
curl -s -X GET "http://localhost:8000/api/v1/assets/macro"
```

**Expected HTTP status:** 200
**Expected:** Response contains macro economic data (gold price, crude oil, treasury yield indicators)

**Pass criteria:** HTTP 200. Response is valid JSON with economic data fields.

---

### TEST 3.20 — GET /rag/query — RAG Query Endpoint

```bash
curl -s -X GET "http://localhost:8000/rag/query?q=financial+analysis"
```

**Expected HTTP status:** 200 (even if no documents have been uploaded — should return empty results, not error)

**Pass criteria:** HTTP 200. Does not crash.

---

## SECTION 4 — Backend Data Integrity Tests

**Objective:** Verify data consistency across multiple operations and ensure database constraints work.

---

### TEST 4.1 — Portfolio Name Uniqueness

```bash
# Create first portfolio
curl -s -X POST "http://localhost:8000/portfolios/" \
  -H "Content-Type: application/json" \
  -d '{"name": "UNIQUE_NAME_TEST"}'

# Try to create another with the same name
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://localhost:8000/portfolios/" \
  -H "Content-Type: application/json" \
  -d '{"name": "UNIQUE_NAME_TEST"}'
```

**Expected on second request:** HTTP 400 or 409 (conflict) — the `portfolio_service.create_portfolio()` has duplicate name detection.

**Pass criteria:** Second creation attempt is rejected with a 4xx status code.

---

### TEST 4.2 — Holdings Weighted Average Price Update

*Using the portfolio from earlier tests:*

```bash
# First holding: 50 shares at 1450
curl -s -X POST "http://localhost:8000/portfolios/1/holdings" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "WIPRO.NS", "quantity": 50, "average_price": 400.0}'

# Second purchase of same symbol: 50 more shares at 450 
# Weighted average should become: (50*400 + 50*450) / 100 = 425
curl -s -X POST "http://localhost:8000/portfolios/1/holdings" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "WIPRO.NS", "quantity": 50, "average_price": 450.0}'

# Check summary
curl -s "http://localhost:8000/portfolios/1/summary" | python -m json.tool | grep -A5 "WIPRO"
```

**Expected:** `average_price` for WIPRO.NS in summary is `425.0` (weighted average of 400 and 450)

**Pass criteria:** `average_price` is `425.0` (or very close due to floating point). Not simply 450 (last write) or 400 (first write).

---

### TEST 4.3 — Transaction SELL Does Not Oversell

```bash
# Try to sell more shares than owned (50 WIPRO.NS were added, try to sell 200)
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://localhost:8000/portfolios/1/transactions" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "WIPRO.NS", "transaction_type": "SELL", "quantity": 200, "price": 400.0}'
```

**Expected HTTP status:** 400 (Bad Request) — `portfolio_service.record_transaction()` prevents overselling.

**Pass criteria:** HTTP 400. The transaction is rejected, not silently accepted.

---

### TEST 4.4 — Alert Status Transitions

```bash
# Create alert
ALERT_ID=$(curl -s -X POST "http://localhost:8000/api/v1/alerts/" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "TESTSTOCK", "condition": "price_above", "threshold": 9999999.0}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Created alert ID: $ALERT_ID"

# Verify it's active
curl -s "http://localhost:8000/api/v1/alerts/active" | python -m json.tool | grep "status"
```

**Pass criteria:** Alert is created. Status is `"active"`. ID is a valid integer.

---

## SECTION 5 — Frontend Build & Compilation Tests

**Objective:** Verify the Next.js frontend has no TypeScript errors, missing imports, or broken builds.

---

### TEST 5.1 — TypeScript Compilation Check

```bash
cd Full-Stack-Client-Dashboard/frontend
npx tsc --noEmit 2>&1
```

**Expected output:** No output (zero errors = success) OR `Found 0 errors.`

**If there are errors:** Document each error file and line number. A test failure here means TypeScript types in the API client files don't match what was written. Do not ignore these.

**Pass criteria:** Zero TypeScript compilation errors.

---

### TEST 5.2 — ESLint Check

```bash
cd Full-Stack-Client-Dashboard/frontend
npm run lint 2>&1
```

**Expected output:** `✓ No ESLint warnings or errors` or similar success message.

**Acceptable:** Warnings about `any` types are acceptable but should be noted. Errors are not acceptable.

**Pass criteria:** Zero ESLint errors (warnings are acceptable but should be documented).

---

### TEST 5.3 — Production Build

```bash
cd Full-Stack-Client-Dashboard/frontend
npm run build 2>&1
```

**Expected output:**
```
✓ Compiled successfully
Route (app) ...
...all pages listed without errors...
```

**Failure indicators (must not appear):**
- `Failed to compile`
- `Module not found`
- `Type error`
- Any red error messages

**Pass criteria:** Build completes successfully with `✓ Compiled successfully`.

---

### TEST 5.4 — Required Source Files Exist

```bash
cd Full-Stack-Client-Dashboard/frontend/src
ls lib/api-client.ts lib/stock.api.ts lib/portfolio.api.ts lib/alerts.api.ts lib/ai.api.ts lib/news.api.ts lib/market.api.ts lib/useWebSocketPrice.ts lib/utils.ts lib/mock.ts
```

**Expected output:** All 10 files listed without "No such file" errors.

```bash
ls app/providers.tsx app/layout.tsx app/dashboard/page.tsx "app/stock/[symbol]/page.tsx" app/ai-research/page.tsx app/portfolio/page.tsx app/watchlist/page.tsx app/news/page.tsx app/alerts/page.tsx
```

**Expected output:** All 9 files listed without errors.

**Pass criteria:** All 19 files exist.

---

### TEST 5.5 — Mock Data Still Available (Regression Guard)

```bash
cd Full-Stack-Client-Dashboard/frontend
grep -l "from '@/lib/mock'" src/app/dashboard/page.tsx 2>&1
```

**Expected:** The file still imports from mock (for `portfolioHistory`, `aiInsightsData`, `topMovers` that are not yet migrated). This is expected and correct.

```bash
grep -c "from '@/lib/mock'" src/app/alerts/page.tsx src/app/portfolio/page.tsx src/app/news/page.tsx src/app/watchlist/page.tsx src/app/ai-research/page.tsx "src/app/stock/[symbol]/page.tsx"
```

**Expected output:** All counts should be `0` — these 6 pages must NOT import from mock anymore.

**Pass criteria:** Alerts, portfolio, news, watchlist, ai-research, stock pages have zero mock imports. Dashboard still has mock imports (acceptable).

---

### TEST 5.6 — React Query Provider Wraps App

```bash
grep -r "QueryClientProvider\|Providers" Full-Stack-Client-Dashboard/frontend/src/app/layout.tsx
```

**Expected:** Output contains both `Providers` import and usage in the layout.

```bash
grep -r "QueryClientProvider" Full-Stack-Client-Dashboard/frontend/src/app/providers.tsx
```

**Expected:** `providers.tsx` contains `QueryClientProvider`.

**Pass criteria:** Both files reference QueryClientProvider. Layout uses Providers wrapper.

---

## SECTION 6 — Frontend API Client Layer Tests

**Objective:** Verify each TypeScript API client file has the correct structure and exports.

---

### TEST 6.1 — api-client.ts Exports and Error Class

```bash
cd Full-Stack-Client-Dashboard/frontend
node -e "
const { execSync } = require('child_process');
// Compile and check for ApiError class and apiFetch function
const content = require('fs').readFileSync('src/lib/api-client.ts', 'utf8');
const checks = [
  ['ApiError class', content.includes('class ApiError')],
  ['ApiError extends Error', content.includes('extends Error')],
  ['apiFetch function', content.includes('async function apiFetch')],
  ['NEXT_PUBLIC_API_URL used', content.includes('NEXT_PUBLIC_API_URL')],
  ['Network error handled', content.includes('Cannot reach backend') || content.includes('network') || content.includes('catch')],
  ['Non-2xx error thrown', content.includes('response.ok') || content.includes('!response.ok')],
];
checks.forEach(([name, result]) => console.log(result ? 'PASS' : 'FAIL', name));
"
```

**Expected output:** All lines start with `PASS`.

**Pass criteria:** All 6 structural checks pass.

---

### TEST 6.2 — All API Client Files Have TypeScript Interfaces

```bash
cd Full-Stack-Client-Dashboard/frontend/src/lib
for file in stock.api.ts portfolio.api.ts alerts.api.ts ai.api.ts news.api.ts market.api.ts; do
  interface_count=$(grep -c "^export interface\|^interface" $file 2>/dev/null || echo "0")
  export_count=$(grep -c "^export const" $file 2>/dev/null || echo "0")
  echo "$file: $interface_count interfaces, $export_count exports"
done
```

**Expected output (each file):**
- `stock.api.ts`: ≥3 interfaces, ≥1 export
- `portfolio.api.ts`: ≥4 interfaces, ≥1 export
- `alerts.api.ts`: ≥2 interfaces, ≥1 export
- `ai.api.ts`: ≥2 interfaces, ≥1 export
- `news.api.ts`: ≥1 interface, ≥1 export
- `market.api.ts`: ≥1 interface, ≥1 export

**Pass criteria:** All files have at least 1 exported interface and 1 exported API object.

---

### TEST 6.3 — useWebSocketPrice Hook Structure

```bash
cd Full-Stack-Client-Dashboard/frontend
node -e "
const content = require('fs').readFileSync('src/lib/useWebSocketPrice.ts', 'utf8');
const checks = [
  ['Has use client directive', content.includes(\"'use client'\")],
  ['Exports useWebSocketPrice', content.includes('export function useWebSocketPrice')],
  ['Uses useEffect', content.includes('useEffect')],
  ['Uses useRef for WS', content.includes('useRef') && content.includes('WebSocket')],
  ['Reads NEXT_PUBLIC_WS_URL', content.includes('NEXT_PUBLIC_WS_URL')],
  ['Returns price state', content.includes('price') && content.includes('connected')],
  ['Cleanup on unmount', content.includes('ws.close') || content.includes('wsRef.current?.close')],
];
checks.forEach(([name, result]) => console.log(result ? 'PASS' : 'FAIL', name));
"
```

**Expected output:** All 7 lines start with `PASS`.

**Pass criteria:** All structural checks pass.

---

### TEST 6.4 — utils.ts Exports All Expected Functions

```bash
cd Full-Stack-Client-Dashboard/frontend
node -e "
const content = require('fs').readFileSync('src/lib/utils.ts', 'utf8');
const fns = ['formatINR', 'formatPct', 'formatDate', 'formatTime', 'changeColor'];
fns.forEach(fn => {
  const found = content.includes('export function ' + fn) || content.includes('export const ' + fn);
  console.log(found ? 'PASS' : 'FAIL', fn);
});
"
```

**Expected output:** All 5 lines start with `PASS`.

**Pass criteria:** All 5 utility functions are exported.

---

## SECTION 7 — Frontend Page Rendering Tests

**Objective:** Visually verify every page loads in the browser without errors, displays correctly, and shows the expected UI structure. Both servers must be running.

---

### TEST 7.1 — Root Redirect

Open browser: `http://localhost:3000`

**Expected behavior:** Automatically redirects to `http://localhost:3000/dashboard` within 1 second.

**Pass criteria:** URL in browser address bar becomes `/dashboard`. Dashboard content is visible.

---

### TEST 7.2 — Dashboard Page (`/dashboard`)

Open browser: `http://localhost:3000/dashboard`

**Visual checks (all must pass):**
1. **Sidebar** is visible on the left (64px wide, dark background, navigation icons)
2. **TopBar** is visible at the top with page title and search input
3. **4 Market Index Cards** are visible in a row at the top of the main content area
4. **Index cards show actual data:** At least 2 of the 4 cards show a numeric price (not "N/A" or loading spinner)
5. **Portfolio History Chart** is visible (may show mock data — that is acceptable)
6. **AI Insights Panel** is visible on the right side
7. **News Preview** section shows at least 1 real news article (not the mock "Reliance Industries announces..." headline)
8. **No JavaScript console errors** — open browser DevTools (F12), Console tab, verify no red errors
9. **No "Failed to fetch" errors** in the console

**Pass criteria:** All 9 visual checks pass.

---

### TEST 7.3 — Dashboard Page Loading States

```
1. Stop the backend server (Ctrl+C in backend terminal)
2. Reload http://localhost:3000/dashboard
3. Observe what happens to the index cards and news section
```

**Expected behavior:**
- Index cards should show either a loading spinner or an error message, NOT crash the page
- The rest of the UI (sidebar, chart with mock data, AI insights with mock data) should still render

**Then restart the backend and verify:**
- Data reappears after the next refetch (within 30 seconds, or on page reload)

**Pass criteria:** Page does not crash when backend is down. Data loads when backend comes back.

---

### TEST 7.4 — Stock Analysis Page (`/stock/[symbol]`)

Open browser: `http://localhost:3000/stock/RELIANCE.NS`

**Visual checks:**
1. Page loads without a white screen of death
2. A price chart (AreaChart) is visible with data points
3. A price number is visible at the top of the chart area
4. **Key Financials** grid shows cards with real data (Market Cap, P/E Ratio, RSI, etc.)
5. The **timeframe selector** (1M/3M/6M/1Y/ALL) buttons are visible and clickable
6. Clicking a different timeframe (e.g., 3M) triggers a new data fetch (brief loading state, then new data)
7. **"Get AI Analysis" button** is visible (the AI panel is collapsed by default)
8. No "undefined" or "NaN" values visible in the metrics grid

**Then test symbol search:**
- Find the search bar in TopBar
- Type `TCS` and press Enter
- Verify the URL changes to `/stock/TCS.NS` or `/stock/TCS` and loads TCS data

**Pass criteria:** All 8 visual checks pass. Symbol navigation works.

---

### TEST 7.5 — AI Research Page (`/ai-research`)

Open browser: `http://localhost:3000/ai-research`

**Visual checks:**
1. Page loads with empty chat area (or a welcome/empty state message)
2. **5 Suggestion pill buttons** are visible
3. **Chat input box** is visible at the bottom with a send button
4. Clicking a suggestion pill populates the input box

**Then test actual AI interaction:**
1. Type: `What is the current market outlook for Indian IT sector?`
2. Click Send (or press Enter)
3. The user message appears immediately in the chat in a styled bubble
4. **Agent thinking animation starts** (4-step pipeline dots or similar animation)
5. After 15-60 seconds, an AI response appears in the chat
6. The response contains: a verdict (BULLISH/BEARISH/NEUTRAL), a confidence percentage, and at least 2 paragraphs of analysis text
7. The thinking animation stops after the response arrives
8. A second message can be sent immediately after

**Pass criteria:** All 8 steps work. AI response arrives within 60 seconds.

---

### TEST 7.6 — Portfolio Page (`/portfolio`)

Open browser: `http://localhost:3000/portfolio`

**When no portfolio exists:**
1. Page loads without error
2. An empty state is shown (e.g., "No portfolios available" or similar message)
3. No JavaScript console errors

**After creating a portfolio (use Swagger or curl — see TEST 3.10 and 3.11):**
1. Reload the portfolio page
2. **Summary cards** appear at the top (Total Value, Invested, Gain, Return)
3. **Holdings table** shows the INFY.NS holding added in TEST 3.11
4. **Allocation donut chart** shows INFY.NS as a slice
5. Values in the summary cards are computed correctly (not all zeros)
6. If live price fetch succeeds: P&L column shows a non-zero value

**Pass criteria:** Empty state renders cleanly. After portfolio creation and reload, all 6 checks pass.

---

### TEST 7.7 — Alerts Page (`/alerts`)

Open browser: `http://localhost:3000/alerts`

**When no alerts exist:**
1. Page loads without error
2. Summary counters show `0 Active`, `0 Triggered`, `0 Total`
3. Alert list area is empty (no crashes)

**After creating alerts (see TEST 3.13):**
1. Reload the page
2. The NIFTY50 `price_above` alert appears in the list
3. The alert shows: symbol badge, condition text, status badge
4. **Toggle switch** is visible and in the "ON" position for active alerts
5. Clicking the toggle (to deactivate/delete) removes the alert from the list
6. Summary counters update to reflect the change

**Pass criteria:** Empty state renders cleanly. Alert list shows real data. Toggle works.

---

### TEST 7.8 — News Page (`/news`)

Open browser: `http://localhost:3000/news`

**Visual checks:**
1. Page loads with real news articles (not the mock "HDFC Bank beats Q3 expectations" headlines)
2. **Sentiment filter pills** are visible: All, Positive, Neutral, Negative
3. **Sentiment distribution badge** shows actual percentages (should add up to ~100%)
4. Each news card shows: source badge, sentiment badge, timestamp, headline, summary
5. Sentiment badges are color-coded (green = positive, gray = neutral, red = negative)
6. Clicking "Positive" filter shows only positive-sentiment articles
7. Clicking "All" restores all articles
8. **Article links are clickable** and open in a new tab (real Yahoo Finance URLs)

**Pass criteria:** All 8 checks pass. Articles are real (not mock). Filtering works.

---

### TEST 7.9 — Watchlist Page (`/watchlist`)

Open browser: `http://localhost:3000/watchlist`

**With empty watchlist:**
1. Page loads without crash
2. Input box for adding symbols is visible

**Adding symbols:**
1. Type `TCS` in the input box and click "Add to watchlist"
2. `TCS` (or `TCS.NS`) appears in the table
3. A live price appears for TCS (may take a few seconds to fetch)
4. Type `HDFC.NS` and add it — it also appears
5. Click "Remove" on TCS — it disappears from the list
6. **Reload the page** — HDFC.NS is still in the list (localStorage persists across reload)
7. TCS is NOT in the list (was removed before reload)

**Pass criteria:** Add/remove works. Persistence across reload works via localStorage.

---

### TEST 7.10 — Settings Page (`/settings`)

Open browser: `http://localhost:3000/settings`

**Visual checks:**
1. Page loads without error
2. Profile form is visible (Name, Email, Phone fields)
3. Subscription plan card is visible
4. API key inputs are visible (masked password fields)
5. Notification toggles are visible

This page is intentionally left as static mock data. No backend integration is expected.

**Pass criteria:** Page renders without errors. All sections are visible.

---

### TEST 7.11 — Sidebar Navigation

**Test all 8 navigation items from the sidebar:**

| Click Target | Expected URL | Expected Page Content |
|-------------|--------------|----------------------|
| Grid/Home icon | `/dashboard` | Market indices, portfolio chart |
| Chart/Stock icon | `/stock/...` | Stock analysis page |
| Brain/AI icon | `/ai-research` | AI chat interface |
| Briefcase/Portfolio icon | `/portfolio` | Holdings table |
| Bookmark/Watchlist icon | `/watchlist` | Watchlist table |
| News icon | `/news` | News articles |
| Bell/Alerts icon | `/alerts` | Alert list |
| Gear/Settings icon | `/settings` | Settings form |

**Pass criteria:** All 8 navigation links lead to the correct page without 404 errors or white screens.

---

## SECTION 8 — Integration Tests — Frontend to Backend

**Objective:** Verify that the data displayed in the browser matches what the backend actually returns.

---

### TEST 8.1 — Index Card Data Consistency

1. In Terminal: `curl -s http://localhost:8000/api/v1/indices | python -m json.tool`
   - **Note the NIFTY 50 price from the API response.**

2. In Browser: Open `http://localhost:3000/dashboard`
   - **Note the NIFTY 50 price shown on the index card.**

3. **Compare:** The price shown in the UI must match or be very close to what the API returned.

**Pass criteria:** UI price and API price match within a ±2% tolerance (price changes during the test window are acceptable).

---

### TEST 8.2 — Stock Page Data Consistency

1. In Terminal: `curl -s http://localhost:8000/api/v1/stock/INFY.NS | python -m json.tool`
   - Note: `price_data.price`, `rsi`, `sma_20`

2. In Browser: Open `http://localhost:3000/stock/INFY.NS`
   - Note the price displayed, the RSI value in the technical indicators section, the SMA value

3. **Compare:** UI values must match API values within ±2% for price, and exactly for RSI/SMA (within displayed decimal precision).

**Pass criteria:** No significant discrepancy between API response and UI display.

---

### TEST 8.3 — News Sentiment Consistency

1. In Terminal: `curl -s "http://localhost:8000/api/v1/news?limit=5" | python -c "import sys,json; articles=json.load(sys.stdin)['articles']; [print(a['title'][:50], '|', a['sentiment']) for a in articles]"`

2. In Browser: Open `http://localhost:3000/news` — note the sentiment badge on the first 5 articles.

3. **Compare:** The sentiment label on each article in the browser matches the API response.

**Pass criteria:** Sentiment displayed in UI matches sentiment from API for all compared articles.

---

### TEST 8.4 — Portfolio Data Roundtrip

1. Create a portfolio and holding via API:
```bash
PORT_ID=$(curl -s -X POST "http://localhost:8000/portfolios/" -H "Content-Type: application/json" -d '{"name":"Integration Test Portfolio"}' | python -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X POST "http://localhost:8000/portfolios/$PORT_ID/holdings" -H "Content-Type: application/json" -d '{"symbol":"TATAMOTORS.NS","quantity":100,"average_price":800.0}'
```

2. Open browser: `http://localhost:3000/portfolio`

3. **Verify:** `TATAMOTORS.NS` appears in the holdings table with quantity 100 and average price ₹800.

**Pass criteria:** Data created via API appears correctly in the UI without page modification.

---

### TEST 8.5 — Alert Roundtrip (API Create → UI Display → UI Delete)

1. Create alert via API:
```bash
curl -s -X POST "http://localhost:8000/api/v1/alerts/" -H "Content-Type: application/json" -d '{"symbol":"ROUNDTRIP_TEST","condition":"price_above","threshold":999.0}'
```

2. Open browser: `http://localhost:3000/alerts`

3. **Verify:** `ROUNDTRIP_TEST` alert appears in the list with status `active`.

4. Click the toggle on the ROUNDTRIP_TEST alert in the browser.

5. **Verify:** The alert disappears from the list in the browser.

6. Confirm via API: `curl -s http://localhost:8000/api/v1/alerts/active | grep ROUNDTRIP_TEST`

7. **Expected:** No output (alert was deleted).

**Pass criteria:** All 7 steps work in sequence.

---

## SECTION 9 — WebSocket Live Price Tests

**Objective:** Verify the WebSocket connection for live price streaming works end-to-end.

---

### TEST 9.1 — WebSocket Endpoint Exists and Connects

*Requires a WebSocket client. Use Python:*

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import asyncio
import websockets
import json

async def test():
    uri = 'ws://localhost:8000/api/v1/stream/price/RELIANCE.NS'
    try:
        async with websockets.connect(uri) as ws:
            print('Connected successfully')
            # Wait for up to 3 messages
            for i in range(3):
                msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(msg)
                print(f'Message {i+1}:', data)
                if 'price' not in data:
                    print('FAIL: price field missing from WebSocket message')
                    return
            print('PASS: WebSocket sends price messages correctly')
    except ConnectionRefusedError:
        print('FAIL: WebSocket connection refused — backend not running or endpoint missing')
    except Exception as e:
        print(f'FAIL: {type(e).__name__}: {e}')

asyncio.run(test())
" 2>&1
```

*If websockets package is not installed:*
```bash
venv\Scripts\pip.exe install websockets
```

**Expected output:**
```
Connected successfully
Message 1: {'symbol': 'RELIANCE.NS', 'price': <number>, 'timestamp': <string>}
Message 2: {'symbol': 'RELIANCE.NS', 'price': <number>, 'timestamp': <string>}
Message 3: {'symbol': 'RELIANCE.NS', 'price': <number>, 'timestamp': <string>}
PASS: WebSocket sends price messages correctly
```

**Pass criteria:** Connection succeeds. Price messages arrive. Each has a `price` field.

---

### TEST 9.2 — WebSocket Price Updates in Browser

1. Open browser: `http://localhost:3000/stock/RELIANCE.NS`
2. Open browser DevTools → Network tab → Filter by "WS" (WebSocket)
3. **Verify:** A WebSocket connection to `ws://localhost:8000/api/v1/stream/price/RELIANCE.NS` is visible
4. Click on the connection → Messages tab
5. **Verify:** Messages appear every 5 seconds with price data
6. The displayed price in the UI updates (or stays the same if market is closed — this is acceptable)

**Pass criteria:** WebSocket connection visible in DevTools. Messages arriving at the expected interval.

---

### TEST 9.3 — WebSocket Cleanup on Navigation

1. Open browser: `http://localhost:3000/stock/RELIANCE.NS`
2. Open DevTools → Network → WS tab — note the WebSocket connection for RELIANCE.NS
3. Navigate to `/stock/TCS.NS` via the search bar
4. **Verify in DevTools:** The RELIANCE.NS WebSocket closes, and a new TCS.NS WebSocket opens
5. Navigate away to `/dashboard`
6. **Verify:** The TCS.NS WebSocket closes (no lingering connections)

**Pass criteria:** WebSocket connections are properly opened and closed during navigation. No connection leaks.

---

## SECTION 10 — AI Agent Pipeline Tests

**Objective:** Verify the LangGraph AI agent works correctly, including its guardrails, fallback behavior, and output schema enforcement.

---

### TEST 10.1 — Standard Financial Question

```bash
curl -s -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"question": "Analyze HDFC Bank stock. What are the key technical signals?"}' \
  --max-time 60 | python -m json.tool
```

**Validation checklist:**
- [ ] HTTP 200 received
- [ ] `verdict` is one of: `BULLISH`, `BEARISH`, `NEUTRAL`
- [ ] `confidence` is an integer between 0 and 100
- [ ] `reasoning_summary` length > 100 characters
- [ ] `technical_signals` is an array (may have 0 or more items)
- [ ] `sentiment_signals` is an array
- [ ] `risk_assessment` length > 50 characters
- [ ] No `null` values on required string fields

**Pass criteria:** All 8 checklist items are satisfied.

---

### TEST 10.2 — Toxicity Filter — Blocked Content

```bash
curl -s -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"question": "This stock is guaranteed to make profit risk free get rich quick scheme guaranteed profits"}' \
  --max-time 60 | python -c "
import sys, json
data = json.load(sys.stdin)
print('Verdict:', data.get('verdict'))
print('Confidence:', data.get('confidence'))
# If toxicity filter triggered, confidence should be 0 and verdict NEUTRAL
if data.get('verdict') == 'NEUTRAL' and data.get('confidence') == 0:
    print('PASS: Toxicity filter triggered NEUTRAL fallback')
else:
    print('INFO: Response returned (filter may not have triggered — check reasoning_summary for safety language)')
    print('Summary:', data.get('reasoning_summary', '')[:200])
"
```

**Expected:** Either a `NEUTRAL, 0%` fallback (toxicity filter caught it) or a normal response that avoids repeating the manipulative language. The response must NEVER contain phrases like "guaranteed profit" or "risk-free" in an affirmative context.

**Pass criteria:** Response does not endorse guaranteed profits or risk-free claims.

---

### TEST 10.3 — LLM Provider Fallback Verification

*This tests that if the primary LLM (Groq) fails, the system falls back to the next provider.*

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import sys
sys.path.insert(0, 'backend')
from app.ai.analyst import create_analyst_agent

# The agent should be created regardless of which LLM keys are set
agent = create_analyst_agent()
print('Agent created:', type(agent).__name__)
print('PASS: LLM agent initializes without crash')
" 2>&1
```

**Expected:** Agent initializes. No `ValueError: No LLM provider configured` error.

**Pass criteria:** Agent object is created successfully.

---

### TEST 10.4 — AI Response in Chat UI Format

In browser at `http://localhost:3000/ai-research`:

1. Send the message: `Give me a brief analysis of NIFTY 50`
2. Wait for response (up to 60 seconds)
3. **Verify the response is formatted correctly:**
   - Verdict is visible (e.g., `Verdict: BULLISH 📈 (Confidence: 65%)`)
   - The reasoning text appears below
   - Risk assessment is visible
   - **Bold text** rendering works — text between `**` should render as highlighted/lime-colored text, not as literal asterisks
4. Send a second message immediately — the input is available without page reload

**Pass criteria:** Response renders correctly. Bold text markers render as styling. Second message can be sent.

---

## SECTION 11 — Portfolio & Database Tests

**Objective:** Test the complete portfolio lifecycle including CRUD operations and database persistence.

---

### TEST 11.1 — Full Portfolio Lifecycle

```bash
# 1. Create
P=$(curl -s -X POST "http://localhost:8000/portfolios/" -H "Content-Type: application/json" -d '{"name":"Lifecycle Test"}' | python -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "Portfolio ID: $P"

# 2. Add multiple holdings
curl -s -X POST "http://localhost:8000/portfolios/$P/holdings" -H "Content-Type: application/json" -d '{"symbol":"RELIANCE.NS","quantity":10,"average_price":2800.0}' | python -m json.tool
curl -s -X POST "http://localhost:8000/portfolios/$P/holdings" -H "Content-Type: application/json" -d '{"symbol":"TCS.NS","quantity":5,"average_price":3500.0}' | python -m json.tool

# 3. Get summary
curl -s "http://localhost:8000/portfolios/$P/summary" | python -m json.tool

# 4. Record a BUY transaction
curl -s -X POST "http://localhost:8000/portfolios/$P/transactions" -H "Content-Type: application/json" -d "{\"symbol\":\"RELIANCE.NS\",\"transaction_type\":\"BUY\",\"quantity\":5,\"price\":2850.0}"

# 5. Verify holding updated (10+5 = 15 shares, new weighted average)
curl -s "http://localhost:8000/portfolios/$P/summary" | python -c "
import sys, json
data = json.load(sys.stdin)
for h in data['holdings']:
    if h['symbol'] == 'RELIANCE.NS':
        print('RELIANCE quantity:', h['quantity'])
        print('RELIANCE avg price:', h['average_price'])
        # Expected qty: 15, expected avg: (10*2800 + 5*2850)/15 = 2816.67
        expected_avg = (10*2800 + 5*2850) / 15
        print('Expected avg price:', round(expected_avg, 2))
        diff = abs(h['average_price'] - expected_avg)
        print('PASS' if diff < 1 else 'FAIL', 'Weighted average is correct')
"
```

**Pass criteria:** All CRUD operations succeed. Weighted average recalculates correctly after the second purchase.

---

### TEST 11.2 — MPT Optimization

```bash
curl -s -X GET "http://localhost:8000/portfolios/1/optimize" --max-time 60 | python -m json.tool
```

**Expected response structure:**
```json
{
  "weights": {"SYMBOL1": 0.45, "SYMBOL2": 0.30, ...},
  "expected_annual_return": <float>,
  "annual_volatility": <float>,
  "sharpe_ratio": <float>
}
```

**Specific validations:**
1. `weights` values sum to approximately 1.0 (within ±0.01 tolerance)
2. `sharpe_ratio` is a positive number (optimized portfolio should have positive Sharpe)
3. `expected_annual_return` is a percentage (value between 0 and 1, or between 0 and 100 depending on implementation)

**Pass criteria:** HTTP 200. Weights sum to ~1.0. All numeric fields are present.

---

### TEST 11.3 — Database Persistence After Restart

```bash
# 1. Record the current portfolio count before restart
curl -s "http://localhost:8000/portfolios/" | python -c "import sys,json; print('Count before:', len(json.load(sys.stdin)))"

# 2. Stop the backend server (Ctrl+C)
# 3. Restart the backend server (uvicorn command)
# 4. Wait 10 seconds for startup
sleep 10

# 5. Check portfolio count — must be same as before
curl -s "http://localhost:8000/portfolios/" | python -c "import sys,json; print('Count after restart:', len(json.load(sys.stdin)))"
```

**Expected:** Count before and after restart must be identical.

**Pass criteria:** All data persists across backend restart. SQLite file is not wiped on startup.

---

## SECTION 12 — Alerts System Tests

**Objective:** Verify the APScheduler alert engine and the alert evaluation pipeline.

---

### TEST 12.1 — APScheduler Starts with Backend

In the backend startup logs, look for:
```
INFO:     Application startup complete.
INFO apscheduler: Scheduler started
```
or similar APScheduler startup message.

```bash
# Check if scheduler is running by verifying it appears in backend logs
# Run this while the backend is starting and check the output
```

**Pass criteria:** APScheduler startup message appears in backend logs. No scheduler crash on startup.

---

### TEST 12.2 — Alert Conditions Are Logically Evaluated

Create an alert that should ALREADY be triggered (price above a very low threshold):

```bash
# Get current NIFTY 50 price
NIFTY_PRICE=$(curl -s "http://localhost:8000/api/v1/indices" | python -c "
import sys,json
indices = json.load(sys.stdin)['indices']
nifty = next((i for i in indices if i['name'] == 'NIFTY 50'), None)
if nifty and nifty.get('price'):
    print(nifty['price'])
else:
    print(20000)
")
echo "NIFTY Price: $NIFTY_PRICE"

# Create alert with threshold FAR below current price (should trigger on next poll)
# Threshold is 1000 — NIFTY is at ~22000, so price_above should have been triggered
curl -s -X POST "http://localhost:8000/api/v1/alerts/" \
  -H "Content-Type: application/json" \
  -d "{\"symbol\": \"^NSEI\", \"condition\": \"price_above\", \"threshold\": 1000.0}"
```

**Note:** The alert engine polls every 5 minutes. For immediate testing, check the alert status after the next poll cycle. For a faster test, you can manually trigger the evaluation:

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import asyncio
import sys
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from app.services.alert_service import alert_service

db = SessionLocal()
asyncio.run(alert_service._check_alerts())
# After this, check if low-threshold alerts were triggered
active = alert_service.get_all_active_alerts(db)
notifications = alert_service.get_recent_alerts(db, limit=10)
print('Active alerts:', len(active))
print('Notifications:', [(n.symbol, n.condition, n.status) for n in notifications])
db.close()
"
```

**Pass criteria:** An alert with `price_above: 1000` on NIFTY (which is at ~22000) is marked as `triggered` after the evaluation runs.

---

### TEST 12.3 — GET /api/v1/alerts/notifications

```bash
curl -s "http://localhost:8000/api/v1/alerts/notifications" | python -m json.tool
```

**Expected HTTP status:** 200
**Expected:** Array of up to 10 most recently triggered alerts (may be empty if no alerts have triggered)

**Pass criteria:** HTTP 200. Response is a valid JSON array. No 500 errors.

---

## SECTION 13 — Error Handling & Resilience Tests

**Objective:** Verify the system handles failures gracefully and never shows raw Python tracebacks to the client.

---

### TEST 13.1 — Global Exception Handler

```bash
# Send a malformed request body that will cause a parsing failure
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d 'this is not valid json at all'
```

**Expected HTTP status:** 422 (Pydantic validation error) or 400 (bad request)
**Expected response body:** A structured JSON error, NOT a Python traceback

```bash
# Verify the response body is JSON (not HTML or plain text traceback)
curl -s -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d 'NOT JSON' | python -m json.tool
```

**Expected:** Parses as valid JSON (structured error response). If it fails to parse as JSON, the test FAILS because the server is returning a raw traceback.

**Pass criteria:** All error responses are valid JSON. No Python tracebacks exposed to client.

---

### TEST 13.2 — Circuit Breaker Behavior (Informational)

The `stock_service.py` has a 3-state circuit breaker (`CLOSED → OPEN → HALF_OPEN`). This test verifies the breaker doesn't interfere with normal operation.

```bash
# Make 10 rapid requests to the same endpoint
for i in {1..10}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/v1/stock/RELIANCE.NS")
  echo "Request $i: HTTP $STATUS"
done
```

**Expected:** All 10 requests return HTTP 200 (circuit breaker should remain CLOSED for valid symbols).

**Pass criteria:** At least 8/10 requests return HTTP 200 (minor failures due to yfinance rate limits are acceptable).

---

### TEST 13.3 — Rate Limiter Response

```bash
# The analyze endpoint has a 5/min rate limit — send 6 requests rapidly
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:8000/api/v1/analyze" \
    -H "Content-Type: application/json" \
    -d '{"question":"rate limit test"}')
  echo "Request $i: HTTP $STATUS"
done
```

**Expected:** First 5 requests return HTTP 200 (or processing). Request 6 returns HTTP 429 (Too Many Requests).

**Pass criteria:** Rate limiting triggers on the 6th request with HTTP 429.

---

### TEST 13.4 — Frontend Error Boundary — Backend Down

1. Stop the backend server
2. Open browser: `http://localhost:3000/alerts`
3. **Verify:** The page shows an error state ("Failed to load data" or similar) — NOT a white screen of death
4. The Sidebar and TopBar are still visible
5. A "Try again" or retry button is visible
6. Restart backend and click retry — data loads

**Pass criteria:** Page degrades gracefully. Core UI chrome stays visible during backend failure.

---

### TEST 13.5 — Invalid Portfolio ID

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" "http://localhost:8000/portfolios/999999/summary"
```

**Expected HTTP status:** 404

**Pass criteria:** HTTP 404 with a structured error body, not a Python exception.

---

### TEST 13.6 — CORS Headers Present

```bash
curl -s -v -X OPTIONS "http://localhost:8000/api/v1/indices" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control"
```

**Expected output contains:**
```
Access-Control-Allow-Origin: * (or http://localhost:3000)
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Pass criteria:** CORS headers are present in the OPTIONS preflight response. The frontend's origin is allowed.

---

## SECTION 14 — Rate Limiting Tests

**Objective:** Verify that `slowapi` rate limiting is active and returns proper HTTP 429 responses.

---

### TEST 14.1 — Global Rate Limit (20 req/min)

```bash
# Send 25 rapid requests to a basic endpoint (no special rate limit)
PASS=0; FAIL=0; LIMITED=0
for i in {1..25}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/v1/indices")
  if [ "$STATUS" == "200" ]; then PASS=$((PASS+1))
  elif [ "$STATUS" == "429" ]; then LIMITED=$((LIMITED+1))
  else FAIL=$((FAIL+1))
  fi
done
echo "200 OK: $PASS, 429 Limited: $LIMITED, Other: $FAIL"
```

**Expected:** First 20 return 200, requests 21-25 return 429.

**Pass criteria:** HTTP 429 is returned after the rate limit is exceeded. Not a 500 error.

---

### TEST 14.2 — Rate Limit Response Body

```bash
# Trigger rate limit then examine the response body
# (May need to run after TEST 14.1 has already hit the limit)
curl -s -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"question":"rate limit body test"}' \
  | python -m json.tool
```

**After rate limit is hit, expected response:**
```json
{"detail": "Rate limit exceeded: X per Y second"}
```

**Pass criteria:** Rate limit response body is valid JSON with a `detail` field.

---

## SECTION 15 — Cross-Page Navigation & State Tests

**Objective:** Test that navigation between pages works correctly, state is preserved where expected, and WebSocket connections clean up.

---

### TEST 15.1 — TopBar Symbol Search Navigation

1. Open browser at any page (e.g., `/dashboard`)
2. Click on the search input in the TopBar
3. Type `WIPRO` and press Enter
4. **Expected:** Browser navigates to `/stock/WIPRO` or `/stock/WIPRO.NS`
5. Wipro stock data loads
6. Navigate back (browser back button)
7. **Expected:** Returns to `/dashboard`, dashboard data is still visible (not blank)

**Pass criteria:** Search navigates correctly. Back navigation works.

---

### TEST 15.2 — Watchlist Persistence Across Pages

1. On `/watchlist`, add `HDFC.NS`
2. Navigate to `/dashboard`
3. **Expected:** Watchlist preview section on dashboard shows `HDFC.NS`
4. Navigate back to `/watchlist`
5. **Expected:** `HDFC.NS` is still in the list

**Pass criteria:** Watchlist state (stored in localStorage) persists across page navigation.

---

### TEST 15.3 — React Query Cache — No Duplicate API Calls

Open browser DevTools → Network tab, then:
1. Navigate to `/alerts`
2. **Note:** An API call to `/api/v1/alerts/active` appears in Network tab
3. Navigate to `/dashboard`
4. Navigate back to `/alerts`
5. **Verify:** Within the `staleTime` window (30 seconds), NO new API call to `/api/v1/alerts/active` is made (cached data is used)
6. Wait 30+ seconds and navigate back
7. **Verify:** A new API call IS made after the cache expires

**Pass criteria:** React Query caching prevents redundant API calls within the staleTime window.

---

### TEST 15.4 — Timeframe Selector Triggers New Data Fetch

1. Open browser: `http://localhost:3000/stock/RELIANCE.NS`
2. Open DevTools → Network tab
3. **Note:** API call to `/api/v1/stock/RELIANCE.NS` (1-month data) was made on load
4. Click the `3M` timeframe button
5. **Verify:** A new API call to `/api/v1/stock/RELIANCE.NS/history?period=3mo` is made
6. The chart updates with more data points (3 months vs 1 month)
7. Click `1Y` — a call for `period=1y` is made

**Pass criteria:** Each timeframe button click triggers the correct new API call with the right period parameter.

---

## SECTION 16 — Data Accuracy Verification Tests

**Objective:** Spot-check that the financial data displayed is accurate and sensible.

---

### TEST 16.1 — Index Price Sanity Check

From the dashboard, verify these approximate ranges (as of 2026, adjust if significantly outdated):

| Index | Approximate Expected Range |
|-------|---------------------------|
| NIFTY 50 | 18,000 – 28,000 |
| SENSEX | 60,000 – 90,000 |
| NIFTY BANK | 40,000 – 55,000 |
| NIFTY IT | 28,000 – 45,000 |

**Pass criteria:** All visible index prices fall within the expected ranges. Prices of 0, negative values, or impossibly large numbers (e.g., > 1,000,000) indicate a data error.

---

### TEST 16.2 — RSI Range Validation

On the `/stock/RELIANCE.NS` page:

**Expected:** RSI value is between 20 and 80 for a normal market condition. An RSI of 0, 100, or null in a liquid stock is suspicious.

```bash
curl -s "http://localhost:8000/api/v1/stock/RELIANCE.NS" | python -c "
import sys, json
data = json.load(sys.stdin)
rsi = data.get('rsi')
if rsi is None:
    print('WARN: RSI is null')
elif 0 < rsi < 100:
    print(f'PASS: RSI is {rsi:.1f} (valid range)')
else:
    print(f'FAIL: RSI is {rsi} (out of valid 0-100 range)')
"
```

**Pass criteria:** RSI is a float between 0 and 100 (exclusive).

---

### TEST 16.3 — OHLC Candle Integrity

Verify that Open, High, Low, Close values are internally consistent:

```bash
curl -s "http://localhost:8000/api/v1/stock/TCS.NS/history?period=1mo" | python -c "
import sys, json
data = json.load(sys.stdin)
candles = data.get('candles', [])
errors = []
for c in candles:
    if c['high'] < c['low']:
        errors.append(f\"Date {c['date']}: high {c['high']} < low {c['low']}\")
    if c['close'] < c['low'] or c['close'] > c['high']:
        errors.append(f\"Date {c['date']}: close {c['close']} outside [low={c['low']}, high={c['high']}]\")
    if c['open'] < c['low'] or c['open'] > c['high']:
        errors.append(f\"Date {c['date']}: open {c['open']} outside [low={c['low']}, high={c['high']}]\")

if errors:
    print('FAIL: OHLC integrity violations:')
    for e in errors: print(' ', e)
else:
    print(f'PASS: All {len(candles)} candles have valid OHLC relationships')
"
```

**Pass criteria:** All candles satisfy: `low ≤ open ≤ high`, `low ≤ close ≤ high`.

---

### TEST 16.4 — News Headline Relevance

From `/api/v1/news`, verify that news articles are actually about financial markets (not completely unrelated content):

```bash
curl -s "http://localhost:8000/api/v1/news?limit=10" | python -c "
import sys, json
data = json.load(sys.stdin)
financial_keywords = ['market', 'stock', 'share', 'nifty', 'sensex', 'rupee', 'rbi', 'bank', 'quarter', 'revenue', 'profit', 'index', 'bse', 'nse', 'fund', 'investor', 'economy', 'gdp', 'inflation']
articles = data.get('articles', [])
relevant = 0
for a in articles:
    title_lower = a['title'].lower()
    if any(kw in title_lower for kw in financial_keywords):
        relevant += 1

pct = (relevant / len(articles) * 100) if articles else 0
print(f'{relevant}/{len(articles)} articles ({pct:.0f}%) appear to be financial news')
print('PASS' if pct >= 60 else 'WARN', 'Financial news relevance check')
"
```

**Pass criteria:** At least 60% of articles contain financial keywords in their headlines.

---

## SECTION 17 — Performance & Load Tests

**Objective:** Verify that the system responds within acceptable time limits under normal usage.

---

### TEST 17.1 — API Response Time Benchmarks

```bash
# Test response times for key endpoints
for endpoint in "/health" "/api/v1/indices" "/api/v1/news?limit=5" "/api/v1/stock/RELIANCE.NS"; do
  TIME=$(curl -s -o /dev/null -w "%{time_total}" "http://localhost:8000$endpoint")
  echo "$endpoint: ${TIME}s"
done
```

**Expected response times:**
| Endpoint | Acceptable Time | Maximum Time |
|----------|----------------|--------------|
| `/health` | < 0.1s | 0.5s |
| `/api/v1/indices` | < 5s | 15s |
| `/api/v1/news?limit=5` | < 3s | 10s |
| `/api/v1/stock/RELIANCE.NS` | < 5s | 15s |

*(Times are higher for market data endpoints because they make external API calls to yFinance)*

**Pass criteria:** All endpoints respond within their maximum time. None timeout at the network level.

---

### TEST 17.2 — Cached Response Time (Second Request)

```bash
# First request (cold — fetches from yfinance)
time curl -s -o /dev/null "http://localhost:8000/api/v1/stock/RELIANCE.NS"

# Second request (warm — should hit Redis/in-memory cache, TTL: 120s)
time curl -s -o /dev/null "http://localhost:8000/api/v1/stock/RELIANCE.NS"
```

**Expected:** Second request is significantly faster (at least 2x faster) because it hits the cache. If both requests take the same time, the caching is not working.

**Pass criteria:** Second request is noticeably faster than the first.

---

### TEST 17.3 — Frontend Page Load Time

Open browser DevTools → Network tab → Enable "Disable cache" checkbox.

Open `http://localhost:3000/dashboard` and note:
- **DOMContentLoaded** time in the Network tab status bar
- **Load** time

**Expected:** DOMContentLoaded under 3 seconds. Total Load under 5 seconds.

**Pass criteria:** Page loads within acceptable time. No individual asset takes more than 5 seconds.

---

## SECTION 18 — Security & Configuration Tests

**Objective:** Verify that sensitive configuration is not exposed and security measures are in place.

---

### TEST 18.1 — API Keys Not Exposed in Frontend Source

```bash
# Check that no API keys appear in the compiled Next.js JavaScript
grep -r "GROQ_API_KEY\|OPENAI_API_KEY\|GEMINI_API_KEY" Full-Stack-Client-Dashboard/frontend/.next/ 2>/dev/null | grep -v "NEXT_PUBLIC" | head -5
```

**Expected output:** No results. API keys must NOT appear in client-side JavaScript bundles. Only `NEXT_PUBLIC_` variables may appear.

**Pass criteria:** Zero API key matches in frontend compiled output.

---

### TEST 18.2 — Backend Stack Trace Not Exposed

```bash
# Force a 500 error and verify no traceback is in the response
curl -s -X GET "http://localhost:8000/portfolios/NOTANUMBER/summary"
```

**Expected HTTP status:** 422 (type validation fails before execution) or 404
**Expected response:** Structured JSON error, NOT a Python traceback containing file paths and line numbers

**Pass criteria:** No Python file paths or stack frames in error response body.

---

### TEST 18.3 — .env Files Not in Version Control

```bash
# Check if .env files are in .gitignore
grep ".env" Full-Stack-Client-Dashboard/.gitignore
grep ".env.local" Full-Stack-Client-Dashboard/.gitignore 2>/dev/null || grep ".env.local" Full-Stack-Client-Dashboard/frontend/.gitignore 2>/dev/null
```

**Expected:** Both `.env` and `.env.local` patterns appear in `.gitignore`. If not present:

```bash
echo ".env" >> Full-Stack-Client-Dashboard/.gitignore
echo ".env.local" >> Full-Stack-Client-Dashboard/.gitignore
echo "venv/" >> Full-Stack-Client-Dashboard/.gitignore
```

**Pass criteria:** `.env`, `.env.local`, and `venv/` are in `.gitignore`.

---

### TEST 18.4 — CORS Restricts Unknown Origins

```bash
curl -s -v -X GET "http://localhost:8000/api/v1/indices" \
  -H "Origin: http://malicious-site.com" 2>&1 | grep -i "access-control-allow-origin"
```

**Expected in development:** `Access-Control-Allow-Origin: *` (wildcard, acceptable for dev)
**Expected in production:** Should NOT include `http://malicious-site.com` if origin whitelist is configured

**Note:** For development, `allow_origins=["*"]` is acceptable and expected. Document this as a production hardening task.

**Pass criteria:** CORS header is present. Its value is documented.

---

## SECTION 19 — Regression Tests — Mock Data Removal

**Objective:** Verify that mock data has been properly removed from migrated pages and that no mock values accidentally appear in the live UI.

---

### TEST 19.1 — Mock Headlines Not on News Page

Open browser: `http://localhost:3000/news`

**Verify NONE of these mock headlines appear:**
- "HDFC Bank beats Q3 expectations with 18.2% profit growth"
- "Reliance Industries announces major expansion"
- "Infosys Q4 guidance: Revenue growth expected at 7-8%"
- "Tata Motors eyes premium segment with new EV lineup"

These were the hardcoded mock news items. If any appear verbatim, the page is still reading from mock data.

**Pass criteria:** None of the 4 mock headlines are visible on the page.

---

### TEST 19.2 — Mock Alert Data Not on Alerts Page

Open browser: `http://localhost:3000/alerts`

**Verify NONE of these mock symbols appear (unless the user actually created these via the API):**
- Mock alert symbols that were hardcoded in `mock.ts`

Check the mock.ts to find the original alertsData mock values:
```bash
grep "sym\|cond" Full-Stack-Client-Dashboard/frontend/src/lib/mock.ts | head -20
```

**Verify those exact symbols are NOT appearing in the alerts list in the browser** (unless the user created real alerts with those symbols).

**Pass criteria:** No mock alert data is displayed unless it was created through the real API.

---

### TEST 19.3 — Mock Stock History Not on Stock Page

Open browser: `http://localhost:3000/stock/RELIANCE.NS`

The mock `stockHistory` data was a fixed array of values. Real data will vary by date.

**Verification:** Open browser DevTools → Application → No API call to `/api/v1/stock/RELIANCE.NS` would indicate mock data is still being used. Verify the network call IS being made.

```bash
# In DevTools Network tab, filter by "stock" — you should see a call to:
# GET http://localhost:8000/api/v1/stock/RELIANCE.NS
# Status: 200
```

**Pass criteria:** Network call to the real API endpoint is visible. The chart data changes when you change the symbol (it would not if hardcoded mock data were used).

---

### TEST 19.4 — Mock Metrics Not on Stock Page

The mock `metrics` array had hardcoded values like specific P/E ratios and market caps. Real data will be different.

Open browser: `http://localhost:3000/stock/WIPRO.NS` vs `http://localhost:3000/stock/TCS.NS`

**Verification:** The "Key Financials" section should show DIFFERENT values for WIPRO and TCS. If both show identical values, mock data is still in use.

**Pass criteria:** Key Financials values differ between WIPRO.NS and TCS.NS pages.

---

### TEST 19.5 — Mock Portfolio Holdings Not on Portfolio Page

Open browser: `http://localhost:3000/portfolio`

If the database has no portfolios, the page should show an empty state — NOT the mock holdings like `HDFCBANK`, `RELIANCE`, etc. with hardcoded quantities.

**Pass criteria:** Portfolio page shows empty state (if no real portfolio created) or shows only holdings created via the real API.

---

## SECTION 20 — Final System Health Check

**Objective:** A complete end-to-end smoke test run in sequence, verifying the entire system is functional.

---

### TEST 20.1 — Complete User Journey: New User Flow

Execute these steps in order, verifying each step before proceeding:

```
STEP 1: Open http://localhost:3000
         ✓ Redirects to /dashboard

STEP 2: Dashboard shows 4 index cards with real prices
         ✓ At least 2 of 4 cards show numeric prices

STEP 3: Navigate to /stock/RELIANCE.NS via search bar
         ✓ Price chart appears with real data
         ✓ Key Financials grid shows real values

STEP 4: Click "Get AI Analysis" (or equivalent button)
         ✓ Loading state appears
         ✓ After 10-60 seconds, AI verdict appears

STEP 5: Navigate to /ai-research
         ✓ Empty chat state visible
         ✓ Send message: "What is the outlook for Indian banking sector?"
         ✓ Agent thinking animation plays
         ✓ Real AI response arrives

STEP 6: Navigate to /news
         ✓ Real news articles appear
         ✓ Sentiment filter works

STEP 7: Navigate to /watchlist
         ✓ Add "NIFTY_IT.NS"
         ✓ Price loads for the symbol

STEP 8: Navigate to /alerts
         ✓ Create alert via API or UI
         ✓ Alert appears in list

STEP 9: Navigate to /portfolio
         ✓ Empty state or real portfolio shown

STEP 10: Navigate to /settings
          ✓ Settings form renders (static)
```

**Pass criteria:** All 10 steps complete without JavaScript errors, white screens, or HTTP 500 responses.

---

### TEST 20.2 — Final Backend API Health Summary

Run this comprehensive health check script:

```bash
cd Full-Stack-Client-Dashboard
venv\Scripts\python.exe -c "
import urllib.request
import json

endpoints = [
    ('GET', 'http://localhost:8000/health', None),
    ('GET', 'http://localhost:8000/api/v1/indices', None),
    ('GET', 'http://localhost:8000/api/v1/news?limit=2', None),
    ('GET', 'http://localhost:8000/api/v1/stock/RELIANCE.NS', None),
    ('GET', 'http://localhost:8000/portfolios/', None),
    ('GET', 'http://localhost:8000/api/v1/alerts/active', None),
]

print('=== Backend Health Check ===')
all_pass = True
for method, url, body in endpoints:
    try:
        req = urllib.request.Request(url, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            data = json.loads(resp.read())
            print(f'PASS {status} {url.replace(\"http://localhost:8000\", \"\")}')
    except urllib.error.HTTPError as e:
        print(f'FAIL {e.code} {url.replace(\"http://localhost:8000\", \"\")}')
        all_pass = False
    except Exception as e:
        print(f'ERROR {type(e).__name__} {url.replace(\"http://localhost:8000\", \"\")}')
        all_pass = False

print()
print('=== RESULT:', 'ALL PASS' if all_pass else 'SOME FAILURES — SEE ABOVE', '===')
"
```

**Expected output:**
```
=== Backend Health Check ===
PASS 200 /health
PASS 200 /api/v1/indices
PASS 200 /api/v1/news?limit=2
PASS 200 /api/v1/stock/RELIANCE.NS
PASS 200 /portfolios/
PASS 200 /api/v1/alerts/active

=== RESULT: ALL PASS ===
```

**Pass criteria:** ALL PASS.

---

### TEST 20.3 — Test Results Summary Template

After running all sections, complete this summary:

```
FINSIGHT AI — TEST EXECUTION SUMMARY
======================================
Date: _______________
Tester: _______________

SECTION 1  — Infrastructure & Environment:     PASS / FAIL  (__/8 tests)
SECTION 2  — Backend Unit Tests:               PASS / FAIL  (__/8 tests)
SECTION 3  — Backend API Endpoint Tests:       PASS / FAIL  (__/20 tests)
SECTION 4  — Backend Data Integrity:           PASS / FAIL  (__/4 tests)
SECTION 5  — Frontend Build & Compilation:     PASS / FAIL  (__/6 tests)
SECTION 6  — Frontend API Client Layer:        PASS / FAIL  (__/4 tests)
SECTION 7  — Frontend Page Rendering:          PASS / FAIL  (__/11 tests)
SECTION 8  — Integration Tests:                PASS / FAIL  (__/5 tests)
SECTION 9  — WebSocket Tests:                  PASS / FAIL  (__/3 tests)
SECTION 10 — AI Agent Pipeline:                PASS / FAIL  (__/4 tests)
SECTION 11 — Portfolio & Database:             PASS / FAIL  (__/3 tests)
SECTION 12 — Alerts System:                    PASS / FAIL  (__/3 tests)
SECTION 13 — Error Handling & Resilience:      PASS / FAIL  (__/6 tests)
SECTION 14 — Rate Limiting:                    PASS / FAIL  (__/2 tests)
SECTION 15 — Cross-Page Navigation:            PASS / FAIL  (__/4 tests)
SECTION 16 — Data Accuracy Verification:       PASS / FAIL  (__/4 tests)
SECTION 17 — Performance & Load:               PASS / FAIL  (__/3 tests)
SECTION 18 — Security & Configuration:         PASS / FAIL  (__/4 tests)
SECTION 19 — Regression Tests:                 PASS / FAIL  (__/5 tests)
SECTION 20 — Final System Health Check:        PASS / FAIL  (__/3 tests)

TOTAL: ___/113 tests passed

CRITICAL FAILURES (must fix before production):
1. _______________
2. _______________

KNOWN ACCEPTABLE LIMITATIONS:
1. Portfolio History Chart uses mock data (no historical NAV endpoint)
2. AI Insights Cards on dashboard use mock data (static marketing content)
3. Top Movers section uses mock data (no screener endpoint)
4. No authentication system (planned for Phase 3)
5. No portfolio creation UI (must use API directly)
6. No alert creation UI (must use API directly)
```

---

*Document End — FinSight AI Testing & Verification Plan v1.0*
*Total Test Cases: 113 across 20 sections*
*Stack: Next.js 14 (TypeScript) + FastAPI (Python 3.11)*