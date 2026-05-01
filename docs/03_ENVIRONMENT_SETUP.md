# FinSight AI — Environment Setup & Local Development

> This document covers everything needed to get both the backend and frontend running locally from scratch.
> All commands assume the working directory is the project root (`Full-Stack-Client-Dashboard/`) unless otherwise noted.

---

## Prerequisites

Before starting, ensure these are installed and available in your system PATH:

| Tool | Minimum Version | Check Command |
|------|----------------|--------------|
| **Python** | 3.11+ | `python --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Git** | Any recent | `git --version` |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git
cd Full-Stack-Client-Dashboard
```

---

## Step 2 — Python Virtual Environment

Create and activate a Python virtual environment. This isolates Python dependencies from your global system packages.

```bash
# Create the virtual environment in a folder called .venv
python -m venv .venv

# Activate it
# Windows (PowerShell):
.\.venv\Scripts\activate

# Windows (Command Prompt):
.venv\Scripts\activate.bat

# macOS / Linux:
source .venv/bin/activate
```

After activation, your terminal prompt should show `(.venv)`.

```bash
# Install all Python dependencies
pip install -r requirements.txt

# Verify key packages are installed correctly
python -c "import fastapi; print('FastAPI OK:', fastapi.__version__)"
python -c "import sqlalchemy; print('SQLAlchemy OK:', sqlalchemy.__version__)"
python -c "import yfinance; print('yfinance OK:', yfinance.__version__)"
```

> **IMPORTANT:** The `.venv/` folder is machine-specific and is GITIGNORED. Each developer creates their own from `requirements.txt`. Never copy `.venv/` between computers.

---

## Step 3 — Backend Environment Variables

The backend reads its configuration from a `.env` file in the **project root** (`Full-Stack-Client-Dashboard/.env`).

This file is **GITIGNORED** for security — it contains secrets and must never be committed.

A safe template with empty values is committed as `.env.example`. New developers must:
1. Copy `.env.example` to `.env`
2. Fill in the actual values (ask the team lead)

```bash
# Copy the template
copy .env.example .env     # Windows
cp .env.example .env       # macOS/Linux
```

### Full Backend `.env` Reference

```env
# ─────────────────────────────────────────────────────────
# DATABASE CONNECTION (required)
# ─────────────────────────────────────────────────────────

# For LOCAL DEVELOPMENT — use the direct Supabase connection:
DATABASE_URL=postgresql+psycopg2://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres

# For PRODUCTION on DigitalOcean — use the Session Pooler (IPv4-compatible):
# DATABASE_URL=postgresql+psycopg2://postgres.xxxx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# ─────────────────────────────────────────────────────────
# SUPABASE AUTH (required for protected API endpoints)
# ─────────────────────────────────────────────────────────

# This field supports TWO formats — the backend auto-detects which one:
#
# Format A — Legacy HS256 (plain string from Supabase Dashboard → Authentication → JWT Settings → "Legacy JWT Secret" tab):
#   SUPABASE_JWT_SECRET=your-long-random-string-here
#
# Format B — Modern ES256/ECC P-256 (paste the JWK JSON as a single line):
#   SUPABASE_JWT_SECRET={"x":"...","y":"...","alg":"ES256","crv":"P-256","kty":"EC","key_ops":["verify"]}
#
# To find your current key type: Supabase Dashboard → Authentication → JWT Signing Keys
# If you see "ECC P-256", use Format B and paste the full JSON.
# If you only see a "Legacy JWT Secret" tab, use Format A.
#
SUPABASE_JWT_SECRET=your_jwt_secret_or_jwk_json_here

# ─────────────────────────────────────────────────────────
# LLM PROVIDERS (at least one is required for AI features)
# ─────────────────────────────────────────────────────────

# Groq — free tier, best for development testing
GROQ_API_KEY=

# OpenAI — GPT-4o and GPT-4o-mini
OPENAI_API_KEY=

# Google Gemini — Gemini 1.5 Pro / Flash
GEMINI_API_KEY=

# ─────────────────────────────────────────────────────────
# OPTIONAL EXTERNAL DATA SOURCES
# ─────────────────────────────────────────────────────────

# NewsAPI.org — supplementary news articles (falls back to Yahoo RSS if absent)
NEWS_API_KEY=

# FRED (Federal Reserve Economic Data) — macroeconomic indicators
# Without this, macro data falls back to hardcoded static values
FRED_API_KEY=

# ─────────────────────────────────────────────────────────
# OPTIONAL VECTOR DATABASE
# ─────────────────────────────────────────────────────────

# Pinecone cloud vector store (falls back to local ChromaDB if absent)
Pinecone_Vector_Database=

# ─────────────────────────────────────────────────────────
# OPTIONAL CACHING
# ─────────────────────────────────────────────────────────

# Redis connection URL (falls back to in-memory dict if not set or unreachable)
# redis_url=redis://localhost:6379

# ─────────────────────────────────────────────────────────
# OPTIONAL OBSERVABILITY (LangSmith tracing)
# ─────────────────────────────────────────────────────────

LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=financial-research-agent
LANGCHAIN_API_KEY=
```

### How Config is Loaded

`backend/app/core/config.py` contains a `Settings` class extending Pydantic's `BaseSettings`. It calculates the project root by going **3 levels up** from its own file location (`backend/app/core/config.py` → `backend/app/core/` → `backend/app/` → `backend/` → project root) and reads `.env` from there automatically.

The `settings` singleton is imported throughout the backend:
```python
from app.core.config import settings
settings.database_url   # → value from .env
settings.groq_api_key   # → value from .env
```

---

## Step 4 — Frontend Environment Variables

File: `frontend/.env.local` (GITIGNORED — never commit)

```env
# Backend API base URL (no trailing slash)
# Local development:
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Production (DigitalOcean):
# NEXT_PUBLIC_API_URL=https://finsight-app-v8wgj.ondigitalocean.app
# NEXT_PUBLIC_WS_URL=wss://finsight-app-v8wgj.ondigitalocean.app

# Supabase (required for authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
```

> **Critical:** The `NEXT_PUBLIC_` prefix is mandatory. Next.js only exposes variables with this prefix to the browser. Variables without it remain server-side only and will be `undefined` in client components.

> **Critical:** The Supabase key variable MUST be named `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with `_KEY` suffix). If named without `_KEY`, Supabase auth will silently fail in production.

### Where to find your Supabase values:
- **URL:** Supabase Dashboard → Project Settings → API → Project URL
- **Anon Key:** Supabase Dashboard → Project Settings → API → `anon` `public` key (NOT the `service_role` key)

---

## Step 5 — Install Frontend Dependencies

```bash
cd frontend
npm install
```

This reads `package.json` and `package-lock.json` and installs all Node.js dependencies into `frontend/node_modules/`.

---

## Step 6 — Running Both Servers

You need **two simultaneous terminal windows**, both kept open while developing.

### Terminal 1 — Backend (port 8000)

```bash
# From project root, with .venv active:
.\.venv\Scripts\activate   # Windows
source .venv/bin/activate  # macOS/Linux

cd backend
uvicorn app.main:app --reload
```

Verify the backend is running:
- **Health check:** `http://localhost:8000/health` → should return `{"status": "ok"}`
- **Swagger UI:** `http://localhost:8000/docs` → interactive API documentation
- **ReDoc:** `http://localhost:8000/redoc` → alternative API docs

### Terminal 2 — Frontend (port 3000)

```bash
# From project root:
cd frontend
npm run dev
```

Visit `http://localhost:3000` — the root page redirects to `http://localhost:3000/dashboard`.

---

## The `uvicorn` Command Explained

`uvicorn app.main:app --reload` breaks down as:

| Part | Meaning |
|------|---------|
| `uvicorn` | The ASGI web server binary (installed in `.venv/Scripts/uvicorn`) |
| `app.main` | Python module path: folder `app/`, file `main.py` (from inside `backend/`) |
| `:app` | The FastAPI instance variable named `app` inside `main.py` |
| `--reload` | Watch for file changes and auto-restart (development only — never use in production) |

> **Must run from `backend/` directory**, not from the project root. This ensures `app.main` resolves to `backend/app/main.py`.

---

## Port Conflicts (Windows)

On Windows, if a previous uvicorn process crashes without releasing port 8000, you may get `OSError: [Errno 10048] address already in use`.

```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process by PID (replace <PID> with actual number)
taskkill /PID <PID> /F
```

---

## Production Environment Variables (DigitalOcean)

When deployed to DigitalOcean App Platform, environment variables are set in the DigitalOcean dashboard (App → Settings → Environment Variables), not from `.env` files.

**Backend env vars required in DigitalOcean:**
- `DATABASE_URL` → Session Pooler URL (`aws-1-ap-southeast-1.pooler.supabase.com`)
- `SUPABASE_JWT_SECRET` → JWK JSON or plain HS256 string
- At least one LLM key (`GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`)

**Frontend env vars required in DigitalOcean:**
- `NEXT_PUBLIC_API_URL` → `https://finsight-app-v8wgj.ondigitalocean.app`
- `NEXT_PUBLIC_WS_URL` → `wss://finsight-app-v8wgj.ondigitalocean.app`
- `NEXT_PUBLIC_SUPABASE_URL` → Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Your Supabase anon public key

> **Hidden newline gotcha:** When pasting `DATABASE_URL` into DigitalOcean's UI, an invisible newline character can be appended. This causes `FATAL: database "postgres\n" does not exist`. Always delete and retype the last few characters of the value after pasting to ensure no trailing whitespace.
