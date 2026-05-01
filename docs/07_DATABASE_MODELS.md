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
