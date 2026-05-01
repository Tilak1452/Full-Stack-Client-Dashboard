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
