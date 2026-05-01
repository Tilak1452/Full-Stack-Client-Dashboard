# FinSight AI — Frontend Architecture

> This document covers the Next.js 14 App Router structure, all pages and their data sources, shared components, the artifact rendering system, and the landing page components.

---

## Root Layout (`layout.tsx`)

**Location:** `frontend/src/app/layout.tsx`

The root layout wraps every page in the application. It provides:

1. **Google Fonts** — Loads `Outfit` (headings) and `DM Sans` (body) via Next.js `next/font/google`. Font variables are applied to the `<html>` element.
2. **Metadata** — Sets the default `<title>` and `<meta name="description">` for the app.
3. **`<Providers>`** — Wraps all content in the React Query `QueryClientProvider` for server-state management.
4. **`<AuthProvider>`** — Wraps all content in the global authentication context, making the current Supabase session available to all components.
5. **Layout structure** — Full-height flex row: `<Sidebar>` on the left, `<main>` content area on the right.

The Sidebar is **always rendered** by the root layout. Individual pages that need to suppress it (e.g., landing page, auth pages) must handle their own conditional rendering.

---

## Providers (`providers.tsx`)

**Location:** `frontend/src/app/providers.tsx`

Creates the `QueryClient` with application-wide caching configuration:

| Setting | Value | Effect |
|---------|-------|--------|
| `staleTime` | `30_000` (30 seconds) | API data is considered fresh for 30s; no refetch during this window |
| `gcTime` | `5 * 60_000` (5 minutes) | Inactive queries are garbage collected after 5 minutes |
| `retry` | `1` | Failed requests are retried once before showing an error |
| `refetchOnWindowFocus` | `false` | Does not re-fetch when user switches browser tabs |

---

## Middleware (`middleware.ts`)

**Location:** `frontend/src/middleware.ts`

Next.js Middleware runs on every incoming request before any page is rendered. This middleware:

1. Checks for a valid Supabase session in the request cookies.
2. If the user is **not authenticated** and the route is **not** a public path (`/`, `/auth/login`, `/auth/signup`), redirects to `/auth/login`.
3. If the user **is authenticated** and tries to visit `/auth/login` or `/auth/signup`, redirects to `/dashboard`.

This creates a protected-by-default application — all routes behind `/dashboard`, `/portfolio`, `/ai-research`, etc. require authentication.

---

## Pages

### Root (`/`) — `page.tsx`
Immediately performs a client-side redirect to `/dashboard`. No content is rendered.

---

### Auth Pages

#### Login (`/auth/login`) — `auth/login/page.tsx`
- Email + password form that calls `authApi.login()`.
- On success, Supabase issues a session; the middleware redirects to `/dashboard`.
- No backend FastAPI calls — auth goes directly to Supabase.

#### Signup (`/auth/signup`) — `auth/signup/page.tsx`
- Email + password + name form that calls `authApi.register()`.
- Supabase sends a confirmation email. The user must click the link before the session is active.
- **Critical:** The Supabase Dashboard → Authentication → URL Configuration → Site URL must be set to the production domain, otherwise confirmation emails link to `localhost`.

---

### Dashboard (`/dashboard`) — `dashboard/page.tsx`

The primary landing page after authentication. Data sources:

| Section | Data Source | Live? |
|---------|------------|-------|
| Indian Market Indices (4 cards) | `marketApi.getIndices()` via `useQuery` | ✅ Live |
| Portfolio Value Chart | `mock.ts → portfolioHistory` | ❌ Mock |
| Watchlist (sidebar) | `stockApi.getFullData()` for each symbol in localStorage | ✅ Live |
| Top Movers (gainers/losers) | `marketApi.getMovers()` via `useQuery` | ✅ Live |
| News Preview | `newsApi.getLatest(5)` via `useQuery` | ✅ Live |
| AI Insights Cards (3 cards) | `mock.ts → aiInsightsData` | ❌ Mock |

> **Known limitation:** The portfolio value area chart and AI insight cards still use mock data from `mock.ts`. Replacing these with live API calls is a future task.

---

### Stock Detail (`/stock/[symbol]`) — `stock/[symbol]/page.tsx`

Dynamic route — `[symbol]` is the stock ticker (e.g., `RELIANCE.NS`).

Tabs on the page:

| Tab | Component | Data Source |
|-----|-----------|------------|
| Overview / Price | Inline in page + `TradingViewWidget` | `stockApi.getFullData(symbol)` + `useWebSocketPrice(symbol)` |
| Technical | `TechnicalTab` | Stock data from `stockApi` (RSI, SMA, EMA) |
| Fundamental | `FundamentalTab` | Extended fundamental data from `stockApi` |
| Financials | `FinancialStatements` | Financial statements from the stock API |
| Shareholding | `ShareholdingDonut` | Shareholding pattern data from the stock API |
| Corporate Actions | `CorporateActionsCard` | Dividend + split history from the stock API |

Live price is updated via `useWebSocketPrice(symbol)` — the price displayed in the hero section refreshes every 5 seconds without a page reload.

---

### AI Research (`/ai-research`) — `ai-research/page.tsx`

The AI agent chat interface. Features:

1. **Chat input** — User types a financial question or command.
2. **Agent step animation** — While the agent is processing, each tool call step is shown progressively as an animated list (`[→ Fetching stock data for INFY.NS...]`).
3. **Artifact rendering** — The agent response may include a structured `artifact` block (see Artifact Rendering System below). These are rendered as rich interactive cards instead of plain text.
4. **Conversation history** — The chat history is maintained in component state for the current session (not persisted between page reloads).

Data flow: `aiApi.analyze(question)` → `POST /api/v1/agent/chat` → agent processes → response with optional artifact → `ArtifactRenderer` displays it.

---

### Portfolio (`/portfolio`) — `portfolio/page.tsx`

Portfolio management page. Features:

| Feature | Implementation |
|---------|---------------|
| List portfolios | `portfolioApi.list()` → renders portfolio selector |
| View holdings + P&L | `portfolioApi.getSummary(id)` → table with live P&L from backend |
| Buy shares | Opens `AddToPortfolioModal` → calls `portfolioApi.buyHolding()` |
| Sell shares | Opens `SellHoldingModal` → shows FIFO P&L preview → calls `portfolioApi.sellHolding()` |
| Optimize portfolio | `portfolioApi.optimize(id)` → displays MPT weight suggestions |

P&L values (unrealized gain/loss, current value) are pre-computed by the backend's background price update job and stored in the database. The frontend does **not** calculate P&L — it reads the pre-computed values from the portfolio summary response.

---

### Watchlist (`/watchlist`) — `watchlist/page.tsx`

- The user's watchlist is stored in `localStorage` under key `finsight_watchlist` as a JSON array of ticker symbol strings.
- On page load, each symbol is fetched live via `stockApi.getFullData(symbol)`.
- Users can add/remove symbols; changes are immediately persisted to localStorage.
- **No backend persistence** — clearing browser data clears the watchlist.

---

### News (`/news`) — `news/page.tsx`

- Fetches articles from `newsApi.getLatest(limit)`.
- Displays articles in a card grid with source, timestamp, and a color-coded sentiment badge (`positive` = green, `neutral` = gray, `negative` = red).

---

### Alerts (`/alerts`) — `alerts/page.tsx`

Full alert management:
- List active alerts from `alertsApi.getActive()`.
- Create new alert rules via a form (symbol, condition, threshold, optional message).
- Delete alerts via `alertsApi.delete(id)`.
- View last 10 triggered alerts from `alertsApi.getNotifications()`.

---

### Settings (`/settings`) — `settings/page.tsx`

Static settings form with UI controls (theme, notifications, etc.). No backend integration — changes are not persisted. Placeholder for future account management features.

---

## Shared Components

### Layout Components

| Component | Description |
|-----------|-------------|
| `Sidebar.tsx` | Left navigation sidebar with route links to all main pages. Uses Next.js `usePathname()` to highlight the active route. |
| `TopBar.tsx` | Top header bar shown on most pages. Displays the current page title and the authenticated user's email. |
| `AppShell.tsx` | Thin wrapper component around page content areas for consistent padding and max-width constraints. |

### Icon Components (`Icons.tsx`)

Contains all custom SVG icon components used throughout the UI:
- `IcSend` — Send/submit icon (used in AI chat input)
- `IcPlus` — Plus/add icon (used in portfolio and alert creation)
- `IcPortfolio` — Portfolio briefcase icon
- `IcAlerts` — Bell/alert icon
- `IcChart` — Chart/trend icon
... and more.

### Stock Detail Components

| Component | Description |
|-----------|-------------|
| `FundamentalTab.tsx` | Displays P/E ratio, EPS, dividend yield, book value, sector, market cap, 52-week high/low, and other fundamental metrics |
| `TechnicalTab.tsx` | Displays RSI, SMA, EMA with interpretation badges (Overbought/Neutral/Oversold) and a summary gauge |
| `FinancialStatements.tsx` | Tabbed view of income statement, balance sheet, and cash flow data |
| `ShareholdingDonut.tsx` | Recharts PieChart showing promoter, FII, DII, and public shareholding % breakdown |
| `CorporateActionsCard.tsx` | Table of historical dividends and stock split events |
| `IndicatorCard.tsx` | Reusable card for one technical indicator value with label, value, and interpretation text |
| `TechnicalSummaryGauge.tsx` | Visual semicircle gauge showing overall Buy / Neutral / Sell rating |
| `SupportResistanceBar.tsx` | Horizontal bar chart showing the current price relative to support and resistance levels |
| `TradingViewWidget.tsx` | Embeds a TradingView Advanced Chart widget using an iframe. Reads the stock symbol from props. |

### Portfolio Modal Components

| Component | Description |
|-----------|-------------|
| `AddToPortfolioModal.tsx` | Modal dialog for buying/adding shares: portfolio selector, symbol input, quantity, price. Calls `portfolioApi.buyHolding()`. |
| `SellHoldingModal.tsx` | Modal dialog for selling shares. Shows live FIFO P&L preview as quantity is changed. Calls `portfolioApi.sellHolding()`. |

### Dashboard AI Component

| Component | Description |
|-----------|-------------|
| `AIInsights.tsx` | Card shown on the main dashboard sidebar. Displays 3 AI insight items from `mock.ts`. Shows a live status indicator (green dot + "AI Active"). |

---

## Artifact Rendering System

The artifact system provides rich, structured output rendering for the AI Research page. When the AI agent returns a response with an `artifact` block, the `ArtifactRenderer` parses the type and renders an appropriate interactive UI instead of raw text.

### `ArtifactRenderer.tsx`

**Location:** `frontend/src/components/artifact/ArtifactRenderer.tsx`

The root renderer component. Accepts an `artifact` object with a `type` field and routes it to the appropriate skeleton or custom layout:

| Artifact Type | Renderer Used | Description |
|--------------|--------------|-------------|
| `hero_price` | `SkeletonHeroPrice` | Large hero display of a stock's current price and daily change |
| `investment_thesis` | `SkeletonInvestmentThesis` | Full investment thesis: verdict banner, metric grid, risk panel, news feed |
| `technical_focus` | `SkeletonTechnicalFocus` | Technical analysis breakdown: RSI/SMA/EMA gauges, signal rows, support/resistance |
| `financials_timeline` | `SkeletonFinancialsTimeline` | Revenue and profit over multiple years as a bar/line chart |
| `news_event` | `SkeletonNewsEvent` | News event summary with sentiment and impact assessment |
| `three_way_compare` | `SkeletonThreeWayCompare` | Side-by-side comparison of three stocks across multiple metrics |

### Artifact Atoms (`components/artifact/atoms/`)

Primitive building blocks used inside skeleton layouts. Each atom is a focused, reusable component that renders one type of data:

| Atom | What It Renders |
|------|----------------|
| `VerdictBanner.tsx` | Full-width BULLISH / BEARISH / NEUTRAL banner with confidence bar |
| `VerdictCard.tsx` | Compact verdict card with confidence score (used in comparisons) |
| `HeroMetric.tsx` | Large metric display with label, value, and delta indicator |
| `MetricGrid.tsx` | 2-3 column grid of compact key-value metrics |
| `FundamentalGrid.tsx` | Layout grid optimized for fundamental financial data |
| `PeerComparisonTable.tsx` | Full table comparing multiple stocks across rows |
| `CompareColumns.tsx` | Side-by-side column layout for peer data |
| `SignalRow.tsx` | One technical signal: indicator name + value + buy/sell/neutral badge |
| `TechnicalGauges.tsx` | Set of mini circular gauges for RSI, SMA position, EMA position |
| `SupportResistanceBar.tsx` | Horizontal bar showing current price between support and resistance |
| `RevenueProfitChart.tsx` | Bar/line combo chart for revenue and net profit over years |
| `SegmentStrengthBars.tsx` | Horizontal bar visualization of business segment contributions |
| `MiniBarChart.tsx` | Tiny inline bar chart for trend visualization |
| `MiniPriceCard.tsx` | Compact price card with change percentage indicator |
| `ProgressBar.tsx` | Labeled horizontal progress bar (used for shareholding %) |
| `NewsFeed.tsx` | Container for a list of `NewsItem` components |
| `NewsItem.tsx` | Single news headline with source, timestamp, and sentiment badge |
| `ExpandSection.tsx` | Collapsible section with expand/collapse toggle |
| `ExpandableRiskPanel.tsx` | Expandable risk factors panel with warning styling |

### Artifact Skeletons (`components/artifact/skeletons/`)

Loading states shown while the AI agent is generating a response. Each skeleton matches the layout of the corresponding artifact type, using animated shimmer effects.

| Skeleton | For Artifact Type |
|----------|-----------------|
| `SkeletonHeroPrice.tsx` | `hero_price` |
| `SkeletonInvestmentThesis.tsx` | `investment_thesis` |
| `SkeletonTechnicalFocus.tsx` | `technical_focus` |
| `SkeletonFinancialsTimeline.tsx` | `financials_timeline` |
| `SkeletonNewsEvent.tsx` | `news_event` |
| `SkeletonThreeWayCompare.tsx` | `three_way_compare` |
| `Shimmer.tsx` | Base shimmer animation — imported by all other skeleton components |

### Artifact Type System (`lib/artifact-types.ts` and `lib/artifact-assembler.ts`)

- **`artifact-types.ts`** — TypeScript type definitions for every artifact variant's data shape. These types match what the AI agent returns in its `artifact.data` field.
- **`artifact-assembler.ts`** — Parses the raw agent JSON response and constructs typed `Artifact` objects. Handles validation, defaults, and edge cases (e.g., `s.compare as any` cast for dynamic `peers` property access when the type is `any[]`).

---

## Landing Page Components (`components/landing/`)

Components used on the public-facing landing page (shown before authentication):

| Component | Description |
|-----------|-------------|
| `NavBar.tsx` | Top navigation bar with logo, links, and CTA button |
| `HeroSection.tsx` | Hero banner: headline, subtext, call-to-action buttons, and dashboard preview image |
| `TickerTape.tsx` | Infinitely scrolling horizontal ticker tape animation showing live Indian stock prices |
| `FeatureGrid.tsx` | Grid of feature cards with icons describing FinSight AI's capabilities |
| `ProtocolSection.tsx` | "How It Works" section explaining the AI research pipeline |
| `TrustBar.tsx` | Social proof bar: data sources, model providers, and trust indicators |
| `LandingFooter.tsx` | Page footer with links and copyright |
