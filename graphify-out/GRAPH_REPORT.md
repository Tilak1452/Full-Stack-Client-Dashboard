# Graph Report - D:\Full-Stack-Client-Dashboard  (2026-04-21)

## Corpus Check
- 130 files · ~171,650 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 695 nodes · 1243 edges · 82 communities detected
- Extraction: 60% EXTRACTED · 40% INFERRED · 0% AMBIGUOUS · INFERRED: 503 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]

## God Nodes (most connected - your core abstractions)
1. `FinancialAnalysisResult` - 36 edges
2. `Holding` - 28 edges
3. `Base` - 24 edges
4. `Portfolio` - 22 edges
5. `NewsResponse` - 22 edges
6. `StockDataResponse` - 22 edges
7. `NewsService` - 22 edges
8. `StockService` - 22 edges
9. `CircuitBreaker` - 20 edges
10. `Transaction` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Base` --uses--> `Alert Model (models/alert.py) SQLAlchemy model for persisting user-defined mark`  [INFERRED]
  D:\Full-Stack-Client-Dashboard\backend\app\core\database.py → D:\Full-Stack-Client-Dashboard\backend\app\models\alert.py
- `DOPathRewriteMiddleware` --uses--> `Base`  [INFERRED]
  D:\Full-Stack-Client-Dashboard\backend\app\main.py → D:\Full-Stack-Client-Dashboard\backend\app\core\database.py
- `Application Entry Point (main.py)  This module serves as the central orchestra` --uses--> `Base`  [INFERRED]
  D:\Full-Stack-Client-Dashboard\backend\app\main.py → D:\Full-Stack-Client-Dashboard\backend\app\core\database.py
- `Pure ASGI middleware to rewrite paths before Starlette's router processes them.` --uses--> `Base`  [INFERRED]
  D:\Full-Stack-Client-Dashboard\backend\app\main.py → D:\Full-Stack-Client-Dashboard\backend\app\core\database.py
- `Start the background job that refreshes holding prices every 5 minutes.` --uses--> `Base`  [INFERRED]
  D:\Full-Stack-Client-Dashboard\backend\app\main.py → D:\Full-Stack-Client-Dashboard\backend\app\core\database.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (88): _agent_stream_generator(), AgentRequest, _get_agent_graph(), invoke_agent(), Agent API Router (api/agent.py)  Exposes the FinSight LangGraph agent via:   - P, Split text into small word-based chunks for a streaming visual effect.     LangG, Format a Server-Sent Event string., SSE streaming endpoint — tokens arrive in real-time. (+80 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (54): FinancialAnalysisResult, Analysis Schemas (schemas/analysis.py)  Strict Pydantic models for enforcing J, A technical indicator score mapped by the deterministic engine., A sentiment component evaluated cleanly by the NLP engine., The rigid Decision Intelligence Output.     The LLM aggregates signals into a f, SentimentSignal, TechnicalSignal, AgentState (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (36): Base, Base, Database Engine & Session Configuration (database.py)  Responsibilities: 1. C, Shared base class for all ORM models.      All future models must inherit from, DeclarativeBase, Holding, Holding Model (holding.py)  Responsibilities: 1. Represents a single stock po, SQLAlchemy model for the 'holdings' table.      A Holding represents how many (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (34): get_market_indices(), get_top_movers(), Returns current price and daily change for the 4 Indian market indices.     Uses, Returns top 2 gainers and top 2 losers from a predefined basket of large cap Ind, NewsArticle, NewsResponse, News Schemas (schemas/news.py)  Pydantic models for normalizing news data from, Standardized news article format.     All providers must map their responses to (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (22): ABC, DataProvider, DataProvider Interface (services/data_provider.py)  Defines the abstract contr, Abstract base class defining the minimum contract for any stock data source., Concrete DataProvider backed by yFinance (via StockService).      Delegates to, YFinanceProvider, DocumentProcessor, Document loader module for the Financial Research AI Agent. Handles ingestion o (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (37): BaseModel, optimize_portfolio(), Given a list of ticker symbols, fetches up to 5 years of historical data,     c, add_holding(), AddHoldingRequest, _build_portfolio_response(), create_portfolio(), CreatePortfolioRequest (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (30): start_scheduler(), stop_scheduler(), AnalyzeRequest, AnalyzeResponse, HealthResponse, Schemas – Analyze Module (app/schemas/analyze.py)  This module defines the dat, me(), Request and response shapes for auth endpoints.  After migrating to Supabase Aut (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (33): Alert, AlertCondition, AlertStatus, Alert Model (models/alert.py) SQLAlchemy model for persisting user-defined mark, create_alert(), _evaluate_condition(), fetch_and_evaluate_alerts(), _fetch_market_data() (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (23): CircuitBreaker, CircuitBreakerOpenError, CircuitState, Circuit Breaker (core/circuit_breaker.py)  Implements the classic 3-state Circ, Called when a call succeeds. Resets failures and closes the circuit., Called when a call fails. Increments counter, trips to OPEN if threshold hit., Internal state transition with logging. Assumes lock is held., Returns current circuit breaker status as a dict (for health checks). (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (31): _atr_series(), _bollinger_bands(), calculate_all(), calculate_ema(), calculate_rsi(), calculate_sma(), compute_all_indicators(), compute_pivot_points() (+23 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (23): BlackScholesRequest, get_macro_data(), get_options_data(), mpt_optimize(), MPTRequest, price_option(), Returns 10Y Treasury yield, CPI inflation, and unemployment rate from FRED., Returns the nearest expiration options chain for a given symbol.     Includes to (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (12): categorize_query(), Categorization Service. Determines the intent of a user query: 'stock', 'news',, Classifies the user query using an LLM (mocked for now).     Falls back to 'gen, # TODO: Replace with actual LLM call in Task 12/4, # TODO: Import actual LLM client in Task 4, Unit Tests – Categorization Service  This module contains unit tests for the `, Ensure it doesn't crash on empty or weird input., test_categorize_fallback() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (8): get_current_user(), get_db(), FastAPI Dependency Injection Layer (dependencies.py)  Responsibilities: 1. Provi, Dependency that provides a SQLAlchemy session with full transaction management., FastAPI dependency that extracts and validates a Supabase JWT from the     Autho, decode_access_token(), security.py — Supabase Auth edition  The backend no longer creates or hashes pas, Decodes and verifies a Supabase-issued JWT.      Uses the SUPABASE_JWT_SECRET (H

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): Integration Tests – Health & Analyze Endpoints  This module contains integrati, Validation: empty question should return 422., Validation: missing 'question' field should return 422., Smoke test: verify /analyze returns a valid structured JSON response., test_analyze_rejects_empty_question(), test_analyze_rejects_missing_field(), test_analyze_stub_returns_valid_schema(), test_health_check()

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (4): useAuth(), LoginPage(), SignUpPage(), TopBar()

### Community 16 - "Community 16"
Cohesion: 0.47
Nodes (3): handleAdd(), handleRemove(), saveSymbols()

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.4
Nodes (2): streamAgent(), fetchSynthesis()

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (3): client(), Pytest Configuration – Test Client Setup (tests/conftest.py)  This module defi, Returns a synchronous test client for the FastAPI app.

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (1): ApiError

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (1): FinSight AI — Upgraded Prompt System All prompts include: - Failure protocol (pr

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): auth_service.py — stub kept to prevent any legacy import errors.  Authentication

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): Adds a list of Langchain documents to the vector store.

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): Retrieves the top k most similar documents to the query.         Optionally fil

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (1): Normalize symbol to uppercase for consistency.

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (1): Fetch the latest price and metadata for a stock symbol.          Args:

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (1): Fetch historical OHLC + volume data.          Args:             symbol:   Sto

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **135 isolated node(s):** `FinSight AI — LangGraph Agent State Machine Flow: classify intent → route to app`, `Complete state passed between all nodes in the graph.`, `Returns a ChatOpenAI instance configured for OpenRouter.      - node_name select`, `Classifies the user query into one of: stock, news, portfolio, general.     Sets`, `Decides which branch to execute based on intent_category.     Returns the name o` (+130 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 25`** (2 nodes): `migrate.py`, `migrate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `prompts.py`, `FinSight AI — Upgraded Prompt System All prompts include: - Failure protocol (pr`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `auth_service.py — stub kept to prevent any legacy import errors.  Authentication`, `auth_service.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `page.tsx`, `LandingPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `providers.tsx`, `Providers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `page.tsx`, `Spark()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `page.tsx`, `PortfolioPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `AppShell()`, `AppShell.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `IndicatorCard.tsx`, `IndicatorCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `SupportResistanceBar.tsx`, `pct()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `TechnicalSummaryGauge.tsx`, `TechnicalSummaryGauge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `TechnicalTab.tsx`, `getIndicatorCards()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `TradingViewWidget.tsx`, `formatSymbol()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `LandingFooter.tsx`, `LandingFooter()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `NavBar.tsx`, `NavBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `ProtocolSection.tsx`, `ProtocolSection()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `TickerTape.tsx`, `TickerTape()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `TrustBar.tsx`, `TrustBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `useWebSocketPrice.ts`, `useWebSocketPrice()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `test_jwt.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `Adds a list of Langchain documents to the vector store.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `Retrieves the top k most similar documents to the query.         Optionally fil`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `Normalize symbol to uppercase for consistency.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `Fetch the latest price and metadata for a stock symbol.          Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `Fetch historical OHLC + volume data.          Args:             symbol:   Sto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `AddToPortfolioModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `AIInsights.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `SellHoldingModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `FeatureGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `HeroSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `alerts.api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `market.api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `mock.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `news.api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `portfolio.api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `stock.api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `supabase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FinancialAnalysisResult` connect `Community 1` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `build_fallback_verdict()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `Base` connect `Community 2` to `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `str` (e.g. with `global_exception_handler()` and `classify_intent()`) actually correct?**
  _`str` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 33 inferred relationships involving `FinancialAnalysisResult` (e.g. with `AgentState` and `AnalystAgent`) actually correct?**
  _`FinancialAnalysisResult` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `Holding` (e.g. with `Portfolio Pydantic Schemas (schemas/portfolio.py)  Responsibilities: - Define` and `Returns a list of all portfolios for the current user.`) actually correct?**
  _`Holding` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `Base` (e.g. with `DOPathRewriteMiddleware` and `Application Entry Point (main.py)  This module serves as the central orchestra`) actually correct?**
  _`Base` has 21 INFERRED edges - model-reasoned connections that need verification._