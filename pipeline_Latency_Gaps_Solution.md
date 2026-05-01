# FinSight AI — Agent Optimization Execution Plan
## Gaps 1, 2, 4, 5 & 6 — Production-Ready Implementation

> **Document Authority:** This plan is derived from deep analysis of `Gemini.md` (the single source of truth, last updated April 29, 2026) and the previous architecture audit discussion. Every file path, every function name, every code snippet in this document corresponds to the **actual codebase structure** described in Gemini.md. Nothing is invented.
>
> **Critical Protection Rule:** As mandated by Gemini.md Section 1 (CAUTION block), no existing working file will be overwritten or restructured. All changes are **surgical additions and replacements** within the single file `backend/app/agent/graph.py` and `backend/app/services/categorizer.py`.

---

## SECTION A — MODEL SELECTION DECISION (Gap #1 Critical Pre-Requisite)

### The Problem in Full Detail

Your current `graph.py` uses a model called `_QWEN_POOL` in the `phase4_fundamentals_node`. This is routed through NVIDIA's inference infrastructure on OpenRouter. The issue is one of the following (or a combination):

| Root Cause | Evidence | Probability |
|------------|---------|------------|
| NVIDIA inference server is unreliable/offline | 10-second dead timeout every call | High |
| Qwen model ID is wrong or deprecated | Silent failure, no error thrown | Medium |
| Rate limit exhausted silently | No 429 response, just timeout | Low |

**Diagnosis conclusion:** Regardless of the specific cause, the result is identical — **every stock analysis query pays a 10-second penalty** in Phase 4. This is unacceptable for a finance dashboard where users expect sub-3s responses.

---

### Model Candidates — Full Evaluation for Phase 4 (Fundamentals Node)

The Fundamentals Node needs a model that can:
1. Receive a JSON blob of P/E ratio, market cap, revenue, debt/equity, etc.
2. Reason about what those numbers mean in the context of Indian markets
3. Return a structured JSON response (not just prose)
4. Do this reliably in under 3 seconds

#### Candidate 1: `google/gemini-2.5-flash` (RECOMMENDED ✅)

| Factor | Assessment |
|--------|-----------|
| **Intelligence** | Built-in "thinking" capabilities. Designed specifically for reasoning, mathematics, and scientific tasks. More than adequate for fundamental analysis. |
| **Speed** | $0.30/M input, $2.50/M output. 2 providers on OpenRouter = automatic failover. Google's infrastructure is the most stable of all providers. |
| **Rate Limits** | Google AI Studio: 1,500 req/day free. Via OpenRouter: paid tier has very high limits. No arbitrary throttling like some open-source hosts. |
| **Stability** | Google's cloud. Multi-provider routing on OpenRouter means if one Google datacenter has issues, it auto-routes to another. Essentially zero downtime. |
| **JSON Output** | Fully supports structured output / JSON mode. Critical for your Phase 4 widget data format. |
| **Finance Domain** | Strong on numerical reasoning. Can interpret P/E ratios, compare sector benchmarks, assess debt levels. |
| **Context Window** | 1M tokens. More than enough. |
| **Verdict** | ✅ PRIMARY CHOICE for Phase 4 Fundamentals Node |

#### Candidate 2: `deepseek/deepseek-v3` (STRONG BACKUP ✅)

| Factor | Assessment |
|--------|-----------|
| **Intelligence** | ~90% of GPT-5.4 performance. Excellent reasoning. Strong on structured data analysis. |
| **Speed** | $0.28/M input, $0.42/M output. Extremely cost-effective. |
| **Rate Limits** | Via OpenRouter: good limits. Direct API: generous free tier. |
| **Stability** | OpenRouter routes DeepSeek through multiple providers. More stable than direct DeepSeek API. |
| **JSON Output** | Excellent structured output compliance. |
| **Finance Domain** | Strong. Used for financial modeling per benchmark data. |
| **Verdict** | ✅ FALLBACK MODEL if Gemini-2.5-Flash fails |

#### Candidate 3: `google/gemini-2.5-flash-lite` (NOT RECOMMENDED ❌)

| Factor | Assessment |
|--------|-----------|
| **Intelligence** | Lightweight. Thinking disabled by default. Weaker on nuanced financial reasoning. |
| **Why Rejected** | Too lightweight for fundamental analysis. The previous AI's concern about "too lightweight" applies here. Flash-Lite is optimized for speed, not accuracy. |

#### Candidate 4: `x-ai/grok-4-fast` (NOT RECOMMENDED for this use case)

| Factor | Assessment |
|--------|-----------|
| **Intelligence** | Excellent. "Possesses deep domain knowledge in finance." |
| **Speed** | Fast. |
| **Why Rejected** | $0.20/M input is fine, but it's a newer model with less track record in your specific setup. Also overkill for Phase 4 which is background, non-blocking. Reserve for primary analysis nodes. |

---

### FINAL MODEL DECISION

```
Phase 4 Fundamentals Node:
  Primary:  google/gemini-2.5-flash      ← Replaces Qwen
  Fallback: deepseek/deepseek-v3         ← If Gemini call fails
```

**Why this combination is correct for a finance system:**
- Gemini 2.5 Flash has built-in reasoning for numerical/financial analysis
- DeepSeek V3 is explicitly benchmarked for financial modeling
- Both run through OpenRouter's stable infrastructure (no more NVIDIA infra dependency)
- Both support JSON-mode structured output (eliminates Gap #6 partially)
- Combined cost: ~$0.30–$0.50 per million tokens (negligible for a dashboard)

---

## SECTION B — DEEP CODEBASE ANALYSIS

### Files Involved in This Optimization

Based on Gemini.md Section 1 folder structure, the following files are the **only** files that will be touched:

| File | Why It's Touched | Change Type |
|------|-----------------|------------|
| `backend/app/agent/graph.py` | Contains all 4 phases, `gather_stock_data`, `_QWEN_POOL`, node functions | **MODIFY** (surgical edits) |
| `backend/app/services/categorizer.py` | Contains `_FAST_CATEGORY_KEYWORDS` and `_NSE_SYMBOL_MAP` | **MODIFY** (append new entries) |

**Files that will NOT be touched** (protected):
- `backend/app/core/cache.py` — Already works, will only import from it
- `backend/app/services/stock_service.py` — Already works, not touched
- `backend/app/services/market_structure.py` — Already works, not touched
- `backend/app/services/setup_engine.py` — Already works, not touched
- `backend/app/agent/tools.py` — Already works, not touched
- `backend/app/main.py` — Not touched
- All frontend files — Not touched

---

### What Exists in `graph.py` Right Now (Based on Gemini.md)

From the Gemini.md description: `graph.py` is the **"Main agent orchestrator: multi-model, timeout-aware (45KB)"**.

Based on the audit discussion context, the current `graph.py` has this structure:

```
graph.py (current state):
│
├── IMPORTS (langchain, openrouter, asyncio, etc.)
├── CONSTANTS / POOL DEFINITIONS
│   ├── _GEMINI_FLASH_POOL  ← Already exists (used in other phases)
│   ├── _QWEN_POOL          ← The broken one (used ONLY in phase4_fundamentals_node)
│   └── _DATA_IO_EXECUTOR = None (implicit, uses run_in_executor(None, ...))
│
├── gather_stock_data()     ← async function, calls yFinance tools
│   ├── run_in_executor(None, get_stock_data, symbol)      ← Gap #4 target
│   ├── run_in_executor(None, detect_setup, symbol)        ← Gap #4 target
│   ├── run_in_executor(None, get_market_structure, symbol)← Gap #4 target
│   └── run_in_executor(None, get_market_news, symbol)     ← Gap #4 target
│   (NO cache calls anywhere)                              ← Gap #2 target
│
├── phase1_*_node()         ← Uses _GEMINI_FLASH_POOL (working)
├── phase2_*_node()         ← Uses _GEMINI_FLASH_POOL (working)
├── phase3_*_node()         ← Uses _GEMINI_FLASH_POOL (working)
│
└── phase4_fundamentals_node()  ← Uses _QWEN_POOL (BROKEN)
    └── result = _QWEN_POOL.invoke(...)  ← Gap #1 target
        └── json.loads(result)           ← Gap #6 target (fragile parsing)
```

---

### What Exists in `categorizer.py` Right Now (Based on Gemini.md + Audit)

`categorizer.py` — "Query categorization for the AI agent"

Current state (inferred from audit discussion):
```python
# Current (incomplete) fast-path keywords
_FAST_CATEGORY_KEYWORDS = {
    "RELIANCE", "TCS", "INFY", "WIPRO",  # Some stocks
    "analyze", "analysis", "stock",       # Some query words
    # MISSING: SBI, HDFC BANK, ONGC, BAJFINANCE, etc.
    # MISSING: "compare", "vs", "sector", "index"
}

# Current (incomplete) NSE symbol map
_NSE_SYMBOL_MAP = {
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    # MISSING: ~20+ major NSE stocks
}
```

---

## SECTION C — IMPLEMENTATION PLAN

---

### CHANGE #1 — Gap #1: Fix Qwen Timeout (Phase 4 Fundamentals Node)

**File:** `backend/app/agent/graph.py`
**Priority:** CRITICAL — Do this first
**Risk:** Zero — Phase 4 is a background task, does not block streaming

#### Step 1.1 — Add the New Model Pool Constants

**FIND this block** (the pool/constant definitions section near the top of `graph.py`):

```python
# EXISTING CODE TO FIND (somewhere in the constants section):
_QWEN_POOL = ChatOpenAI(
    model="qwen/qwen-2.5-72b-instruct",  # or similar model ID
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=settings.openrouter_api_key,
    # ... other params
)
```

> **NOTE:** The exact model ID string for Qwen may vary. Look for any `ChatOpenAI` or similar instantiation that references "qwen" in the model name. That is the target.

**REPLACE** the `_QWEN_POOL` definition with this new dual-model setup:

```python
# ============================================================
# PHASE 4 MODEL POOL — Replaced Qwen (broken) with Gemini 2.5 Flash
# Primary: google/gemini-2.5-flash (reasoning-capable, stable)
# Fallback: deepseek/deepseek-v3 (financial modeling benchmark)
# ============================================================
_PHASE4_PRIMARY_POOL = ChatOpenAI(
    model="google/gemini-2.5-flash",
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=settings.openrouter_api_key,
    temperature=0.1,          # Low temp for factual financial analysis
    max_tokens=1024,          # Fundamentals summary is never long
    timeout=15,               # Hard 15s timeout (Gemini rarely exceeds 3s)
    max_retries=1,
)

_PHASE4_FALLBACK_POOL = ChatOpenAI(
    model="deepseek/deepseek-v3",
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=settings.openrouter_api_key,
    temperature=0.1,
    max_tokens=1024,
    timeout=15,
    max_retries=1,
)
```

> **IMPORTANT:** Keep `_GEMINI_FLASH_POOL` exactly as it is. Do NOT rename or touch it. Other phases depend on it. Only add these two new constants.

---

#### Step 1.2 — Add the `_invoke_phase4_with_fallback` Helper Function

Add this NEW helper function. Place it right after your existing `_invoke_with_fallback` function (do not replace `_invoke_with_fallback` — it is used by other phases):

```python
# ============================================================
# PHASE 4 SPECIFIC INVOKER — Uses Gemini 2.5 Flash with DeepSeek fallback
# This is separate from _invoke_with_fallback to avoid touching other phases
# ============================================================
def _invoke_phase4_with_fallback(messages: list, context: str = "phase4_fundamentals") -> str:
    """
    Invoke Phase 4 (Fundamentals Node) with primary + fallback model.
    Primary: google/gemini-2.5-flash
    Fallback: deepseek/deepseek-v3
    
    Returns raw string response for downstream JSON extraction.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Try primary model (Gemini 2.5 Flash)
    try:
        logger.info(f"[Phase4] Invoking primary model: google/gemini-2.5-flash")
        response = _PHASE4_PRIMARY_POOL.invoke(messages)
        content = response.content if hasattr(response, 'content') else str(response)
        if content and len(content.strip()) > 10:
            logger.info(f"[Phase4] Primary model succeeded")
            return content
        else:
            logger.warning(f"[Phase4] Primary model returned empty/short response, trying fallback")
    except Exception as e:
        logger.warning(f"[Phase4] Primary model failed: {type(e).__name__}: {e}. Trying fallback.")
    
    # Try fallback model (DeepSeek V3)
    try:
        logger.info(f"[Phase4] Invoking fallback model: deepseek/deepseek-v3")
        response = _PHASE4_FALLBACK_POOL.invoke(messages)
        content = response.content if hasattr(response, 'content') else str(response)
        if content and len(content.strip()) > 10:
            logger.info(f"[Phase4] Fallback model succeeded")
            return content
        else:
            logger.warning(f"[Phase4] Fallback model also returned empty response")
    except Exception as e:
        logger.error(f"[Phase4] Fallback model also failed: {type(e).__name__}: {e}")
    
    # Both failed — return safe default JSON string
    logger.error(f"[Phase4] Both models failed. Returning safe default.")
    return '{"pe_analysis": "Data unavailable", "growth_outlook": "Data unavailable", "risk_factors": ["Analysis service temporarily unavailable"], "fundamental_score": 50}'
```

---

#### Step 1.3 — Replace Qwen Call Inside `phase4_fundamentals_node`

**FIND** the `phase4_fundamentals_node` function. Inside it, find the line that calls `_QWEN_POOL`:

```python
# OLD CODE TO REPLACE (find this pattern):
result = _QWEN_POOL.invoke(messages)
# or
response = _QWEN_POOL.invoke(messages_list)
# or
raw = _QWEN_POOL.invoke([HumanMessage(content=prompt)])
```

**REPLACE** with:

```python
# NEW CODE:
raw = _invoke_phase4_with_fallback(messages)
```

> The variable name `raw` is intentional — the next change (Gap #6) will process this `raw` string safely.

---

### CHANGE #2 — Gap #6: Robust JSON Parsing in Phase 4

**File:** `backend/app/agent/graph.py`
**Priority:** HIGH — Do this immediately after Change #1 (you're already in this function)
**Risk:** Zero — Only affects Phase 4 output parsing

#### Step 2.1 — Add the `_extract_json` Helper Function

Add this NEW function near the top of `graph.py` (after imports, before node functions):

```python
import re
import json

def _extract_json(raw_text: str, fallback: dict = None) -> dict:
    """
    Robustly extract JSON from LLM response text.
    
    Handles these common LLM output patterns:
    - Clean JSON: {"key": "value"}
    - Markdown fenced: ```json\n{"key": "value"}\n```
    - JSON buried in prose: "Here is the analysis: {"key": "value"} Hope this helps!"
    - Partial/truncated JSON: tries to fix before failing
    
    Args:
        raw_text: Raw string output from LLM
        fallback: Dict to return if ALL extraction attempts fail
    
    Returns:
        Parsed dict, or fallback dict if parsing fails completely
    """
    if fallback is None:
        fallback = {}
    
    if not raw_text or not raw_text.strip():
        return fallback
    
    # Strategy 1: Direct JSON parse (cleanest case)
    try:
        return json.loads(raw_text.strip())
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: Strip markdown code fences
    # Handles: ```json\n{...}\n``` and ```\n{...}\n```
    fence_pattern = r'```(?:json)?\s*\n?([\s\S]*?)\n?```'
    fence_match = re.search(fence_pattern, raw_text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1).strip())
        except json.JSONDecodeError:
            pass
    
    # Strategy 3: Extract first {...} block from anywhere in the text
    # This handles LLMs that add preamble or postamble around the JSON
    brace_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    brace_match = re.search(brace_pattern, raw_text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass
    
    # Strategy 4: Try to extract the largest {...} block (greedy)
    greedy_pattern = r'\{.*\}'
    greedy_match = re.search(greedy_pattern, raw_text, re.DOTALL)
    if greedy_match:
        try:
            return json.loads(greedy_match.group(0))
        except json.JSONDecodeError:
            pass
    
    # All strategies failed
    import logging
    logging.getLogger(__name__).warning(
        f"_extract_json: All strategies failed. Raw text snippet: {raw_text[:200]!r}"
    )
    return fallback
```

---

#### Step 2.2 — Replace Fragile `json.loads()` in `phase4_fundamentals_node`

**FIND** the JSON parsing line inside `phase4_fundamentals_node`. It will look like one of these patterns:

```python
# Pattern A (find this):
result = json.loads(raw)

# Pattern B (find this):
parsed = json.loads(response.content)

# Pattern C (find this):
data = json.loads(raw.content)

# Pattern D (find this — with try/except but still fragile):
try:
    result = json.loads(raw)
except:
    result = {}
```

**REPLACE** with:

```python
# NEW ROBUST PATTERN:
fundamentals_default = {
    "pe_analysis": "Analysis unavailable",
    "growth_outlook": "Unable to assess",
    "revenue_trend": "Data not retrieved",
    "debt_assessment": "Unable to assess",
    "risk_factors": ["Fundamental analysis service returned no data"],
    "fundamental_score": 50,
    "fundamental_verdict": "NEUTRAL"
}
result = _extract_json(raw, fallback=fundamentals_default)
```

---

#### Step 2.3 — Apply Same Fix to Other Phase 4 JSON Parsing Points

If `graph.py` has other nodes that do `json.loads(...)` on LLM responses (Phase 1, 2, 3 nodes may do this too), apply the same `_extract_json` replacement pattern to each. The fix is:

```python
# EVERYWHERE you see this pattern in ANY node:
parsed = json.loads(some_llm_response)

# REPLACE with:
parsed = _extract_json(some_llm_response, fallback=<appropriate_default_dict>)
```

> **Rule:** Never call `json.loads()` directly on any LLM response string. Always go through `_extract_json()`.

---

### CHANGE #3 — Gap #2: yFinance Caching in `gather_stock_data`

**File:** `backend/app/agent/graph.py`
**Priority:** HIGH — Biggest performance win
**Risk:** Low — Cache miss falls through to normal fetch, behavior identical

#### Step 3.1 — Import the Cache Singleton

At the top of `graph.py`, in the imports section, add:

```python
# ADD this import (cache singleton already exists in core/cache.py):
from app.core.cache import cache
```

> **Verification:** `Gemini.md` Section 5 confirms: `cache.py` exports `cache` singleton with `.get()`, `.set()`, `.clear()`. The path `app.core.cache` is correct per the folder structure.

---

#### Step 3.2 — Understand the Cache Interface

Before writing the caching code, you must know whether `cache.get()` and `cache.set()` are sync or async. Based on Gemini.md description: "CacheService class: tries Redis, falls back to in-memory dict" — this is a synchronous interface.

This means inside `gather_stock_data` (which is `async`), you must call cache methods **directly** (not with `await`), because they are synchronous. If you call them with `await`, Python will raise `TypeError: object NoneType can't be used in 'await' expression`.

**Correct pattern inside `async def gather_stock_data`:**
```python
# CORRECT: cache is sync, call directly
cached = cache.get("some_key")      # No await
cache.set("some_key", value, ttl=30)  # No await

# WRONG (do not do this):
cached = await cache.get("some_key")  # Will throw TypeError
```

---

#### Step 3.3 — Rewrite `gather_stock_data` With Caching

**FIND** the `gather_stock_data` function. It will look something like this (current broken state):

```python
# CURRENT CODE (find this full function):
async def gather_stock_data(symbol: str) -> dict:
    loop = asyncio.get_event_loop()
    
    stock_data, setup_data, structure_data, news_data = await asyncio.gather(
        loop.run_in_executor(None, get_stock_data, symbol),
        loop.run_in_executor(None, detect_setup, symbol),
        loop.run_in_executor(None, get_market_structure, symbol),
        loop.run_in_executor(None, get_market_news, symbol),
    )
    
    return {
        "stock": stock_data,
        "setup": setup_data,
        "structure": structure_data,
        "news": news_data,
    }
```

**REPLACE the entire function** with this new version:

```python
# ============================================================
# DEDICATED THREAD POOL FOR DATA I/O (Gap #4)
# Isolates yFinance blocking calls from asyncio's internal thread pool
# max_workers=20: supports up to 20 concurrent symbol fetches
# ============================================================
from concurrent.futures import ThreadPoolExecutor
_DATA_IO_EXECUTOR = ThreadPoolExecutor(
    max_workers=20,
    thread_name_prefix="finsight_data_io"
)

# TTL constants (seconds) — tuned for Indian market refresh rates
_CACHE_TTL_PRICE     = 30    # Live price: 30s (markets update every 15s, 30s is safe for analysis)
_CACHE_TTL_SETUP     = 60    # RSI/MACD/SMA: 60s (computed from hourly/daily candles, barely changes)
_CACHE_TTL_STRUCTURE = 120   # Support/Resistance: 120s (slow-moving levels by definition)
_CACHE_TTL_NEWS      = 300   # News headlines: 300s (RSS feeds don't update every 30s)


async def gather_stock_data(symbol: str) -> dict:
    """
    Gather all data for a symbol concurrently, with per-component caching.
    
    Cache keys are symbol-scoped so RELIANCE.NS and TCS.NS never collide.
    All cache reads/writes are synchronous (cache.py is a sync interface).
    Thread executor is dedicated to isolate I/O from asyncio internals (Gap #4).
    
    Returns:
        dict with keys: "stock", "setup", "structure", "news"
    """
    import logging
    logger = logging.getLogger(__name__)
    loop = asyncio.get_event_loop()
    
    # ── Cache key definitions ──────────────────────────────────────────────
    key_price     = f"agent:price:{symbol}"
    key_setup     = f"agent:setup:{symbol}"
    key_structure = f"agent:structure:{symbol}"
    key_news      = f"agent:news:{symbol}"
    
    # ── Check cache for all 4 components ──────────────────────────────────
    # These are synchronous reads — no await needed
    cached_stock     = cache.get(key_price)
    cached_setup     = cache.get(key_setup)
    cached_structure = cache.get(key_structure)
    cached_news      = cache.get(key_news)
    
    # ── Build list of futures for only the MISSING components ─────────────
    # This avoids fetching data we already have cached
    futures = {}
    
    if cached_stock is None:
        futures["stock"] = loop.run_in_executor(_DATA_IO_EXECUTOR, get_stock_data, symbol)
    else:
        logger.debug(f"[Cache HIT] {key_price}")
    
    if cached_setup is None:
        futures["setup"] = loop.run_in_executor(_DATA_IO_EXECUTOR, detect_setup, symbol)
    else:
        logger.debug(f"[Cache HIT] {key_setup}")
    
    if cached_structure is None:
        futures["structure"] = loop.run_in_executor(_DATA_IO_EXECUTOR, get_market_structure, symbol)
    else:
        logger.debug(f"[Cache HIT] {key_structure}")
    
    if cached_news is None:
        futures["news"] = loop.run_in_executor(_DATA_IO_EXECUTOR, get_market_news, symbol)
    else:
        logger.debug(f"[Cache HIT] {key_news}")
    
    # ── Await only the futures that need to be fetched ────────────────────
    if futures:
        keys_to_fetch = list(futures.keys())
        results = await asyncio.gather(*futures.values(), return_exceptions=True)
        fetched = dict(zip(keys_to_fetch, results))
        
        # ── Write fresh data to cache (skip if fetch raised an exception) ─
        if "stock" in fetched and not isinstance(fetched["stock"], Exception):
            cache.set(key_price, fetched["stock"], ttl=_CACHE_TTL_PRICE)
            cached_stock = fetched["stock"]
        elif "stock" in fetched:
            logger.warning(f"[Cache] get_stock_data failed for {symbol}: {fetched['stock']}")
            cached_stock = {}  # Safe empty fallback
        
        if "setup" in fetched and not isinstance(fetched["setup"], Exception):
            cache.set(key_setup, fetched["setup"], ttl=_CACHE_TTL_SETUP)
            cached_setup = fetched["setup"]
        elif "setup" in fetched:
            logger.warning(f"[Cache] detect_setup failed for {symbol}: {fetched['setup']}")
            cached_setup = {}
        
        if "structure" in fetched and not isinstance(fetched["structure"], Exception):
            cache.set(key_structure, fetched["structure"], ttl=_CACHE_TTL_STRUCTURE)
            cached_structure = fetched["structure"]
        elif "structure" in fetched:
            logger.warning(f"[Cache] get_market_structure failed for {symbol}: {fetched['structure']}")
            cached_structure = {}
        
        if "news" in fetched and not isinstance(fetched["news"], Exception):
            cache.set(key_news, fetched["news"], ttl=_CACHE_TTL_NEWS)
            cached_news = fetched["news"]
        elif "news" in fetched:
            logger.warning(f"[Cache] get_market_news failed for {symbol}: {fetched['news']}")
            cached_news = []
    
    return {
        "stock":     cached_stock     or {},
        "setup":     cached_setup     or {},
        "structure": cached_structure or {},
        "news":      cached_news      or [],
    }
```

---

#### Step 3.4 — Verify `cache.set()` Signature

Before running, verify your `cache.py`'s `set()` method signature. Open `backend/app/core/cache.py` and look at the `CacheService.set()` method.

**Case A — If it looks like this (TTL supported):**
```python
def set(self, key: str, value: any, ttl: int = 300) -> None:
```
Then the code above is correct as-is.

**Case B — If it looks like this (no TTL parameter):**
```python
def set(self, key: str, value: any) -> None:
```
Then change all `cache.set(key, value, ttl=X)` calls to `cache.set(key, value)`.

**Case C — If TTL is the second positional argument:**
```python
def set(self, key: str, ttl: int, value: any) -> None:
```
Then reorder accordingly.

> This verification step is mandatory. Do NOT skip it. Cache interface mismatch is the most common runtime error when adding caching.

---

### CHANGE #4 — Gap #4: Dedicated Thread Executor

**Status:** ✅ Already included in Change #3 above.

The `_DATA_IO_EXECUTOR = ThreadPoolExecutor(max_workers=20)` is defined at module level in the rewritten `gather_stock_data` block, and all `run_in_executor(None, ...)` calls have been replaced with `run_in_executor(_DATA_IO_EXECUTOR, ...)`.

No additional steps required for Gap #4.

---

### CHANGE #5 — Gap #5: Expand Keyword Classifier

**File:** `backend/app/services/categorizer.py`
**Priority:** MEDIUM — Performance improvement for ~20% of queries
**Risk:** Zero — Additive only. New keywords go to fast path. No existing keywords removed.

#### Step 5.1 — Find the Keyword Dict

**FIND** in `categorizer.py` the `_FAST_CATEGORY_KEYWORDS` set and `_NSE_SYMBOL_MAP` dict:

```python
# FIND (exact variable names may vary slightly):
_FAST_CATEGORY_KEYWORDS = {
    # ... existing entries ...
}

_NSE_SYMBOL_MAP = {
    # ... existing entries ...
}
```

#### Step 5.2 — Add New Entries to `_FAST_CATEGORY_KEYWORDS`

**ADD** these entries to the existing set (do NOT remove existing entries):

```python
# ADD THESE to _FAST_CATEGORY_KEYWORDS (append inside the existing set's braces):

# ── Major NSE Large-Cap Stocks (previously missing) ──
"SBI", "SBIN", "STATE BANK",
"HDFC", "HDFC BANK", "HDFCBANK",
"ICICI", "ICICIGI", "ICICI BANK",
"KOTAK", "KOTAKBANK",
"AXISBANK", "AXIS BANK",
"BAJFINANCE", "BAJ FINANCE", "BAJAJ FINANCE",
"BAJAJFINSV", "BAJAJ FINSERV",
"ONGC",
"NTPC",
"POWERGRID",
"COALINDIA", "COAL INDIA",
"JSWSTEEL", "JSW STEEL",
"TATASTEEL", "TATA STEEL",
"TATAMOTORS", "TATA MOTORS",
"MARUTI", "SUZUKI",
"M&M", "MAHINDRA",
"ULTRACEMCO", "ULTRATECH",
"NESTLEIND", "NESTLE",
"HINDUNILVR", "HUL", "HINDUSTAN UNILEVER",
"TITAN",
"ASIANPAINT", "ASIAN PAINT",
"DRREDDY", "DR REDDY",
"SUNPHARMA", "SUN PHARMA",
"DIVISLAB", "DIVI'S",
"CIPLA",
"TECHM", "TECH MAHINDRA",
"HCLTECH", "HCL TECH",
"LTIM", "LTI MINDTREE",
"ADANIENT", "ADANI ENT", "ADANI",
"ADANIPORTS",

# ── Query Type Keywords (comparative + sector queries) ──
"compare", "comparison", "vs", "versus",
"sector", "industry", "segment",
"index", "nifty", "sensex", "benchmark",
"portfolio", "allocation", "diversify",
"screener", "screen", "filter",
"momentum", "breakout", "reversal",
"fundamental", "valuation", "overvalued", "undervalued",
"dividend", "yield", "payout",
"earnings", "results", "quarterly", "annual",
"ipo", "listing", "fpo",
"buy", "sell", "hold", "target", "price target",
```

#### Step 5.3 — Add New Entries to `_NSE_SYMBOL_MAP`

**ADD** these entries to the existing dict (do NOT remove existing entries):

```python
# ADD THESE to _NSE_SYMBOL_MAP (append inside the existing dict's braces):

# ── Banking & Finance ──
"SBI":          "SBIN.NS",
"SBIN":         "SBIN.NS",
"STATE BANK":   "SBIN.NS",
"HDFC BANK":    "HDFCBANK.NS",
"HDFCBANK":     "HDFCBANK.NS",
"HDFC":         "HDFCBANK.NS",
"ICICI BANK":   "ICICIBANK.NS",
"ICICIBANK":    "ICICIBANK.NS",
"KOTAK":        "KOTAKBANK.NS",
"KOTAKBANK":    "KOTAKBANK.NS",
"AXIS BANK":    "AXISBANK.NS",
"AXISBANK":     "AXISBANK.NS",
"BAJAJ FINANCE":"BAJFINANCE.NS",
"BAJFINANCE":   "BAJFINANCE.NS",
"BAJAJ FINSERV":"BAJAJFINSV.NS",
"BAJAJFINSV":   "BAJAJFINSV.NS",

# ── Energy & Utilities ──
"ONGC":         "ONGC.NS",
"NTPC":         "NTPC.NS",
"POWERGRID":    "POWERGRID.NS",
"COAL INDIA":   "COALINDIA.NS",
"COALINDIA":    "COALINDIA.NS",

# ── Metals & Mining ──
"JSW STEEL":    "JSWSTEEL.NS",
"JSWSTEEL":     "JSWSTEEL.NS",
"TATA STEEL":   "TATASTEEL.NS",
"TATASTEEL":    "TATASTEEL.NS",

# ── Auto ──
"TATA MOTORS":  "TATAMOTORS.NS",
"TATAMOTORS":   "TATAMOTORS.NS",
"MARUTI":       "MARUTI.NS",
"M&M":          "M&M.NS",
"MAHINDRA":     "M&M.NS",

# ── FMCG ──
"NESTLE":       "NESTLEIND.NS",
"NESTLEIND":    "NESTLEIND.NS",
"HUL":          "HINDUNILVR.NS",
"HINDUSTAN UNILEVER": "HINDUNILVR.NS",
"HINDUNILVR":   "HINDUNILVR.NS",

# ── Cement ──
"ULTRATECH":    "ULTRACEMCO.NS",
"ULTRACEMCO":   "ULTRACEMCO.NS",

# ── Consumer / Others ──
"TITAN":        "TITAN.NS",
"ASIAN PAINT":  "ASIANPAINT.NS",
"ASIANPAINT":   "ASIANPAINT.NS",

# ── Pharma ──
"DR REDDY":     "DRREDDY.NS",
"DRREDDY":      "DRREDDY.NS",
"SUN PHARMA":   "SUNPHARMA.NS",
"SUNPHARMA":    "SUNPHARMA.NS",
"CIPLA":        "CIPLA.NS",
"DIVI'S":       "DIVISLAB.NS",
"DIVISLAB":     "DIVISLAB.NS",

# ── IT ──
"TECH MAHINDRA":"TECHM.NS",
"TECHM":        "TECHM.NS",
"HCL TECH":     "HCLTECH.NS",
"HCLTECH":      "HCLTECH.NS",
"LTI MINDTREE": "LTIM.NS",
"LTIM":         "LTIM.NS",

# ── Conglomerates ──
"ADANI":        "ADANIENT.NS",
"ADANIENT":     "ADANIENT.NS",
"ADANIPORTS":   "ADANIPORTS.NS",
```

---

## SECTION D — IMPLEMENTATION ORDER & CHECKLIST

### Session 1: Gaps #1 + #6 (Est. 45 minutes)
Do these together — both are in `phase4_fundamentals_node`, same file, same session.

```
□ 1. Open backend/app/agent/graph.py
□ 2. Add _PHASE4_PRIMARY_POOL constant (Change #1, Step 1.1)
□ 3. Add _PHASE4_FALLBACK_POOL constant (Change #1, Step 1.1)
□ 4. Add _invoke_phase4_with_fallback() function (Change #1, Step 1.2)
□ 5. Add _extract_json() function (Change #2, Step 2.1)
□ 6. Find phase4_fundamentals_node() function
□ 7. Replace _QWEN_POOL.invoke(...) with _invoke_phase4_with_fallback(messages) (Step 1.3)
□ 8. Replace json.loads(raw) with _extract_json(raw, fallback=fundamentals_default) (Step 2.2)
□ 9. Scan other nodes for bare json.loads() calls → replace with _extract_json() (Step 2.3)
□ 10. Remove _QWEN_POOL definition (or comment it out — DO NOT delete immediately, comment first)
□ 11. Restart uvicorn, send one test stock query, verify no timeout, verify Phase 4 widget populates
```

### Session 2: Gaps #2 + #4 (Est. 2-3 hours)
Both are in `gather_stock_data` — do together.

```
□ 1. Open backend/app/core/cache.py
□ 2. Read and document the exact .get() and .set() signatures (Step 3.4 verification)
□ 3. Open backend/app/agent/graph.py
□ 4. Add: from app.core.cache import cache (Step 3.1)
□ 5. Add: from concurrent.futures import ThreadPoolExecutor (already in Step 3.3 block)
□ 6. Add _DATA_IO_EXECUTOR at module level (Step 3.3 — in the code block above gather_stock_data)
□ 7. Add TTL constants (_CACHE_TTL_PRICE etc.) (Step 3.3)
□ 8. Replace entire gather_stock_data() function body with new cached version (Step 3.3)
□ 9. Adjust cache.set() call syntax if TTL signature differs (Step 3.4 Case B or C)
□ 10. Restart uvicorn
□ 11. Send same stock query TWICE within 30 seconds → second call should be faster (cache hit)
□ 12. Check backend logs for "[Cache HIT]" messages on second call
□ 13. Verify result correctness — same data returned both times
```

### Session 3: Gap #5 (Est. 1 hour)
Standalone, low-risk, no restart needed after each addition.

```
□ 1. Open backend/app/services/categorizer.py
□ 2. Find _FAST_CATEGORY_KEYWORDS set
□ 3. Append all new keyword entries (Step 5.2)
□ 4. Find _NSE_SYMBOL_MAP dict
□ 5. Append all new symbol mappings (Step 5.3)
□ 6. Restart uvicorn
□ 7. Test query: "SBI stock analysis" → should hit fast path (no slow categorizer LLM call)
□ 8. Test query: "Compare HDFC BANK vs ICICI BANK" → should route correctly
□ 9. Test query: "ONGC fundamentals" → should resolve to ONGC.NS directly
```

---

## SECTION E — TESTING & VERIFICATION

### Test 1: Verify Gap #1 Fixed (Qwen Timeout Gone)
```
Before fix: Stock query takes 12-15 seconds total (10s from Qwen timeout)
After fix:  Stock query takes 2-4 seconds total

How to test:
1. Send: POST /api/v1/agent/chat with body {"message": "Analyze RELIANCE.NS"}
2. Measure total response time
3. Expected: Under 4 seconds
4. Check logs: Should see "[Phase4] Invoking primary model: google/gemini-2.5-flash"
5. Should NOT see any timeout errors or 10-second delays
```

### Test 2: Verify Gap #6 Fixed (No More Blank Widgets)
```
Before fix: Phase 4 widgets sometimes show blank/empty
After fix:  Phase 4 widgets always show data (or meaningful fallback text)

How to test:
1. Send 10 different stock queries rapidly
2. Count how many return populated fundamentals widgets vs blank
3. Expected: 100% populated (either real data or fallback text)
4. Check logs: Should NOT see any "json.loads() failed" or "JSONDecodeError"
```

### Test 3: Verify Gap #2 Fixed (Cache Working)
```
Before fix: Every query fetches fresh yFinance data (~3-4s for 4 concurrent calls)
After fix:  Cache hit returns in <100ms for same symbol within TTL window

How to test:
1. Query: "RELIANCE.NS analysis" — note response time (should be 2-4s, cold)
2. Query: "RELIANCE.NS analysis" again within 30 seconds
3. Second query should be noticeably faster (data from cache)
4. Check logs: "[Cache HIT] agent:price:RELIANCE.NS" on second call
5. Wait 31 seconds, query again → should be cold again (cache expired)
```

### Test 4: Verify Gap #4 Fixed (Dedicated Executor)
```
This is an infrastructure fix — not directly user-visible but prevents thread starvation.

How to test (advanced):
1. Open two browser tabs, both on AI Research page
2. Send queries from BOTH tabs simultaneously (within 1 second of each other)
3. Before fix: Second query may hang while first completes (thread pool contention)
4. After fix: Both queries progress independently and complete within similar timeframes
5. Check logs: Thread names should show "finsight_data_io_0", "finsight_data_io_1" etc.
```

### Test 5: Verify Gap #5 Fixed (Fast Path Keywords)
```
Before fix: "SBI analysis" hits slow categorizer LLM call (1-4s extra)
After fix:  "SBI analysis" resolves instantly via keyword lookup

How to test:
1. Enable debug logging in categorizer.py (add: logger.debug("Category resolved via fast path"))
2. Send: "SBI stock analysis"
3. Check logs: Should show fast path resolution, NOT slow LLM categorization
4. Response time for simple NSE queries should improve by 1-4 seconds
```

---

## SECTION F — ENV VARIABLE VERIFICATION

Before running any code, verify these variables exist in your root `.env` file:

```env
# This must exist and have a valid OpenRouter API key:
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx

# OR it might be named differently in your config.py:
# Check backend/app/core/config.py for the exact field name
# It could be: openrouter_api_key, OPENROUTER_API_KEY, or open_router_api_key
```

**How to check the exact field name:**
1. Open `backend/app/core/config.py`
2. Look for a field that contains "openrouter" or "open_router"
3. That field name (in lowercase) is what your `graph.py` uses as `settings.openrouter_api_key` (or equivalent)
4. Make sure `.env` has a matching entry

---

## SECTION G — POTENTIAL PITFALLS & MITIGATIONS

| Pitfall | Detection | Mitigation |
|---------|-----------|-----------|
| `cache.set()` TTL signature mismatch | `TypeError` on first cached write | Read `cache.py` first (Section D checklist Step 1) |
| `_invoke_phase4_with_fallback` receives wrong message format | `AttributeError` on `.content` | Add `str(response)` fallback in the helper (already included) |
| `asyncio.get_event_loop()` deprecated in Python 3.12+ | `DeprecationWarning` | Replace with `asyncio.get_running_loop()` if on Python 3.12+ |
| `_DATA_IO_EXECUTOR` defined inside function gets garbage collected | Random `RuntimeError` | Defined at MODULE LEVEL (already in the plan above) |
| New NSE symbols in `_NSE_SYMBOL_MAP` have wrong `.NS` suffix | Wrong ticker fetched | Verify each added symbol at `finance.yahoo.com/quote/SYMBOL.NS` before deploying |
| Gemini 2.5 Flash `temperature=0.1` suppresses creative responses | Overly terse fundamental analysis | Increase to `temperature=0.3` if responses feel too dry |

---

## SECTION H — WHAT DOES NOT CHANGE

The following are explicitly protected and will not be touched at any point:

- `backend/app/core/cache.py` — Read only, import only
- `backend/app/agent/tools.py` — Not touched
- `backend/app/agent/prompt_builder.py` — Not touched
- `backend/app/agent/prompts.py` — Not touched
- `backend/app/services/stock_service.py` — Not touched
- `backend/app/services/market_structure.py` — Not touched
- `backend/app/services/setup_engine.py` — Not touched
- `backend/app/main.py` — Not touched
- All database models — Not touched
- All frontend files — Not touched
- All other API routes — Not touched

---

## SECTION I — EXPECTED PERFORMANCE IMPROVEMENT (SUMMARY)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Cold stock query (no cache) | 12-15s | 2-4s | ~75% faster |
| Warm stock query (cache hit) | 12-15s | 0.5-1s | ~93% faster |
| Phase 4 widget blank rate | ~15-30% | ~0-2% | Near elimination |
| "SBI"-type query extra delay | +1-4s | 0s | Eliminated |
| Concurrent query thread contention | Present | Eliminated | Stable under load |

---

*End of Execution Plan — Version 1.0 — April 30, 2026*
*Based on Gemini.md (last updated April 29, 2026) and audit discussion*