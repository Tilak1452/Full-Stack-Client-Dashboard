# 3. Methodology (continued)

## 3.5 Artificial Intelligence Pipeline

### 3.5.1 Dual-Agent Architecture

The system implements two distinct AI pipelines, each addressing a different interaction modality. The first — referred to herein as the *AnalystAgent* — is invoked synchronously per stock symbol and produces a structured, schema-validated JSON object (`FinancialAnalysisResult`) suitable for display on the stock detail page. The second — the *LangGraph Conversational Agent* — handles free-text financial queries submitted through the chat interface and returns markdown-formatted responses delivered via Server-Sent Events (SSE). Both pipelines share the foundational principle that the LLM is a synthesizer: it never calls tools autonomously, never retrieves data independently, and never computes numeric values. All quantitative inputs are pre-assembled by deterministic service-layer functions prior to LLM invocation.

### 3.5.2 AnalystAgent — Structured Stock Analysis

The AnalystAgent is constructed as a three-node LangGraph `StateGraph`. The shared state is a `TypedDict` containing the stock data response, news response, the accumulated message history (using LangGraph's `add_messages` reducer for append-only semantics), the parsed result object, and a retry counter.

**Node 1 — `_node_generate_analysis`:** Before constructing the LLM prompt, two deterministic pre-computation steps execute unconditionally. First, `compute_technical_signals(stock_data)` scores the technical indicators and returns a normalised momentum score in [0.0, 1.0] alongside directional signals. Second, `_score_headlines_with_vader(news_data)` applies the VADER sentiment analyser to up to eight news headlines and returns an average compound score with a categorical label. The resulting values are embedded directly into the structured human-turn prompt using a fixed template. The prompt template explicitly instructs the model that the pre-computed values are authoritative and that the model must not recalculate or contradict them — a prompt engineering technique intended to suppress hallucination of numeric values. The LLM invocation includes an inner retry loop of up to three attempts with a 60-second inter-attempt delay, targeting specifically the HTTP 429 (rate limit) and ResourceExhausted error classes.

**Node 2 — `_node_validate_and_guard`:** The raw LLM output undergoes a four-stage validation pipeline. First, markdown code fences are stripped from the response. Second, `json.loads()` validates syntactic JSON correctness before Pydantic parsing is attempted, preventing Pydantic from receiving malformed input. Third, `PydanticOutputParser` validates the parsed JSON against the `FinancialAnalysisResult` schema, which requires a verdict (`BULLISH`, `BEARISH`, or `NEUTRAL`), a confidence integer in [0, 100], a reasoning summary string, structured technical and sentiment signal arrays, and a risk assessment string. Fourth, three content guardrails are applied in sequence: a toxicity checker that flags or redacts harmful financial language, a hallucination checker that cross-references LLM-stated numeric claims against the ground-truth stock data, and a length enforcer that trims outputs exceeding configured limits. If validation fails, a correction message is appended to the conversation history, `retry_count` is incremented, and the graph routes back to Node 1. If `retry_count` reaches the configured maximum, the graph routes to Node 3.

**Node 3 — `_node_fallback_analysis`:** If all validation retries are exhausted, a deterministic neutral fallback response is returned. This ensures the API always returns a valid, schema-conforming response regardless of LLM availability or output quality, which is a critical requirement for production reliability.

### 3.5.3 LangGraph Conversational Agent — Financial Q&A

The conversational agent implements a nine-node specialist-prompt state machine compiled using LangGraph's `StateGraph`. The complete agent state comprises the user query string, intent category, extracted ticker symbol, intent confidence score, query complexity tier, accumulated tool results, and the final response string.

The graph topology is as follows. The entry node is `classify_intent`, from which conditional edges route to one of five specialist branches: `gather_stock_data → analyze_stock`, `gather_news_data → synthesize_news`, `gather_portfolio_data → audit_portfolio`, `handle_market`, or `handle_general`. All terminal nodes connect to `END`. This topology ensures that every query follows exactly two processing stages — data gathering and synthesis — regardless of query type, providing predictable latency characteristics.

**Phase 1 — Rule-Based Complexity Classification:** Prior to any LLM invocation, a deterministic keyword-matching function classifies the query into one of three complexity tiers in under one millisecond. Queries matching price-lookup keywords (e.g., "price", "market cap", "p/e ratio") are classified as SIMPLE. Queries matching strategic or comparative keywords (e.g., "compare", "portfolio", "macro", "inflation", "rebalance") are classified as COMPLEX. All remaining queries default to MEDIUM. This classification directly determines which LLM model tier will service the query, enabling cost optimisation without sacrificing response quality for demanding tasks.

**Phase 2 — LLM Intent Extraction:** Regardless of complexity tier, intent extraction always uses the fastest available free-tier model (Google Gemma 4 31B via OpenRouter). The model receives a structured prompt requesting a JSON object containing three fields: `category` (one of `stock`, `news`, `portfolio`, `market`, or `general`), `symbol` (a normalised NSE ticker string or null), and `confidence` (a float in [0, 1]). JSON response parsing includes a strip of markdown code fences to handle models that wrap structured outputs in code blocks. On parse failure, the agent defaults to the `general` branch to ensure graceful degradation.

**Phase 3 — Deterministic Routing:** The `route_intent` function maps the extracted category to a branch node name. A special case handles the situation where the intent is classified as `stock` but no symbol is extracted — in this case, the query is rerouted to the `handle_market` branch, which performs portfolio-level market screening rather than single-stock analysis.

### 3.5.4 Complexity-Tiered Model Routing and Fallback Chains

Model selection is implemented through an explicit three-tier, three-attempt fallback chain:

| Complexity Tier | Attempt 0 | Attempt 1 | Attempt 2 |
|---|---|---|---|
| SIMPLE | Gemma 4 31B (free) | Qwen3-235B (free) | Nemotron 70B |
| MEDIUM | Qwen3-235B (free) | Nemotron 70B | Gemma 4 31B (free) |
| COMPLEX | Nemotron 70B | Qwen3-235B (free) | Gemma 4 31B (free) |

On receiving an HTTP 402 or 429 response from OpenRouter (indicating quota exhaustion), the node increments the fallback index and retries with the next model in the chain. Each attempt uses a genuinely distinct model backend, ensuring that fallback retries represent a meaningful change in inference provider rather than a repeated call to the same overloaded endpoint. Temperature is randomly sampled from a node-specific range on each call (e.g., [0.30, 0.42] for stock analysis), introducing controlled stochastic variability in generated text without compromising factual grounding. Per-node token budgets are enforced at LLM instantiation: 200 tokens for intent classification, 2500 for stock analysis, 1200 for news synthesis, 1800 for portfolio auditing, 900 for general Q&A, and 4000 for market screening.

### 3.5.5 Parallel Data Gathering

The `gather_stock_data` node executes three agent tools simultaneously using `asyncio.gather` with `return_exceptions=True`:

> stock_data, technicals, news = await asyncio.gather(
>     get_stock_data(symbol), get_technical_indicators(symbol), get_financial_news(query)
> )

The `return_exceptions=True` parameter ensures that a failure in any individual tool does not abort the concurrent execution of the others. Failed tool results are replaced with empty dictionaries, allowing downstream synthesis nodes to produce partial responses rather than errors.

The `handle_market` node extends this pattern to 12 large-capitalisation NSE stocks from a predefined screening universe, fetching price and technical indicators for each stock concurrently — a total of 24 simultaneous yFinance calls — via `asyncio.gather(*[_fetch_one(sym) for sym in SCREEN_UNIVERSE])`. Empirical testing demonstrated that this parallel fetch reduces market-wide screening latency from approximately 60 seconds (sequential) to approximately 5 seconds (concurrent), making real-time AI-assisted market screening feasible without paid batch data APIs.

### 3.5.6 Specialist Prompt Engineering

Each synthesis node is assigned a distinct system prompt aligned to its functional role. The `analyze_stock` node operates under an "expert trading coach" persona; `synthesize_news` operates as a "financial journalist"; `audit_portfolio` operates as a "portfolio risk analyst"; `handle_market` operates as a "quantitative screener". This specialisation prevents prompt generalisation artefacts — the phenomenon where a single general-purpose prompt produces mediocre outputs across all query types — and enables fine-tuning of response format, depth, and vocabulary independently per node.

Dynamic user prompts are assembled by `prompt_builder.py` for each call, incorporating live indicator values, news headlines with sentiment labels, and the user's original natural-language query. This ensures that the LLM always receives the most current available data rather than stale template fill-ins.

### 3.5.7 Retrieval-Augmented Generation Pipeline

The RAG subsystem enables users to upload proprietary documents (annual reports, research papers, regulatory filings) and query them semantically. Uploaded files (PDF, TXT, Markdown, CSV) are parsed by `DocumentProcessor.load_and_split()`, which tokenises the text and splits it into fixed-size overlapping chunks. Each chunk receives `source_file` metadata and is embedded using OpenAI's `text-embedding-3-small` model, then stored in ChromaDB using L2 (Euclidean) distance as the similarity metric.

Semantic search queries are served via `similarity_search_with_score(query, k=4, score_threshold=1.5)`, returning the four most similar document chunks whose L2 distance to the query embedding falls below the threshold. Retrieved context is optionally injected into the AnalystAgent's prompt as a supplementary section, augmenting the LLM's financial analysis with user-supplied domain knowledge that falls outside Yahoo Finance's data coverage.

The system implements a vector store factory pattern: if the `Pinecone_Vector_Database` environment variable is set, the factory returns a Pinecone cloud implementation; otherwise, it returns a local ChromaDB implementation. This allows the system to operate fully offline in development and switch to a team-shared cloud vector store in production without code changes.

---

## 3.6 Portfolio Management

### 3.6.1 Cost Basis Accounting

Portfolio management is implemented entirely within SQLAlchemy async transactions using the `AsyncSession` interface. When a user executes a buy order, the system queries for an existing holding with the same symbol. If one exists, the average acquisition price is updated using the weighted average formula:

> new_avg = (existing_qty × existing_avg + new_qty × new_price) / (existing_qty + new_qty)

This weighted average cost basis method is the industry-standard approach for tracking average acquisition price across multiple purchase events.

When a user executes a sell order, the system applies First-In, First-Out (FIFO) profit calculation, consistent with SEBI regulations and standard Indian capital gains tax treatment. The algorithm queries all BUY transactions for the symbol ordered by timestamp ascending, then iterates through them, consuming shares from the oldest purchase first:

> realized_P&L = Σ [min(qty_remaining, buy_txn.qty) × (sell_price − buy_txn.price)]

After computing the realized profit, the sold quantity is deducted from the holding record. If the holding reaches zero quantity, the record is deleted and a final `realized_pl_pct` is recorded. In all cases, an immutable `Transaction` record is appended to the audit trail with the computed `realized_pl` field.

### 3.6.2 Real-Time Portfolio Valuation

A background price refresh job runs every five minutes using a thread-based `BackgroundScheduler`. The job queries all distinct ticker symbols across all holdings, fetches the current price for each symbol, and recomputes the following fields for each holding:

> current_value = quantity × current_price
> unrealized_pl = current_value − cost_basis
> unrealized_pl_pct = (unrealized_pl / cost_basis) × 100

The thread-based scheduler is used intentionally for this job, as the price fetch and database write operations are synchronous. The frontend's portfolio summary query is configured with a `refetchInterval` of five minutes, deliberately synchronised with the background job's execution cadence to ensure users observe updated valuations promptly after each refresh cycle.

### 3.6.3 Modern Portfolio Theory Optimisation

The system implements a Maximum Sharpe Ratio optimisation using PyPortfolioOpt's `EfficientFrontier` class. The optimisation procedure operates on five years of daily adjusted closing prices obtained via `yf.download()`. Expected returns are computed as the annualised arithmetic mean of log returns scaled to 252 trading days. The risk model is the sample covariance matrix of asset returns. The quadratic programming solver finds the portfolio weights on the efficient frontier that maximise the Sharpe Ratio (expected excess return per unit of volatility). Weights below a numerical tolerance are truncated to zero via `clean_weights()`, eliminating negligibly small allocations. The output includes optimal weight per ticker, expected annual return, expected annual volatility, and the Sharpe Ratio.

---

## 3.7 Market Alert System

The alert system permits users to define conditional rules on six market events: PRICE_ABOVE, PRICE_BELOW, RSI_ABOVE, RSI_BELOW, SMA_CROSS_ABOVE, and SMA_CROSS_BELOW. Alert rules are stored with ACTIVE status in the `alerts` table.

The evaluation loop is an async coroutine (`fetch_and_evaluate_alerts`) scheduled by `AsyncIOScheduler` every 300 seconds. At each execution: (1) all ACTIVE alerts are loaded from the database; (2) alerts are grouped by symbol to minimise redundant API calls — all alerts on the same ticker share one yFinance history fetch; (3) three months of daily OHLCV data is fetched for each symbol and RSI-14 and SMA-20 are computed deterministically; (4) each alert condition is evaluated against the computed values using a pure boolean function; and (5) triggered alerts receive a TRIGGERED status update, a `triggered_at` timestamp, and a human-readable notification message, all committed atomically within an async database transaction.

Triggered notifications are appended to an in-memory queue (module-level list, capped at 50 entries) and polled by the frontend via a dedicated REST endpoint.

---

## 3.8 Frontend Architecture and Data Delivery

### 3.8.1 Application Structure

The frontend adopts Next.js 14's App Router paradigm, in which the file system under `src/app/` defines the URL route hierarchy. Every page is a React Server Component by default; components requiring browser APIs (WebSocket, localStorage, `window`) are designated client components via the `"use client"` directive. The root layout wraps all pages with a global authentication context provider (`AuthProvider`) and a TanStack Query `QueryClientProvider`. Route protection is enforced by Next.js middleware that reads the session JWT from the request cookie before any client-side code executes, redirecting unauthenticated users to the login page at the server level.

### 3.8.2 Server State Management

All backend-derived data is managed through TanStack Query, which provides declarative data fetching with automatic cache management, background refetching, and loading/error state handling. Each dataset is identified by a typed `queryKey` array. Cache staleness intervals are aligned with backend TTLs: market indices and movers use a 60-second `staleTime` with a five-minute `refetchInterval`; individual stock data uses 30-second staleness; portfolio summaries use a five-minute interval to match the background price refresh job. TanStack Query's `queryClient.invalidateQueries()` is called after mutations (buy/sell operations, alert creation) to trigger immediate cache invalidation and UI refresh without requiring a manual page reload.

### 3.8.3 API Client Layer

A single `apiFetch<T>()` base function wraps the browser `fetch` API, automatically injecting the JWT `Authorization: Bearer` header from `sessionStorage` on every request. On receiving HTTP 401, the function clears session storage and redirects to the login page, ensuring the user is never left in a partially authenticated state. Domain-specific typed clients (`stockApi`, `portfolioApi`, `marketApi`, `alertsApi`, `newsApi`) compose `apiFetch()` to expose typed, promise-based methods for each backend resource.

### 3.8.4 Server-Sent Event Streaming

The AI chat interface consumes the agent endpoint via a custom `streamAgent()` function that reads a `ReadableStream` from the `fetch` response body, bypassing the browser's native `EventSource` API — which does not support POST requests. The function accumulates the response body in a string buffer, splits on double-newline SSE event boundaries, extracts `event:` and `data:` fields using regular expressions with null guards, and dispatches each event to an `onEvent` callback. The function returns an `AbortController`, allowing the caller to cancel an in-flight stream when a new query is submitted or the component unmounts. The UI renders a sequence of SSE event types: `complexity` (updates the model tier badge), `classified` (displays category and symbol), `status` (shows progress messages), `chunk` (appends streaming text), `result` (sets the final response), and `done`/`error` (terminates the loading state).

---

## 3.9 System Security

The security architecture addresses seven primary concerns. Password storage uses bcrypt with per-password salting. Authentication uses stateless JWT with a seven-day expiry and support for both HS256 and ES256 signing algorithms. Authorisation is enforced declaratively through FastAPI's dependency injection system, ensuring no route handler executes without a verified user identity. Multi-tenancy is guaranteed by always extracting the `user_id` from the verified JWT payload, never from the request body. Rate limiting at 20 requests per minute per IP address mitigates denial-of-service and credential stuffing attacks. CORS configuration restricts cross-origin access to whitelisted frontend origins. All request body parsing is performed by Pydantic v2, which raises structured validation errors on malformed input. Database queries are executed exclusively through SQLAlchemy's parameterised ORM interface, eliminating SQL injection vectors. All secrets are loaded from environment variables at runtime through pydantic-settings and are never committed to version control.

---

## 3.10 Concurrency Model

The backend operates on a single asyncio event loop managed by Uvicorn. All database queries, news fetches, and agent tool calls are async-native, ensuring that I/O-bound operations yield control to the event loop rather than blocking it. Synchronous library calls (yFinance, feedparser) are dispatched to thread pools via `loop.run_in_executor()` or FastAPI's `run_in_threadpool()`, converting synchronous blocking operations into awaitable coroutines. The alert scheduler (`AsyncIOScheduler`) runs on the shared event loop; the price update scheduler (`BackgroundScheduler`) runs in a dedicated background thread to avoid cross-contamination between sync and async execution contexts. On the frontend, TanStack Query deduplicates concurrent requests for the same `queryKey`, preventing redundant API calls when multiple components mount simultaneously. Watchlist batch price fetches use `Promise.allSettled()`, ensuring that a single failed symbol fetch does not block the resolution of successfully fetched symbols.

---

## 3.11 Summary of Novel Methodological Contributions

The implementation demonstrates the following research contributions of methodological significance:

1. **Deterministic-First Synthesis**: Pre-computing all quantitative signals (RSI, MACD, VADER scores, momentum score) before LLM invocation grounds the generated text in verifiable numerical facts, reducing the opportunity for hallucinated financial claims.

2. **Sub-Millisecond Complexity Routing**: A keyword-matching query complexity classifier executing in under one millisecond enables dynamic LLM tier selection, reducing estimated inference costs by 60–80% relative to always routing queries to the highest-tier model.

3. **Resilient Free-Tier Data Pipeline**: A three-layer resilience architecture (circuit breaker, exponential-backoff retry, fast-info fallback) applied to a free, unauthenticated data source achieves near-production reliability without paid API dependency.

4. **FIFO P&L on Asynchronous ORM**: Correct First-In-First-Out realized profit computation is implemented entirely within SQLAlchemy async transactions, including timestamp-ordered traversal of purchase lots, without requiring a dedicated accounting library.

5. **Dual-Scheduler Mixed-Concurrency Architecture**: The co-deployment of an `AsyncIOScheduler` for async database coroutines and a `BackgroundScheduler` for synchronous price refresh correctly handles the mixed sync/async execution model characteristic of real-world FastAPI applications.

6. **Parallel Universe Screening**: Concurrent fetching of 24 yFinance requests (12 stocks × 2 data types) via `asyncio.gather` reduces AI-assisted market-wide screening latency from approximately 60 seconds (sequential) to approximately 5 seconds, making real-time broad-market analysis viable on a zero-cost data infrastructure.
