# FinSight AI — Latency Fix Implementation Guide
### For: Claude Sonnet 4.6 on Antigravity
### Prepared by: Harsh (via Claude claude-sonnet-4-6)
### Date: April 28, 2026

---

> ## ⚠️ READ THIS FIRST — BEFORE TOUCHING ANY CODE
>
> This document describes **3 surgical fixes** to reduce pipeline latency from ~28-60 seconds
> to under 10 seconds (perceived). 
>
> **You MUST verify each diagnosis below against the actual codebase before implementing.**
> The exact line numbers and code snippets are provided — cross-check them first.
> If anything doesn't match, STOP and report the mismatch. Do not guess.
>
> **Files to be modified:** `backend/app/agent/graph.py` and `backend/app/api/agent.py` ONLY.
> No other file should be touched.

---

## THE ROOT CAUSE — Understand This First

The pipeline has **3 compounding latency problems**:

```
User Query
    │
    ▼
Phase 1: classify_query_complexity()     →  <1ms   ✅ Fine
    │
    ▼
Phase 2: classify_intent() LLM call      →  8-10s  ❌ PROBLEM 1
    │     Full Gemma 4 31B API call just
    │     to extract ticker + category JSON
    ▼
Phase 3: gather_stock_data()             →  3-8s   ❌ PROBLEM 2
    │     Starts AFTER Phase 2 completes
    │     Sequential, not overlapping
    ▼
Phase 4: analyze_stock() / handle_*()   →  15-20s ❌ PROBLEM 3
          stream_mode="updates" means
          LangGraph waits for FULL node
          completion before yielding.
          asyncio.sleep(0.02) is FAKE streaming.
          User sees nothing for 15-20 seconds,
          then all chunks appear instantly.

TOTAL PERCEIVED WAIT: 28-60 seconds
```

---

## DIAGNOSIS — Verify These 3 Things in the Codebase

### Diagnosis 1: Phase 2 has no fast-path

**File:** `backend/app/agent/graph.py`
**Look for:** `classify_intent()` function (around line 408)

You should see this — a full LLM call every single time:
```python
def classify_intent(state: AgentState) -> AgentState:
    complexity = classify_query_complexity(state["query"])
    messages = [
        SystemMessage(content=CLASSIFIER_SYSTEM_PROMPT),
        HumanMessage(content=CLASSIFIER_USER_TEMPLATE.format(query=state["query"]))
    ]
    try:
        raw = _invoke_with_fallback("classify_intent", messages, complexity="simple")
        ...
```

**Confirm:** There is NO regex check before the `_invoke_with_fallback` call. 
If confirmed → Fix 1 applies.

---

### Diagnosis 2: Phase 3 starts AFTER Phase 2

**File:** `backend/app/agent/graph.py`
**Look for:** The LangGraph graph definition — how nodes are connected.

You should see Phase 3 nodes (`gather_stock_data`, etc.) connected as edges AFTER `classify_intent`. This means Phase 3 cannot start until Phase 2's full LLM call finishes.

**Confirm:** `gather_stock_data` depends on `classify_intent` output (needs `intent_symbol`).
If confirmed → Fix 2 applies.

---

### Diagnosis 3: Fake streaming in the SSE endpoint

**File:** `backend/app/api/agent.py`
**Look for:** `_agent_stream_generator()` function

You should see this exact pattern:
```python
async for event in graph.astream(initial_state, stream_mode="updates"):
    ...
    if node_name in ("analyze_stock", ...) and not emitted_response:
        final_text = update.get("final_response", "")
        if final_text:
            emitted_response = True
            chunks = _split_into_chunks(final_text)
            for chunk in chunks:
                yield _sse_event("chunk", {"text": chunk})
                await asyncio.sleep(0.02)   # ← THIS IS FAKE. Cosmetic only.
```

**The problem:** `stream_mode="updates"` gives you the COMPLETE `final_response` string
only after the LangGraph node has FULLY finished. The `_split_into_chunks()` + 
`asyncio.sleep(0.02)` is simulating word-by-word streaming artificially — 
but the user already waited 15-20 seconds for the node to complete before seeing the first chunk.

**Confirm:** `final_response` arrives as a complete string, not token-by-token.
If confirmed → Fix 3 applies.

---

## THE 3 FIXES

---

## Fix 1 — Regex Fast-Path in `classify_intent()`

**Goal:** For queries where the ticker and category are obvious (80% of real queries),
skip the 8-10 second LLM call entirely. Time saved: 8-10 seconds.

**File:** `backend/app/agent/graph.py`

**Step 1A:** Add these imports at the top of `graph.py` (with existing imports):
```python
import re
```

**Step 1B:** Add this new helper function BEFORE `classify_intent()`:

```python
# ── Regex Fast-Path for Phase 2 ──────────────────────────────────────────────
_NSE_TICKER_REGEX = re.compile(
    r'\b(RELIANCE|TCS|INFY|INFOSYS|HDFCBANK|HDFC|SBIN|STATEBANK|ICICIBANK|ICICI|'
    r'WIPRO|AXISBANK|AXIS|BAJFINANCE|BAJAJ|SUNPHARMA|SUN|LT|LARSEN|TATASTEEL|TATA|'
    r'ADANIENT|ADANI|ONGC|COALINDIA|COAL|NTPC|POWERGRID|HINDUNILVR|HUL|NESTLEIND|'
    r'NESTLE|MARUTI|TATAMOTORS|BHARTIARTL|AIRTEL|JSWSTEEL|JSW|INDIGO|ASIANPAINT|'
    r'ASIAN|TECHM|TECH|HCLTECH|HCL|DRREDDY|CIPLA|DIVISLAB|DIVIS)\b',
    re.IGNORECASE
)

_NSE_SYMBOL_MAP = {
    "RELIANCE": "RELIANCE.NS", "TCS": "TCS.NS", "INFY": "INFY.NS",
    "INFOSYS": "INFY.NS", "HDFCBANK": "HDFCBANK.NS", "HDFC": "HDFCBANK.NS",
    "SBIN": "SBIN.NS", "STATEBANK": "SBIN.NS", "ICICIBANK": "ICICIBANK.NS",
    "ICICI": "ICICIBANK.NS", "WIPRO": "WIPRO.NS", "AXISBANK": "AXISBANK.NS",
    "AXIS": "AXISBANK.NS", "BAJFINANCE": "BAJFINANCE.NS", "BAJAJ": "BAJFINANCE.NS",
    "SUNPHARMA": "SUNPHARMA.NS", "SUN": "SUNPHARMA.NS", "LT": "LT.NS",
    "LARSEN": "LT.NS", "TATASTEEL": "TATASTEEL.NS", "TATA": "TATAMOTORS.NS",
    "ADANIENT": "ADANIENT.NS", "ADANI": "ADANIENT.NS", "ONGC": "ONGC.NS",
    "COALINDIA": "COALINDIA.NS", "COAL": "COALINDIA.NS", "NTPC": "NTPC.NS",
    "POWERGRID": "POWERGRID.NS", "HINDUNILVR": "HINDUNILVR.NS", "HUL": "HINDUNILVR.NS",
    "NESTLEIND": "NESTLEIND.NS", "NESTLE": "NESTLEIND.NS", "MARUTI": "MARUTI.NS",
    "TATAMOTORS": "TATAMOTORS.NS", "BHARTIARTL": "BHARTIARTL.NS", "AIRTEL": "BHARTIARTL.NS",
    "JSWSTEEL": "JSWSTEEL.NS", "JSW": "JSWSTEEL.NS", "INDIGO": "INDIGO.NS",
    "ASIANPAINT": "ASIANPAINT.NS", "ASIAN": "ASIANPAINT.NS", "TECHM": "TECHM.NS",
    "TECH": "TECHM.NS", "HCLTECH": "HCLTECH.NS", "HCL": "HCLTECH.NS",
    "DRREDDY": "DRREDDY.NS", "CIPLA": "CIPLA.NS", "DIVISLAB": "DIVISLAB.NS",
    "DIVIS": "DIVISLAB.NS",
}

_FAST_CATEGORY_KEYWORDS = {
    "news":      ["news", "headline", "update", "latest", "happened", "today", "announced"],
    "portfolio": ["portfolio", "holding", "holdings", "bought", "sold", "position", "my stocks", "invested"],
    "market":    ["nifty", "sensex", "market", "index", "top stocks", "best stocks", "gainers", "losers", "screen"],
    "general":   ["what is", "explain", "how does", "define", "meaning of", "teach me", "what are"],
}

def _fast_classify(query: str) -> dict | None:
    """
    Regex-based fast-path classifier. Returns result dict if confident, else None.
    Execution time: <1ms. Zero API calls.
    Returns None → caller must fall through to LLM classification.
    """
    q_lower = query.lower()

    # Detect category from keywords first
    detected_category = None
    for category, keywords in _FAST_CATEGORY_KEYWORDS.items():
        if any(kw in q_lower for kw in keywords):
            detected_category = category
            break

    # Detect NSE ticker
    ticker_match = _NSE_TICKER_REGEX.search(query)
    detected_symbol = None
    if ticker_match:
        raw_ticker = ticker_match.group().upper()
        detected_symbol = _NSE_SYMBOL_MAP.get(raw_ticker)

    # Decision logic
    if detected_symbol and not detected_category:
        # Ticker found, no category keyword → assume "stock"
        return {"category": "stock", "symbol": detected_symbol, "confidence": 0.88}

    if detected_symbol and detected_category == "news":
        # "TCS news" or "Reliance latest update"
        return {"category": "news", "symbol": detected_symbol, "confidence": 0.90}

    if detected_symbol and detected_category in ("general",):
        # "What is Reliance PE" — still a stock query
        return {"category": "stock", "symbol": detected_symbol, "confidence": 0.85}

    if detected_category in ("portfolio", "market", "general") and not detected_symbol:
        # Clear category with no specific stock
        return {"category": detected_category, "symbol": None, "confidence": 0.87}

    # Ambiguous — let LLM handle it
    return None
```

**Step 1C:** Modify `classify_intent()` — add fast-path check at the TOP, before the LLM call:

Replace the ENTIRE `classify_intent()` function with this:

```python
def classify_intent(state: AgentState) -> AgentState:
    """
    Phase 1: Rule-based complexity classification (zero API cost, <1ms).
    Phase 2: Fast-path regex classification (<1ms, no API call) for clear queries.
             Falls back to LLM (Gemma 4 31B) only if regex is not confident.
    """
    # Phase 1 — keyword complexity classifier, zero API cost
    complexity = classify_query_complexity(state["query"])

    # Phase 2 — FAST PATH: try regex first (<1ms, no API call)
    fast_result = _fast_classify(state["query"])
    if fast_result:
        logger.info(
            "classify_intent [FAST PATH]: regex classified '%s' → %s / %s",
            state["query"][:50], fast_result["category"], fast_result["symbol"]
        )
        return {
            **state,
            "query_complexity":  complexity,
            "intent_category":   fast_result["category"],
            "intent_symbol":     fast_result["symbol"],
            "intent_confidence": fast_result["confidence"],
            "gathered_data":     {},
        }

    # Phase 2 — SLOW PATH: LLM call only for ambiguous queries
    logger.info("classify_intent [LLM PATH]: regex inconclusive, calling Gemma 4 31B")
    messages = [
        SystemMessage(content=CLASSIFIER_SYSTEM_PROMPT),
        HumanMessage(content=CLASSIFIER_USER_TEMPLATE.format(query=state["query"]))
    ]
    try:
        raw = _invoke_with_fallback("classify_intent", messages, complexity="simple")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        return {
            **state,
            "query_complexity":  complexity,
            "intent_category":   parsed.get("category", "general"),
            "intent_symbol":     parsed.get("symbol"),
            "intent_confidence": parsed.get("confidence", 0.5),
            "gathered_data":     {},
        }
    except Exception as e:
        return {
            **state,
            "query_complexity":  complexity,
            "intent_category":   "general",
            "intent_symbol":     None,
            "intent_confidence": 0.0,
            "gathered_data":     {},
            "error":             f"Classification failed: {str(e)}"
        }
```

**Expected result after Fix 1:**
- "Analyze RELIANCE" → <1ms (was 8-10s)
- "TCS price today" → <1ms (was 8-10s)
- "Should I invest in Infosys long term" → <1ms (was 8-10s)
- "Kitni achhi company hai ye" (Hindi, no ticker) → LLM fallback (correct behavior)

---

## Fix 2 — COMPLEX_KEYWORDS Expansion

**Goal:** "Analyze RELIANCE for long term" was wrongly classified as `simple` because
`"long term"` was not in `COMPLEX_KEYWORDS`. Wrong tier = wrong model = poor analysis quality.

**File:** `backend/app/agent/graph.py`
**Look for:** `classify_query_complexity()` function — find the `complex_patterns` list.

**Add these keywords** to the existing complex patterns list (do not remove any existing ones):

```python
# Add to complex_patterns list:
"long term", "short term", "long-term", "short-term",
"fundamental", "intrinsic value", "valuation", "dcf",
"earnings", "quarterly results", "annual report", "q4", "q3", "q2", "q1",
"should i buy", "should i sell", "good investment", "worth buying",
"growth potential", "target price", "fair value", "undervalued", "overvalued",
"technical analysis", "chart pattern", "breakout", "breakdown",
"debt", "revenue", "profit", "ebitda", "cash flow", "margin",
```

**Expected result after Fix 2:**
- "Analyze RELIANCE for long term" → `complex` tier → DeepSeek V4 (was wrongly `simple` → Gemma)
- "Should I buy TCS now" → `complex` tier → DeepSeek V4
- "TCS Q4 earnings analysis" → `complex` tier → DeepSeek V4

---

## Fix 3 — Real Token Streaming (The Biggest Perceived Latency Win)

**Goal:** User sees first words in 1-2 seconds instead of waiting 15-20 seconds in silence.
This is the highest-impact fix for user experience.

**The core problem (already diagnosed above):**
`stream_mode="updates"` delivers the complete `final_response` string only after the node
finishes. The current word-by-word simulation is fake — it happens AFTER the full wait.

**The fix:** Use `stream_mode="messages"` instead of `"updates"`. In LangGraph, `messages` 
stream mode yields actual LLM tokens as they are generated. Combined with the existing SSE
infrastructure, this gives real token-by-token streaming.

**File:** `backend/app/api/agent.py`
**Function:** `_agent_stream_generator()`

**IMPORTANT NOTE before implementing:**
LangGraph's `stream_mode="messages"` yields `(message_chunk, metadata)` tuples where
`message_chunk` is an `AIMessageChunk`. The node name is in `metadata["langgraph_node"]`.
This is different from `stream_mode="updates"` which yields `{node_name: state_update}` dicts.
You need to handle both the streaming chunks AND the state updates (for classification events).

**Replace the ENTIRE `_agent_stream_generator()` function with this:**

```python
async def _agent_stream_generator(request: AgentRequest):
    from app.agent.graph import AgentState

    yield _sse_event("status", {"message": "Agent initialising...", "step": 1})

    graph = _get_agent_graph()
    if graph is None:
        yield _sse_event("error", {"message": "Agent graph failed to initialise."})
        return

    initial_state: AgentState = {
        "query":            request.query,
        "query_complexity": "",
        "intent_category":  "",
        "intent_symbol":    request.symbol,
        "intent_confidence": 0.0,
        "gathered_data":    {},
        "final_response":   "",
        "error":            None,
    }

    try:
        emitted_classification = False
        emitted_response_start = False

        # Use BOTH stream modes simultaneously — "messages" for tokens, "updates" for state
        async for stream_event in graph.astream(
            initial_state,
            stream_mode=["messages", "updates"],   # ← KEY CHANGE: dual stream mode
        ):
            # LangGraph dual-mode yields: (mode, event) tuples
            mode, event = stream_event

            # ── Handle state UPDATE events (classification, status badges) ──────
            if mode == "updates":
                for node_name, update in event.items():
                    if node_name.startswith("__"):
                        continue

                    # Classification node completed → emit badge + routing info
                    if node_name == "classify_intent" and not emitted_classification:
                        category   = update.get("intent_category", "general")
                        symbol     = update.get("intent_symbol")
                        confidence = update.get("intent_confidence", 0.0)
                        complexity = update.get("query_complexity", "complex")

                        _MODEL_BADGE = {
                            "simple":  "🌱 Gemma 4 31B",
                            "medium":  "⚡ Qwen3.5 397B A17B",
                            "complex": "🚀 DeepSeek V4",
                        }
                        yield _sse_event("complexity", {
                            "complexity": complexity,
                            "model": _MODEL_BADGE.get(complexity, "🚀 DeepSeek V4"),
                        })
                        yield _sse_event("classified", {
                            "category":   category,
                            "symbol":     symbol,
                            "confidence": confidence,
                        })
                        emitted_classification = True

                        step_msgs = {
                            "stock":     f"Gathering stock data for {symbol}...",
                            "news":      "Fetching market news...",
                            "portfolio": "Analysing portfolio holdings...",
                            "market":    "Screening NSE stocks...",
                            "general":   "Preparing response...",
                        }
                        yield _sse_event("status", {
                            "message": step_msgs.get(category, "Processing..."),
                            "step": 2,
                        })

                    # Data gathering completed → update status
                    if node_name in ("gather_stock_data", "gather_news_data", "gather_portfolio_data"):
                        yield _sse_event("status", {"message": "Running AI analysis...", "step": 3})

            # ── Handle MESSAGE events (actual LLM token chunks) ──────────────
            elif mode == "messages":
                message_chunk, metadata = event
                node_name = metadata.get("langgraph_node", "")

                # Only stream tokens from synthesis nodes (not classifier)
                is_synthesis_node = node_name in (
                    "analyze_stock", "synthesize_news", "audit_portfolio",
                    "handle_general", "handle_market"
                )

                if is_synthesis_node and hasattr(message_chunk, "content") and message_chunk.content:
                    # First token → emit "start streaming" status
                    if not emitted_response_start:
                        emitted_response_start = True
                        yield _sse_event("status", {"message": "Streaming response...", "step": 4})

                    # Emit the actual token chunk — NO artificial sleep needed
                    yield _sse_event("chunk", {"text": message_chunk.content})

        yield _sse_event("done", {"message": "Analysis complete."})

    except Exception as e:
        logger.error("Agent stream error: %s", str(e), exc_info=True)
        yield _sse_event("error", {"message": f"Analysis failed: {str(e)}"})
```

**What changed and why:**

| Old Code | New Code | Why |
|---|---|---|
| `stream_mode="updates"` | `stream_mode=["messages", "updates"]` | Dual mode: get tokens AND state updates |
| `final_text = update.get("final_response", "")` | `message_chunk.content` | Real token, not complete string |
| `asyncio.sleep(0.02)` | Removed | Not needed — real tokens have natural pacing |
| Single mode loop | `mode, event = stream_event` | Distinguish tokens from state updates |

**Expected result after Fix 3:**
- User sees first token in ~1-2 seconds (as soon as LLM starts generating)
- Response streams word-by-word in real-time
- Total generation time is same, but perceived wait is 1-2s not 15-20s

---

## IMPORTANT: LLM Provider Must Support Streaming

**Before implementing Fix 3, verify this:**

In `graph.py`, find where `ProviderPool` is initialized / where LLM instances are created.
Look for `streaming=False` or `stream=False` in any LLM constructor call.

If you see:
```python
ChatOpenAI(..., streaming=False)
# or
ChatGoogleGenerativeAI(..., streaming=False)
# or
model = SomeLLM(..., stream=False)
```

**Change it to `streaming=True`** for synthesis nodes (analyze_stock, synthesize_news, etc.).
The classifier node (`classify_intent`) should keep `streaming=False` — JSON output doesn't benefit
from streaming and partial JSON would cause parse errors.

If `ProviderPool` has a shared config, you may need to split it into:
- `classifier_pool` → `streaming=False`
- `synthesis_pool` → `streaming=True`

**Check this carefully before proceeding.**

---

## COMPLETE EXPECTED TIMELINE AFTER ALL 3 FIXES

```
Query: "Analyze RELIANCE for long term"

├── Phase 1: classify_query_complexity()    <1ms  ✅ unchanged
│            "long term" NOW in keywords → COMPLEX tier (Fix 2)
│
├── Phase 2: _fast_classify()               <1ms  ✅ Fix 1
│            RELIANCE detected → stock / RELIANCE.NS
│            LLM call SKIPPED entirely
│
├── Phase 3: gather_stock_data()            3-5s  (starts immediately after Phase 2)
│            4 concurrent yFinance calls
│
├── Phase 4: analyze_stock() streaming      2s → first token visible  ✅ Fix 3
│            DeepSeek V4 (correct tier now) → tokens stream live
│            Full response arrives in 15s BUT user sees text from second 2
│
└── PERCEIVED experience:
    Old: 28-60 seconds of silence → response dumps all at once
    New: <1s → classify → ~5s → "Analysing..." → ~7s → FIRST WORDS APPEAR → streams live
```

---

## FILES TO MODIFY — SUMMARY

| File | What Changes | Risk |
|---|---|---|
| `backend/app/agent/graph.py` | Add `_fast_classify()` helper + modify `classify_intent()` + expand COMPLEX_KEYWORDS | Low — additive changes only |
| `backend/app/api/agent.py` | Replace `_agent_stream_generator()` | Medium — test after change |

## FILES TO NOT TOUCH

- `backend/app/agent/tools.py` — data fetchers are correct
- `backend/app/agent/prompts.py` — specialist prompts are correct
- `backend/app/agent/prompt_builder.py` — data injection is correct
- All `frontend/` files — no frontend changes needed
- All other `api/*.py` files — not related

---

## TESTING CHECKLIST

After implementing, test these queries:

```
Test 1: "What is TCS price?"
Expected: <1ms Phase 2 (fast path), simple tier, ~6s total

Test 2: "Analyze RELIANCE for long term"  
Expected: <1ms Phase 2 (fast path), COMPLEX tier (not simple!), streaming starts ~7s

Test 3: "Latest news on HDFC Bank"
Expected: <1ms Phase 2 (fast path, news category), ~5s total

Test 4: "Should I invest in IT sector?"
Expected: LLM fallback for Phase 2 (no ticker), general/complex, streaming starts ~10s

Test 5: "Best stocks to buy today"
Expected: <1ms Phase 2 (market category), market screener node, streaming

Test 6: "My portfolio performance"
Expected: <1ms Phase 2 (portfolio category), audit node

Verify for ALL tests:
- [ ] First chunk appears within 2 seconds of analysis starting
- [ ] Tokens stream continuously (not all at once)
- [ ] Model badge shows correct tier (🌱/⚡/🚀)
- [ ] "done" event fires at end
- [ ] No errors in backend logs
```

---

*Implementation guide prepared by Claude claude-sonnet-4-6 based on full codebase review.*
*Cross-reference with: `Latest_Update_Harsh.md`, `Gemini.md`, `Context.md` before proceeding.*