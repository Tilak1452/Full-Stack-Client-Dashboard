# FinSight AI — Known Issues & Operational Notes

> This document catalogs known bugs, technical gotchas, environment-specific issues, and operational notes that every developer must be aware of.

---

## Backend Known Issues

### 1. `pandas_datareader` Incompatibility with pandas ≥ 3.0

**Affected service:** `macro_service.py`
**Impact:** FRED macroeconomic data (10Y Treasury, CPI, Unemployment) returns hardcoded static fallback values instead of live data.

The `pandas_datareader` library has not been updated to support `pandas >= 3.0`. The import in `macro_service.py` is wrapped in a `try/except` block so the backend does not crash — it silently degrades:

```python
try:
    import pandas_datareader as pdr
    PANDAS_DATAREADER_AVAILABLE = True
except ImportError:
    PANDAS_DATAREADER_AVAILABLE = False
```

When `PANDAS_DATAREADER_AVAILABLE` is `False`, `get_macro_dashboard()` returns:
```python
{"ten_year_treasury": 4.28, "cpi": 3.2, "unemployment": 3.9, ...}
```

**Resolution path:** Either pin `pandas < 3.0` in `requirements.txt`, switch to the FRED REST API directly, or accept the static fallback values.

---

### 2. `structlog` Must Be in `requirements.txt`

**Affected file:** `ai/document_loader.py`
**Impact:** The RAG upload endpoint will crash with `ImportError: No module named 'structlog'` if structlog is not installed.

`structlog` was missing from the original `requirements.txt`. It has since been added. If you encounter this error, run:
```bash
pip install structlog
pip freeze > requirements.txt
```

---

### 3. Redis is Optional — Silent Fallback

**Affected file:** `core/cache.py`

If Redis is not running or `redis_url` is not set in `.env`, the `CacheService` silently switches to an in-memory Python dictionary. This is logged at startup:

```
WARNING: Redis is unreachable. Falling back to in-memory dictionary cache.
```

**Implications of in-memory fallback:**
- Cache is lost on every backend restart.
- Cache is not shared between multiple worker processes (if horizontal scaling is ever used).
- For development, this is perfectly acceptable.

---

### 4. `create_all()` Does NOT Add New Columns

**Affected component:** `backend/app/main.py` → `Base.metadata.create_all()`

SQLAlchemy's `create_all()` creates tables that don't exist yet. It **never** modifies existing tables — no new columns, no type changes, no index additions.

**When this matters:** Every time a new column is added to a model file (`models/holding.py`, `models/transaction.py`, etc.), that column must be manually added to the real database via an `ALTER TABLE` statement in `migrate.py`.

See `15_DATABASE_MIGRATIONS.md` for the full migration workflow.

---

### 5. Supabase Session Pooler Hangs `create_all()`

**Affected component:** `backend/app/main.py` startup sequence

The Supabase Session Pooler uses PgBouncer in transaction mode. PgBouncer cannot handle multi-statement DDL introspection queries that SQLAlchemy sends before `CREATE TABLE`. This causes the startup to hang indefinitely, failing DigitalOcean health checks.

**Fix already in place:** `main.py` detects `"pooler.supabase.com"` in `DATABASE_URL` and skips `create_all()`. Tables must exist before deploying with the pooler URL.

**For fresh setup:** Use the direct connection URL temporarily → start backend once → `create_all()` runs → switch back to pooler URL.

---

### 6. Mock Data Still in Use (Dashboard)

**Affected file:** `frontend/src/app/dashboard/page.tsx`
**Affected mock:** `frontend/src/lib/mock.ts`

Two sections of the main dashboard still use static mock data instead of live API calls:

| Section | Mock Data Source | Future Fix |
|---------|-----------------|-----------|
| Portfolio Value Area Chart | `mock.ts → portfolioHistory` | Wire to `/portfolios/{id}/summary` historical data |
| AI Insights Cards (3 items) | `mock.ts → aiInsightsData` | Wire to a new agent-powered insights endpoint |

This does not break any functionality — the dashboard works correctly. It's a known debt item.

---

### 7. Watchlist is Client-Side Only

**Affected page:** `frontend/src/app/watchlist/page.tsx`
**Storage:** `localStorage` under key `finsight_watchlist`

The watchlist has no backend persistence. Clearing browser data, using a different browser, or switching devices loses the watchlist. This is by design for the current version — a future backend `/watchlist` endpoint would enable persistence.

---

### 8. Port 8000 Conflict on Windows

When a uvicorn process crashes without releasing port 8000, the next `uvicorn` start fails with:
```
OSError: [WinError 10048] Only one usage of each socket address (protocol/network address/port) is normally permitted.
```

**Fix:**
```powershell
# Find the PID occupying port 8000
netstat -ano | findstr :8000

# Kill it (replace 12345 with actual PID)
taskkill /PID 12345 /F
```

---

### 9. `.env` Leading Spaces Issue

Lines in `.env` that start with a leading space are **silently ignored** by pydantic-settings:
```env
 LANGCHAIN_TRACING_V2=true    ← WRONG: leading space, this variable will be ignored
LANGCHAIN_TRACING_V2=true     ← CORRECT: flush with left margin
```

This is especially common when copying variables from documentation or browser interfaces that add indentation.

---

## Authentication-Specific Issues

### 10. Supabase JWT Algorithm: ES256 vs HS256

**Context:** Supabase rotated its JWT signing key from Legacy HS256 to modern ECC P-256 (`ES256`) in 2025.

**Symptom if misconfigured:** All authenticated API calls return `401 Unauthorized`. The frontend enters an infinite login redirect loop.

**Resolution:**
1. Check your Supabase project: Dashboard → Authentication → JWT Signing Keys.
2. If you see "ECC P-256 (ES256)", copy the JWK JSON and set `SUPABASE_JWT_SECRET={...json...}` in `.env`.
3. If you only see a "Legacy JWT Secret" tab, copy the plain string and set `SUPABASE_JWT_SECRET=plain-string-here`.

The backend `security.py` auto-detects the format — no code changes needed.

---

### 11. Supabase Email Confirmation Links to Localhost

**Context:** By default, Supabase sends email confirmations that redirect to `http://localhost:3000`.

**Symptom:** Mobile users or users on different machines click the confirmation link and see `ERR_CONNECTION_REFUSED`.

**Fix:** Update Supabase Dashboard → Authentication → URL Configuration → **Site URL** to your production domain (`https://finsight-app-v8wgj.ondigitalocean.app`). No code change needed.

---

### 12. `NEXT_PUBLIC_SUPABASE_ANON` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The Supabase JS client specifically looks for `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with the `_KEY` suffix). If the variable is named `NEXT_PUBLIC_SUPABASE_ANON` (missing `_KEY`), the Supabase client initializes without the anon key. Auth will appear to work in the Supabase dashboard but silently fail in the app.

Always use the exact name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Production-Specific Issues (DigitalOcean)

### 13. DigitalOcean Workers Cannot Reach IPv6 Hosts

**Context:** DigitalOcean App Platform workers are IPv4-only. The default Supabase direct connection (`db.xxx.supabase.co`) resolves to an IPv6 address.

**Symptom:** `FATAL: could not connect to server: No route to host` in backend logs.

**Fix:** Always use the **Supabase Session Pooler URL** for production:
```
postgresql+psycopg2://postgres.PROJECTREF:[PASS]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

---

### 14. Hidden Newline in DigitalOcean Environment Variables

When pasting `DATABASE_URL` (or any multiline value) into DigitalOcean's environment variable UI, an invisible newline (`\n`) can be appended to the end.

**Symptom:** `FATAL: database "postgres\n" does not exist`

**Fix:** After pasting the value, place your cursor at the end and press Backspace once or twice to ensure no trailing whitespace. Then delete and retype the last character to confirm.

---

### 15. DigitalOcean Route Stripping and `DOPathRewriteMiddleware`

DigitalOcean App Platform routes `/api/*` traffic to the FastAPI worker but strips the `/api` prefix before forwarding the request. This means FastAPI receives `/v1/indices` instead of `/api/v1/indices`.

**Fix already in place:** `main.py` registers `DOPathRewriteMiddleware` as the outermost ASGI middleware. It detects when a request path doesn't start with `/api` and re-prepends it.

This middleware is **harmless in local development** — locally, the browser sends the full `/api/v1/...` path, which already starts with `/api`, so the middleware is a no-op.

---

## TypeScript-Specific Issues (Frontend Build)

### 16. Three TypeScript Build Errors Fixed (May 1, 2026)

Three TypeScript strict-mode errors were blocking the DigitalOcean production build. All three are fixed:

| File | Error | Fix Applied |
|------|-------|------------|
| `ArtifactRenderer.tsx` | `ProgressBar` imported but export was renamed to `ShareholdingProgress` | Updated import to match the actual export name |
| `SkeletonThreeWayCompare.tsx` | Passed `w`/`h` shorthand props to `<Shimmer>` but interface requires `width`/`height` | Updated all prop names to `width` and `height` |
| `artifact-assembler.ts` | `s.compare` typed as `any[]` but accessed `.peers` property (object member, not array) | Cast to `(s.compare as any).peers` |

These fixes are present in the current codebase. They are documented here for historical awareness.

---

## Operational Checklist

When setting up a new developer environment, verify all of the following:

- [ ] Python 3.11+ installed
- [ ] `.venv` created and activated
- [ ] `pip install -r requirements.txt` completed without errors
- [ ] `.env` created from `.env.example` with real values filled in
- [ ] `SUPABASE_JWT_SECRET` format matches your Supabase project (HS256 string or JWK JSON)
- [ ] `DATABASE_URL` uses direct connection for local dev (not pooler)
- [ ] `frontend/.env.local` created with Supabase URL and anon key
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` named with `_KEY` suffix
- [ ] `npm install` completed in `frontend/`
- [ ] Backend starts at `http://localhost:8000/health` → `{"status": "ok"}`
- [ ] Frontend starts at `http://localhost:3000` → redirects to login
- [ ] Login works end-to-end (Supabase session issued, dashboard loads)
