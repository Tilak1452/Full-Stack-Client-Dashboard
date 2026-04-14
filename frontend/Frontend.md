# Frontend — FinSight AI Client Dashboard

> **Project Folder**: `Full-Stack-Client-Dashboard`
> **Internal Package Name**: `finsight-ai`
> **Version**: `0.1.0`

---

## 1. Project Overview

FinSight AI is a **Financial Research AI Agent SaaS** application. The frontend is a dark-themed, premium financial dashboard that provides:

- Real-time market index tracking (NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT)
- Individual stock analysis with interactive price charts and technical indicators
- An AI-powered research agent with a chat interface for market queries
- Portfolio management with holdings table, P&L tracking, and sector allocation visualization
- Watchlist management with add/remove functionality
- Market news feed with AI-generated sentiment analysis
- Configurable price and AI-driven alerts with toggle controls
- User settings for profile, subscription plan, API keys, and notifications

The application is currently in **Phase 2 (UI Shell)** — all pages are built with static mock data. Phase 3 (Auth + PostgreSQL via Supabase/Prisma) and Phase 4 (live AI integration via Groq LLM) are planned next.

---

## 2. Technology Stack

### Core Framework

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | `14.2.5` | React meta-framework — App Router, file-based routing, server components, optimized font loading |
| **React** | `^18.3.1` | UI component library |
| **React DOM** | `^18.3.1` | DOM rendering layer for React |
| **TypeScript** | `^5` | Static type safety across the entire codebase |

### Styling

| Technology | Version | Purpose |
|---|---|---|
| **Tailwind CSS** | `3.4.4` | Utility-first CSS framework — all styling uses Tailwind classes with a custom design token system |
| **PostCSS** | `^8` | CSS transformation pipeline (required by Tailwind) |
| **Autoprefixer** | `^10.4.27` | Automatically adds vendor prefixes for cross-browser CSS compatibility |

### Data Visualization

| Technology | Version | Purpose |
|---|---|---|
| **Recharts** | `^2.12.7` | Composable charting library built on D3 — used for `AreaChart`, `PieChart`, and custom tooltips |

### Icons

| Technology | Version | Purpose |
|---|---|---|
| **Lucide React** | `^0.428.0` | Icon library (installed but not currently used — custom SVG icon components are used instead) |

### Code Quality

| Technology | Version | Purpose |
|---|---|---|
| **ESLint** | `^8` | JavaScript/TypeScript linter |
| **eslint-config-next** | `14.2.5` | Next.js-specific ESLint rules |

---

## 3. Design System

The entire UI follows a strict **dark-mode design system** with a carefully curated color palette. All tokens are defined in `tailwind.config.ts` and referenced via Tailwind utility classes throughout the app.

### Color Tokens

```
Background     #0B0D11    — Main page background
Sidebar        #090B0F    — Left navigation rail
Card           #12141B    — Primary card surfaces
Card2          #0E1014    — Nested/secondary card surfaces
Border         rgba(255,255,255,0.07)   — Subtle dividers
Border-Hi      rgba(255,255,255,0.13)   — Emphasized borders (e.g., chat input)
Lime           #C8FF00    — Primary accent (active states, CTAs, highlights)
Lime-Dim       rgba(200,255,0,0.12)     — Lime tinted backgrounds
Pink           #FF4FD8    — Gradient accent
Purple         #9B72FF    — Secondary accent (badges, gradients)
Blue           #60A5FA    — Tertiary accent
Text           #ECEEF2    — Primary text
Muted          #636B7A    — Secondary/disabled text
Dim            #1D2028    — Recessed surface color
Green          #4ADE80    — Positive values / upward movement
Red            #F87171    — Negative values / downward movement
Amber          #FBBF24    — Warning / triggered states
```

### Typography

Two Google Fonts are loaded via `next/font/google` for zero-layout-shift optimization:

| Font | CSS Variable | Usage |
|---|---|---|
| **Outfit** | `--font-outfit` | Primary UI font — headings, labels, body text |
| **DM Sans** | `--font-dm-sans` | Secondary font — available for monospace/data contexts |

### Spacing & Radius

- **Page padding**: `22px` (`p-[22px]`)
- **Card border-radius**: `16px` (`rounded-2xl`)
- **Button/input radius**: `10px` (`rounded-[10px]`)
- **Badge radius**: `6px` (`rounded-md`)
- **Pill/tag radius**: `20px` (`rounded-full`)
- **Gap rhythm**: `12px` / `14px` between cards and sections

---

## 4. Project Structure

```
Full-Stack-Client-Dashboard/
├── .vscode/
│   └── settings.json               # VS Code config
├── Cluade_Plan.md                  # Master project plan & original UI reference code
├── image.png                       # Reference screenshot
└── frontend/                       # ← Entire Next.js project is here
    ├── .next/                      # Next.js build output (auto-generated)
    ├── node_modules/               # Installed dependencies
    ├── src/
    │   ├── app/                    # Next.js App Router
    │   │   ├── globals.css         # Global styles
    │   │   ├── layout.tsx          # Root layout
    │   │   ...
    │   ├── components/             # Shared components
    │   │   └── TopBar.tsx          # Page header
    │   └── lib/
    │       └── mock.ts             # mock data
    ├── Frontend.md                 # ← This documentation file
    ├── next-env.d.ts               # Next.js TypeScript declarations
    ├── package.json                # Dependencies, scripts
    ├── package-lock.json           # Locked dependency tree
    ├── postcss.config.js           # PostCSS plugin chain
    ├── tailwind.config.ts          # Tailwind design tokens
    └── tsconfig.json               # TypeScript compiler options
```

---

## 5. How the Application Works

### 5.1 Application Bootstrap

```
User visits localhost:3000
        │
        ▼
   src/app/layout.tsx  (Root Layout — Server Component)
        │
        ├── Loads Outfit & DM Sans fonts via next/font/google
        ├── Injects font CSS variables into <html> tag
        ├── Sets up full-height flex layout: <body class="h-screen flex overflow-hidden">
        ├── Renders <Sidebar /> (persistent, left side)
        └── Renders {children} in a flex-1 overflow container
                │
                ▼
        src/app/page.tsx  (Root Page — Server Component)
                │
                └── Calls redirect('/dashboard') → browser goes to /dashboard
```

### 5.2 Routing Architecture

The project uses **Next.js App Router** with file-based routing. Every route directory under `src/app/` contains a `page.tsx` that exports a default React component. All page components are **Client Components** (marked with `"use client"`) because they use React hooks (`useState`, `useRef`, `useEffect`) and browser event handlers.

| Route | File | Component | Description |
|---|---|---|---|
| `/` | `app/page.tsx` | `RootPage` | Server-side redirect to `/dashboard` |
| `/dashboard` | `app/dashboard/page.tsx` | `DashboardPage` | Main dashboard with 4 market indices, portfolio area chart, AI insights panel, watchlist preview, top movers, and news preview |
| `/stock/[symbol]` | `app/stock/[symbol]/page.tsx` | `StockPage` | Dynamic route — symbol extracted from URL params. Shows price chart, key financials grid, technical indicators with progress bars, and expandable AI analysis report |
| `/ai-research` | `app/ai-research/page.tsx` | `AIPage` | Chat interface with suggestion pills, simulated multi-step agent pipeline, and markdown-like bold text rendering |
| `/portfolio` | `app/portfolio/page.tsx` | `PortfolioPage` | Summary metric cards, scrollable holdings table with P&L, and donut allocation chart |
| `/watchlist` | `app/watchlist/page.tsx` | `WatchlistPage` | Add symbol input + button, data table with remove actions |
| `/news` | `app/news/page.tsx` | `NewsPage` | Sentiment filter pills (all/positive/neutral/negative), news cards with AI summaries, overall sentiment distribution badge |
| `/alerts` | `app/alerts/page.tsx` | `AlertsPage` | Summary counters, alert condition rows with type badges and active/inactive toggle switches |
| `/settings` | `app/settings/page.tsx` | `SettingsPage` | Profile form, subscription plan card, API key inputs (masked), notification toggle switches |

### 5.3 Shared Components

#### `<Sidebar />` — `src/components/Sidebar.tsx`

- **Type**: Client Component
- **Rendered in**: Root layout (persistent across all pages)
- **Width**: `64px` fixed
- **Behavior**:
  - Uses `usePathname()` from `next/navigation` to determine the active route
  - Renders 8 navigation icons as `<Link>` elements
  - Active item gets a lime-colored left indicator bar and tinted background
  - Bottom of sidebar shows user avatar with purple→pink gradient
  - Logo at top: lime gradient square with "F" letter

#### `<TopBar />` — `src/components/TopBar.tsx`

- **Type**: Client Component
- **Rendered in**: Each page component individually (not in layout)
- **Props**: `title: string`
- **Features**:
  - Displays the current page title
  - Contains a search input — pressing Enter navigates to `/stock/{SYMBOL}`
  - Notification bell with red dot indicator
  - User profile pill showing name ("Arjun Shah") and plan badge ("Pro Plan")

#### `Icons.tsx` — `src/components/Icons.tsx`

Contains **12 custom SVG icon components**, each accepting typed props:

```typescript
type IconProps = {
  s?: number;    // size in pixels (default varies per icon)
  c?: string;    // stroke/fill color (default: 'currentColor')
  className?: string;
};
```

Icons: `IcGrid`, `IcChart`, `IcBrain`, `IcBrief`, `IcBkmrk`, `IcNews`, `IcBell`, `IcGear`, `IcSearch`, `IcSend`, `IcPlus`, `IcTrash`

### 5.4 Data Layer

All data currently lives in `src/lib/mock.ts` as exported constant arrays. This module is the **single source of truth** and is designed so that swapping to real API calls requires changing only the import source — the data shapes remain identical.

| Export | Type | Used By |
|---|---|---|
| `portfolioHistory` | `{m, v}[]` | Dashboard area chart |
| `indices` | `{name, val, chg, up, spark}[]` | Dashboard index cards |
| `watchlistData` | `{sym, name, price, chg, up}[]` | Dashboard watchlist, Watchlist page |
| `topMovers` | `{sym, chg, vol, up}[]` | Dashboard movers section |
| `newsData` | `{title, tag, sent, time, summary}[]` | Dashboard news, News page |
| `aiInsightsData` | `{icon, color, title, body}[]` | Dashboard AI panel |
| `stockHistory` | `{d, v}[]` | Stock page area chart |
| `metrics` | `{label, val}[]` | Stock page financials grid |
| `holdings` | `{sym, qty, avg, ltp, val, gain, pct, up}[]` | Portfolio page |
| `alloc` | `{name, v, color}[]` | Portfolio pie chart |
| `alertsData` | `{sym, cond, type, active, triggered}[]` | Alerts page |

### 5.5 Key Interactive Behaviors

| Feature | Page | Mechanism |
|---|---|---|
| Timeframe toggle (1M/3M/6M/1Y/ALL) | Dashboard, Stock | `useState` swaps active button styling (chart data is static for now) |
| Symbol search → navigation | TopBar, Stock | `useRouter().push()` on Enter keypress |
| AI chat with agent steps | AI Research | `useState` for message array + `setTimeout` loop simulating 4-step pipeline |
| Bold text rendering in AI responses | AI Research | Splits on `**` delimiters, alternates `<span>` and `<strong className="text-lime">` |
| Auto-scroll to latest message | AI Research | `useRef` + `useEffect` calling `scrollIntoView({ behavior: 'smooth' })` |
| Add symbol to watchlist | Watchlist | `useState` array + push new object on button click |
| Remove from watchlist | Watchlist | `Array.filter()` by index |
| Sentiment filter | News | `useState` string filter applied to `newsData` array |
| Alert toggle switch | Alerts | `useState` array + map to flip `active` boolean at index |
| Notification toggles | Settings | Static render (not yet wired to state) |
| AI analysis expand/collapse | Stock | `useState` boolean toggling visibility of analysis panel |

---

## 6. Configuration Files

### `tsconfig.json`

- **Target**: ES5 (broad browser compatibility)
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled
- **Path alias**: `@/*` → `./src/*` (clean imports like `@/components/Sidebar`)
- **JSX**: Preserve (handled by Next.js)
- **Incremental compilation**: Enabled for faster rebuilds

### `tailwind.config.ts`

- **Content paths**: Scans `src/pages`, `src/components`, `src/app` for class usage
- **Extended theme**: Full custom color palette, font families via CSS variables, custom gradient utilities
- **No plugins** currently configured

### `postcss.config.js`

Standard two-plugin chain:
1. `tailwindcss` — processes `@tailwind` directives and utility classes
2. `autoprefixer` — adds `-webkit-`, `-moz-`, etc. prefixes

### `globals.css`

Uses Tailwind's `@layer base` to set:
- Body background and text color from design tokens
- Universal box-sizing reset
- Custom ultra-thin scrollbar styling (4px width, `bg-dim` thumb)
- Inherited font-family on buttons and inputs
- Subtle hover opacity effect on all buttons (`opacity: 0.88`)

---

## 7. NPM Scripts

```bash
npm run dev      # Start Next.js development server on http://localhost:3000
npm run build    # Create optimized production build
npm run start    # Serve the production build
npm run lint     # Run ESLint checks
```

---

## 8. Installed Packages

### Production Dependencies

| Package | Version | Description |
|---|---|---|
| `next` | `14.2.5` | React framework with App Router, SSR, file routing, optimized fonts |
| `react` | `^18.3.1` | Declarative UI component library |
| `react-dom` | `^18.3.1` | React rendering to the browser DOM |
| `recharts` | `^2.12.7` | React charting library — `AreaChart`, `PieChart`, `Tooltip`, `ResponsiveContainer` |
| `lucide-react` | `^0.428.0` | SVG icon components (available but custom icons are used instead) |

### Development Dependencies

| Package | Version | Description |
|---|---|---|
| `typescript` | `^5` | TypeScript compiler |
| `@types/node` | `^20` | Node.js type definitions |
| `@types/react` | `^18` | React type definitions |
| `@types/react-dom` | `^18` | React DOM type definitions |
| `tailwindcss` | `3.4.4` | Utility-first CSS framework |
| `postcss` | `^8` | CSS transformation tool |
| `autoprefixer` | `^10.4.27` | CSS vendor prefix tool |
| `eslint` | `^8` | Code linter |
| `eslint-config-next` | `14.2.5` | Next.js ESLint preset |

---

## 9. Architectural Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (localhost:3000)                  │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ Sidebar  │   TopBar (per page — search, notifications, user)    │
│ (64px)   │──────────────────────────────────────────────────────│
│          │                                                      │
│ ┌──────┐ │   Page Content (scrollable)                          │
│ │ Logo │ │   ┌────────────────────────────────────────────────┐ │
│ └──────┘ │   │                                                │ │
│ ┌──────┐ │   │  Route-specific UI                             │ │
│ │ Nav  │ │   │  (Dashboard / Stock / AI / Portfolio / etc.)   │ │
│ │ Icons│ │   │                                                │ │
│ │      │ │   │  Data from: src/lib/mock.ts                    │ │
│ │  8   │ │   │  Charts from: recharts                         │ │
│ │items │ │   │  Icons from: src/components/Icons.tsx           │ │
│ └──────┘ │   │                                                │ │
│          │   └────────────────────────────────────────────────┘ │
│ ┌──────┐ │                                                      │
│ │Avatar│ │                                                      │
│ └──────┘ │                                                      │
├──────────┴──────────────────────────────────────────────────────┤
│              Tailwind CSS + PostCSS + Autoprefixer              │
│              Next.js App Router (file-based routing)            │
│              TypeScript (strict mode)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Data Flow (Current: Mock → Future: API)

```
Current State (Phase 2):
─────────────────────────
  src/lib/mock.ts  ──export──▶  Page Components  ──render──▶  Browser DOM
       (static arrays)              (useState for local interactivity)


Planned State (Phase 3+):
─────────────────────────
  Yahoo Finance API ─┐
  NewsAPI.org ────────┤
  Supabase (Postgres) ┤──▶  /api/* routes (Next.js)  ──▶  SWR/React Query hooks
  Groq LLM ───────────┘              │                           │
                              Prisma ORM                    Page Components
                              (type-safe queries)           (dynamic data)
```

---

## 11. Page-by-Page Feature Breakdown

### `/dashboard` — DashboardPage

| Section | Components Used | Data Source |
|---|---|---|
| Market Indices (4 cards) | `<Spark>` (custom SVG sparkline) | `indices` |
| Portfolio Value Chart | Recharts `<AreaChart>` + `<ChartTip>` tooltip | `portfolioHistory` |
| Timeframe Selector | Toggle buttons (1M/3M/6M/1Y/ALL) | `useState` |
| AI Insights Panel | Card stack with colored icons + LIVE badge | `aiInsightsData` |
| Watchlist Preview | 5 stock rows with symbol badge, price, change | `watchlistData` |
| Top Movers | 5 rows with volume and colored change badge | `topMovers` |
| Market News | 4 headlines with tag, sentiment dot, timestamp | `newsData` |

### `/stock/[symbol]` — StockPage

| Section | Components Used | Data Source |
|---|---|---|
| Symbol Search Bar | Input + Analyze button + Compare/Watchlist actions | `useState` + `useRouter` |
| Price Header | Large price display with % change and timeframe toggle | `stockHistory` (computed) |
| Price Chart | Recharts `<AreaChart>` with lime gradient fill | `stockHistory` |
| Key Financials | 2×4 grid of metric cards (Market Cap, PE, EPS, etc.) | `metrics` |
| Technical Indicators | RSI, MA20, MA50, MACD with progress bars | Inline data |
| AI Analysis Report | Expandable text panel with investment thesis | Toggle via `useState` |

### `/ai-research` — AIPage

| Section | Components Used | Data Source |
|---|---|---|
| Empty State | Title + 5 suggestion pill buttons | `SUGGESTIONS` const |
| Chat Messages | User (purple avatar, right-aligned) / AI (lime avatar, left-aligned) | `useState<Message[]>` |
| Agent Thinking Steps | 4-step pipeline with dot indicators turning lime | `AGENT_STEPS` + `setTimeout` |
| Chat Input | Text input + lime send button | `useState` + `onKeyDown` |

### `/portfolio` — PortfolioPage

| Section | Components Used | Data Source |
|---|---|---|
| Summary Cards | Total Value, Invested, Gain, Return (4 cards) | `holdings` (computed) |
| Holdings Table | Sortable table with Symbol, Qty, Avg, LTP, Value, P&L, Return | `holdings` |
| Allocation Chart | Recharts `<PieChart>` donut with legend | `alloc` |

### `/watchlist` — WatchlistPage

| Section | Components Used | Data Source |
|---|---|---|
| Add Symbol Bar | Search input + "Add to watchlist" button | `useState` |
| Watchlist Table | Symbol badge, Company, Price, Change badge, Remove button | `watchlistData` + `useState` |

### `/news` — NewsPage

| Section | Components Used | Data Source |
|---|---|---|
| Sentiment Filters | 4 pill buttons (all/positive/neutral/negative) | `useState` |
| Sentiment Summary | Distribution badge (62% / 21% / 17%) | Static |
| News Cards | Tag badge + sentiment badge + timestamp + title + AI summary | `newsData` (filtered) |

### `/alerts` — AlertsPage

| Section | Components Used | Data Source |
|---|---|---|
| Summary Counters | Active / Triggered / Total (3 cards) | `alertsData` (computed) |
| Alert List | Symbol badge, condition text, type badge, triggered badge, toggle switch | `alertsData` + `useState` |

### `/settings` — SettingsPage

| Section | Components Used | Data Source |
|---|---|---|
| Profile Form | Name, Email, Phone inputs + Save button | Static defaults |
| Plan Card | Gradient card showing Pro plan + usage meter | Static |
| API Keys | Masked password inputs for Groq, Alpha Vantage, NewsAPI | Static |
| Notifications | 4 rows with label + toggle switch | Static |

---

## 12. Future Roadmap

| Phase | Focus | Status |
|---|---|---|
| Phase 1 | Project setup, design tokens, Tailwind config | ✅ Complete |
| Phase 2 | UI Shell — all 8 pages with mock data | ✅ Complete |
| Phase 3 | Auth (Supabase) + PostgreSQL (Prisma ORM) + API routes | 🔲 Planned |
| Phase 4 | AI Integration — Groq LLM multi-agent pipeline | 🔲 Planned |
| Phase 5 | Public landing page with pricing | 🔲 Planned |
| Phase 6 | QA, middleware audit, Lighthouse, deployment | 🔲 Planned |

---

*Last updated: April 2026*
