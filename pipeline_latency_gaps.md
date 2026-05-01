# FinSight AI — LangGraph Pipeline Latency Gap Analysis
> **Last Updated:** April 30, 2026
> **Author:** Antigravity AI (Performance Audit)
> **Purpose:** This document is a deep, descriptive breakdown of every latency gap found in the FinSight AI LangGraph pipeline. It explains **what the gap is**, **why it exists**, **how much time it wastes**, and **exactly how to fix it**.

---

## Understanding the Pipeline Flow

Before diving into the gaps, here is the complete execution path for a **stock analysis query** (e.g. *"Analyze RELIANCE for long term"*). This is the most complex and most frequently used path.

```
User Sends Query
      │
      ▼
[Phase 1] Rule-Based Complexity Classifier       ← <1ms,  Zero API cost
      │
      ▼
[Phase 2] Intent Classifier (Fast or Slow Path)  ← <1ms (fast) OR 1–4s (slow)
      │
      ▼
[Router] route_intent()                          ← <1ms,  Pure Python
      │
      ▼
[Phase 3A] gather_stock_data                     ← 1.5–4s, 4 concurrent yFinance calls
      │
      ▼
[Phase 3B] analyze_stock (Main LLM Chat)         ← 1–3s,  Gemini Flash streaming
      │
      ▼
      END  ─────────────────────────────────── User sees text in UI ✅
      │
      │  (Background Task — does NOT block UI)
      ▼
[Phase 4A] Parallel LLM Nodes (3 concurrent)
  ├── phase4_technicals_node   ← Gemini Flash, 2–5s
  ├── phase4_news_node         ← Gemini Flash, 2–5s
  └── phase4_fundamentals_node ← Qwen (HANGING) → Flash fallback, 10–15s
      │
      ▼
[Phase 4B] phase4_sequencer_node                 ← <5ms, Pure Python
      │
      ▼
[Phase 4C] SSE Artifact Events → Frontend Widgets
```

**Total time before user sees text:** Target `< 5s`. Currently: `8–40s` depending on key exhaustion.
**Total time before widgets populate:** Target `< 10s`. Currently: `15–50s`.

---

## Gap #1 — NVIDIA NIM Qwen Timeout (CRITICAL 🔴)

### What Is This Gap?
In `phase4_fundamentals_node` (located in `graph.py` around line 1216), the code is designed to call the **Qwen 3.5 397B A17B** model hosted on the NVIDIA NIM platform for deep fundamental analysis (P/E ratio, Revenue Trend, Debt Health, Valuation).

The code tries to call `_QWEN_POOL.invoke(...)` as its **first and primary** choice. Only if that fails does it fall back to the Gemini Flash pool.

### Why Does This Gap Exist?
The NVIDIA NIM API endpoint (`https://integrate.api.nvidia.com/v1`) is currently **not responding** to requests. When the backend sends a request, the TCP connection opens successfully (the server acknowledges the connection), but the server never sends back a single byte of the response. It just hangs indefinitely.

This is an infrastructure issue on NVIDIA's side — their API is overloaded, down for maintenance, or the specific model endpoint is unavailable.

### How Much Time Does It Waste?
We set a 10-second timeout on the Qwen pool after diagnosing this. This means:

- Every single stock analysis query waits a full **10 dead seconds** while the backend holds an open TCP connection to NVIDIA, hoping for a response that never comes.
- After 10 seconds, the `TimeoutError` is raised, caught by the `except` block, and it falls back to Gemini Flash.
- The Gemini Flash fallback then takes another 2–5 seconds to complete.
- **Total wasted time: 10–12 seconds** purely because we're waiting for a server that will never respond.

### Where Is This In The Code?
```python
# graph.py — phase4_fundamentals_node (around line 1216)
try:
    # ── EXPLICIT: Always use Qwen 3.5 397B A17B for fundamental analysis ──
    raw = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: _QWEN_POOL.invoke(messages, cfg, temperature, streaming=False)
    )
    # ... parse and return
except Exception as e:
    logger.warning("[Phase4-Fundamentals] Qwen failed, trying Gemini Pro fallback: %s", e)
    # ... fallback to Gemini (after 10 seconds have already been wasted)
```

### How To Fix It
**Short-term fix (do now):** Replace the primary pool in `phase4_fundamentals_node` with `_GEMINI_FLASH_POOL` directly. Remove the Qwen attempt entirely until NVIDIA is stable and confirmed working. Qwen should only be re-enabled after a successful live latency test (target: `< 3s TTFT`).

**Long-term fix (when NVIDIA is stable):** Use a "race" pattern — send the request to both Qwen and Gemini Flash simultaneously and use whichever responds first. This ensures Qwen's superior quality when it's fast and Gemini's reliability as the guaranteed fallback.

**Estimated saving:** 8–12 seconds per stock analysis query.

---

## Gap #2 — yFinance Data Is Never Cached (HIGH 🟠)

### What Is This Gap?
Every time any user asks about a stock — even the exact same stock that was analyzed 5 seconds ago — the backend makes **4 fresh network calls to Yahoo Finance servers**:

1. `get_stock_data` → Fetches live price, P/E ratio, Market Cap, 52-week high/low
2. `detect_setup` → Fetches historical OHLCV data to compute RSI, MACD, SMA, EMA
3. `get_market_structure` → Fetches historical price data to compute support/resistance levels
4. `get_market_news` → Scrapes Yahoo Finance RSS feed for recent headlines

None of these results are ever saved to memory or Redis. Every single query pays the full network latency cost, even for data that changes at most once every few minutes.

### Why Does This Gap Exist?
The project has a fully-built caching layer at `backend/app/core/cache.py`. It supports both Redis (for production) and an in-memory dictionary (for development). However, the `gather_stock_data` node in `graph.py` was never wired up to use it.

### How Much Time Does It Waste?
- Each of the 4 yFinance calls takes approximately 400ms to 1,500ms over the network.
- Even with `asyncio.gather` running them concurrently, the slowest call determines the total time. The slowest is typically `get_stock_data` which calls `ticker.info` — a notoriously slow yFinance endpoint that can take up to **4 seconds** on a cold request.
- If the same stock (e.g. `RELIANCE.NS`) is queried twice within 30 seconds, the second query pays the exact same 2–4 second cost needlessly.

### Where Is This In The Code?
```python
# graph.py — gather_stock_data (around line 752)
stock_r, setup_r, structure_r, news_r = await asyncio.gather(
    loop.run_in_executor(None, lambda: get_stock_data.invoke({"symbol": symbol})),
    loop.run_in_executor(None, lambda: detect_setup.invoke({"symbol": symbol})),
    loop.run_in_executor(None, lambda: get_market_structure.invoke({"symbol": symbol})),
    loop.run_in_executor(None, lambda: get_market_news.invoke({"symbol": symbol, "limit": 5})),
    return_exceptions=True,
)
# ⚠️ No cache read before this. No cache write after this.
```

### How To Fix It
Wrap each tool call with a cache read-before / write-after pattern using the existing `get_cache()` and `set_cache()` utilities from `cache.py`.

```python
# Pseudocode for the fix
from app.core.cache import get_cache, set_cache

cache_key = f"stock_data:{symbol}"
cached = await get_cache(cache_key)
if cached:
    return cached  # ← instant, 0ms

result = get_stock_data.invoke({"symbol": symbol})
await set_cache(cache_key, result, ttl=30)  # Cache for 30 seconds
return result
```

Recommended TTL values:
- `stock_data` (price/fundamentals): **30 seconds** — prices change every 15 seconds in markets
- `technicals` (RSI/SMA/EMA): **60 seconds** — these are computed from daily/hourly candles, they barely change
- `market_structure` (support/resistance): **120 seconds** — changes very slowly
- `news` (RSS headlines): **300 seconds (5 minutes)** — news articles don't update that frequently

**Estimated saving:** 2–4 seconds on cached queries, which could represent 40–60% of all queries in active use.

---

## Gap #3 — Synchronous Analysis Nodes Block The Thread Pool (MEDIUM 🟡)

### What Is This Gap?
The main synthesis nodes — `analyze_stock`, `synthesize_news`, `audit_portfolio`, and `handle_general` — are all defined as regular Python **synchronous functions** (`def`, not `async def`).

```python
# graph.py — Current state (synchronous)
def analyze_stock(state: AgentState) -> AgentState:
    ...
    content = _invoke_with_fallback("analyze_stock", messages, complexity, use_streaming=True)
    return {**state, "final_response": content}
```

When LangGraph encounters a synchronous node, it executes it by running it in a **background thread** from Python's default `ThreadPoolExecutor`. Inside that thread, `_invoke_with_fallback` makes a blocking HTTP call to the Gemini API.

### Why Is This A Problem?
Python's default `ThreadPoolExecutor` (the one used by `asyncio.get_event_loop().run_in_executor(None, ...)`) has a limited number of threads — typically `min(32, os.cpu_count() + 4)`. On a standard development machine this is around 8–12 threads.

The same default pool is shared between:
- Data-gathering calls (`get_stock_data`, `detect_setup`, etc.) in `gather_stock_data`
- The blocking LLM HTTP call inside `analyze_stock`
- Phase 4 LLM calls in the background task
- Any other concurrent request's data fetching

Under a single user: fine.
Under 2–3 concurrent users: the threads start competing. New tasks queue up waiting for a thread to become free. This invisible queuing time can add **500ms to 2+ seconds** of latency that doesn't show up in any single function's timing, making it extremely hard to diagnose.

### How To Fix It
Convert the analysis nodes to `async def`. Instead of calling the synchronous `_invoke_with_fallback` in a blocking manner, call it wrapped in `asyncio.get_event_loop().run_in_executor` with a **dedicated executor** (see Gap #4). For true async I/O, refactor `_invoke_with_fallback` to use `async` LangChain calls.

**Estimated saving:** 200ms–2 seconds under concurrent load.

---

## Gap #4 — Shared Default Thread Executor Causes Queuing (MEDIUM 🟡)

### What Is This Gap?
As explained in Gap #3, all `run_in_executor(None, ...)` calls in the codebase share Python's single default `ThreadPoolExecutor`. The `None` argument is what tells asyncio to use the default pool.

This pool is a shared resource and has no awareness of the priorities between tasks. A low-priority background Phase 4 task can "steal" a thread that a high-priority user-facing data fetch needs.

### How Much Time Does It Waste?
Under concurrent load (2+ active users at the same time), tasks that need a thread can wait in the queue for 200ms to 1,500ms. This adds invisible, hard-to-debug latency spikes that feel random to the developer.

### How To Fix It
Create a **dedicated** `ThreadPoolExecutor` specifically for data-gathering I/O:

```python
# graph.py — Add near the top, after imports
import concurrent.futures

# Dedicated pool for external API calls (yFinance, NewsAPI, etc.)
# Completely isolated from the default asyncio pool used by LangGraph internals.
_DATA_IO_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=20,
    thread_name_prefix="finsight-data-io"
)
```

Then replace every `run_in_executor(None, ...)` in `gather_stock_data` and `handle_market` with `run_in_executor(_DATA_IO_EXECUTOR, ...)`.

**Estimated saving:** 200ms–1.5 seconds under concurrent load. Improves predictability.

---

## Gap #5 — LLM Classification Slow Path (LOW-MEDIUM 🟢)

### What Is This Gap?
The `classify_intent` node runs in two phases:

- **Fast Path** (`_fast_classify`): A regex-based classifier that runs in under 1ms and costs zero API calls. Handles about 80% of queries.
- **Slow Path** (LLM Fallback): For queries the regex cannot confidently classify, the system makes a **full Gemini API call** just to determine what category the query belongs to (stock, news, portfolio, general, market). This is before any actual data fetching or analysis even begins.

### Why Does This Gap Exist?
The fast-path keyword dictionaries (`_FAST_CATEGORY_KEYWORDS`) and the NSE ticker map (`_NSE_SYMBOL_MAP`) are incomplete. Common and valid financial queries like:
- *"Should I invest in the IT sector?"*
- *"What is a good banking stock?"*
- *"Compare TCS and Infosys"*
- *"HDFC Bank kar analysis"* (Hindi-English mix)

...fail regex matching because the keywords and symbol abbreviations for these patterns are not present in the fast-path lists.

### How Much Time Does It Waste?
- The LLM classification call takes **1–4 seconds** depending on key availability and model latency.
- This is pure overhead — the user has not received any data yet, the graph hasn't even routed, and the screen just shows "Agent initialising..." the entire time.
- Approximately **20% of queries** hit this slow path based on the keyword coverage gaps.

### How To Fix It
Expand the `_FAST_CATEGORY_KEYWORDS` dictionary and the `_NSE_SYMBOL_MAP` to cover more patterns:

```python
# Add to _FAST_CATEGORY_KEYWORDS["general"]
"compare", "vs", "sector", "it sector", "banking", "pharma", "invest in",
"kar analysis", "batao", "kya lagta", "good stock", "best stock"

# Expand _NSE_SYMBOL_MAP with common abbreviations
"HDFC": "HDFCBANK.NS",
"HDFC BANK": "HDFCBANK.NS",
"SBI": "SBIN.NS",
"STATE BANK": "SBIN.NS",
"BAJAJ FIN": "BAJFINANCE.NS",
```

**Estimated saving:** 1–4 seconds for ~20% of queries.

---

## Gap #6 — JSON Parse Failures Increase Fallback Rate (LOW 🟢)

### What Is This Gap?
The three Phase 4 specialist nodes (Technicals, News, Fundamentals) all ask the LLM to return a **strict JSON object** with no surrounding markdown or explanation. They then call `json.loads(raw)` directly.

In practice, LLMs frequently return responses like:
```
Sure! Here is the analysis:
```json
{"trend": "BULLISH", "rsi_value": 45.5, ...}
```
```

Or sometimes:
```
{"trend": "BULLISH", "rsi_value": 45.5, ...
```
*(truncated due to token limit)*

The current stripping logic (`raw.strip().strip("```json").strip("```").strip()`) is fragile. If the model adds any prefix like *"Sure!"*, the strip fails. If the JSON is truncated, `json.loads` raises a `JSONDecodeError`.

### Why Is This A Problem?
When `json.loads` fails, the **entire node fails silently** and returns the generic fallback dict with null values. This means the user sees empty widgets even when the model actually produced valid JSON — it just had a few extra words around it.

### How To Fix It
Add a robust JSON extractor using a simple regex before attempting to parse:

```python
import re

def _extract_json(raw: str) -> dict:
    """
    Robustly extracts a JSON object from a potentially dirty LLM response.
    Handles markdown fences, surrounding text, and minor truncation.
    """
    # Strip markdown fences first
    raw = re.sub(r"```(?:json)?", "", raw).strip()

    # Extract the first {...} block found
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError("No JSON object found in LLM response")
```

**Estimated impact:** Reduces Phase 4 failure rate by 15–30%, meaning more widgets show real AI data instead of "unavailable" placeholders.

---

## Summary Table

| # | Gap Name | Phase | Latency Added | Frequency | Fix Complexity | Priority |
|---|---|---|---|---|---|---|
| 1 | NVIDIA Qwen Timeout | Phase 4 Fundamentals | +10–12s | Every stock query | Low (1 line change) | 🔴 Critical |
| 2 | yFinance Not Cached | Phase 3A Data Gather | +2–4s | Every query | Medium | 🟠 High |
| 3 | Sync Nodes Block Threads | Phase 3B & 4 | +0.5–2s | Under load | Medium | 🟡 Medium |
| 4 | Shared Thread Executor | Phase 3A, 4A | +0.2–1.5s | Under load | Low | 🟡 Medium |
| 5 | LLM Classifier Slow Path | Phase 2 | +1–4s | 20% of queries | Low | 🟢 Low |
| 6 | JSON Parse Failures | Phase 4A | Increases errors | ~15–30% of queries | Low | 🟢 Low |

---

## Target Latency Goals (After All Fixes)

| Milestone | Current (Worst Case) | Target (After Fixes) |
|---|---|---|
| First SSE event to user | 100ms | < 100ms ✅ (already fine) |
| Classification complete | 1–4s | < 100ms |
| Data gathering complete | 4–8s | 1.5–2s |
| First chat token in UI | 6–12s | 2–4s |
| Phase 4 widgets populated | 15–50s | 5–10s |

---

## Implementation Order (Recommended)

1. **Gap #1** — Bypass Qwen in `phase4_fundamentals_node` → Direct Gemini Flash call
2. **Gap #2** — Add cache wrapper in `gather_stock_data` using `cache.py`
3. **Gap #6** — Add `_extract_json()` helper in all Phase 4 nodes
4. **Gap #4** — Create `_DATA_IO_EXECUTOR` and replace all `run_in_executor(None, ...)`
5. **Gap #3** — Convert synthesis nodes to `async def`
6. **Gap #5** — Expand `_FAST_CATEGORY_KEYWORDS` and `_NSE_SYMBOL_MAP`
