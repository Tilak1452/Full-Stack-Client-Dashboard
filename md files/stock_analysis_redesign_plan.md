# FinSight AI — Stock Analysis Page Redesign Plan
## Phase 1 (Technical Tab) + Phase 2 (Fundamental Tab)

> **CRITICAL NOTICE FOR ANY AI READING THIS:**
> This document is a precise engineering spec. Every file path, endpoint name,
> and field name must match the Gemini.md project reference EXACTLY.
> Do NOT invent endpoints, fields, or files not listed here.
> The project root is `Full-Stack-Client-Dashboard/`.

---

## TABLE OF CONTENTS

1. [What We Are Building](#1-what-we-are-building)
2. [UI Architecture — Lower Section Redesign](#2-ui-architecture--lower-section-redesign)
3. [The Interval + Period System](#3-the-interval--period-system)
4. [Smart Data Fetching Strategy](#4-smart-data-fetching-strategy)
5. [Indicator Warmup Requirements](#5-indicator-warmup-requirements)
6. [Phase 1 — Technical Tab](#6-phase-1--technical-tab)
7. [Phase 2 — Fundamental Tab](#7-phase-2--fundamental-tab)
8. [Backend Changes — File by File](#8-backend-changes--file-by-file)
9. [Frontend Changes — File by File](#9-frontend-changes--file-by-file)
10. [API Contract — New and Modified Endpoints](#10-api-contract--new-and-modified-endpoints)
11. [Constraints, Caveats, and Known Limits](#11-constraints-caveats-and-known-limits)
12. [Implementation Order](#12-implementation-order)

---

## 1. What We Are Building

The current stock detail page (`frontend/src/app/stock/[symbol]/page.tsx`) has a lower section with a simple key-financials grid and a basic technical-indicators panel. We are replacing this entire lower section with a two-tab interface:

- **Tab 1 — Technical:** 8 computed indicators + interval switcher + bullish/neutral/bearish summary + support & resistance levels
- **Tab 2 — Fundamental:** PE ratio, P/B, ROE, dividend yield, quarterly revenue/profit chart, shareholding breakdown, earnings calendar

This is broken into two phases:
- **Phase 1** (Technical tab) — zero new infrastructure. All data is derived from the existing history endpoint. No new external API calls.
- **Phase 2** (Fundamental tab) — one new backend endpoint. Calls `ticker.quarterly_financials`, `ticker.financials`, `ticker.major_holders`, `ticker.calendar` in parallel via `asyncio.gather()`. Loaded lazily on first tab click only.

---

## 2. UI Architecture — Lower Section Redesign

### 2.1 Tab Toggle Component

Replace the entire lower section of `frontend/src/app/stock/[symbol]/page.tsx` below the existing chart with this two-tab structure:

```
┌─────────────────────────────────────────────────┐
│  [ Technical ]  [ Fundamental ]                 │  ← Tab bar
├─────────────────────────────────────────────────┤
│                                                 │
│  [Active tab content renders here]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

- State variable: `activeTab: 'technical' | 'fundamental'`
- Default: `'technical'`
- The fundamental tab fires its React Query only when `activeTab === 'fundamental'` for the first time (lazy load)

### 2.2 Technical Tab Layout

```
┌──────────────────────────────────────────────────────────────┐
│  INTERVAL SWITCHER                                           │
│  [ 5m ]  [ 15m ]  [ 1h ]  [ 1d 1mo ]  [ 1d 1yr ]          │
├──────────────┬───────────────────────────────────────────────┤
│  SUMMARY     │  SUPPORT & RESISTANCE                        │
│  ● Bullish   │  S2──────S1──────[PRICE]──────R1──────R2    │
│  15 signals  │  ₹2,780  ₹2,810   ₹2,847    ₹2,880  ₹2,910 │
├──────────────┴───────────────────────────────────────────────┤
│  INDICATORS (8 cards, 2-column grid)                        │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ RSI (14)    │  │ SMA (20)    │                          │
│  │ 58.3        │  │ ₹2,810      │                          │
│  │ Neutral     │  │ Price above │                          │
│  └─────────────┘  └─────────────┘                          │
│  ... (6 more cards)                                         │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Fundamental Tab Layout

```
┌──────────────────────────────────────────────────────────────┐
│  OVERVIEW (metric cards row)                                │
│  PE: 24.8  |  P/B: 3.2  |  ROE: 18.4%  |  Div Yield: 0.8% │
│  Day High: ₹2,860  |  Day Low: ₹2,835  |  Market Cap: ₹19T │
├──────────────────────────────────────────────────────────────┤
│  REVENUE & PROFIT  (quarterly bar chart — last 8 quarters)  │
│  [ Quarterly ] [ Annual ]  ← sub-toggle                    │
│  [Chart.js bar chart: Revenue and Profit side by side]      │
├──────────────────────────────────────────────────────────────┤
│  SHAREHOLDING PATTERN  (available from yfinance)            │
│  Institutional %: 47.2%  |  Insider %: 3.1%               │
│  Float: 94.2%  |  # Institutions: 2,841                    │
│  [Horizontal bar visual for each]                           │
├──────────────────────────────────────────────────────────────┤
│  UPCOMING EVENTS  (from ticker.calendar)                    │
│  Next Earnings: Apr 18, 2026                                │
│  Expected EPS: ₹85.20 – ₹92.40                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. The Interval + Period System

### 3.1 Valid yfinance Intervals

**IMPORTANT:** yfinance does NOT support 10-minute intervals. Valid short intervals: `1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo`.

### 3.2 UI Interval Options and Their Backend Mapping

The UI shows 5 interval buttons. Each maps to a specific yfinance `interval` + `period` combination:

| UI Button Label | yfinance `interval` | yfinance `period` | Why this period |
|-----------------|---------------------|-------------------|-----------------|
| `5m`            | `5m`                | `5d`              | Yahoo keeps ~60d of 5m data; 5d gives ~390 rows — enough for all indicators |
| `15m`           | `15m`               | `15d`             | Yahoo keeps ~60d of 15m data; 15d gives ~390 rows |
| `1h`            | `60m`               | `60d`             | Yahoo keeps ~730d of 1h data; 60d gives ~420 rows |
| `1d 1mo`        | `1d`                | `6mo`             | **NOT `1mo`** — must be `6mo` to get enough rows for MACD convergence |
| `1d 1yr`        | `1d`                | `2y`              | Gives ~504 rows for long-term trend view |

**CRITICAL NOTE on `1d 1mo` vs `1d 1yr`:**
Both use the `1d` interval. The difference is purely how many rows are returned and what the chart displays. The backend call differs only in `period`. The frontend sends `interval=1d&period=6mo` or `interval=1d&period=2y`.

### 3.3 Why We Never Use `period=1mo` Anymore

With `period=1mo` and `interval=1d`, yfinance returns ~22 rows. MACD requires 35 rows minimum to produce ANY output (returns NaN for all rows), and 100 rows to converge accurately. This means the current codebase is silently returning wrong/null MACD values. The fix is `period=6mo` everywhere for daily intervals.

---

## 4. Smart Data Fetching Strategy

### 4.1 The Core Principle

Do NOT fetch the maximum allowed data for every interval. Fetch the MINIMUM needed to:
1. Satisfy the warmup period for the most demanding indicator (MACD: 35 rows minimum, 100 rows to converge)
2. Leave enough rows for a readable chart (target: ~150–300 visible bars after `dropna()`)

### 4.2 Row Requirements Per Indicator

| Indicator | Minimum rows (any output) | Rows for full convergence |
|-----------|--------------------------|---------------------------|
| RSI (14)  | 14                       | 28                        |
| SMA (20)  | 20                       | 20                        |
| EMA (20)  | 20                       | 40                        |
| MACD (12,26,9) | **35**             | **100**                   |
| Bollinger Bands (20) | 20          | 20                        |
| Stochastic (14,3) | 17            | 25                        |
| ATR (14)  | 14                       | 28                        |
| MFI (14)  | 14                       | 14                        |
| **Worst case (MACD)** | **35** | **100**               |

**Rule:** Always fetch enough rows so that after `df.dropna()`, at least 100 rows remain. This ensures MACD is converged and all other indicators are fully valid.

### 4.3 Smart Fetch Matrix

This is the exact mapping to use in the backend `get_historical_data()` call:

| UI Interval | `interval` param | `period` param | Expected raw rows | Rows after dropna() | Chart display bars |
|-------------|-----------------|----------------|-------------------|--------------------|--------------------|
| `5m`        | `5m`            | `5d`           | ~390              | ~355               | ~355 (zoom-ready)  |
| `15m`       | `15m`           | `15d`          | ~390              | ~355               | ~355               |
| `1h`        | `60m`           | `60d`          | ~420              | ~385               | ~385               |
| `1d 1mo`    | `1d`            | `6mo`          | ~126              | ~91                | ~91 (last 3mo visible) |
| `1d 1yr`    | `1d`            | `2y`           | ~504              | ~469               | ~469               |

**Why this is efficient:** For `5m`, fetching `5d` instead of `60d` means ~390 rows vs ~4,680 rows. That is 12× less data to download, transfer, and compute on. The user still gets a fully converged MACD. If they want more historical context, they can switch to `1h` or `1d` views.

### 4.4 When User Switches Intervals

The frontend sends a new request with the new `interval` + `period` params. React Query caches by query key `['stock-history', symbol, interval, period]`. Switching back to a previously loaded interval is instant (cache hit, no re-fetch within 30-second `staleTime`).

---

## 5. Indicator Warmup Requirements

### 5.1 What Warmup Means

Every indicator needs a minimum number of rows before it can produce a number. Before that threshold, pandas-ta returns `NaN`. These NaN rows must be stripped before the response is returned.

The fix is always `df.dropna()` applied after computing all indicators.

### 5.2 The 8 Indicators We Compute

All computed using `pandas-ta` library (add `pandas-ta` to `requirements.txt`):

```python
import pandas_ta as ta

def compute_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df.ta.rsi(length=14, append=True)          # → RSI_14
    df.ta.sma(length=20, append=True)          # → SMA_20
    df.ta.ema(length=20, append=True)          # → EMA_20
    df.ta.macd(fast=12, slow=26, signal=9, append=True)  # → MACD_12_26_9, MACDs_12_26_9, MACDh_12_26_9
    df.ta.bbands(length=20, append=True)       # → BBL_20, BBM_20, BBU_20, BBB_20, BBP_20
    df.ta.stoch(k=14, d=3, append=True)       # → STOCHk_14_3_3, STOCHd_14_3_3
    df.ta.atr(length=14, append=True)         # → ATRr_14
    df.ta.mfi(length=14, append=True)         # → MFI_14
    df = df.dropna()                          # Strip warmup NaN rows
    return df
```

### 5.3 Support & Resistance (Pivot Points)

Computed from the last completed candle's OHLC values. Pure math, no extra data needed:

```python
def compute_pivot_points(df: pd.DataFrame) -> dict:
    last = df.iloc[-2]  # Use second-to-last (last completed candle, not current)
    H, L, C = last['High'], last['Low'], last['Close']
    pivot = (H + L + C) / 3
    return {
        "pivot": round(pivot, 2),
        "s1": round(2 * pivot - H, 2),
        "s2": round(pivot - (H - L), 2),
        "r1": round(2 * pivot - L, 2),
        "r2": round(pivot + (H - L), 2),
    }
```

### 5.4 Technical Summary Score (Bullish/Neutral/Bearish)

Computed from the indicator values — no API call:

```python
def compute_summary(row: pd.Series, current_price: float) -> dict:
    signals = []
    # RSI
    rsi = row.get('RSI_14')
    if rsi: signals.append('bullish' if rsi < 40 else 'bearish' if rsi > 60 else 'neutral')
    # Price vs SMA
    sma = row.get('SMA_20')
    if sma: signals.append('bullish' if current_price > sma else 'bearish')
    # Price vs EMA
    ema = row.get('EMA_20')
    if ema: signals.append('bullish' if current_price > ema else 'bearish')
    # MACD histogram direction
    macdh = row.get('MACDh_12_26_9')
    if macdh: signals.append('bullish' if macdh > 0 else 'bearish')
    # Stochastic
    stochk = row.get('STOCHk_14_3_3')
    if stochk: signals.append('bullish' if stochk < 20 else 'bearish' if stochk > 80 else 'neutral')
    
    bullish = signals.count('bullish')
    bearish = signals.count('bearish')
    verdict = 'BULLISH' if bullish > bearish else 'BEARISH' if bearish > bullish else 'NEUTRAL'
    return {"verdict": verdict, "bullish": bullish, "bearish": bearish, "neutral": signals.count('neutral')}
```

---

## 6. Phase 1 — Technical Tab

### 6.1 Scope

- Zero new external API calls
- One modified backend endpoint (history endpoint returns more data + indicators)
- One new backend endpoint for technical analysis enrichment (computed from existing data)
- Frontend: interval switcher + 8 indicator cards + summary gauge + S&R bar

### 6.2 What Changes in the Backend

**Modified:** `backend/app/api/stock.py` — The existing `GET /api/v1/stock/{symbol}/history` endpoint currently accepts `period` and `interval` as query params and calls `stock_service.get_historical_data()`. We modify it to:
1. Accept the same params as before
2. Also accept a new optional query param `include_indicators: bool = False`
3. When `include_indicators=True`, call `compute_all_indicators()` on the DataFrame before returning, also compute `pivot_points` and `summary`
4. Add `pandas-ta` import to `backend/app/services/indicators.py`

**Why not a separate endpoint?** Because the indicator computation REQUIRES the same OHLCV data. Making it separate would mean two yfinance calls for the same data, doubling latency. Computing everything in one call is the correct approach.

### 6.3 New Response Shape for History Endpoint (with indicators)

When `include_indicators=True`:

```json
{
  "symbol": "RELIANCE.NS",
  "interval": "1d",
  "period": "6mo",
  "candles": [
    {
      "timestamp": "2025-10-14T00:00:00Z",
      "open": 2801.50,
      "high": 2860.00,
      "low": 2795.20,
      "close": 2847.50,
      "volume": 4210000,
      "rsi": 58.3,
      "sma": 2810.50,
      "ema": 2825.30,
      "macd": 12.4,
      "macd_signal": 9.8,
      "macd_hist": 2.6,
      "bb_upper": 2910.20,
      "bb_middle": 2810.50,
      "bb_lower": 2710.80,
      "stoch_k": 68.4,
      "stoch_d": 62.1,
      "atr": 34.2,
      "mfi": 61.5
    }
  ],
  "latest_indicators": {
    "rsi": 58.3,
    "sma": 2810.50,
    "ema": 2825.30,
    "macd": 12.4,
    "macd_signal": 9.8,
    "macd_hist": 2.6,
    "bb_upper": 2910.20,
    "bb_middle": 2810.50,
    "bb_lower": 2710.80,
    "stoch_k": 68.4,
    "stoch_d": 62.1,
    "atr": 34.2,
    "mfi": 61.5
  },
  "pivot_points": {
    "pivot": 2834.17,
    "s1": 2808.33,
    "s2": 2782.17,
    "r1": 2860.33,
    "r2": 2886.17
  },
  "summary": {
    "verdict": "BULLISH",
    "bullish": 3,
    "bearish": 1,
    "neutral": 1
  }
}
```

### 6.4 Indicator Card Definitions (what to show per card)

| Indicator | Primary value displayed | Interpretation label logic |
|-----------|------------------------|---------------------------|
| RSI (14) | `58.3` | `< 30` → Oversold (Bullish) · `30–70` → Neutral · `> 70` → Overbought (Bearish) |
| SMA (20) | `₹2,810` | Price vs SMA: `price > sma` → Bullish · `price < sma` → Bearish |
| EMA (20) | `₹2,825` | Same logic as SMA |
| MACD | `12.4` (MACD line) | `macd > signal` → Bullish · `macd < signal` → Bearish · show histogram direction |
| Bollinger Bands | `₹2,910 / ₹2,811 / ₹2,711` | `price > upper` → Overbought · `price < lower` → Oversold · otherwise Neutral |
| Stochastic | `%K: 68.4 / %D: 62.1` | `< 20` → Oversold · `> 80` → Overbought · otherwise Neutral |
| ATR (14) | `₹34.2` | Volatility gauge: no bullish/bearish, show "High/Medium/Low volatility" relative to price % |
| MFI (14) | `61.5` | `< 20` → Oversold · `> 80` → Overbought · otherwise Neutral |

---

## 7. Phase 2 — Fundamental Tab

### 7.1 Scope

- One NEW backend endpoint: `GET /api/v1/stock/{symbol}/fundamentals`
- Uses `asyncio.gather()` to fetch 4 yfinance data sources in parallel
- Frontend: lazy-loaded on first tab click, cached by React Query

### 7.2 New Endpoint — `GET /api/v1/stock/{symbol}/fundamentals`

**File to create:** `backend/app/api/` — add to the existing `backend/app/api/stock.py` file as a new route.

**Backend logic using `asyncio.gather()`:**

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def get_fundamentals(symbol: str):
    loop = asyncio.get_event_loop()
    ticker = yf.Ticker(symbol)
    
    with ThreadPoolExecutor() as pool:
        quarterly_fin, annual_fin, holders, calendar = await asyncio.gather(
            loop.run_in_executor(pool, lambda: ticker.quarterly_financials),
            loop.run_in_executor(pool, lambda: ticker.financials),
            loop.run_in_executor(pool, lambda: ticker.major_holders),
            loop.run_in_executor(pool, lambda: ticker.calendar),
        )
    # Parse and return structured response
```

**Important:** yfinance calls are synchronous (blocking). They MUST be wrapped in `loop.run_in_executor()` to work with `asyncio.gather()`. Do NOT call them directly in an async function.

### 7.3 Fundamentals Endpoint Response Shape

```json
{
  "symbol": "RELIANCE.NS",
  "overview": {
    "pe_ratio": 24.8,
    "pb_ratio": 3.2,
    "roe": 0.184,
    "dividend_yield": 0.008,
    "market_cap": 19280000000000,
    "day_high": 2860.00,
    "day_low": 2835.00,
    "52_week_high": 3024.90,
    "52_week_low": 2220.30,
    "beta": 0.92,
    "book_value": 890.20,
    "earnings_per_share": 114.6
  },
  "quarterly_financials": [
    {
      "period": "Dec 2024",
      "total_revenue": 11219400000000,
      "net_income": 1765700000000
    }
  ],
  "annual_financials": [
    {
      "period": "FY2024",
      "total_revenue": 43980000000000,
      "net_income": 6794000000000
    }
  ],
  "shareholding": {
    "pct_held_by_institutions": 0.4720,
    "pct_held_by_insiders": 0.0310,
    "float_shares_pct": 0.9420,
    "number_of_institutions": 2841
  },
  "calendar": {
    "next_earnings_date": "2026-04-18",
    "earnings_low": 85.20,
    "earnings_high": 92.40,
    "revenue_low": null,
    "revenue_high": null
  }
}
```

**Data sourcing note:** `overview` fields come from `ticker.info` dict (already fetched in existing `/stock/{symbol}` endpoint — can be cached or re-fetched). The fields `pe_ratio`, `pb_ratio`, `roe`, `dividendYield`, `marketCap`, `dayHigh`, `dayLow`, `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `beta`, `bookValue`, `trailingEps` are all standard `ticker.info` keys.

### 7.4 What IS and IS NOT Available from yfinance for Indian Stocks

| Data Point | yfinance Key | Available for `.NS` stocks | Notes |
|------------|-------------|---------------------------|-------|
| P/E ratio | `ticker.info['trailingPE']` | Yes | |
| P/B ratio | `ticker.info['priceToBook']` | Yes | |
| ROE | `ticker.info['returnOnEquity']` | Yes (sometimes null) | |
| Dividend yield | `ticker.info['dividendYield']` | Yes | |
| Quarterly revenue | `ticker.quarterly_financials` | Yes | |
| Annual revenue | `ticker.financials` | Yes | |
| Institutional % | `ticker.major_holders` | Yes | 4 rows |
| Next earnings date | `ticker.calendar` | Yes | |
| Promoter/FII/DII/Retail | Not in yfinance | **NO** | BSE filing data only |
| Product-wise revenue split | Not in yfinance | **NO** | Requires paid API |
| AGM/E-voting events | Not in yfinance | **NO** | BSE announcements |

### 7.5 Frontend Lazy Load Pattern

In `frontend/src/app/stock/[symbol]/page.tsx`:

```typescript
// Only fires when the fundamental tab is first clicked
const {
  data: fundamentals,
  isLoading: fundamentalsLoading,
} = useQuery({
  queryKey: ['stock-fundamentals', symbol],
  queryFn: () => stockApi.getFundamentals(symbol),
  enabled: activeTab === 'fundamental',   // KEY: lazy load
  staleTime: 5 * 60_000,                 // Cache for 5 minutes (financials don't change by the second)
});
```

Add `getFundamentals(symbol: string)` to `frontend/src/lib/stock.api.ts`:

```typescript
getFundamentals: (symbol: string) =>
  apiFetch<FundamentalsResponse>(`/api/v1/stock/${symbol}/fundamentals`)
```

---

## 8. Backend Changes — File by File

### 8.1 `requirements.txt` (project root)

Add one line:
```
pandas-ta
```

### 8.2 `backend/app/services/indicators.py`

**Current state:** Contains manual RSI, SMA, EMA implementations.

**New state:** Replace manual calculations with pandas-ta. Keep the existing function signatures as wrappers if other parts of the code call them, but internally delegate to pandas-ta. Add:
- `compute_all_indicators(df: pd.DataFrame) -> pd.DataFrame`
- `compute_pivot_points(df: pd.DataFrame) -> dict`
- `compute_summary(latest_row: pd.Series, current_price: float) -> dict`

### 8.3 `backend/app/services/stock_service.py`

**Modify `get_historical_data()`:**
- Change default `period` from `"1mo"` to the value passed in by the caller (no hardcoded default override)
- Add optional `include_indicators: bool = False` parameter
- When `True`, call `compute_all_indicators(df)` before building the response
- Always call `df = df.dropna()` after computing indicators (strips warmup NaN rows)
- Build `latest_indicators`, `pivot_points`, `summary` from the final clean DataFrame
- The candle list should include all indicator columns per row (for chart overlays)

**Add `get_fundamentals()` async method:**
- Takes `symbol: str`
- Uses `asyncio.gather()` with `run_in_executor()` for 4 parallel yfinance calls
- Returns structured dict matching the fundamentals response shape above
- Wrap each yfinance call in a try/except — some fields are null for some Indian stocks

### 8.4 `backend/app/api/stock.py`

**Modify existing history route:**
```python
@router.get("/api/v1/stock/{symbol}/history")
async def get_stock_history(
    symbol: str,
    period: str = "6mo",        # Changed default from "1mo" to "6mo"
    interval: str = "1d",
    include_indicators: bool = False,
):
```

**Add new fundamentals route:**
```python
@router.get("/api/v1/stock/{symbol}/fundamentals")
async def get_stock_fundamentals(symbol: str):
    data = await stock_service.get_fundamentals(symbol)
    return data
```

### 8.5 `backend/app/schemas/stock.py`

Add new Pydantic models:
- `CandleData` — single candle row with all indicator fields as `Optional[float]`
- `PivotPoints` — s2, s1, pivot, r1, r2
- `TechnicalSummary` — verdict, bullish, bearish, neutral counts
- `EnrichedHistoryResponse` — candles list + latest_indicators + pivot_points + summary
- `FundamentalsOverview` — all overview fields
- `QuarterlyFinancial` — period, total_revenue, net_income
- `ShareholdingData` — institutional %, insider %, float %, count
- `EarningsCalendar` — next_earnings_date, earnings_low, earnings_high
- `FundamentalsResponse` — all of the above nested

---

## 9. Frontend Changes — File by File

### 9.1 `frontend/src/lib/stock.api.ts`

Add two new methods to `stockApi`:
```typescript
getHistoryWithIndicators: (symbol: string, interval: string, period: string) =>
  apiFetch<EnrichedHistoryResponse>(
    `/api/v1/stock/${symbol}/history?interval=${interval}&period=${period}&include_indicators=true`
  ),

getFundamentals: (symbol: string) =>
  apiFetch<FundamentalsResponse>(`/api/v1/stock/${symbol}/fundamentals`),
```

### 9.2 `frontend/src/app/stock/[symbol]/page.tsx`

**State additions:**
```typescript
const [activeTab, setActiveTab] = useState<'technical' | 'fundamental'>('technical');
const [activeInterval, setActiveInterval] = useState<IntervalOption>(INTERVALS[3]); // default: 1d 1mo
```

**Interval config object:**
```typescript
const INTERVALS = [
  { label: '5m',      interval: '5m',  period: '5d'  },
  { label: '15m',     interval: '15m', period: '15d' },
  { label: '1h',      interval: '60m', period: '60d' },
  { label: '1d 1mo',  interval: '1d',  period: '6mo' },
  { label: '1d 1yr',  interval: '1d',  period: '2y'  },
] as const;
```

**React Query hook for technical data:**
```typescript
const { data: technicalData, isLoading: techLoading } = useQuery({
  queryKey: ['stock-history-indicators', symbol, activeInterval.interval, activeInterval.period],
  queryFn: () => stockApi.getHistoryWithIndicators(symbol, activeInterval.interval, activeInterval.period),
  staleTime: 30_000,
  enabled: activeTab === 'technical',
});
```

**React Query hook for fundamentals:**
```typescript
const { data: fundamentals, isLoading: fundLoading } = useQuery({
  queryKey: ['stock-fundamentals', symbol],
  queryFn: () => stockApi.getFundamentals(symbol),
  enabled: activeTab === 'fundamental',
  staleTime: 5 * 60_000,
});
```

### 9.3 New Component Files to Create

Create these in `frontend/src/components/`:

| File | Purpose |
|------|---------|
| `TechnicalTab.tsx` | Container for the entire technical tab content |
| `FundamentalTab.tsx` | Container for the entire fundamental tab content |
| `IndicatorCard.tsx` | Single indicator card (name, value, interpretation badge) |
| `SupportResistanceBar.tsx` | Visual S/R bar with S2, S1, Pivot, R1, R2 + current price marker |
| `TechnicalSummaryGauge.tsx` | Bullish/Neutral/Bearish indicator count display |
| `FinancialsChart.tsx` | Chart.js bar chart for quarterly/annual revenue+profit |
| `ShareholdingBar.tsx` | Horizontal bar visual for shareholding data |

---

## 10. API Contract — New and Modified Endpoints

### 10.1 Modified Endpoint

```
GET /api/v1/stock/{symbol}/history
```

| Param | Type | Default | Values |
|-------|------|---------|--------|
| `period` | string | `6mo` | `5d`, `15d`, `60d`, `6mo`, `2y` |
| `interval` | string | `1d` | `5m`, `15m`, `60m`, `1d` |
| `include_indicators` | bool | `false` | `true`, `false` |

When `include_indicators=false`: returns existing candle format (no change to current behavior).
When `include_indicators=true`: returns enriched format with all 8 indicators per candle + `latest_indicators` + `pivot_points` + `summary`.

### 10.2 New Endpoint

```
GET /api/v1/stock/{symbol}/fundamentals
```

No query params. Returns `FundamentalsResponse`. Expected latency: ~2.0–3.0s (4 parallel yfinance calls). Register this route in `backend/app/main.py` — it uses the same `stock.router` already registered, no new router needed.

---

## 11. Constraints, Caveats, and Known Limits

### 11.1 Data Availability

1. **10-minute interval does not exist** in yfinance. If the user requests it via UI, map it to `15m` or reject. The UI should not offer a `10m` button.

2. **1-minute data is capped at 7 days** by Yahoo Finance. The UI `1m` button (if added in future) should show a note: "Last 7 days only."

3. **Indian stock symbols require `.NS` suffix** for NSE (e.g., `RELIANCE.NS`) or `.BO` for BSE. The backend should already handle this.

4. **Promoter/FII/DII shareholding is NOT available** from yfinance for Indian stocks. This is SEBI regulatory filing data stored only in BSE/NSE systems. Do NOT attempt to fake this data. Show only what yfinance provides (`major_holders`): institutional %, insider %, float shares %.

5. **Some fundamental fields will be `null`** for certain Indian stocks (especially mid/small cap). All fundamental response fields must be `Optional` in Pydantic schemas. The frontend must handle null values gracefully (show `—` instead of crashing).

### 11.2 Latency Expectations

| Action | Expected Latency |
|--------|-----------------|
| Initial page load (technical tab default) | ~1.5s (same as today) |
| Switching interval (cache miss) | ~1.5s |
| Switching interval (cache hit, <30s) | ~0ms |
| First click on Fundamental tab | ~2.5–3.5s |
| Subsequent clicks on Fundamental tab | ~0ms (React Query cache) |
| Technical indicators computation | ~30–50ms (pandas-ta, in-memory) |
| Support & Resistance computation | ~1ms (pure math) |

### 11.3 Error Handling

- If `ticker.quarterly_financials` returns an empty DataFrame (common for some NSE stocks): return empty array `[]` for that section, do not 500.
- If `ticker.calendar` returns None: return null for all calendar fields.
- If `compute_all_indicators()` fails for any reason: fall back to returning the raw candles without indicators and log the error. Do not crash the endpoint.
- Circuit breaker in `backend/app/core/circuit_breaker.py` already handles yfinance failures for current endpoints. Apply the same pattern to `get_fundamentals()`.

### 11.4 pandas-ta Column Name Reference

After calling `df.ta.X(append=True)`, the exact column names added are:

| Call | Column name(s) added |
|------|---------------------|
| `df.ta.rsi(length=14)` | `RSI_14` |
| `df.ta.sma(length=20)` | `SMA_20` |
| `df.ta.ema(length=20)` | `EMA_20` |
| `df.ta.macd(fast=12, slow=26, signal=9)` | `MACD_12_26_9`, `MACDs_12_26_9`, `MACDh_12_26_9` |
| `df.ta.bbands(length=20)` | `BBL_20_2.0`, `BBM_20_2.0`, `BBU_20_2.0`, `BBB_20_2.0`, `BBP_20_2.0` |
| `df.ta.stoch(k=14, d=3)` | `STOCHk_14_3_3`, `STOCHd_14_3_3` |
| `df.ta.atr(length=14)` | `ATRr_14` |
| `df.ta.mfi(length=14)` | `MFI_14` |

Note: Bollinger Band column names include the std dev suffix `_2.0`. Access them as `df['BBU_20_2.0']`, not `df['BBU_20']`.

---

## 12. Implementation Order

Execute in this exact order to avoid breaking existing functionality:

### Step 1 — Add pandas-ta (5 minutes)
```bash
# In active venv from project root:
pip install pandas-ta
# Add "pandas-ta" to requirements.txt
```
Verify: `python -c "import pandas_ta; print('OK')"` — should print OK.

### Step 2 — Modify `indicators.py` (backend)
Add `compute_all_indicators()`, `compute_pivot_points()`, `compute_summary()` functions. Keep existing RSI/SMA/EMA functions to avoid breaking anything that calls them.

### Step 3 — Modify `stock_service.py` (backend)
Update `get_historical_data()` to accept `include_indicators` param. Add `get_fundamentals()` async method.

### Step 4 — Modify `stock.py` API route (backend)
Update history route signature. Add fundamentals route.

### Step 5 — Add Pydantic schemas (backend)
Add new schemas to `backend/app/schemas/stock.py`.

### Step 6 — Test backend endpoints
```bash
# Test technical (verify no NaN in response):
curl "http://localhost:8000/api/v1/stock/RELIANCE.NS/history?period=6mo&interval=1d&include_indicators=true"

# Test fundamentals:
curl "http://localhost:8000/api/v1/stock/RELIANCE.NS/fundamentals"
```

### Step 7 — Update `stock.api.ts` (frontend)
Add `getHistoryWithIndicators()` and `getFundamentals()` methods.

### Step 8 — Build new components (frontend)
Build in this sub-order: `IndicatorCard` → `SupportResistanceBar` → `TechnicalSummaryGauge` → `TechnicalTab` → `FinancialsChart` → `ShareholdingBar` → `FundamentalTab`.

### Step 9 — Integrate into `stock/[symbol]/page.tsx`
Replace the lower section with the two-tab structure. Add interval state and the two React Query hooks.

### Step 10 — Test end-to-end
- Switch all 5 intervals on the Technical tab
- Click Fundamental tab (verify ~2.5s load, single network call)
- Click back to Technical (instant)
- Click Fundamental again (instant — cached)
- Test with a stock that might have null fundamentals (e.g. a mid-cap NSE stock)

---

*End of plan. This document supersedes any previous discussion about the stock page redesign. Implement exactly as specified. When in doubt, refer to Gemini.md for file paths and existing patterns.*
