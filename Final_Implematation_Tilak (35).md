# FinSight AI — Complete Implementation Plan
### Phase 3 Parallel Data Fetching + Phase 4 LLM Node Division + Artifact Response System

> **Document Version:** 1.0  
> **Created:** April 30, 2026  
> **Target AI:** Claude Sonnet (Antigravity Setup)  
> **Companion Files Required Before Starting:**
> - `Gemini.md` — Project source of truth (folder structure, endpoints, constraints)
> - `Context.md` — Architecture decisions, model strategy, LangGraph pipeline

---

## ⚠️ MANDATORY AI EXECUTION RULES — READ BEFORE ANYTHING ELSE

These rules are NON-NEGOTIABLE. Any AI executing this document MUST follow all of them without exception.

### Rule 1 — Pre-Execution Protocol (MANDATORY FIRST STEP)
Before writing a single line of code, the AI MUST:
1. Read `Gemini.md` fully — understand the complete folder structure and ALL protected files
2. Read `Context.md` fully — understand the 4-Phase LangGraph pipeline, AgentState, SSE events
3. Build a mental inventory of every file that currently exists in the project
4. Cross-reference every file this plan touches against that inventory
5. If ANY conflict is found between this plan and existing code → follow Gemini.md Rule (preserve existing, adapt new)

**DO NOT SKIP THIS STEP. Starting implementation without reading both files is a critical violation.**

### Rule 2 — Execution Continuity
- Execute all steps sequentially without stopping unless a CRITICAL error occurs
- A critical error is ONLY: syntax error that breaks the entire backend, missing dependency that cannot be resolved, or a conflict that would delete working existing features
- Minor issues (a fallback returning None, a single API key failing) are NOT critical errors — handle them inline and continue
- Do NOT pause to ask for confirmation on implementation details already defined in this document
- Do NOT ask "should I proceed?" — the answer is always YES unless a critical error is hit

### Rule 3 — Internal Planning Allowed
- The AI MAY create an internal implementation plan or checklist for itself before starting
- This internal plan should be shown to the developer

Here’s a cleaner, more professional, and **execution-ready version** of your rule:

---

## **Rule 4 — File Safety Protocol (Strict Enforcement)**
### **1. Pre-Change Validation**
* Before making any changes, **read and fully understand this rule**.
* If any required modification conflicts with these restrictions (e.g., a file must be changed, deleted, or overwritten), you must **pause and ask for explicit permission** before proceeding.
### **2. File Modification Scope**
* **NEVER delete or overwrite** any file listed in *Gemini.md Section 1*.
* Only implement changes that are **explicitly mentioned** in the provided instructions.
* Do **not modify unrelated files**.
### **3. Dependency Handling**
* If modifying a specific file requires changes in **connected or dependent files**, you are allowed to update those files **only if necessary for proper functionality**.
* However, you must:
  * **Preserve the core logic** of those files
  * Avoid unnecessary changes
### **4. Code Integrity Rules**
* **NEVER remove** any existing:
  * Functions
  * Classes
  * Endpoints
* You may **only ADD new logic or extend existing functionality**.
### **5. Restricted Files (Do Not Modify)**
Under no circumstances should you modify the following files:
* `prompts.py`
* `tools.py`
* `api/portfolio.py`
* `api/alerts.py`
* `api/stock.py`
* `api/news.py`
* `api/market.py`
* Any frontend file outside `ai-research/page.tsx`
### **6. Controlled File Updates**
* When modifying `graph.py` or `config.py`:
  * Only **add new code in clearly marked sections**
  * **Do NOT rewrite or replace existing working logic**
* When modifying `main.py`:
  * Only **add new router registrations**
  * Do **NOT modify or remove existing routes**
### **7. System Stability Guarantee**
* Every modification must:
  * **Preserve all existing functionality**
  * **Avoid breaking any current features**
  * Maintain **system stability and compatibility**
### **8. Safety Override Rule**
* If any restriction in this protocol **blocks a necessary change for system correctness**, you must:
  1. **Stop execution**
  2. **Clearly explain the conflict**
  3. **Request approval before proceeding**
---
### **Final Principle**
> “Enhance the system without breaking or replacing what already works.”

### Rule 5 — Reporting Rule
Before executing any step that involves:
- Adding a new external API dependency
- Changing an existing data flow that touches the frontend SSE stream
- Modifying `AgentState` fields (any addition, never removal)
- Adding a new background job or scheduler

The AI MUST print a one-line notice:  
`[NOTICE] About to <action> — this affects <component>. Proceeding.`  
Then immediately proceed. This is for logging only, not a pause point.

### Rule 6 — Consistency Rules
- All new Python files MUST use the same import style as existing files in the project
- All async functions MUST use `async def` and `await` — no sync blocking calls in async context
- All new environment variables MUST follow the existing `.env` naming convention (UPPER_SNAKE_CASE)
- All new LangGraph nodes MUST accept `AgentState` and return `AgentState` — no exceptions
- All SSE events MUST use the format: `f"event: {name}\ndata: {json.dumps(payload)}\n\n"`

### Rule 7 — Testing After Each Phase
After completing each numbered Section (Section 1 through Section 7), the AI MUST:
1. Verify all new imports resolve correctly (no ImportError)
2. Verify backend starts without crashing (`uvicorn app.main:app`)
3. Verify existing endpoints still respond (do not break existing features)
4. Only then proceed to the next Section

### Rule 8 — Forbidden Actions
The AI MUST NEVER:
- Use `os.system()` or `subprocess` to run shell commands inside application code
- Hard-code any API key value in any Python file — always read from `settings` or `key_manager`
- Use synchronous `requests` library inside an `async def` function — use `aiohttp` instead
- Use `time.sleep()` in async context — use `asyncio.sleep()`
- Catch `Exception` silently with `pass` — always log the error first: `logger.warning(f"...")`
- Remove the `final_response` field from `AgentState` — it must remain for backward compatibility

---

## SECTION 0 — SYSTEM OVERVIEW & WHAT THIS PLAN DOES

### 0.1 What Is Being Built

This plan implements 4 interconnected systems on top of the existing FinSight AI codebase:

```
SYSTEM 1: Multi-Key Manager Extension
  → Adds Finnhub, Twelve Data key rotation to existing KeyManager
  
SYSTEM 2: Phase 3 — Parallel Data Fetching Overhaul
  → Replaces sequential data fetching with asyncio.gather() across 7 data types
  → Each data type has: Primary API → Fallback 1 → Fallback 2
  → Provider categories: AngelOne, Yahoo Finance, FMP, Finnhub, Twelve Data, NSE/BSE scrape, News, Fred, Alpha Vantage APIs

SYSTEM 3: Phase 4 — LLM Node Division + Artifact Output
  → Splits single synthesis node into 3 parallel specialist nodes
  → Each node outputs structured JSON (artifact) + optional text (not prose)
  → Adds 1 Sequencer Node that assembles final output
  → Adds artifact_type decision to Phase 2 classifier

SYSTEM 4: Frontend Artifact Rendering
  → Modifies ONLY ai-research/page.tsx
  → Adds split-panel layout (chat left, artifact right)
  → Adds slot-based rendering (skeletons → real cards as SSE arrives)
  → Adds Component Registry (artifact_type → React component mapping)
  → Adds dynamic text slot above artifact cards
```

### 0.2 Files That Will Be Created (New)

```
backend/app/core/key_manager.py          ← NEW (if not exists) or EXTEND (if exists)
backend/app/services/data_provider.py   ← EXTEND existing file
```

### 0.3 Files That Will Be Modified (Existing)

```
backend/.env                             ← Add new key variables only
backend/requirements.txt                 ← Add aiohttp, finnhub-python, twelvedata
backend/app/core/config.py              ← Add new settings fields only
backend/app/agent/graph.py              ← Add new nodes + modify _get_llm + classify_intent
backend/app/api/agent.py                ← Add new typed SSE events only
frontend/src/app/ai-research/page.tsx   ← Full rewrite of this single file only
```

### 0.4 Files That Will NOT Be Touched

```
backend/app/agent/prompts.py            ← PROTECTED
backend/app/agent/prompt_builder.py     ← PROTECTED
backend/app/agent/tools.py              ← PROTECTED
backend/app/api/portfolio.py            ← PROTECTED
backend/app/api/alerts.py               ← PROTECTED
backend/app/api/stock.py                ← PROTECTED
backend/app/api/news.py                 ← PROTECTED
backend/app/api/market.py               ← PROTECTED
backend/app/api/stream.py               ← PROTECTED
backend/app/api/rag.py                  ← PROTECTED
backend/app/api/auth.py                 ← PROTECTED
backend/app/main.py                     ← PROTECTED (no router changes needed)
frontend/src/components/Sidebar.tsx     ← PROTECTED
frontend/src/components/TopBar.tsx      ← PROTECTED
frontend/src/app/layout.tsx             ← PROTECTED
All other frontend files                ← PROTECTED
```

---

## SECTION 1 — DEPENDENCIES & ENVIRONMENT SETUP

### 1.1 Install New Python Packages

Run from project root with `.venv` activated:

```bash
pip install aiohttp finnhub-python twelvedata langchain-google-genai langchain-groq langchain-nvidia-ai-endpoints
```

Add these lines to `requirements.txt` (append, do not remove existing lines):

```
aiohttp>=3.9.0
finnhub-python>=2.4.19
twelvedata>=1.0.7
langchain-google-genai>=2.0.0
langchain-groq>=0.2.0
langchain-nvidia-ai-endpoints>=0.3.0
```

### 1.2 Update `.env` File

Append ALL of the following to the existing `.env` file. Do NOT remove any existing variables.

```env
# ─────────────────────────────────────────────────────────────────
# DIRECT LLM PROVIDER KEYS (Replacing OpenRouter)
# ─────────────────────────────────────────────────────────────────

# Google AI Studio — Multiple keys, comma-separated (15 RPM each)
# Consolidate existing Gemma_4_API_KEY_1, Gemini_API_KEY_1 etc. into this list
# Get from: https://aistudio.google.com → Get API key
GOOGLE_API_KEYS=AIzaSy_KEY1,AIzaSy_KEY2,AIzaSy_KEY3,AIzaSy_KEY4,AIzaSy_KEY5

# NVIDIA Build — Multiple keys, comma-separated (40 RPM per account)
# Get from: https://build.nvidia.com → select model → Get API Key
NVIDIA_API_KEYS=nvapi-KEY1,nvapi-KEY2,nvapi-KEY3,nvapi-KEY4

# ─────────────────────────────────────────────────────────────────
# DIRECT LLM MODEL IDs
# ─────────────────────────────────────────────────────────────────

GEMINI_FLASH_MODEL=gemini-2.5-flash
NVIDIA_COMPLEX_MODEL=qwen/qwen3-235b-a22b
LLM_PROVIDER_TIMEOUT=35

# ─────────────────────────────────────────────────────────────────
# DATA API KEYS — FINANCIAL DATA PROVIDERS
# ─────────────────────────────────────────────────────────────────

# Finnhub — 5 keys, comma-separated (60 RPM each)
# Get from: https://finnhub.io → Dashboard → API Keys
FINNHUB_API_KEYS=finhub_KEY1,finhub_KEY2,finhub_KEY3,finhub_KEY4,finhub_KEY5

# Twelve Data — 4 keys, comma-separated (800 credits/day each)
# Get from: https://twelvedata.com → My API → Generate Key
TWELVE_DATA_API_KEYS=twelve_KEY1,twelve_KEY2,twelve_KEY3,twelve_KEY4

# FMP — 4 keys, comma-separated (already exists, extend to list format)
# Rename existing FMP_API_KEY to FMP_API_KEYS and add more keys
FMP_API_KEYS=fmp_KEY1,fmp_KEY2,fmp_KEY3,fmp_KEY4

# Alpha Vantage — 4 keys, comma-separated (already exists, extend)
ALPHA_VANTAGE_KEYS=av_KEY1,av_KEY2,av_KEY3,av_KEY4

# NewsAPI — 4 keys, comma-separated (already exists, extend)
NEWS_API_KEYS=news_KEY1,news_KEY2,news_KEY3,news_KEY4

# FRED — 4 keys, comma-separated (already exists, extend)
FRED_API_KEYS=fred_KEY1,fred_KEY2,fred_KEY3,fred_KEY4

etc..


# ─────────────────────────────────────────────────────────────────
# DATA FETCH TIMEOUTS (seconds)
# ─────────────────────────────────────────────────────────────────

TIMEOUT_ANGEL_ONE=3
TIMEOUT_YAHOO=5
TIMEOUT_FMP=4
TIMEOUT_FINNHUB=4
TIMEOUT_ALPHA_VANTAGE=6
TIMEOUT_NEWSAPI=3
TIMEOUT_TWELVE_DATA=5
TIMEOUT_FRED=8
TIMEOUT_NSE_SCRAPE=6
TIMEOUT_BSE_SCRAPE=6
```

---

## SECTION 2 — KEY MANAGER (`backend/app/core/key_manager.py`)

### 2.1 Action

**IF** `backend/app/core/key_manager.py` does not exist → CREATE it with the full content below.  
**IF** it already exists → ADD the new key pools listed below to the existing class. Do not remove existing pools.

### 2.2 Complete File Content

```python
# backend/app/core/key_manager.py

import itertools
import threading
import os
import logging
from typing import List

logger = logging.getLogger(__name__)


class KeyManager:
    """
    Round-Robin API key manager for all providers.
    
    Handles:
    - LLM providers: Google AI Studio, Groq Cloud, NVIDIA Build
    - Data providers: Finnhub, Twelve Data, FMP, Alpha Vantage, NewsAPI, FRED
    
    Behavior:
    - Rotates keys per request (round-robin) to distribute load
    - Thread-safe with a single lock
    - On 429: caller catches exception, calls get_*_key() again for next key
    - If provider has 0 keys: raises ValueError at startup (fail fast)
    """

    def __init__(self):
        # ── LLM Provider Keys ───────────────────────────────────────────
        self._google_keys: List[str]  = self._load_keys("GOOGLE_API_KEYS")
        self._nvidia_keys: List[str]  = self._load_keys("NVIDIA_API_KEYS")

        # ── Data Provider Keys ──────────────────────────────────────────
        self._finnhub_keys: List[str]    = self._load_keys("FINNHUB_API_KEYS")
        self._twelve_keys: List[str]     = self._load_keys("TWELVE_DATA_API_KEYS")
        self._fmp_keys: List[str]        = self._load_keys("FMP_API_KEYS", required=False)
        self._av_keys: List[str]         = self._load_keys("ALPHA_VANTAGE_KEYS", required=False)
        self._newsapi_keys: List[str]    = self._load_keys("NEWS_API_KEYS", required=False)
        self._fred_keys: List[str]       = self._load_keys("FRED_API_KEYS", required=False)

        # ── Cycle Iterators (thread-safe via lock) ──────────────────────
        self._google_cycle  = itertools.cycle(self._google_keys)
        self._nvidia_cycle  = itertools.cycle(self._nvidia_keys)
        self._finnhub_cycle = itertools.cycle(self._finnhub_keys)
        self._twelve_cycle  = itertools.cycle(self._twelve_keys)
        self._fmp_cycle     = itertools.cycle(self._fmp_keys) if self._fmp_keys else None
        self._av_cycle      = itertools.cycle(self._av_keys) if self._av_keys else None
        self._newsapi_cycle = itertools.cycle(self._newsapi_keys) if self._newsapi_keys else None
        self._fred_cycle    = itertools.cycle(self._fred_keys) if self._fred_keys else None

        self._lock = threading.Lock()

        logger.info(
            f"KeyManager initialized — "
            f"Google:{len(self._google_keys)}"
            f"NVIDIA:{len(self._nvidia_keys)} Finnhub:{len(self._finnhub_keys)} "
            f"TwelveData:{len(self._twelve_keys)} FMP:{len(self._fmp_keys)} "
            f"AlphaVantage:{len(self._av_keys)} NewsAPI:{len(self._newsapi_keys)} "
            f"FRED:{len(self._fred_keys)}"
        )

    def _load_keys(self, env_var: str, required: bool = True) -> List[str]:
        """Parse comma-separated keys from environment variable."""
        raw = os.getenv(env_var, "")
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        if not keys and required:
            raise ValueError(
                f"[KeyManager] CRITICAL: No keys found for '{env_var}' in .env. "
                f"Add at least 1 key to proceed."
            )
        if not keys and not required:
            logger.warning(f"[KeyManager] Optional provider '{env_var}' has no keys — will use fallbacks.")
        return keys

    # ── LLM Provider Keys ─────────────────────────────────────────────────

    def get_google_key(self) -> str:
        with self._lock:
            return next(self._google_cycle)

    def get_nvidia_key(self) -> str:
        with self._lock:
            return next(self._nvidia_cycle)

    # ── Data Provider Keys ────────────────────────────────────────────────

    def get_finnhub_key(self) -> str:
        with self._lock:
            return next(self._finnhub_cycle)

    def get_twelve_key(self) -> str:
        with self._lock:
            return next(self._twelve_cycle)

    def get_fmp_key(self) -> str | None:
        if not self._fmp_cycle:
            return None
        with self._lock:
            return next(self._fmp_cycle)

    def get_av_key(self) -> str | None:
        if not self._av_cycle:
            return None
        with self._lock:
            return next(self._av_cycle)

    def get_newsapi_key(self) -> str | None:
        if not self._newsapi_cycle:
            return None
        with self._lock:
            return next(self._newsapi_cycle)

    def get_fred_key(self) -> str | None:
        if not self._fred_cycle:
            return None
        with self._lock:
            return next(self._fred_cycle)

    def has_fmp(self) -> bool:
        return bool(self._fmp_keys)

    def has_av(self) -> bool:
        return bool(self._av_keys)

    def has_newsapi(self) -> bool:
        return bool(self._newsapi_keys)

    def has_fred(self) -> bool:
        return bool(self._fred_keys)


# Module-level singleton — import this everywhere
key_manager = KeyManager()
```

---

## SECTION 3 — CONFIG SETTINGS (`backend/app/core/config.py`)

### 3.1 Action

MODIFY `config.py`. Add the following new fields to the existing `Settings` class. Do NOT remove any existing field.

### 3.2 Fields to Add

Locate the `Settings` class in `config.py`. After the last existing field, add:

```python
# ── NEW: Direct LLM Provider Config ─────────────────────────────────────────
google_api_keys: str = ""           # Maps to GOOGLE_API_KEYS
nvidia_api_keys: str = ""           # Maps to NVIDIA_API_KEYS

gemini_flash_model: str = "gemini-2.5-flash"
nvidia_complex_model: str = "qwen/qwen3-235b-a22b"
llm_provider_timeout: int = 35      # Replaces 90s timeout

# ── NEW: Data Provider Config ────────────────────────────────────────────────
finnhub_api_keys: str  = ""         # Maps to FINNHUB_API_KEYS
twelve_data_api_keys: str = ""      # Maps to TWELVE_DATA_API_KEYS
fmp_api_keys: str = ""              # Maps to FMP_API_KEYS
alpha_vantage_keys: str = ""        # Maps to ALPHA_VANTAGE_KEYS
news_api_keys: str = ""             # Maps to NEWS_API_KEYS
fred_api_keys: str = ""             # Maps to FRED_API_KEYS

# ── NEW: Data Fetch Timeouts (seconds) ───────────────────────────────────────
timeout_angel_one: int = 3
timeout_yahoo: int = 5
timeout_fmp: int = 4
timeout_finnhub: int = 4
timeout_alpha_vantage: int = 6
timeout_newsapi: int = 3
timeout_twelve_data: int = 5
timeout_fred: int = 8
timeout_nse_scrape: int = 6
timeout_bse_scrape: int = 6

# ── NEW: AgentState Extension Flags ─────────────────────────────────────────
enable_parallel_phase4: bool = True     # Controls whether Phase 4 runs parallel nodes
enable_artifact_system: bool = True     # Controls whether artifact_type is emitted
```

---

## SECTION 4 — PHASE 3: PARALLEL DATA FETCHING (`backend/app/services/data_provider.py`)

### 4.1 Action

MODIFY the existing `data_provider.py` file. Add all new methods described below. Do NOT remove any existing methods.

If the file does not yet have a `DataProvider` class, create one. If it does, extend it.

### 4.2 Data Assignment Table — Source of Truth

This table defines which API fetches which data type. The AI MUST follow this exactly.

```
┌──────────────────────────┬───────────────────────────────────────────────────┐
│ Data Type                │ Primary → Fallback 1 → Fallback 2                │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ live_price               │ AngelOne → Yahoo Finance → Alpha Vantage          │
│ ohlcv_history            │ Yahoo Finance → AngelOne → Alpha Vantage          │
│ technical_indicators     │ Yahoo Finance (local calc) → Alpha Vantage        │
│ fundamentals             │ FMP → Finnhub → Yahoo Finance                    │
│ sector_context           │ FMP → Finnhub → Yahoo Finance                    │
│ news_headlines           │ NewsAPI → Yahoo Finance RSS → Finnhub news       │
│ macro_context            │ FRED → Alpha Vantage → hardcoded_fallback        │
│ shareholding_pattern     │ Finnhub → NSE scrape → BSE scrape                │
│ revenue_pnl_quarterly    │ FMP → Finnhub → Twelve Data                      │
│ revenue_pnl_annual       │ FMP → Finnhub → Twelve Data                      │
│ corporate_actions        │ Yahoo Finance → FMP → Finnhub                    │
│ (dividends + AGM)        │                                                   │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

### 4.3 Required Data Per Artifact Type

This mapping controls which data types are fetched for each artifact type. Only fetch what is needed.

```python
REQUIRED_DATA_MAP = {
    "price_ticker":        ["live_price"],
    "technical_gauge":     ["live_price", "ohlcv_history", "technical_indicators"],
    "news_feed":           ["news_headlines"],
    "info_card":           [],
    "comparison_table":    ["live_price", "technical_indicators", "fundamentals", "revenue_pnl_quarterly"],
    "screener_table":      ["live_price"],
    "portfolio_breakdown": ["live_price"],
    "full_analysis":       [
        "live_price",
        "ohlcv_history",
        "technical_indicators",
        "fundamentals",
        "sector_context",
        "news_headlines",
        "shareholding_pattern",
        "revenue_pnl_quarterly",
        "corporate_actions",
    ],
    "financial_report":    [
        "fundamentals",
        "revenue_pnl_quarterly",
        "revenue_pnl_annual",
        "shareholding_pattern",
        "corporate_actions",
    ],
}
```

### 4.4 Complete `DataProvider` Class Implementation

Add this complete class to `data_provider.py`. Imports go at the top of the file with existing imports.

```python
# ── NEW IMPORTS (add to top of data_provider.py) ─────────────────────────────
import asyncio
import aiohttp
import json
import logging
import finnhub
from datetime import datetime, timedelta
from typing import Optional
import yfinance as yf

from ..core.key_manager import key_manager
from ..core.config import settings

logger = logging.getLogger(__name__)


# ── REQUIRED DATA MAP ─────────────────────────────────────────────────────────
REQUIRED_DATA_MAP = {
    "price_ticker":        ["live_price"],
    "technical_gauge":     ["live_price", "ohlcv_history", "technical_indicators"],
    "news_feed":           ["news_headlines"],
    "info_card":           [],
    "comparison_table":    ["live_price", "technical_indicators", "fundamentals", "revenue_pnl_quarterly"],
    "screener_table":      ["live_price"],
    "portfolio_breakdown": ["live_price"],
    "full_analysis": [
        "live_price", "ohlcv_history", "technical_indicators",
        "fundamentals", "sector_context", "news_headlines",
        "shareholding_pattern", "revenue_pnl_quarterly", "corporate_actions",
    ],
    "financial_report": [
        "fundamentals", "revenue_pnl_quarterly", "revenue_pnl_annual",
        "shareholding_pattern", "corporate_actions",
    ],
}


class DataProvider:
    """
    Parallel data fetcher for FinSight AI Phase 3.
    
    All public methods are async. Uses asyncio.gather() with
    return_exceptions=True so one failed source never blocks others.
    
    Each data type has a waterfall fallback chain. If all sources fail,
    a structured fallback dict is returned (never None, never raises).
    """

    # ── MASTER ENTRY POINT ────────────────────────────────────────────────────

    async def fetch_all_parallel(
        self,
        symbol: str,
        query: str,
        artifact_type: str,
        comparison_symbols: Optional[list] = None,
    ) -> dict:
        """
        Main Phase 3 entry point. Called from gather_stock_data() node in graph.py.
        
        Args:
            symbol: NSE ticker e.g. "RELIANCE.NS"
            query: Original user query string
            artifact_type: One of the keys in REQUIRED_DATA_MAP
            comparison_symbols: List of additional symbols for comparison_table type
            
        Returns:
            dict with keys matching REQUIRED_DATA_MAP values, all populated
        """
        required = REQUIRED_DATA_MAP.get(artifact_type, ["live_price", "technical_indicators"])
        logger.info(f"[Phase3] Fetching {len(required)} data types for {symbol} | artifact: {artifact_type}")

        # Build task dict — only tasks for required data types
        task_map = {
            "live_price":           lambda: self._fetch_live_price(symbol),
            "ohlcv_history":        lambda: self._fetch_ohlcv_history(symbol),
            "technical_indicators": lambda: self._fetch_technical_indicators(symbol),
            "fundamentals":         lambda: self._fetch_fundamentals(symbol),
            "sector_context":       lambda: self._fetch_sector_context(symbol),
            "news_headlines":       lambda: self._fetch_news(query, symbol),
            "macro_context":        lambda: self._fetch_macro(),
            "shareholding_pattern": lambda: self._fetch_shareholding(symbol),
            "revenue_pnl_quarterly":lambda: self._fetch_financials(symbol, "quarter"),
            "revenue_pnl_annual":   lambda: self._fetch_financials(symbol, "annual"),
            "corporate_actions":    lambda: self._fetch_corporate_actions(symbol),
        }

        active_tasks = {k: task_map[k]() for k in required if k in task_map}

        results = await asyncio.gather(
            *active_tasks.values(),
            return_exceptions=True
        )

        gathered = {}
        for key, result in zip(active_tasks.keys(), results):
            if isinstance(result, Exception):
                logger.warning(f"[Phase3] {key} fetch raised exception: {result}")
                gathered[key] = self._get_fallback(key)
            else:
                gathered[key] = result

        logger.info(f"[Phase3] Completed. Keys populated: {list(gathered.keys())}")
        return gathered

    # ── LIVE PRICE ────────────────────────────────────────────────────────────

    async def _fetch_live_price(self, symbol: str) -> dict:
        """Primary: AngelOne | Fallback: Yahoo Finance | Fallback: Alpha Vantage"""

        # AngelOne — requires user's trading account credentials
        # Only works if ANGEL_ONE_API_KEY is configured
        try:
            async with asyncio.timeout(settings.timeout_angel_one):
                result = await self._angel_one_price(symbol)
                if result:
                    logger.debug(f"[live_price] AngelOne success for {symbol}")
                    return result
        except Exception as e:
            logger.warning(f"[live_price] AngelOne failed: {e}")

        # Fallback: Yahoo Finance
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                result = await self._yahoo_price(symbol)
                if result:
                    logger.debug(f"[live_price] Yahoo success for {symbol}")
                    return result
        except Exception as e:
            logger.warning(f"[live_price] Yahoo failed: {e}")

        # Fallback: Alpha Vantage
        try:
            av_key = key_manager.get_av_key()
            if av_key:
                async with asyncio.timeout(settings.timeout_alpha_vantage):
                    result = await self._alpha_vantage_price(symbol, av_key)
                    if result:
                        logger.debug(f"[live_price] AlphaVantage success for {symbol}")
                        return result
        except Exception as e:
            logger.warning(f"[live_price] AlphaVantage failed: {e}")

        logger.error(f"[live_price] ALL sources failed for {symbol}")
        return self._get_fallback("live_price")

    async def _angel_one_price(self, symbol: str) -> Optional[dict]:
        """AngelOne SmartAPI price fetch — requires session token."""
        angel_key = getattr(settings, 'angel_one_api_key', None)
        if not angel_key:
            return None
        # AngelOne SDK is synchronous — run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        def _sync_fetch():
            try:
                from SmartApi import SmartConnect
                api = SmartConnect(api_key=angel_key)
                nse_symbol = symbol.replace(".NS", "-EQ").replace(".BO", "")
                data = api.ltpData("NSE", nse_symbol, "")
                if data and data.get("status"):
                    ltp = data["data"]["ltp"]
                    return {
                        "current_price": ltp,
                        "symbol": symbol,
                        "source": "angel_one",
                        "currency": "INR",
                    }
            except Exception as e:
                logger.warning(f"AngelOne SDK error: {e}")
            return None
        return await loop.run_in_executor(None, _sync_fetch)

    async def _yahoo_price(self, symbol: str) -> dict:
        """Yahoo Finance price via yfinance — run in thread pool."""
        loop = asyncio.get_event_loop()
        def _sync():
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            return {
                "current_price": info.last_price,
                "previous_close": info.previous_close,
                "day_high": info.day_high,
                "day_low": info.day_low,
                "volume": info.three_month_average_volume,
                "market_cap": getattr(info, "market_cap", None),
                "symbol": symbol,
                "source": "yahoo_finance",
                "currency": "INR",
            }
        return await loop.run_in_executor(None, _sync)

    async def _alpha_vantage_price(self, symbol: str, api_key: str) -> Optional[dict]:
        """Alpha Vantage GLOBAL_QUOTE endpoint."""
        av_symbol = symbol.replace(".NS", ".BSE").replace(".BO", ".BSE")
        url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={av_symbol}&apikey={api_key}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                data = await resp.json()
                gq = data.get("Global Quote", {})
                if not gq:
                    return None
                return {
                    "current_price": float(gq.get("05. price", 0)),
                    "previous_close": float(gq.get("08. previous close", 0)),
                    "volume": int(gq.get("06. volume", 0)),
                    "symbol": symbol,
                    "source": "alpha_vantage",
                    "currency": "INR",
                }

    # ── OHLCV HISTORY ─────────────────────────────────────────────────────────

    async def _fetch_ohlcv_history(self, symbol: str, period: str = "6mo") -> dict:
        """Primary: Yahoo Finance | Fallback: Alpha Vantage"""
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period=period)
                    if hist.empty:
                        return None
                    return {
                        "dates": hist.index.strftime("%Y-%m-%d").tolist(),
                        "open":  hist["Open"].round(2).tolist(),
                        "high":  hist["High"].round(2).tolist(),
                        "low":   hist["Low"].round(2).tolist(),
                        "close": hist["Close"].round(2).tolist(),
                        "volume": hist["Volume"].tolist(),
                        "symbol": symbol,
                        "source": "yahoo_finance",
                    }
                result = await loop.run_in_executor(None, _sync)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[ohlcv] Yahoo failed: {e}")

        return self._get_fallback("ohlcv_history")

    # ── TECHNICAL INDICATORS ──────────────────────────────────────────────────

    async def _fetch_technical_indicators(self, symbol: str) -> dict:
        """
        Primary: Yahoo Finance OHLCV + local calculation (fastest, no rate limit)
        Fallback: Alpha Vantage pre-calculated endpoints
        """
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    ticker = yf.Ticker(symbol)
                    hist = ticker.history(period="3mo")
                    if hist.empty or len(hist) < 20:
                        return None
                    closes = hist["Close"]
                    # RSI-14
                    delta = closes.diff()
                    gain = delta.clip(lower=0).rolling(14).mean()
                    loss = (-delta.clip(upper=0)).rolling(14).mean()
                    rs = gain / loss
                    rsi = float(round(100 - (100 / (1 + rs.iloc[-1])), 2))
                    # SMA
                    sma_20 = float(round(closes.rolling(20).mean().iloc[-1], 2))
                    sma_50 = float(round(closes.rolling(50).mean().iloc[-1], 2)) if len(closes) >= 50 else None
                    # EMA
                    ema_12 = float(round(closes.ewm(span=12).mean().iloc[-1], 2))
                    ema_26 = float(round(closes.ewm(span=26).mean().iloc[-1], 2))
                    # MACD
                    macd_line = ema_12 - ema_26
                    signal_line = float(round(closes.ewm(span=9).mean().iloc[-1], 2))
                    macd_hist = macd_line - signal_line
                    current_price = float(closes.iloc[-1])
                    return {
                        "rsi_14": rsi,
                        "rsi_signal": "OVERBOUGHT" if rsi > 70 else "OVERSOLD" if rsi < 30 else "NEUTRAL",
                        "sma_20": sma_20,
                        "sma_50": sma_50,
                        "ema_12": ema_12,
                        "ema_26": ema_26,
                        "macd_line": round(macd_line, 4),
                        "macd_signal": signal_line,
                        "macd_histogram": round(macd_hist, 4),
                        "macd_trend": "BULLISH" if macd_hist > 0 else "BEARISH",
                        "price_vs_sma20_pct": round(((current_price - sma_20) / sma_20) * 100, 2),
                        "symbol": symbol,
                        "source": "yahoo_local_calc",
                    }
                result = await loop.run_in_executor(None, _sync)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[technicals] Yahoo local calc failed: {e}")

        # Fallback: Alpha Vantage RSI
        try:
            av_key = key_manager.get_av_key()
            if av_key:
                async with asyncio.timeout(settings.timeout_alpha_vantage):
                    av_symbol = symbol.replace(".NS", ".BSE")
                    url = (
                        f"https://www.alphavantage.co/query?function=RSI"
                        f"&symbol={av_symbol}&interval=daily&time_period=14"
                        f"&series_type=close&apikey={av_key}"
                    )
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as resp:
                            data = await resp.json()
                            rsi_data = data.get("Technical Analysis: RSI", {})
                            if rsi_data:
                                latest_rsi = float(list(rsi_data.values())[0]["RSI"])
                                return {
                                    "rsi_14": round(latest_rsi, 2),
                                    "rsi_signal": "OVERBOUGHT" if latest_rsi > 70 else "OVERSOLD" if latest_rsi < 30 else "NEUTRAL",
                                    "symbol": symbol,
                                    "source": "alpha_vantage",
                                }
        except Exception as e:
            logger.warning(f"[technicals] AlphaVantage failed: {e}")

        return self._get_fallback("technical_indicators")

    # ── FUNDAMENTALS ──────────────────────────────────────────────────────────

    async def _fetch_fundamentals(self, symbol: str) -> dict:
        """Primary: FMP | Fallback: Finnhub | Fallback: Yahoo Finance"""

        # FMP
        try:
            fmp_key = key_manager.get_fmp_key()
            if fmp_key:
                async with asyncio.timeout(settings.timeout_fmp):
                    nse_sym = symbol.replace(".NS", ".NS").replace(".BO", ".BO")
                    url = f"https://financialmodelingprep.com/api/v3/profile/{nse_sym}?apikey={fmp_key}"
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as resp:
                            data = await resp.json()
                            if data and isinstance(data, list) and data[0]:
                                d = data[0]
                                return {
                                    "pe_ratio": d.get("pe"),
                                    "market_cap": d.get("mktCap"),
                                    "eps": d.get("eps"),
                                    "beta": d.get("beta"),
                                    "52w_high": d.get("yearHigh"),
                                    "52w_low": d.get("yearLow"),
                                    "dividend_yield": d.get("lastDiv"),
                                    "sector": d.get("sector"),
                                    "industry": d.get("industry"),
                                    "description": d.get("description", "")[:300],
                                    "symbol": symbol,
                                    "source": "fmp",
                                }
        except Exception as e:
            logger.warning(f"[fundamentals] FMP failed: {e}")

        # Finnhub
        try:
            fh_key = key_manager.get_finnhub_key()
            async with asyncio.timeout(settings.timeout_finnhub):
                loop = asyncio.get_event_loop()
                def _sync():
                    client = finnhub.Client(api_key=fh_key)
                    fh_symbol = symbol.replace(".NS", "").replace(".BO", "")
                    metrics = client.company_basic_financials(fh_symbol, "all")
                    profile = client.company_profile2(symbol=fh_symbol)
                    m = metrics.get("metric", {})
                    return {
                        "pe_ratio": m.get("peTTM"),
                        "market_cap": m.get("marketCapitalization"),
                        "eps": m.get("epsTTM"),
                        "beta": m.get("beta"),
                        "52w_high": m.get("52WeekHigh"),
                        "52w_low": m.get("52WeekLow"),
                        "dividend_yield": m.get("dividendYieldIndicatedAnnual"),
                        "sector": profile.get("finnhubIndustry"),
                        "symbol": symbol,
                        "source": "finnhub",
                    }
                return await loop.run_in_executor(None, _sync)
        except Exception as e:
            logger.warning(f"[fundamentals] Finnhub failed: {e}")

        # Yahoo Finance fallback
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    return {
                        "pe_ratio": info.get("trailingPE"),
                        "market_cap": info.get("marketCap"),
                        "eps": info.get("trailingEps"),
                        "beta": info.get("beta"),
                        "52w_high": info.get("fiftyTwoWeekHigh"),
                        "52w_low": info.get("fiftyTwoWeekLow"),
                        "dividend_yield": info.get("dividendYield"),
                        "sector": info.get("sector"),
                        "industry": info.get("industry"),
                        "symbol": symbol,
                        "source": "yahoo_finance",
                    }
                return await loop.run_in_executor(None, _sync)
        except Exception as e:
            logger.warning(f"[fundamentals] Yahoo failed: {e}")

        return self._get_fallback("fundamentals")

    # ── SHAREHOLDING PATTERN ──────────────────────────────────────────────────

    async def _fetch_shareholding(self, symbol: str) -> dict:
        """Primary: Finnhub | Fallback: NSE Scrape | Fallback: BSE Scrape"""

        # Finnhub institutional ownership
        try:
            fh_key = key_manager.get_finnhub_key()
            async with asyncio.timeout(settings.timeout_finnhub):
                loop = asyncio.get_event_loop()
                def _sync():
                    client = finnhub.Client(api_key=fh_key)
                    fh_symbol = symbol.replace(".NS", "").replace(".BO", "")
                    data = client.ownership(fh_symbol, limit=5)
                    if data and data.get("ownership"):
                        owners = data["ownership"]
                        return {
                            "top_institutional_holders": [
                                {"name": o.get("name"), "pct": o.get("share")}
                                for o in owners[:5]
                            ],
                            "symbol": symbol,
                            "source": "finnhub",
                            "note": "Institutional ownership data — promoter/FII/DII breakdown via NSE",
                        }
                    return None
                result = await loop.run_in_executor(None, _sync)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[shareholding] Finnhub failed: {e}")

        # NSE Scrape
        try:
            async with asyncio.timeout(settings.timeout_nse_scrape):
                result = await self._nse_scrape_shareholding(symbol)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[shareholding] NSE scrape failed: {e}")

        # BSE Scrape
        try:
            async with asyncio.timeout(settings.timeout_bse_scrape):
                result = await self._bse_scrape_shareholding(symbol)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[shareholding] BSE scrape failed: {e}")

        return self._get_fallback("shareholding_pattern")

    async def _nse_scrape_shareholding(self, symbol: str) -> Optional[dict]:
        """NSE official shareholding endpoint — requires session cookie."""
        nse_symbol = symbol.replace(".NS", "").replace(".BO", "")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.nseindia.com",
            "Accept": "application/json",
        }
        async with aiohttp.ClientSession() as session:
            # Establish session cookie first
            await session.get("https://www.nseindia.com", headers=headers)
            url = f"https://www.nseindia.com/api/shareholding-patterns?symbol={nse_symbol}"
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data:
                        # Parse shareholding categories
                        categories = data.get("data", [{}])[0].get("shareHoldingList", [])
                        result = {"symbol": symbol, "source": "nse_official", "quarters": []}
                        for cat in categories:
                            result["quarters"].append({
                                "category": cat.get("category"),
                                "percentage": cat.get("percentage"),
                            })
                        return result
        return None

    async def _bse_scrape_shareholding(self, symbol: str) -> Optional[dict]:
        """BSE shareholding API fallback."""
        # BSE uses scrip codes, not symbols — look up from yfinance info
        try:
            loop = asyncio.get_event_loop()
            bse_code = await loop.run_in_executor(
                None,
                lambda: yf.Ticker(symbol).info.get("exchange", "")
            )
            if not bse_code:
                return None
            url = f"https://api.bseindia.com/BseIndiaAPI/api/ShareholdingPatterns/w?scripcode={bse_code}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return {"symbol": symbol, "source": "bse_official", "raw": data}
        except Exception as e:
            logger.warning(f"BSE scrape inner error: {e}")
        return None

    # ── REVENUE + P&L STATEMENTS ──────────────────────────────────────────────

    async def _fetch_financials(self, symbol: str, period: str = "quarter") -> dict:
        """
        Primary: FMP income statement
        Fallback: Finnhub financials
        Fallback: Twelve Data income statement
        period: "quarter" | "annual"
        """

        # FMP
        try:
            fmp_key = key_manager.get_fmp_key()
            if fmp_key:
                async with asyncio.timeout(settings.timeout_fmp):
                    url = (
                        f"https://financialmodelingprep.com/api/v3/income-statement/{symbol}"
                        f"?period={period}&limit=8&apikey={fmp_key}"
                    )
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as resp:
                            data = await resp.json()
                            if data and isinstance(data, list) and len(data) > 0:
                                return {
                                    "period": period,
                                    "statements": [
                                        {
                                            "date": s.get("date"),
                                            "revenue": s.get("revenue"),
                                            "gross_profit": s.get("grossProfit"),
                                            "operating_income": s.get("operatingIncome"),
                                            "net_income": s.get("netIncome"),
                                            "eps": s.get("eps"),
                                            "ebitda": s.get("ebitda"),
                                        }
                                        for s in data[:8]
                                    ],
                                    "symbol": symbol,
                                    "source": "fmp",
                                }
        except Exception as e:
            logger.warning(f"[financials/{period}] FMP failed: {e}")

        # Finnhub financials
        try:
            fh_key = key_manager.get_finnhub_key()
            async with asyncio.timeout(settings.timeout_finnhub):
                loop = asyncio.get_event_loop()
                def _sync():
                    client = finnhub.Client(api_key=fh_key)
                    fh_symbol = symbol.replace(".NS", "").replace(".BO", "")
                    freq = "quarterly" if period == "quarter" else "annual"
                    data = client.financials_reported(symbol=fh_symbol, freq=freq, count=8)
                    reports = data.get("data", [])
                    if not reports:
                        return None
                    return {
                        "period": period,
                        "statements": reports[:8],
                        "symbol": symbol,
                        "source": "finnhub",
                    }
                result = await loop.run_in_executor(None, _sync)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[financials/{period}] Finnhub failed: {e}")

        # Twelve Data
        try:
            td_key = key_manager.get_twelve_key()
            async with asyncio.timeout(settings.timeout_twelve_data):
                td_symbol = symbol.replace(".NS", ":NSE").replace(".BO", ":BSE")
                url = (
                    f"https://api.twelvedata.com/income_statement"
                    f"?symbol={td_symbol}&period={period}&apikey={td_key}"
                )
                async with aiohttp.ClientSession() as session:
                    async with session.get(url) as resp:
                        data = await resp.json()
                        if data.get("status") == "ok" and data.get("income_statement"):
                            statements = data["income_statement"]
                            return {
                                "period": period,
                                "statements": statements[:8],
                                "symbol": symbol,
                                "source": "twelve_data",
                            }
        except Exception as e:
            logger.warning(f"[financials/{period}] TwelveData failed: {e}")

        return self._get_fallback("revenue_pnl_quarterly")

    # ── NEWS HEADLINES ────────────────────────────────────────────────────────

    async def _fetch_news(self, query: str, symbol: str) -> dict:
        """Primary: NewsAPI | Fallback: Yahoo Finance RSS | Fallback: Finnhub news"""

        # NewsAPI
        try:
            news_key = key_manager.get_newsapi_key()
            if news_key:
                async with asyncio.timeout(settings.timeout_newsapi):
                    company_name = symbol.replace(".NS", "").replace(".BO", "")
                    url = (
                        f"https://newsapi.org/v2/everything"
                        f"?q={company_name}+stock+India"
                        f"&language=en&sortBy=publishedAt&pageSize=10"
                        f"&apiKey={news_key}"
                    )
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as resp:
                            data = await resp.json()
                            articles = data.get("articles", [])
                            if articles:
                                return {
                                    "articles": [
                                        {
                                            "title": a.get("title"),
                                            "source": a.get("source", {}).get("name"),
                                            "published_at": a.get("publishedAt"),
                                            "url": a.get("url"),
                                        }
                                        for a in articles[:8]
                                    ],
                                    "symbol": symbol,
                                    "source": "newsapi",
                                }
        except Exception as e:
            logger.warning(f"[news] NewsAPI failed: {e}")

        # Yahoo Finance RSS
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    ticker = yf.Ticker(symbol)
                    news = ticker.news
                    if not news:
                        return None
                    return {
                        "articles": [
                            {
                                "title": n.get("title"),
                                "source": n.get("publisher"),
                                "published_at": str(n.get("providerPublishTime")),
                                "url": n.get("link"),
                            }
                            for n in news[:8]
                        ],
                        "symbol": symbol,
                        "source": "yahoo_finance",
                    }
                result = await loop.run_in_executor(None, _sync)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[news] Yahoo RSS failed: {e}")

        # Finnhub news
        try:
            fh_key = key_manager.get_finnhub_key()
            async with asyncio.timeout(settings.timeout_finnhub):
                loop = asyncio.get_event_loop()
                def _sync():
                    client = finnhub.Client(api_key=fh_key)
                    fh_symbol = symbol.replace(".NS", "").replace(".BO", "")
                    today = datetime.now().strftime("%Y-%m-%d")
                    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
                    news = client.company_news(fh_symbol, _from=week_ago, to=today)
                    if not news:
                        return None
                    return {
                        "articles": [
                            {
                                "title": n.get("headline"),
                                "source": n.get("source"),
                                "published_at": str(n.get("datetime")),
                                "url": n.get("url"),
                            }
                            for n in news[:8]
                        ],
                        "symbol": symbol,
                        "source": "finnhub",
                    }
                return await loop.run_in_executor(None, _sync)
        except Exception as e:
            logger.warning(f"[news] Finnhub news failed: {e}")

        return self._get_fallback("news_headlines")

    # ── CORPORATE ACTIONS (Dividends + AGM) ──────────────────────────────────

    async def _fetch_corporate_actions(self, symbol: str) -> dict:
        """Primary: Yahoo Finance | Fallback: FMP | Fallback: Finnhub"""

        # Yahoo Finance — already in stack, handles dividends well
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    ticker = yf.Ticker(symbol)
                    divs = ticker.dividends
                    calendar = ticker.calendar
                    actions = ticker.actions
                    div_list = []
                    if not divs.empty:
                        recent_divs = divs.tail(8)
                        div_list = [
                            {"date": str(d), "amount": round(float(v), 4)}
                            for d, v in recent_divs.items()
                        ]
                    upcoming = {}
                    if calendar is not None and not calendar.empty:
                        if hasattr(calendar, 'to_dict'):
                            upcoming = calendar.to_dict()
                    return {
                        "dividend_history": div_list,
                        "upcoming_events": upcoming,
                        "symbol": symbol,
                        "source": "yahoo_finance",
                    }
                result = await loop.run_in_executor(None, _sync)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"[corporate_actions] Yahoo failed: {e}")

        # FMP dividends
        try:
            fmp_key = key_manager.get_fmp_key()
            if fmp_key:
                async with asyncio.timeout(settings.timeout_fmp):
                    url = (
                        f"https://financialmodelingprep.com/api/v3/historical-price-full"
                        f"/stock_dividend/{symbol}?apikey={fmp_key}"
                    )
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as resp:
                            data = await resp.json()
                            hist = data.get("historical", [])
                            if hist:
                                return {
                                    "dividend_history": [
                                        {
                                            "date": d.get("date"),
                                            "amount": d.get("dividend"),
                                            "record_date": d.get("recordDate"),
                                            "ex_date": d.get("adjDividend"),
                                        }
                                        for d in hist[:8]
                                    ],
                                    "symbol": symbol,
                                    "source": "fmp",
                                }
        except Exception as e:
            logger.warning(f"[corporate_actions] FMP failed: {e}")

        return self._get_fallback("corporate_actions")

    # ── MACRO CONTEXT ─────────────────────────────────────────────────────────

    async def _fetch_macro(self) -> dict:
        """Primary: FRED | Fallback: Alpha Vantage | Fallback: hardcoded last-known values"""
        try:
            fred_key = key_manager.get_fred_key()
            if fred_key:
                async with asyncio.timeout(settings.timeout_fred):
                    # FRED series: T10Y2Y (yield curve), CPIAUCSL (CPI), UNRATE (unemployment)
                    urls = {
                        "yield_curve": f"https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key={fred_key}&file_type=json&limit=1&sort_order=desc",
                        "cpi": f"https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key={fred_key}&file_type=json&limit=1&sort_order=desc",
                        "unemployment": f"https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key={fred_key}&file_type=json&limit=1&sort_order=desc",
                    }
                    async with aiohttp.ClientSession() as session:
                        results = {}
                        for name, url in urls.items():
                            async with session.get(url) as resp:
                                data = await resp.json()
                                obs = data.get("observations", [{}])
                                results[name] = obs[-1].get("value") if obs else "N/A"
                        return {**results, "source": "fred"}
        except Exception as e:
            logger.warning(f"[macro] FRED failed: {e}")

        # Hardcoded fallback — macro changes slowly, last-known is acceptable
        return {
            "yield_curve": "0.25",
            "cpi": "312.0",
            "unemployment": "4.1",
            "source": "hardcoded_fallback",
            "note": "Live macro data unavailable — using last known values",
        }

    async def _fetch_sector_context(self, symbol: str) -> dict:
        """FMP sector peers | Finnhub peers | Yahoo sector info"""
        try:
            fmp_key = key_manager.get_fmp_key()
            if fmp_key:
                async with asyncio.timeout(settings.timeout_fmp):
                    url = f"https://financialmodelingprep.com/api/v3/stock_peers?symbol={symbol}&apikey={fmp_key}"
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as resp:
                            data = await resp.json()
                            if data and isinstance(data, list):
                                return {"peers": data[0].get("peersList", [])[:5], "symbol": symbol, "source": "fmp"}
        except Exception as e:
            logger.warning(f"[sector] FMP peers failed: {e}")

        return self._get_fallback("sector_context")

    # ── FALLBACK STRUCTURES ───────────────────────────────────────────────────

    def _get_fallback(self, data_type: str) -> dict:
        """Returns a safe structured fallback for any data type."""
        fallbacks = {
            "live_price":            {"current_price": None, "source": "unavailable", "error": True},
            "ohlcv_history":         {"dates": [], "close": [], "source": "unavailable", "error": True},
            "technical_indicators":  {"rsi_14": None, "macd_trend": "UNKNOWN", "source": "unavailable", "error": True},
            "fundamentals":          {"pe_ratio": None, "market_cap": None, "source": "unavailable", "error": True},
            "sector_context":        {"peers": [], "source": "unavailable", "error": True},
            "news_headlines":        {"articles": [], "source": "unavailable", "error": True},
            "macro_context":         {"yield_curve": "N/A", "source": "unavailable", "error": True},
            "shareholding_pattern":  {"promoter": "N/A", "fii": "N/A", "dii": "N/A", "public": "N/A", "source": "unavailable", "error": True},
            "revenue_pnl_quarterly": {"statements": [], "period": "quarter", "source": "unavailable", "error": True},
            "revenue_pnl_annual":    {"statements": [], "period": "annual", "source": "unavailable", "error": True},
            "corporate_actions":     {"dividend_history": [], "source": "unavailable", "error": True},
        }
        return fallbacks.get(data_type, {"source": "unavailable", "error": True})


# Module-level singleton
data_provider = DataProvider()
```

---

## SECTION 5 — PHASE 2 & PHASE 4: GRAPH.PY MODIFICATIONS

### 5.1 AgentState Extension

In `graph.py`, find the `AgentState` TypedDict. ADD these new fields. Never remove existing ones.

```python
class AgentState(TypedDict):
    # ── ALL EXISTING FIELDS — DO NOT TOUCH ──────────────────────────────────
    query: str
    intent_category: str
    intent_symbol: Optional[str]
    intent_confidence: float
    query_complexity: str
    gathered_data: dict
    final_response: str
    error: Optional[str]
    # ── NEW FIELDS ───────────────────────────────────────────────────────────
    artifact_type: str               # Decided in Phase 2, drives Phase 3+4
    artifact_data: dict              # Populated by Phase 4 parallel nodes
    artifact_text: Optional[str]     # Optional explanatory text from Sequencer
    technicals_draft: dict           # Phase 4 Technicals Node output
    news_draft: dict                 # Phase 4 News Node output
    fundamentals_draft: dict         # Phase 4 Fundamentals Node output
```

### 5.2 Artifact Type Decision Table

Add this dict at module level in `graph.py` (after imports, before class/function definitions):

```python
# ── ARTIFACT TYPE INFERENCE RULES ────────────────────────────────────────────
# classify_intent LLM uses this logic to assign artifact_type.
# The LLM must output one of these exact string values.

ARTIFACT_TYPE_RULES = {
    # Query pattern              → artifact_type
    "price only":               "price_ticker",
    "technical analysis only":  "technical_gauge",
    "news/headlines only":      "news_feed",
    "education/definition":     "info_card",
    "compare two stocks":       "comparison_table",
    "top gainers/screener":     "screener_table",
    "portfolio query":          "portfolio_breakdown",
    "full stock analysis":      "full_analysis",
    "financial statements":     "financial_report",
}

# Used by Phase 2 LLM prompt to know valid values
VALID_ARTIFACT_TYPES = list(ARTIFACT_TYPE_RULES.values())
```

### 5.3 COMPLEX_KEYWORDS Expansion

Find `COMPLEX_KEYWORDS` (or `complex_patterns`) in `graph.py`. ADD these terms to the existing list. Do not remove any existing keywords.

```python
# ADD TO EXISTING COMPLEX_KEYWORDS LIST:
additional_complex_keywords = [
    "long term", "short term", "long-term", "short-term",
    "fundamental", "intrinsic value", "valuation", "dcf",
    "earnings", "quarterly results", "annual report", "balance sheet",
    "should i buy", "should i sell", "good investment", "worth buying",
    "growth potential", "target price", "fair value", "overvalued", "undervalued",
    "technical analysis", "chart pattern", "breakout", "support", "resistance",
    "shareholding", "promoter", "fii holding", "dividend", "quarterly profit",
    "revenue", "net profit", "operating profit", "ebitda", "cash flow",
    "debt", "leverage", "roe", "roce", "margin", "agm",
]
```

### 5.4 Regex Fast-Path for classify_intent

Find the `classify_intent` function in `graph.py`. ADD the fast-path logic at the very beginning of the function body, before any LLM call.

```python
# ── ADD THESE AT MODULE LEVEL (after imports) ─────────────────────────────────
import re

_TICKER_REGEX = re.compile(
    r'\b(RELIANCE|TCS|INFY|HDFCBANK|SBIN|ICICIBANK|WIPRO|AXISBANK|BAJFINANCE|'
    r'SUNPHARMA|LT|TATASTEEL|ADANI|ONGC|COALINDIA|NTPC|POWERGRID|HINDUNILVR|'
    r'NESTLEIND|MARUTI|TATAMOTORS|BHARTIARTL|M&M|JSWSTEEL|INDIGO|ASIANPAINT|'
    r'HCLTECH|TECHM|ULTRACEMCO|TITAN|BAJAJFINSV|KOTAK|BPCL|HEROMOTOCO)\b',
    re.IGNORECASE
)

_FAST_CATEGORY_MAP = {
    "news":      ["news", "headline", "update", "latest", "happened", "announcement"],
    "portfolio": ["portfolio", "holding", "bought", "sold", "position", "balance"],
    "market":    ["nifty", "sensex", "market", "index", "sector", "top stocks", "gainers", "losers"],
    "general":   ["what is", "explain", "how does", "define", "meaning", "what are"],
}

_FAST_ARTIFACT_MAP = {
    "news":      "news_feed",
    "portfolio": "portfolio_breakdown",
    "market":    "screener_table",
    "general":   "info_card",
    "stock":     "full_analysis",
}

def _fast_classify(query: str) -> Optional[dict]:
    """
    Regex fast-path for classify_intent.
    Returns classification dict if confident, else None (→ use LLM).
    """
    q = query.lower()
    ticker_match = _TICKER_REGEX.search(query)

    # Simple price query
    if any(w in q for w in ["price", "ltp", "current price", "trading at"]) and ticker_match:
        return {
            "category": "stock",
            "symbol": f"{ticker_match.group().upper()}.NS",
            "confidence": 0.95,
            "artifact_type": "price_ticker",
        }

    # Category detection
    for category, keywords in _FAST_CATEGORY_MAP.items():
        if any(kw in q for kw in keywords):
            return {
                "category": category,
                "symbol": f"{ticker_match.group().upper()}.NS" if ticker_match else None,
                "confidence": 0.90,
                "artifact_type": _FAST_ARTIFACT_MAP.get(category, "full_analysis"),
            }

    # Ticker found, no category match → full analysis
    if ticker_match:
        return {
            "category": "stock",
            "symbol": f"{ticker_match.group().upper()}.NS",
            "confidence": 0.85,
            "artifact_type": "full_analysis",
        }

    return None  # Cannot classify → LLM path


# ── INSIDE classify_intent() — ADD AT THE TOP OF THE FUNCTION BODY ────────────
def classify_intent(state: AgentState) -> AgentState:
    # FAST PATH — regex (<1ms, no API call)
    fast_result = _fast_classify(state["query"])
    if fast_result:
        logger.info(f"[classify_intent] FAST PATH: {fast_result}")
        return {
            **state,
            "intent_category":   fast_result["category"],
            "intent_symbol":     fast_result["symbol"],
            "intent_confidence": fast_result["confidence"],
            "artifact_type":     fast_result["artifact_type"],
            "gathered_data":     {},
            "artifact_data":     {},
            "technicals_draft":  {},
            "news_draft":        {},
            "fundamentals_draft":{},
        }

    # SLOW PATH — LLM (only if regex couldn't classify)
    # ... rest of existing LLM logic below, UNCHANGED ...
    # IMPORTANT: Update the LLM prompt to also output artifact_type field
    # New JSON format: {"category": "stock", "symbol": "TCS.NS", "confidence": 0.9, "artifact_type": "full_analysis"}
```

### 5.5 Update LLM Prompt in classify_intent

In the existing `classify_intent` LLM call, update the system prompt string to include artifact_type in the expected output. Find the prompt string and append:

```
Add to existing classify_intent system prompt:
"Also include 'artifact_type' field with one of these exact values:
price_ticker, technical_gauge, news_feed, info_card, comparison_table,
screener_table, portfolio_breakdown, full_analysis, financial_report.
Choose based on what the user is asking for.
Output format: {\"category\": \"...\", \"symbol\": \"...\", \"confidence\": 0.9, \"artifact_type\": \"...\"}"
```

### 5.6 Update gather_stock_data Node

Find the `gather_stock_data` function in `graph.py`. Replace the data fetching logic inside it with a call to the new `DataProvider`. Keep the function signature and state management the same.

```python
# ADD THIS IMPORT at top of graph.py:
from ..services.data_provider import data_provider, REQUIRED_DATA_MAP

# MODIFY gather_stock_data() — replace internal fetching logic with:
async def gather_stock_data(state: AgentState) -> AgentState:
    symbol = state.get("intent_symbol")
    artifact_type = state.get("artifact_type", "full_analysis")
    
    if not symbol:
        logger.warning("[Phase3] No symbol in state — skipping data fetch")
        return {**state, "gathered_data": {}}

    logger.info(f"[Phase3] Starting parallel fetch for {symbol} | artifact: {artifact_type}")
    
    gathered = await data_provider.fetch_all_parallel(
        symbol=symbol,
        query=state["query"],
        artifact_type=artifact_type,
    )
    
    return {**state, "gathered_data": gathered}
```

### 5.7 Phase 4 — Three Parallel Specialist Nodes

ADD these three new node functions to `graph.py`. These are additional nodes — do NOT remove or replace the existing synthesis nodes. These will be connected in parallel.

```python
# ── PHASE 4: PARALLEL SPECIALIST NODES ───────────────────────────────────────

async def phase4_technicals_node(state: AgentState) -> AgentState:
    """
    Specialist Node A: Technical Analysis
    Input: gathered_data["technical_indicators"] + gathered_data["live_price"]
    Output: technicals_draft (structured JSON, ~150 tokens)
    Model: Gemini Flash (fast, JSON mode, sufficient for pattern reading)
    """
    tech_data = state.get("gathered_data", {}).get("technical_indicators", {})
    price_data = state.get("gathered_data", {}).get("live_price", {})
    symbol = state.get("intent_symbol", "")
    complexity = state.get("query_complexity", "medium")

    if not tech_data or tech_data.get("error"):
        return {**state, "technicals_draft": {"error": True, "source": "no_data"}}

    system_prompt = """You are a technical analysis specialist for Indian stocks.
Analyze the provided technical indicators and return ONLY a JSON object.
No prose, no markdown, no explanation outside the JSON.
Required format:
{
  "rsi": <number>,
  "rsi_signal": "OVERBOUGHT|NEUTRAL|OVERSOLD",
  "rsi_interpretation": "<10 words max>",
  "macd_trend": "BULLISH|BEARISH|NEUTRAL",
  "macd_interpretation": "<10 words max>",
  "sma_trend": "ABOVE|BELOW|AT",
  "price_vs_sma20_pct": <number>,
  "overall_technical_signal": "STRONG_BUY|BUY|NEUTRAL|SELL|STRONG_SELL",
  "key_levels": {"support": <number or null>, "resistance": <number or null>},
  "brief_text": "<1 sentence summary, max 20 words>"
}"""

    user_message = f"""
Symbol: {symbol}
RSI-14: {tech_data.get('rsi_14')}
RSI Signal: {tech_data.get('rsi_signal')}
MACD Trend: {tech_data.get('macd_trend')}
MACD Histogram: {tech_data.get('macd_histogram')}
SMA-20: {tech_data.get('sma_20')}
SMA-50: {tech_data.get('sma_50')}
Current Price: {price_data.get('current_price')}
Price vs SMA20 %: {tech_data.get('price_vs_sma20_pct')}
"""

    try:
        llm = _get_llm("phase4_technicals", complexity, 0)
        response = await llm.ainvoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ])
        content = response.content.strip()
        # Strip markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        draft = json.loads(content)
        return {**state, "technicals_draft": draft}
    except Exception as e:
        logger.error(f"[Phase4/Technicals] LLM failed: {e}")
        return {**state, "technicals_draft": {
            "rsi": tech_data.get("rsi_14"),
            "rsi_signal": tech_data.get("rsi_signal", "UNKNOWN"),
            "macd_trend": tech_data.get("macd_trend", "UNKNOWN"),
            "overall_technical_signal": "NEUTRAL",
            "brief_text": "Technical data available but analysis failed.",
            "error_fallback": True,
        }}


async def phase4_news_node(state: AgentState) -> AgentState:
    """
    Specialist Node B: News Sentiment Analysis
    Input: gathered_data["news_headlines"]
    Output: news_draft (structured JSON, ~150 tokens)
    Model: Gemini Flash (fast, sufficient for sentiment)
    """
    news_data = state.get("gathered_data", {}).get("news_headlines", {})
    symbol = state.get("intent_symbol", "")
    complexity = state.get("query_complexity", "medium")

    articles = news_data.get("articles", [])
    if not articles:
        return {**state, "news_draft": {"error": True, "articles": [], "mood": "UNKNOWN"}}

    headlines_text = "\n".join([
        f"- {a.get('title', '')} ({a.get('source', '')})"
        for a in articles[:6]
    ])

    system_prompt = """You are a financial news sentiment analyst for Indian stock markets.
Analyze the provided headlines and return ONLY a JSON object.
No prose, no markdown, no explanation outside the JSON.
Required format:
{
  "mood": "BULLISH|BEARISH|NEUTRAL|MIXED",
  "positive_count": <number>,
  "negative_count": <number>,
  "neutral_count": <number>,
  "total_analyzed": <number>,
  "top_headline": "<most impactful headline, verbatim>",
  "key_theme": "<main topic in 5 words>",
  "brief_text": "<1 sentence market implication, max 20 words>"
}"""

    try:
        llm = _get_llm("phase4_news", complexity, 0)
        response = await llm.ainvoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Symbol: {symbol}\n\nHeadlines:\n{headlines_text}"},
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        draft = json.loads(content)
        return {**state, "news_draft": draft}
    except Exception as e:
        logger.error(f"[Phase4/News] LLM failed: {e}")
        return {**state, "news_draft": {
            "mood": "UNKNOWN",
            "total_analyzed": len(articles),
            "brief_text": "News fetched but sentiment analysis failed.",
            "error_fallback": True,
        }}


async def phase4_fundamentals_node(state: AgentState) -> AgentState:
    """
    Specialist Node C: Fundamental Analysis
    Input: gathered_data["fundamentals"] + gathered_data["revenue_pnl_quarterly"] + gathered_data["shareholding_pattern"]
    Output: fundamentals_draft (structured JSON, ~200 tokens)
    Model: NVIDIA Qwen 3.5 for complex queries, Gemini Flash for simple/medium
    (Only this node needs heavy reasoning for valuation conclusions)
    """
    fund_data  = state.get("gathered_data", {}).get("fundamentals", {})
    pnl_data   = state.get("gathered_data", {}).get("revenue_pnl_quarterly", {})
    share_data = state.get("gathered_data", {}).get("shareholding_pattern", {})
    corp_data  = state.get("gathered_data", {}).get("corporate_actions", {})
    symbol     = state.get("intent_symbol", "")
    complexity = state.get("query_complexity", "medium")

    if not fund_data or fund_data.get("error"):
        return {**state, "fundamentals_draft": {"error": True, "source": "no_data"}}

    # Get recent P&L summary
    recent_pnl = ""
    if pnl_data.get("statements"):
        s = pnl_data["statements"][0]
        recent_pnl = f"Latest Quarter Revenue: {s.get('revenue')} | Net Income: {s.get('net_income')} | EPS: {s.get('eps')}"

    # Get recent dividend
    recent_div = ""
    if corp_data.get("dividend_history"):
        d = corp_data["dividend_history"][0]
        recent_div = f"Last Dividend: ₹{d.get('amount')} on {d.get('date')}"

    system_prompt = """You are a fundamental analyst specializing in Indian equities.
Analyze the provided data and return ONLY a JSON object.
No prose, no markdown, no explanation outside the JSON.
Required format:
{
  "pe_ratio": <number or null>,
  "pe_assessment": "CHEAP|FAIR|EXPENSIVE|UNKNOWN",
  "pe_vs_sector": "<comparison in 5 words>",
  "market_cap_category": "LARGE_CAP|MID_CAP|SMALL_CAP",
  "dividend_yield_pct": <number or null>,
  "dividend_assessment": "HIGH|MODERATE|LOW|NONE",
  "shareholding_health": "STRONG|MODERATE|WEAK|UNKNOWN",
  "promoter_holding_note": "<10 words max or null>",
  "revenue_trend": "GROWING|DECLINING|STABLE|UNKNOWN",
  "profit_trend": "GROWING|DECLINING|STABLE|UNKNOWN",
  "valuation_verdict": "UNDERVALUED|FAIRLY_VALUED|OVERVALUED|CANNOT_DETERMINE",
  "brief_text": "<1-2 sentences, max 30 words, key fundamental insight>"
}"""

    user_message = f"""
Symbol: {symbol}
PE Ratio: {fund_data.get('pe_ratio')}
Market Cap: {fund_data.get('market_cap')}
EPS: {fund_data.get('eps')}
Beta: {fund_data.get('beta')}
52W High: {fund_data.get('52w_high')}
52W Low: {fund_data.get('52w_low')}
Sector: {fund_data.get('sector')}
{recent_pnl}
{recent_div}
Shareholding Source: {share_data.get('source', 'unavailable')}
"""

    try:
        # Complex tier gets NVIDIA, others get Gemini Flash
        if complexity == "complex":
            llm = _get_llm("phase4_fundamentals_complex", complexity, 0)
        else:
            llm = _get_llm("phase4_fundamentals_simple", complexity, 0)

        response = await llm.ainvoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        draft = json.loads(content)
        return {**state, "fundamentals_draft": draft}
    except Exception as e:
        logger.error(f"[Phase4/Fundamentals] LLM failed: {e}")
        return {**state, "fundamentals_draft": {
            "pe_ratio": fund_data.get("pe_ratio"),
            "pe_assessment": "UNKNOWN",
            "valuation_verdict": "CANNOT_DETERMINE",
            "brief_text": "Fundamental data available but analysis failed.",
            "error_fallback": True,
        }}


async def phase4_sequencer_node(state: AgentState) -> AgentState:
    """
    Sequencer Node — runs AFTER all 3 parallel nodes complete.
    Reads technicals_draft, news_draft, fundamentals_draft from state.
    Assembles final artifact_data and generates brief_text.
    Model: Gemini Flash (fast, low token budget ≤400)
    Does NOT rewrite content — only assembles and adds connecting text.
    """
    artifact_type = state.get("artifact_type", "full_analysis")
    symbol = state.get("intent_symbol", "UNKNOWN")
    query_complexity = state.get("query_complexity", "medium")

    tech  = state.get("technicals_draft", {})
    news  = state.get("news_draft", {})
    fund  = state.get("fundamentals_draft", {})

    # Assemble artifact_data — structured, ready for frontend slots
    artifact_data = {
        "type": artifact_type,
        "symbol": symbol,
        "technicals": tech,
        "news": news,
        "fundamentals": fund,
        "timestamp": datetime.now().isoformat(),
    }

    # Generate brief connecting text (optional — only if adds value)
    system_prompt = """You are a financial report assembler.
Given three specialist analyses (technical, news, fundamentals), write 1-3 sentences
that connect them into a coherent observation. Be specific — reference actual values.
If data is missing or all analyses are incomplete, return null.
Return ONLY: {"text": "<your text here>" } or {"text": null}
Do NOT rewrite or summarize the individual analyses — they will be shown separately."""

    user_input = f"""
Symbol: {symbol}
Technical Signal: {tech.get('overall_technical_signal', 'N/A')}
RSI: {tech.get('rsi', 'N/A')} ({tech.get('rsi_signal', 'N/A')})
MACD: {tech.get('macd_trend', 'N/A')}
News Mood: {news.get('mood', 'N/A')} ({news.get('total_analyzed', 0)} articles)
Valuation: {fund.get('valuation_verdict', 'N/A')} | PE: {fund.get('pe_ratio', 'N/A')} ({fund.get('pe_assessment', 'N/A')})
"""

    artifact_text = None
    try:
        llm = _get_llm("classify_intent", query_complexity, 0)  # Reuse Gemini Flash
        response = await llm.ainvoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        parsed = json.loads(content)
        artifact_text = parsed.get("text")
    except Exception as e:
        logger.warning(f"[Sequencer] Text generation failed (non-critical): {e}")
        artifact_text = None  # Frontend will show cards without connecting text

    # Also build final_response for backward compatibility
    final_response = f"Analysis for {symbol}: Technical={tech.get('overall_technical_signal', 'N/A')}, News={news.get('mood', 'N/A')}, Valuation={fund.get('valuation_verdict', 'N/A')}"

    return {
        **state,
        "artifact_data":  artifact_data,
        "artifact_text":  artifact_text,
        "final_response": final_response,  # Backward compat
    }
```

### 5.8 Update `_get_llm()` Function

MODIFY the existing `_get_llm()` function. Replace it completely with the version below.
Add imports at top of graph.py:

```python
# ADD TO TOP OF graph.py IMPORTS:
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from ..core.key_manager import key_manager
```

```python
def _get_llm(node_name: str, complexity: str = "complex", fallback_index: int = 0):
    """
    Provider routing for all LLM calls in FinSight AI.
    
    Routing logic:
    - classify_intent / phase4_news / phase4_technicals / phase4_fundamentals_simple
      → Always Gemini Flash (fast JSON, native JSON mode)
    - phase4_fundamentals_complex → NVIDIA Qwen 3.5 (deep reasoning)
    - synthesis nodes (simple/medium) → Groq Llama 3.3 70B (fast LPU generation)
    - synthesis nodes (complex, fallback) → Gemini Flash
    - fallback_index 0=primary, 1=secondary, 2=last resort
    """
    cfg = _NODE_CONFIG.get(node_name, _NODE_CONFIG.get("handle_general", {}))
    temperature = round(random.uniform(
        cfg.get("temp_min", 0.3),
        cfg.get("temp_max", 0.5)
    ), 3)
    timeout = settings.llm_provider_timeout  # 35s

    # ── ALWAYS GOOGLE: Intent classifier + fast parallel nodes ───────────────
    if node_name in (
        "classify_intent",
        "phase4_technicals",
        "phase4_news",
        "phase4_fundamentals_simple",
    ):
        return ChatGoogleGenerativeAI(
            model=settings.gemini_flash_model,
            google_api_key=key_manager.get_google_key(),
            temperature=0.1,
            max_output_tokens=cfg.get("max_tokens", 400),
        )

    # ── ALWAYS NVIDIA: Complex fundamentals node ──────────────────────────────
    if node_name == "phase4_fundamentals_complex":
        return ChatNVIDIA(
            model=settings.nvidia_complex_model,
            api_key=key_manager.get_nvidia_key(),
            temperature=temperature,
            max_tokens=cfg.get("max_tokens", 500),
        )

    # ── SYNTHESIS NODES: Provider chain by complexity ─────────────────────────
    provider_chain = {
        "simple":  ["groq",   "google", "groq"],
        "medium":  ["groq",   "google", "groq"],
        "complex": ["nvidia", "groq",   "google"],
    }
    provider = provider_chain.get(complexity, ["groq", "google", "groq"])[
        min(fallback_index, 2)
    ]

    if provider == "groq":
        return ChatGroq(
            model=settings.groq_medium_model,
            groq_api_key=key_manager.get_groq_key(),
            temperature=temperature,
            max_tokens=cfg.get("max_tokens", 1200),
            timeout=timeout,
        )
    elif provider == "nvidia":
        return ChatNVIDIA(
            model=settings.nvidia_complex_model,
            api_key=key_manager.get_nvidia_key(),
            temperature=temperature,
            max_tokens=cfg.get("max_tokens", 2500),
        )
    else:  # google fallback
        return ChatGoogleGenerativeAI(
            model=settings.gemini_flash_model,
            google_api_key=key_manager.get_google_key(),
            temperature=temperature,
            max_output_tokens=cfg.get("max_tokens", 1200),
        )
```

### 5.9 Add Parallel Execution Wrapper for Phase 4

In `graph.py`, add this async wrapper that runs the 3 specialist nodes in parallel. This is called by the LangGraph graph after `gather_stock_data` completes.

```python
async def run_phase4_parallel(state: AgentState) -> AgentState:
    """
    Orchestrates 3 parallel Phase 4 nodes using asyncio.gather().
    All 3 nodes run simultaneously — total time = slowest node (~2-3s).
    Results written to state fields: technicals_draft, news_draft, fundamentals_draft.
    Then sequencer_node runs to assemble final output.
    """
    artifact_type = state.get("artifact_type", "full_analysis")

    # For non-full-analysis types, skip parallel nodes and use existing synthesis
    if artifact_type not in ("full_analysis", "financial_report", "comparison_table"):
        # Route to existing single synthesis nodes (backward compatible)
        return state

    logger.info(f"[Phase4] Running 3 parallel nodes for artifact: {artifact_type}")

    # Run all 3 specialist nodes simultaneously
    results = await asyncio.gather(
        phase4_technicals_node(state),
        phase4_news_node(state),
        phase4_fundamentals_node(state),
        return_exceptions=True
    )

    # Merge results into state — each node only writes its own field
    merged_state = dict(state)
    field_map = ["technicals_draft", "news_draft", "fundamentals_draft"]

    for field, result in zip(field_map, results):
        if isinstance(result, Exception):
            logger.error(f"[Phase4] Node for {field} raised: {result}")
            merged_state[field] = {"error": True, "exception": str(result)}
        else:
            merged_state[field] = result.get(field, {})

    # Run sequencer after all 3 complete
    final_state = await phase4_sequencer_node(AgentState(**merged_state))
    return final_state
```

---

## SECTION 6 — SSE EVENTS: `backend/app/api/agent.py`

### 6.1 Action

MODIFY `agent.py`. Add new typed SSE events. Do NOT remove or change existing events (`complexity`, `status`, `classified`, `chunk`, `result`, `done`, `error`). All new events are ADDITIVE.

### 6.2 New Events to Emit

Find the section in `agent.py` where SSE events are yielded after the LangGraph graph completes. Add the following NEW events BEFORE the existing `result` event:

```python
# ADD AFTER graph.ainvoke() or after each node completion
# These are NEW events — existing events remain unchanged

# Emit artifact_type first so frontend knows which component to mount
if state.get("artifact_type"):
    yield (
        f"event: artifact_type\n"
        f"data: {json.dumps({'type': state['artifact_type']})}\n\n"
    )

# Emit optional connecting text (may be null — frontend handles gracefully)
if state.get("artifact_text") is not None:
    yield (
        f"event: artifact_text\n"
        f"data: {json.dumps({'text': state['artifact_text']})}\n\n"
    )

# Emit individual slot data
artifact_data = state.get("artifact_data", {})

if artifact_data.get("technicals"):
    yield (
        f"event: slot_technicals\n"
        f"data: {json.dumps(artifact_data['technicals'])}\n\n"
    )

if artifact_data.get("news"):
    yield (
        f"event: slot_news\n"
        f"data: {json.dumps(artifact_data['news'])}\n\n"
    )

if artifact_data.get("fundamentals"):
    yield (
        f"event: slot_fundamentals\n"
        f"data: {json.dumps(artifact_data['fundamentals'])}\n\n"
    )

# Verdict is derived from the 3 drafts
if artifact_data.get("technicals") and artifact_data.get("fundamentals"):
    tech_signal  = artifact_data["technicals"].get("overall_technical_signal", "NEUTRAL")
    fund_verdict = artifact_data["fundamentals"].get("valuation_verdict", "CANNOT_DETERMINE")
    news_mood    = artifact_data.get("news", {}).get("mood", "NEUTRAL")
    yield (
        f"event: slot_verdict\n"
        f"data: {json.dumps({'technical': tech_signal, 'fundamental': fund_verdict, 'news': news_mood})}\n\n"
    )

# EXISTING result event — keep as-is for backward compatibility
yield (
    f"event: result\n"
    f"data: {json.dumps({'content': state.get('final_response', '')})}\n\n"
)
```

### 6.3 Complete SSE Event Reference

After this change, the full event sequence emitted per query is:

```
event: complexity       ← EXISTING — query complexity tier
event: status           ← EXISTING — "Fetching data..."
event: classified       ← EXISTING — intent classification result
event: artifact_type    ← NEW — tells frontend which component to mount
event: status           ← EXISTING — "Analyzing..."
event: artifact_text    ← NEW — optional 1-3 sentence context (may be null)
event: slot_technicals  ← NEW — technical analysis JSON card data
event: slot_news        ← NEW — news sentiment JSON card data
event: slot_fundamentals← NEW — fundamentals JSON card data
event: slot_verdict     ← NEW — combined verdict signals
event: result           ← EXISTING — full text response (backward compat)
event: done             ← EXISTING — stream termination signal
```

---

## SECTION 7 — FRONTEND: `frontend/src/app/ai-research/page.tsx`

### 7.1 Action

REWRITE `frontend/src/app/ai-research/page.tsx` completely. This is the ONLY frontend file being changed. No other frontend files are touched.

### 7.2 Component Registry

```typescript
// Component registry — maps artifact_type to the correct React component
// Add to the TOP of page.tsx

type ArtifactType =
  | "price_ticker"
  | "technical_gauge"
  | "news_feed"
  | "info_card"
  | "comparison_table"
  | "screener_table"
  | "portfolio_breakdown"
  | "full_analysis"
  | "financial_report";

interface SlotData {
  technicals: Record<string, any> | null;
  news: Record<string, any> | null;
  fundamentals: Record<string, any> | null;
  verdict: Record<string, any> | null;
}

interface ArtifactState {
  type: ArtifactType | null;
  text: string | null;
  slots: SlotData;
  isStreaming: boolean;
}
```

### 7.3 Complete page.tsx Implementation

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── TYPE DEFINITIONS ──────────────────────────────────────────────────────────

type ArtifactType =
  | "price_ticker" | "technical_gauge" | "news_feed" | "info_card"
  | "comparison_table" | "screener_table" | "portfolio_breakdown"
  | "full_analysis" | "financial_report" | null;

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface SlotData {
  technicals: Record<string, any> | null;
  news: Record<string, any> | null;
  fundamentals: Record<string, any> | null;
  verdict: Record<string, any> | null;
}

interface ArtifactState {
  type: ArtifactType;
  text: string | null;
  slots: SlotData;
  symbol: string | null;
  isStreaming: boolean;
}

const EMPTY_ARTIFACT: ArtifactState = {
  type: null,
  text: null,
  slots: { technicals: null, news: null, fundamentals: null, verdict: null },
  symbol: null,
  isStreaming: false,
};

// ── SIGNAL COLOR HELPERS ──────────────────────────────────────────────────────

function signalColor(signal: string): string {
  const s = signal?.toUpperCase();
  if (["BULLISH", "BUY", "STRONG_BUY", "UNDERVALUED"].includes(s)) return "text-green";
  if (["BEARISH", "SELL", "STRONG_SELL", "OVERVALUED"].includes(s)) return "text-red";
  return "text-muted";
}

function signalBg(signal: string): string {
  const s = signal?.toUpperCase();
  if (["BULLISH", "BUY", "STRONG_BUY", "UNDERVALUED"].includes(s)) return "bg-green/10 border-green/20";
  if (["BEARISH", "SELL", "STRONG_SELL", "OVERVALUED"].includes(s)) return "bg-red/10 border-red/20";
  return "bg-dim border-border";
}

// ── SKELETON CARD ─────────────────────────────────────────────────────────────

function SkeletonCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card2 p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-24 bg-dim rounded" />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-dim rounded" />
        <div className="h-3 w-3/4 bg-dim rounded" />
        <div className="h-3 w-1/2 bg-dim rounded" />
      </div>
    </div>
  );
}

// ── TECHNICAL CARD ────────────────────────────────────────────────────────────

function TechnicalCard({ data }: { data: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card2 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">📊 Technical Analysis</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded border ${signalBg(data.overall_technical_signal)}`}>
          <span className={signalColor(data.overall_technical_signal)}>
            {data.overall_technical_signal || "N/A"}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">RSI-14</div>
          <div className="text-lg font-bold text-text">{data.rsi?.toFixed(1) ?? "—"}</div>
          <div className={`text-xs ${signalColor(data.rsi_signal)}`}>{data.rsi_signal || ""}</div>
        </div>
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">MACD</div>
          <div className={`text-sm font-semibold ${signalColor(data.macd_trend)}`}>
            {data.macd_trend || "—"}
          </div>
          <div className="text-xs text-muted">{data.macd_interpretation || ""}</div>
        </div>
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">vs SMA-20</div>
          <div className={`text-sm font-semibold ${(data.price_vs_sma20_pct ?? 0) >= 0 ? "text-green" : "text-red"}`}>
            {data.price_vs_sma20_pct != null ? `${data.price_vs_sma20_pct > 0 ? "+" : ""}${data.price_vs_sma20_pct?.toFixed(2)}%` : "—"}
          </div>
          <div className="text-xs text-muted">{data.sma_trend || ""}</div>
        </div>
      </div>

      {data.brief_text && (
        <p className="text-xs text-muted italic border-t border-border pt-3">
          {data.brief_text}
        </p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs text-lime hover:underline"
      >
        {expanded ? "▲ Hide Details" : "▼ View Full Technical Details"}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <div className="text-xs text-muted">RSI Interpretation: {data.rsi_interpretation}</div>
          <div className="text-xs text-muted">Support: {data.key_levels?.support ?? "N/A"}</div>
          <div className="text-xs text-muted">Resistance: {data.key_levels?.resistance ?? "N/A"}</div>
        </div>
      )}
    </div>
  );
}

// ── NEWS CARD ─────────────────────────────────────────────────────────────────

function NewsCard({ data }: { data: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card2 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">📰 News Sentiment</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded border ${signalBg(data.mood)}`}>
          <span className={signalColor(data.mood)}>{data.mood || "N/A"}</span>
        </span>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-green">{data.positive_count ?? 0}</div>
          <div className="text-xs text-muted">Positive</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red">{data.negative_count ?? 0}</div>
          <div className="text-xs text-muted">Negative</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-muted">{data.neutral_count ?? 0}</div>
          <div className="text-xs text-muted">Neutral</div>
        </div>
      </div>

      {data.top_headline && (
        <p className="text-xs text-text bg-dim rounded p-2 mb-3">
          "{data.top_headline}"
        </p>
      )}

      {data.brief_text && (
        <p className="text-xs text-muted italic border-t border-border pt-3">
          {data.brief_text}
        </p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs text-lime hover:underline"
      >
        {expanded ? "▲ Hide" : "▼ Key Theme"}
      </button>

      {expanded && data.key_theme && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-muted">Key Theme: {data.key_theme}</div>
        </div>
      )}
    </div>
  );
}

// ── FUNDAMENTALS CARD ─────────────────────────────────────────────────────────

function FundamentalsCard({ data }: { data: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card2 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">🏦 Fundamentals</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded border ${signalBg(data.valuation_verdict)}`}>
          <span className={signalColor(data.valuation_verdict)}>
            {data.valuation_verdict?.replace("_", " ") || "N/A"}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">PE Ratio</div>
          <div className="text-lg font-bold text-text">{data.pe_ratio?.toFixed(1) ?? "—"}</div>
          <div className={`text-xs ${signalColor(data.pe_assessment === "CHEAP" ? "BUY" : data.pe_assessment === "EXPENSIVE" ? "SELL" : "NEUTRAL")}`}>
            {data.pe_assessment || ""}
          </div>
        </div>
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">Dividend Yield</div>
          <div className="text-lg font-bold text-text">
            {data.dividend_yield_pct != null ? `${(data.dividend_yield_pct * 100).toFixed(2)}%` : "—"}
          </div>
          <div className="text-xs text-muted">{data.dividend_assessment || ""}</div>
        </div>
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">Revenue Trend</div>
          <div className={`text-sm font-semibold ${signalColor(data.revenue_trend === "GROWING" ? "BUY" : data.revenue_trend === "DECLINING" ? "SELL" : "NEUTRAL")}`}>
            {data.revenue_trend || "—"}
          </div>
        </div>
        <div className="bg-dim rounded-lg p-3">
          <div className="text-xs text-muted mb-1">Profit Trend</div>
          <div className={`text-sm font-semibold ${signalColor(data.profit_trend === "GROWING" ? "BUY" : data.profit_trend === "DECLINING" ? "SELL" : "NEUTRAL")}`}>
            {data.profit_trend || "—"}
          </div>
        </div>
      </div>

      {data.brief_text && (
        <p className="text-xs text-muted italic border-t border-border pt-3">
          {data.brief_text}
        </p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs text-lime hover:underline"
      >
        {expanded ? "▲ Hide" : "▼ More Details"}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <div className="text-xs text-muted">Market Cap Category: {data.market_cap_category}</div>
          <div className="text-xs text-muted">Shareholding Health: {data.shareholding_health}</div>
          <div className="text-xs text-muted">PE vs Sector: {data.pe_vs_sector}</div>
          {data.promoter_holding_note && (
            <div className="text-xs text-muted">Promoter Note: {data.promoter_holding_note}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── VERDICT CARD ──────────────────────────────────────────────────────────────

function VerdictCard({ data }: { data: Record<string, any> }) {
  const overallSignal = data.technical || "NEUTRAL";

  return (
    <div className={`rounded-xl border p-5 ${signalBg(overallSignal)}`}>
      <h3 className="text-sm font-semibold text-text mb-3">⚖️ Combined Verdict</h3>
      <div className="flex gap-6">
        <div>
          <div className="text-xs text-muted">Technical</div>
          <div className={`text-sm font-bold ${signalColor(data.technical)}`}>
            {data.technical?.replace("_", " ") || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Valuation</div>
          <div className={`text-sm font-bold ${signalColor(data.fundamental === "UNDERVALUED" ? "BUY" : data.fundamental === "OVERVALUED" ? "SELL" : "NEUTRAL")}`}>
            {data.fundamental?.replace("_", " ") || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">News</div>
          <div className={`text-sm font-bold ${signalColor(data.news)}`}>
            {data.news || "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ARTIFACT PANEL ────────────────────────────────────────────────────────────

function ArtifactPanel({ artifact }: { artifact: ArtifactState }) {
  if (!artifact.type) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-sm">Ask a question to see analysis here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Artifact Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lime font-semibold text-sm">{artifact.symbol || "Analysis"}</span>
          <span className="text-xs text-muted bg-dim px-2 py-1 rounded">
            {artifact.type?.replace("_", " ")}
          </span>
          {artifact.isStreaming && (
            <div className="w-2 h-2 rounded-full bg-lime animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const text = JSON.stringify(artifact.slots, null, 2);
              navigator.clipboard?.writeText(text);
            }}
            className="text-xs text-muted hover:text-text px-2 py-1 rounded border border-border"
            title="Copy data"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Artifact Content */}
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {/* Optional connecting text */}
        {artifact.text && (
          <p className="text-sm text-muted leading-relaxed border-l-2 border-lime pl-3">
            {artifact.text}
          </p>
        )}

        {/* Slots — fixed visual order regardless of arrival order */}
        {artifact.type === "full_analysis" && (
          <>
            {artifact.slots.technicals
              ? <TechnicalCard data={artifact.slots.technicals} />
              : artifact.isStreaming ? <SkeletonCard label="Technical Analysis" /> : null
            }
            {artifact.slots.news
              ? <NewsCard data={artifact.slots.news} />
              : artifact.isStreaming ? <SkeletonCard label="News Sentiment" /> : null
            }
            {artifact.slots.fundamentals
              ? <FundamentalsCard data={artifact.slots.fundamentals} />
              : artifact.isStreaming ? <SkeletonCard label="Fundamentals" /> : null
            }
            {artifact.slots.verdict
              ? <VerdictCard data={artifact.slots.verdict} />
              : artifact.isStreaming ? <SkeletonCard label="Verdict" /> : null
            }
          </>
        )}

        {/* Price ticker — simple layout */}
        {artifact.type === "price_ticker" && artifact.slots.technicals && (
          <div className="rounded-xl border border-border bg-card2 p-6 text-center">
            <div className="text-3xl font-bold text-text mb-2">
              ₹{artifact.slots.technicals?.current_price?.toLocaleString("en-IN") || "—"}
            </div>
            <div className="text-muted text-sm">{artifact.symbol}</div>
          </div>
        )}

        {/* Fallback for other artifact types — show raw data */}
        {!["full_analysis", "price_ticker"].includes(artifact.type || "") && (
          <div className="rounded-xl border border-border bg-card2 p-5">
            <pre className="text-xs text-muted overflow-auto">
              {JSON.stringify(artifact.slots, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function AIResearchPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactState>(EMPTY_ARTIFACT);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const sendMessage = useCallback(async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    setInput("");
    setIsLoading(true);

    // Add user message
    const userMsg: Message = {
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Reset artifact for new query
    setArtifact({ ...EMPTY_ARTIFACT, isStreaming: true });

    let assistantText = "";

    // Open SSE connection
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const es = new EventSource(
      `${API_BASE}/api/v1/agent/stream?q=${encodeURIComponent(query)}`
    );
    esRef.current = es;

    // ── NEW ARTIFACT EVENTS ──────────────────────────────────────────────────

    es.addEventListener("artifact_type", (e) => {
      const { type } = JSON.parse(e.data);
      setArtifact(prev => ({ ...prev, type }));
    });

    es.addEventListener("artifact_text", (e) => {
      const { text } = JSON.parse(e.data);
      setArtifact(prev => ({ ...prev, text }));
    });

    es.addEventListener("slot_technicals", (e) => {
      const data = JSON.parse(e.data);
      setArtifact(prev => ({
        ...prev,
        slots: { ...prev.slots, technicals: data }
      }));
    });

    es.addEventListener("slot_news", (e) => {
      const data = JSON.parse(e.data);
      setArtifact(prev => ({
        ...prev,
        slots: { ...prev.slots, news: data }
      }));
    });

    es.addEventListener("slot_fundamentals", (e) => {
      const data = JSON.parse(e.data);
      setArtifact(prev => ({
        ...prev,
        slots: { ...prev.slots, fundamentals: data }
      }));
    });

    es.addEventListener("slot_verdict", (e) => {
      const data = JSON.parse(e.data);
      setArtifact(prev => ({
        ...prev,
        slots: { ...prev.slots, verdict: data }
      }));
    });

    // ── EXISTING EVENTS (unchanged) ──────────────────────────────────────────

    es.addEventListener("classified", (e) => {
      const data = JSON.parse(e.data);
      setArtifact(prev => ({
        ...prev,
        symbol: data.symbol || prev.symbol,
      }));
    });

    es.addEventListener("chunk", (e) => {
      const data = JSON.parse(e.data);
      assistantText += data.content || "";
    });

    es.addEventListener("result", (e) => {
      const data = JSON.parse(e.data);
      assistantText = data.content || assistantText;
    });

    es.addEventListener("done", () => {
      es.close();
      setIsLoading(false);
      setArtifact(prev => ({ ...prev, isStreaming: false }));
      if (assistantText) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: assistantText,
          timestamp: new Date().toISOString(),
        }]);
      }
    });

    es.addEventListener("error", (e) => {
      es.close();
      setIsLoading(false);
      setArtifact(prev => ({ ...prev, isStreaming: false }));
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "An error occurred. Please try again.",
        timestamp: new Date().toISOString(),
      }]);
    });
  }, [input, isLoading]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background overflow-hidden">

      {/* ── LEFT: CHAT PANEL ─────────────────────────────────────────────────── */}
      <div className="w-[400px] flex flex-col border-r border-border shrink-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">AI Research</h2>
          <p className="text-xs text-muted mt-0.5">Ask anything about Indian stocks</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-muted">Start by asking about any NSE stock</p>
              <div className="mt-4 space-y-2">
                {[
                  "Analyze RELIANCE for long term",
                  "TCS vs Infosys compare karo",
                  "Latest news on HDFC Bank",
                  "What is PE ratio?",
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="block w-full text-left text-xs text-muted hover:text-lime px-3 py-2 rounded bg-dim hover:bg-card border border-border transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-lime text-background font-medium"
                    : "bg-card border border-border text-text"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about any NSE stock..."
              disabled={isLoading}
              className="flex-1 bg-dim border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-lime disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-lime text-background text-sm font-semibold rounded-lg hover:bg-lime/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: ARTIFACT PANEL ─────────────────────────────────────────────── */}
      <ArtifactPanel artifact={artifact} />

    </div>
  );
}
```

---

## SECTION 8 — VALIDATION CHECKLIST

After completing all sections, verify each item before considering implementation complete.

### 8.1 Backend Startup Tests
```
□ Backend starts without error: uvicorn app.main:app --reload
□ KeyManager logs show correct key counts at startup
□ No ImportError for: aiohttp, finnhub, twelvedata, langchain_google_genai, langchain_groq, langchain_nvidia_ai_endpoints
□ No existing endpoint is broken (test /health, /api/v1/indices, /api/v1/news)
```

### 8.2 Phase 3 Tests
```
□ Query "Analyze TCS" → gathered_data has: live_price, technical_indicators, fundamentals, news, shareholding_pattern, revenue_pnl_quarterly, corporate_actions
□ Query "TCS price?" → gathered_data has ONLY: live_price (no unnecessary fetches)
□ Query "Latest HDFC news" → gathered_data has ONLY: news_headlines
□ Fallback test: Set a bad FMP key → fundamentals still populated (from Finnhub fallback)
□ Fallback test: Set all news keys bad → news returns fallback dict with error:True (not crash)
```

### 8.3 Phase 4 Tests
```
□ "Analyze RELIANCE long term" → artifact_type = "full_analysis" (classified as complex)
□ "TCS price?" → artifact_type = "price_ticker" (fast-path regex)
□ "Latest news HDFC" → artifact_type = "news_feed"
□ All 3 parallel nodes complete within 5s (check logs for timing)
□ technicals_draft, news_draft, fundamentals_draft all populated in AgentState
□ artifact_data assembled by Sequencer with type, symbol, technicals, news, fundamentals
□ final_response still populated (backward compat)
```

### 8.4 SSE Event Tests
```
□ curl the stream endpoint → see events in order: complexity, classified, artifact_type, slot_technicals, slot_news, slot_fundamentals, slot_verdict, result, done
□ All existing events still present and unchanged
□ artifact_type event arrives BEFORE slot_* events
□ No malformed JSON in any event data field
```

### 8.5 Frontend Tests
```
□ /ai-research page loads without TypeScript errors
□ Split layout renders: chat panel left (400px), artifact panel right (flex-1)
□ Typing a query → sends SSE request → skeletons appear → slots fill
□ artifact_type event → correct component mounted
□ Slots fill in visual order (Technicals → News → Fundamentals → Verdict) regardless of arrival
□ Expand/collapse works on each card
□ Copy button works
□ Existing pages (dashboard, portfolio, alerts) still work correctly
```

### 8.6 Latency Benchmark
```
□ "What is TCS price?" → < 3 seconds (regex fast path + price only)
□ "Show RSI for Infosys" → < 8 seconds (Groq synthesis)
□ "Analyze RELIANCE long term" → < 12 seconds (NVIDIA complex)
□ "Latest news HDFC Bank" → < 6 seconds (news only)
```

---

## SECTION 9 — KNOWN LIMITATIONS & FUTURE ENHANCEMENTS

### 9.1 Known Limitations (Do Not Fix in This Implementation)
- NSE scraper requires session cookies — may break if NSE changes their anti-bot headers
- Finnhub shareholding for Indian mid/small caps returns empty — handled by fallback
- AngelOne `_angel_one_price()` requires the user's trading account — only works if configured
- Comparison table artifact type is defined but comparison_symbols multi-stock logic not fully implemented — use full_analysis for now
- BSE scraper uses BSE code lookup which may be inaccurate — low priority

### 9.2 Future Enhancements (Not Part of This Plan)
- Real token streaming (switch from graph.ainvoke to graph.astream for token-by-token SSE)
- Comparison table: parallel fetch for 2 symbols simultaneously
- Financial report PDF generation from artifact data
- Portfolio artifact: connect to real portfolio API instead of mock data
- Click-to-expand: POST request for detailed prose generation per card

---

*Document created: April 30, 2026*  
*Author: FinSight AI Design Session*  
*For: Tilak — FinSight AI v2.0 Implementation*  
*Companion files: Context.md, Gemini.md*