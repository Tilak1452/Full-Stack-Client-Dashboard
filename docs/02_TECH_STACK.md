# FinSight AI — Technology Stack

> This document lists every technology used in the project as of **May 1, 2026**, including versions, purpose, and any critical notes. Do not add dependencies outside of this list without updating this document.

---

## Backend Technologies

The backend is a **FastAPI** Python application deployed on DigitalOcean App Platform.

| Technology | Purpose | Version | Critical Notes |
|-----------|---------|---------|---------------|
| **Python** | Runtime language | 3.11+ | Use 3.11+ specifically; older versions may break pydantic-settings or SQLAlchemy 2.x |
| **FastAPI** | Web framework and API server | Latest (0.111+) | Uses async request handling; all route handlers are async |
| **Uvicorn** | ASGI server that runs FastAPI | Latest with `[standard]` extras | Run with `uvicorn app.main:app --reload` for development; `--reload` must be disabled in production |
| **SQLAlchemy** | ORM and database abstraction layer | 2.x | Uses declarative base, relationship() cascades, and `engine.connect()` for raw migration SQL |
| **Supabase (PostgreSQL)** | Cloud-hosted relational database | Latest | All application tables (portfolios, holdings, transactions, alerts) live here. User auth lives in Supabase's internal `auth.users` schema. |
| **psycopg2-binary** | PostgreSQL driver for Python | Latest | Required for SQLAlchemy to speak to Supabase's PostgreSQL. The `-binary` variant requires no C compilation. |
| **SQLite** | Local fallback database | Built-in | Used only for offline development when `DATABASE_URL` is not set. Never used in production. |
| **Pydantic** | Data validation for request/response bodies | v2 | v2 syntax is used throughout (model_config, model_validator, etc.) |
| **pydantic-settings** | Config management via environment variables | v2 | Reads `.env` file automatically via `BaseSettings`. Config is in `backend/app/core/config.py`. |
| **yfinance** | Yahoo Finance market data client | Latest | Used for live prices, OHLCV history, options chain, news RSS. Primary market data source. |
| **LangChain** | LLM orchestration framework | Latest | Used by the agent system for tool calling, chain composition, and prompt management |
| **LangGraph** | Stateful agent workflow graphs | Latest | Used in `agent/graph.py` for multi-step agent state machines |
| **langchain-groq** | Groq LLM provider adapter | Latest | Groq is free-tier; good for development testing |
| **langchain-openai** | OpenAI LLM provider adapter | Latest | GPT-4o and GPT-4o-mini |
| **langchain-google-genai** | Gemini LLM provider adapter | Latest | Gemini 1.5 Pro / Flash |
| **OpenRouter** | LLM routing and multi-model API gateway | Latest | The primary production LLM provider used by `agent/graph.py`. Routes requests to the best available model. |
| **ChromaDB** | Local vector database for RAG | Latest | Stores document embeddings on disk at `backend/vector_db/`. Used when Pinecone key is absent. |
| **Pinecone** | Cloud vector database for RAG | Latest | Optional. Used when `Pinecone_Vector_Database` env var is set. Falls back to ChromaDB. |
| **PyPortfolioOpt** | Modern Portfolio Theory optimization | Latest | Used by `mpt_service.py` for Max-Sharpe Ratio portfolio weights |
| **APScheduler** | Background job scheduler | Latest | Powers two background jobs: alert polling (every 5 min) and holding price refresh (every 5 min) |
| **SlowAPI** | Rate limiting middleware for FastAPI | Latest | Wraps FastAPI with rate limit decorators. Default: 20 req/min globally, stricter on LLM endpoints. |
| **VADER Sentiment** | Rule-based sentiment analysis | Latest | Applied to news article titles in `news_service.py`. Returns compound score → `positive/neutral/negative` label. |
| **pandas** | Data processing and numerical analysis | Latest | Used throughout services for time-series data manipulation |
| **pandas-datareader** | FRED economic data fetching | Latest | **Known incompatibility with pandas ≥ 3.0.** Import is wrapped in try/except to prevent crashes. FRED data falls back to hardcoded values when broken. |
| **Redis** | Optional caching layer | Latest | Used by `core/cache.py`. Falls back silently to in-memory dict if Redis is not running. |
| **structlog** | Structured logging | Latest | Used by `ai/document_loader.py`. Must be in `requirements.txt` or the RAG upload will crash on import. |
| **pybreaker** | Circuit breaker pattern | Latest | Wraps external API calls in `core/circuit_breaker.py` to prevent cascading failures |

---

## Frontend Technologies

The frontend is a **Next.js 14** application with the App Router.

| Technology | Purpose | Version | Critical Notes |
|-----------|---------|---------|---------------|
| **Next.js** | React framework with App Router, SSR, and static optimization | 14.2.5 | Uses the `app/` directory (App Router), NOT the legacy `pages/` directory |
| **React** | UI component library | 18.3.1 | |
| **TypeScript** | Static typing for JavaScript | 5.x | Strict mode is enabled in `tsconfig.json`. All components must be fully typed. |
| **TailwindCSS** | Utility-first CSS framework | 3.4.4 | Extended with a custom dark theme. See `tailwind.config.ts` and `10_DESIGN_SYSTEM.md` for all custom tokens. |
| **@tanstack/react-query** | Server state management (data fetching, caching, invalidation) | 5.x | All API calls in page components use `useQuery()`. Cache config: `staleTime: 30s`, `gcTime: 5min`. |
| **Recharts** | Chart rendering library | 2.12.7 | Used for the AreaChart on the dashboard portfolio value chart |
| **Lucide React** | Icon component library | 0.428.0 | Used throughout the UI for icons (alongside custom `Icons.tsx` SVG components) |
| **@supabase/supabase-js** | Supabase JavaScript client | Latest | Handles all auth (login, signup, logout, session management, token refresh) entirely on the frontend |
| **Outfit** (Google Font) | Heading typography | — | Loaded via Next.js `next/font/google` |
| **DM Sans** (Google Font) | Body typography | — | Loaded via Next.js `next/font/google` |

---

## External Services

| Service | Purpose | Required? | Configuration |
|---------|---------|-----------|---------------|
| **Supabase** | PostgreSQL cloud database + Auth (GoTrue JWT) | **Yes — required** | `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **OpenRouter** | Multi-model LLM API gateway for AI agent | **Yes — for AI features** | Configure in `agent/graph.py` — uses OpenRouter API key |
| **Groq** | Free LLM provider (Llama 3, Mixtral) | Optional | `GROQ_API_KEY` in `.env` |
| **OpenAI** | GPT-4o / GPT-4o-mini provider | Optional | `OPENAI_API_KEY` in `.env` |
| **Google Gemini** | Gemini 1.5 Pro / Flash provider | Optional | `GEMINI_API_KEY` in `.env` |
| **NewsAPI** | Supplementary news articles | Optional | `NEWS_API_KEY` in `.env`. Falls back to Yahoo RSS only if absent. |
| **FRED (Federal Reserve)** | Macroeconomic indicators | Optional | `FRED_API_KEY` in `.env`. Falls back to hardcoded values if absent or pandas incompatibility occurs. |
| **Pinecone** | Cloud vector database for RAG | Optional | `Pinecone_Vector_Database` in `.env`. Falls back to local ChromaDB if absent. |
| **Redis** | Caching layer | Optional | `redis_url` in `.env`. Falls back silently to in-memory dict if unreachable. |
| **LangSmith** | LangChain observability and tracing | Optional | `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` in `.env` |
| **DigitalOcean App Platform** | Production hosting for both frontend and backend | **Production only** | Frontend on route `/`, Backend on route `/api`, port `8080` |

---

## Dependency Installation

### Python (Backend)
```bash
# From project root, with virtual environment active:
pip install -r requirements.txt
```

### Node.js (Frontend)
```bash
# From frontend/ directory:
npm install
```

---

## Key Dependency Notes

### Why OpenRouter over direct LLM providers?
`agent/graph.py` uses OpenRouter as a unified gateway, which means:
- A single API key can route to GPT-4o, Claude 3.5, Gemini 1.5, and open-source models.
- Model fallback and load balancing are handled by OpenRouter automatically.
- No code changes are needed to switch models — just change the model ID string.

### Why both ChromaDB and Pinecone?
The RAG system supports both vector stores through an abstract interface (`ai/interfaces/vector_store.py`). At runtime, if `Pinecone_Vector_Database` is set in `.env`, Pinecone is used for cloud-scale semantic search. If absent, ChromaDB stores embeddings locally in `backend/vector_db/`. This allows the same codebase to work in both local development and production without code changes.

### Why APScheduler instead of Celery?
The background jobs (alert polling, price updates) are simple, time-based, and low-throughput. APScheduler runs inside the same FastAPI process, requiring zero additional infrastructure. Celery would require a separate worker process and message broker (Redis/RabbitMQ), which is excessive for two 5-minute polling jobs.
