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
