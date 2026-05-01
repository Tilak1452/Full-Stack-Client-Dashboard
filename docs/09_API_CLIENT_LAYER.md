# FinSight AI — API Client Layer (Frontend → Backend)

> This document covers all frontend API modules, the base fetch wrapper, the Supabase client, auth context, the WebSocket hook, utility functions, and the artifact type system.

---

## Base Fetch Wrapper — `api-client.ts`

**Location:** `frontend/src/lib/api-client.ts`

All HTTP communication with the FastAPI backend goes through `apiFetch()`. No component or API module should call `fetch()` directly.

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>
```

### What `apiFetch()` Does

1. Reads `NEXT_PUBLIC_API_URL` from the environment. Falls back to `http://127.0.0.1:8000` for local development.
2. Calls `supabase.auth.getSession()` to get the current JWT access token. Falls back to checking `localStorage` for a token if Supabase returns no session.
3. Constructs the full URL: `BASE_URL + endpoint`.
4. Sets default headers: `Content-Type: application/json` and `Authorization: Bearer <token>`.
5. Merges caller-provided `options` (body, method, additional headers).
6. Calls `fetch()` and awaits the response.
7. If status is `401`: calls `supabase.auth.signOut()` and redirects to `/auth/login`.
8. If status is any other non-2xx: throws `ApiError(response.status, detail_from_body)`.
9. Returns the parsed JSON response as type `T`.

### `ApiError` Class

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(`API Error ${status}: ${detail}`);
  }
}
```

Used in component-level `try/catch` blocks to distinguish network/API errors from unexpected JavaScript errors.

---

## Supabase Client — `supabase.ts`

**Location:** `frontend/src/lib/supabase.ts`

Creates and exports a singleton Supabase JavaScript client:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

This client is used:
- In `auth.api.ts` for all authentication operations.
- In `api-client.ts` to retrieve the current session JWT.
- In `auth-context.tsx` to listen for auth state changes.

> **Security:** The `ANON_KEY` is safe to expose in the browser — it has row-level security (RLS) applied in Supabase. Never use the `service_role` key in the frontend.

---

## Auth Context — `auth-context.tsx`

**Location:** `frontend/src/lib/auth-context.tsx`

Provides a React context (`AuthContext`) that makes the current Supabase session available to all components without prop drilling.

```typescript
interface AuthContextValue {
  user: User | null;         // Supabase user object (null if not logged in)
  session: Session | null;   // Full Supabase session (contains access_token)
  loading: boolean;          // True while initial session check is in progress
}
```

The `AuthProvider` component:
1. Calls `supabase.auth.getSession()` on mount to load the initial session.
2. Subscribes to `supabase.auth.onAuthStateChange()` to reactively update state when the user logs in, logs out, or the token refreshes.
3. Sets `loading = false` once the initial check is complete.

**Usage in components:**
```typescript
const { user, loading } = useAuth();  // useAuth() is the context consumer hook
```

---

## Auth API — `auth.api.ts`

**Location:** `frontend/src/lib/auth.api.ts`

Wraps Supabase Auth operations. Does NOT call the FastAPI backend directly.

```typescript
export const authApi = {
  // Login with email + password
  login: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  // Register new user with email + password
  register: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  // Sign out current user
  logout: () => supabase.auth.signOut(),

  // Get current user object
  getUser: () => supabase.auth.getUser(),
};
```

---

## Stock API — `stock.api.ts`

**Location:** `frontend/src/lib/stock.api.ts`

```typescript
export const stockApi = {
  // Full stock data: price + RSI/SMA/EMA + fundamentals
  getFullData: (symbol: string): Promise<StockDataResponse> =>
    apiFetch(`/api/v1/stock/${encodeURIComponent(symbol)}`),

  // Historical OHLCV candle data
  getHistory: (symbol: string, period = "1mo", interval = "1d"): Promise<CandleData[]> =>
    apiFetch(`/api/v1/stock/${encodeURIComponent(symbol)}/history?period=${period}&interval=${interval}`),
};
```

---

## Portfolio API — `portfolio.api.ts`

**Location:** `frontend/src/lib/portfolio.api.ts`

```typescript
export const portfolioApi = {
  // List all portfolios for authenticated user
  list: (): Promise<Portfolio[]> =>
    apiFetch("/portfolios/"),

  // Create a new portfolio
  create: (payload: { name: string }): Promise<Portfolio> =>
    apiFetch("/portfolios/", { method: "POST", body: JSON.stringify(payload) }),

  // Get portfolio summary with live P&L
  getSummary: (id: number): Promise<PortfolioSummaryResponse> =>
    apiFetch(`/portfolios/${id}/summary`),

  // Add holding directly (legacy)
  addHolding: (portfolioId: number, payload: HoldingCreate): Promise<Holding> =>
    apiFetch(`/portfolios/${portfolioId}/holdings`, { method: "POST", body: JSON.stringify(payload) }),

  // Record a BUY or SELL transaction (preferred)
  recordTransaction: (portfolioId: number, payload: TransactionCreate): Promise<Transaction> =>
    apiFetch(`/portfolios/${portfolioId}/transactions`, { method: "POST", body: JSON.stringify(payload) }),

  // Convenience wrapper for buying
  buyHolding: (portfolioId: number, symbol: string, qty: number, price: number) =>
    portfolioApi.recordTransaction(portfolioId, { symbol, transaction_type: "buy", quantity: qty, price }),

  // Sell shares (dedicated endpoint)
  sellHolding: (portfolioId: number, symbol: string, payload: SellRequest): Promise<SellResponse> =>
    apiFetch(`/portfolios/${portfolioId}/holdings/${symbol}/sell`, { method: "POST", body: JSON.stringify(payload) }),

  // MPT optimization
  optimize: (portfolioId: number): Promise<OptimizeResponse> =>
    apiFetch(`/portfolios/${portfolioId}/optimize`),
};
```

---

## Alerts API — `alerts.api.ts`

**Location:** `frontend/src/lib/alerts.api.ts`

```typescript
export const alertsApi = {
  getActive: (): Promise<Alert[]> =>
    apiFetch("/api/v1/alerts/active"),

  getNotifications: (): Promise<Alert[]> =>
    apiFetch("/api/v1/alerts/notifications"),

  create: (payload: AlertCreate): Promise<Alert> =>
    apiFetch("/api/v1/alerts/", { method: "POST", body: JSON.stringify(payload) }),

  delete: (id: number): Promise<void> =>
    apiFetch(`/api/v1/alerts/${id}`, { method: "DELETE" }),
};
```

---

## AI API — `ai.api.ts`

**Location:** `frontend/src/lib/ai.api.ts`

Calls the AI agent chat endpoint:

```typescript
export const aiApi = {
  analyze: (question: string): Promise<AgentChatResponse> =>
    apiFetch("/api/v1/agent/chat", {
      method: "POST",
      body: JSON.stringify({ message: question }),
    }),
};
```

The `AgentChatResponse` type includes: `response` (string), `artifact` (optional typed artifact object), `steps` (agent tool calls), `model_used`, `conversation_id`.

---

## News API — `news.api.ts`

**Location:** `frontend/src/lib/news.api.ts`

```typescript
export const newsApi = {
  getLatest: (limit = 20): Promise<NewsResponse> =>
    apiFetch(`/api/v1/news?limit=${limit}`),
};
```

---

## Market API — `market.api.ts`

**Location:** `frontend/src/lib/market.api.ts`

```typescript
export const marketApi = {
  getIndices: (): Promise<IndexData[]> =>
    apiFetch("/api/v1/indices"),

  getMovers: (): Promise<MoversResponse> =>
    apiFetch("/api/v1/movers"),
};
```

---

## WebSocket Price Hook — `useWebSocketPrice.ts`

**Location:** `frontend/src/lib/useWebSocketPrice.ts`

```typescript
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";

function useWebSocketPrice(symbol: string | null): {
  price: number | null;
  connected: boolean;
  error: string | null;
}
```

### Behaviour

1. Reads `NEXT_PUBLIC_WS_URL` from environment (falls back to `ws://127.0.0.1:8000` locally).
2. On mount or when `symbol` changes: closes any existing WebSocket, opens a new connection to `{WS_BASE}/api/v1/stream/price/{symbol}`.
3. Sets `connected = true` on the `onopen` event.
4. Parses each incoming JSON message and updates the `price` state.
5. Sets `error` on connection failure or unexpected close.
6. On component unmount: calls `ws.close()` for proper cleanup.

### Usage in Stock Detail Page

```typescript
const { price, connected } = useWebSocketPrice("INFY.NS");
// `price` updates every 5 seconds; `connected` shows the stream status indicator
```

---

## Artifact Type System

### `artifact-types.ts`

**Location:** `frontend/src/lib/artifact-types.ts`

Defines TypeScript types for every artifact variant's data payload. These types are used throughout the artifact system for type safety.

Key types:

```typescript
type ArtifactType =
  | "hero_price"
  | "investment_thesis"
  | "technical_focus"
  | "financials_timeline"
  | "news_event"
  | "three_way_compare";

interface Artifact {
  type: ArtifactType;
  data: HeroPriceData | InvestmentThesisData | TechnicalFocusData | ... ;
}
```

Each data type matches the structure that `ArtifactRenderer.tsx` passes to the corresponding skeleton component.

### `artifact-assembler.ts`

**Location:** `frontend/src/lib/artifact-assembler.ts`

Parses the raw agent response body and assembles a typed `Artifact` object:

1. Checks if `response.artifact` exists.
2. Reads `artifact.type` to determine which data shape to expect.
3. Validates and transforms `artifact.data` into the correct typed structure.
4. Returns `null` if the artifact type is unknown or data is malformed.

**Known implementation detail:** When `s.compare` is typed as `any[]` but has object properties like `.peers`, it is cast as `(s.compare as any).peers` to avoid TypeScript strict-mode errors. This was fixed in the May 1, 2026 TypeScript build fixes.

---

## Utility Functions — `utils.ts`

**Location:** `frontend/src/lib/utils.ts`

```typescript
// Format a number as Indian Rupees: ₹1,82,050
formatINR(value: number): string

// Format a percentage with sign: +2.4% or -1.2%
formatPct(value: number): string

// Format a Date or ISO string as: "01 May 2026"
formatDate(date: Date | string): string

// Format a Date or ISO string as: "10:30 AM"
formatTime(date: Date | string): string
```

All price displays across the frontend use `formatINR()` for consistency. All percentage changes use `formatPct()`.

---

## Mock Data — `mock.ts`

**Location:** `frontend/src/lib/mock.ts`

Contains static data used in two places where live API integration is not yet implemented:

| Mock Export | Used By | Description |
|------------|---------|-------------|
| `portfolioHistory` | `dashboard/page.tsx` | Array of `{ date, value }` for the portfolio area chart |
| `aiInsightsData` | `AIInsights.tsx` | Array of 3 AI insight card objects |

These should eventually be replaced with live API data. Until then, they provide a realistic-looking dashboard even without real portfolio data.
