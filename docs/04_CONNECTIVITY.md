# FinSight AI — Frontend ↔ Backend Connectivity

> This document explains the communication model between the Next.js frontend and the FastAPI backend in both local development and production environments.

---

## Overview

The frontend and backend are **completely separate processes** that communicate exclusively over the network:
- **HTTP REST** for all data fetching, CRUD operations, and AI requests.
- **WebSocket** for live real-time price streaming.

There is no shared memory, no server-side rendering of backend data (Next.js calls the API via client-side fetch, not server actions), and no direct database access from the frontend.

---

## Local Development Architecture

```
┌─────────────────────────────┐         HTTP / WebSocket          ┌─────────────────────────────┐
│     Next.js Frontend        │ ◄──────────────────────────────► │     FastAPI Backend         │
│     localhost:3000          │                                    │     localhost:8000          │
│                             │  GET /api/v1/indices               │                             │
│  React components           │  GET /api/v1/stock/RELIANCE.NS     │  Python services            │
│  call apiFetch()            │  POST /api/v1/agent/chat           │  yFinance + Supabase        │
│  or useQuery()              │  WS /api/v1/stream/price/INFY.NS   │  OpenRouter LLMs            │
│                             │                                    │                             │
└─────────────────────────────┘                                    └─────────────────────────────┘
                  │                                                              │
                  │ Supabase Auth (login/signup/session)                        │ Supabase PostgreSQL
                  ▼                                                              ▼
     ┌─────────────────────────┐                              ┌────────────────────────────────┐
     │  Supabase GoTrue        │                              │  Supabase PostgreSQL           │
     │  (Auth service)         │                              │  portfolios, holdings,         │
     │  Issues JWTs            │                              │  transactions, alerts tables   │
     └─────────────────────────┘                              └────────────────────────────────┘
```

---

## Production Architecture (DigitalOcean App Platform)

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│         DigitalOcean App Platform                                                         │
│         https://finsight-app-v8wgj.ondigitalocean.app                                    │
│                                                                                           │
│   ┌──────────────────────────────────┐   ┌──────────────────────────────────────────┐   │
│   │  Next.js Frontend Component      │   │  FastAPI Backend Component               │   │
│   │  Route: /  (all non-/api paths)  │   │  Route: /api  (all /api/* paths)         │   │
│   │  Type: Static + SSR build        │   │  Type: Python worker                     │   │
│   │                                  │   │  Port: 8080                              │   │
│   └──────────────────────────────────┘   └──────────────────────────────────────────┘   │
│                                                          │                               │
└──────────────────────────────────────────────────────────│───────────────────────────────┘
                                                           │
                                                           ▼
                                        ┌──────────────────────────────────────┐
                                        │  Supabase Session Pooler             │
                                        │  (PgBouncer, transaction mode)       │
                                        │  aws-1-ap-southeast-1.pooler.        │
                                        │  supabase.com:5432                   │
                                        │  IPv4 — required for DigitalOcean    │
                                        └──────────────────────────────────────┘
```

---

## How API Calls Work Step-by-Step

### 1. Frontend Makes an API Request

Every API call goes through `frontend/src/lib/api-client.ts`:

```typescript
// Reads NEXT_PUBLIC_API_URL from env; falls back to http://127.0.0.1:8000 for local dev
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>
```

**What `apiFetch()` does on every call:**
1. Retrieves the current Supabase session via `supabase.auth.getSession()` to get the JWT access token.
2. Falls back to `localStorage` for the token if the Supabase session is unavailable.
3. Constructs the full URL: `BASE_URL + endpoint`.
4. Sets `Content-Type: application/json` and `Authorization: Bearer <token>` headers.
5. If the response is `401 Unauthorized`: auto-signs out via Supabase and redirects to `/auth/login`.
6. If the response is any other non-2xx: throws an `ApiError(status, detail)` instance.
7. Returns the parsed JSON response body typed as `T`.

### 2. Request Arrives at the Backend

In production, DigitalOcean routes all `/api/*` requests to the FastAPI worker. However, DigitalOcean **strips the `/api` prefix** before forwarding the request to FastAPI.

To compensate, `main.py` registers `DOPathRewriteMiddleware` as the outermost ASGI middleware. This middleware inspects every incoming path and, if it does NOT start with `/api`, re-prepends `/api` before passing the request to FastAPI's router.

```
Browser sends:  GET https://finsight-app-v8wgj.ondigitalocean.app/api/v1/indices
DigitalOcean routes to FastAPI and strips prefix: GET /v1/indices (arrives at FastAPI)
DOPathRewriteMiddleware re-prepends:              GET /api/v1/indices (FastAPI routes correctly)
```

### 3. Backend Verifies Authentication

For protected endpoints, FastAPI uses `Depends(get_current_user)` in the route definition. This:
1. Extracts the `Authorization: Bearer <token>` header from the request.
2. Calls `decode_access_token()` in `core/security.py`.
3. Auto-detects the JWT algorithm: if `SUPABASE_JWT_SECRET` starts with `{`, treats it as JWK JSON (ES256); otherwise treats it as a plain HS256 string.
4. Calls `jwt.get_unverified_header()` to read the `alg` field from the token, then verifies the signature with the matching key format.
5. Returns the user's UUID (`sub` claim) and email from the verified payload.
6. If verification fails: raises `HTTPException(401)`.

### 4. Backend Returns Response

The route handler calls the appropriate service(s), formats the response into a Pydantic schema, and returns it as JSON. FastAPI serializes Pydantic models to JSON automatically.

---

## WebSocket Connection Flow

Live stock price streaming uses a WebSocket connection managed by `frontend/src/lib/useWebSocketPrice.ts`:

```typescript
// Reads NEXT_PUBLIC_WS_URL from env; falls back to ws://127.0.0.1:8000 for local dev
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";

function useWebSocketPrice(symbol: string | null): {
  price: number | null;
  connected: boolean;
  error: string | null;
}
```

**Connection lifecycle:**
1. When `symbol` changes, the hook closes any existing WebSocket and opens a new one to `{WS_BASE}/api/v1/stream/price/{symbol}`.
2. The backend `stream.py` handler polls yFinance every 5 seconds and pushes JSON: `{"symbol": "INFY.NS", "price": 1825.60, "timestamp": "..."}`.
3. The hook updates `price` state on each message, causing the stock detail page to re-render with the latest price.
4. On component unmount (user navigates away), the hook calls `ws.close()` to clean up the connection.

---

## CORS Configuration

The backend's CORS middleware is configured with `allow_origins=["*"]` to permit all origins. This is intentional for a dashboard application where the frontend domain may vary between development and production environments.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Error Handling

| Scenario | What Happens |
|----------|-------------|
| Backend is not running (local dev) | `apiFetch()` catches `TypeError: Failed to fetch`. The UI shows an error state with a retry button. |
| JWT expired or invalid | Backend returns `401`. `apiFetch()` calls `supabase.auth.signOut()` and redirects to `/auth/login`. |
| Rate limit exceeded | Backend returns `429`. `apiFetch()` throws `ApiError(429, "Too many requests")`. UI shows error. |
| Backend validation error | Backend returns `422`. `apiFetch()` throws `ApiError(422, details)`. |
| Unexpected backend crash | Backend returns `500`. `apiFetch()` throws `ApiError(500, "Internal server error")`. |

---

## Environment Variable Summary

| Variable | Used By | Required | Purpose |
|----------|---------|----------|---------|
| `NEXT_PUBLIC_API_URL` | `api-client.ts` | Yes (production) | Base URL for all HTTP API calls |
| `NEXT_PUBLIC_WS_URL` | `useWebSocketPrice.ts` | Yes (production) | Base URL for WebSocket connections |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase.ts` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase.ts` | Yes | Supabase public anon key |
| `DATABASE_URL` | `core/database.py` | Yes | SQLAlchemy PostgreSQL connection string |
| `SUPABASE_JWT_SECRET` | `core/security.py` | Yes | JWT signature verification secret |
