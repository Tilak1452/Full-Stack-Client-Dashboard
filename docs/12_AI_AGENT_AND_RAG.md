# FinSight AI — AI Agent System & RAG Pipeline

> This document covers the OpenRouter-powered multi-model AI agent (the active system) and the RAG (Retrieval-Augmented Generation) document intelligence pipeline.

---

## AI Agent System

The AI agent system lives in `backend/app/agent/`. It is the **currently active** AI backbone, replacing the old `ai/analyst.py` (which was deleted April 29, 2026). The agent is exposed via `api/agent.py` at `/api/v1/agent/*`.

The agent uses **OpenRouter** as its LLM gateway — a routing layer that allows sending requests to multiple model providers (Anthropic Claude, OpenAI GPT-4o, Mistral, etc.) through a single API with automatic fallback.

---

## `agent/graph.py` — Agent Orchestrator (~79KB)

**Location:** `backend/app/agent/graph.py`

This is the core of the AI agent. It implements a **LangGraph state machine** that processes user messages through a multi-step pipeline:

### Agent Architecture

```
User Message
      │
      ▼
┌─────────────────┐
│  Input Router   │ ← categorizer.py: stock / news / portfolio / macro / general
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Executor  │ ← Selects and calls relevant tools from agent/tools.py
└────────┬────────┘
         │ tool results (stock data, news, market structure, setup patterns)
         ▼
┌─────────────────┐
│ Prompt Builder  │ ← agent/prompt_builder.py: assembles context-rich prompt
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   LLM Call      │ ← OpenRouter API: routes to best available model
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response Parser │ ← Extracts text response + optional artifact JSON block
└────────┬────────┘
         │
         ▼
   Structured Response
   { response, artifact, steps, model_used }
```

### Multi-Model Routing

`graph.py` supports multiple model tiers:
- **Primary model:** Selected based on query complexity (e.g., `anthropic/claude-3.5-sonnet` for complex analysis, `openai/gpt-4o-mini` for simple lookups).
- **Fallback model:** If the primary model times out or returns an error, the orchestrator retries with a fallback model.
- **Timeout protection:** Each LLM call has a configurable timeout (default 45 seconds). If exceeded, the agent returns a degraded response rather than hanging indefinitely.

### Artifact Generation

The agent is instructed (via system prompts) to include a structured JSON `artifact` block in its response when the query warrants rich UI rendering. The artifact contains:
- `type`: one of `"hero_price"`, `"investment_thesis"`, `"technical_focus"`, `"financials_timeline"`, `"news_event"`, `"three_way_compare"`
- `data`: type-specific structured data matching the TypeScript types in `frontend/src/lib/artifact-types.ts`

The frontend `ArtifactRenderer` reads this block and renders the appropriate interactive card.

---

## `agent/prompt_builder.py` — Context-Aware Prompt Assembly (~28KB)

**Location:** `backend/app/agent/prompt_builder.py`

Responsible for assembling the complete prompt sent to the LLM. It:

1. Determines the query category (using `services/categorizer.py`).
2. Fetches relevant real-time context based on the category:
   - **Stock queries:** Calls `stock_service.get_full_stock_data()` and `market_structure.analyze()`.
   - **News queries:** Calls `news_service.get_news()` filtered to relevant tickers.
   - **Portfolio queries:** Loads portfolio data from the database (if user context is provided).
   - **Macro queries:** Calls `macro_service.get_macro_dashboard()`.
3. Formats this data into a structured context block appended to the user message.
4. Selects the appropriate system prompt template from `prompts.py`.
5. Returns the fully assembled prompt ready for the LLM call.

This separation means the LLM always receives pre-fetched, formatted, real-time data — it does not need to call tools to get market data. The tools handle additional structured lookups triggered during graph execution.

---

## `agent/prompts.py` — System Prompt Templates (~19KB)

**Location:** `backend/app/agent/prompts.py`

Contains all system prompt templates used by the agent:

| Template | Purpose |
|----------|---------|
| `STOCK_ANALYSIS_PROMPT` | For single-stock analysis queries — instructs the model to assess technicals, fundamentals, and provide a verdict |
| `PEER_COMPARISON_PROMPT` | For multi-stock comparison — instructs the model to produce a structured comparison artifact |
| `NEWS_ANALYSIS_PROMPT` | For news-driven queries — instructs summarization with sentiment and impact assessment |
| `MACRO_PROMPT` | For macroeconomic questions — instructs connection of macro data to market impact |
| `GENERAL_FINANCE_PROMPT` | For educational or general financial questions |
| `ARTIFACT_INSTRUCTIONS` | Appended to relevant prompts to instruct the model on the exact JSON format for artifact output |

All prompts explicitly instruct the model to:
- Focus on Indian stock markets (NSE/BSE)
- Format monetary values in Indian Rupees (₹)
- Only use data provided in the context block (prevents hallucination of prices)
- Return a specific artifact JSON structure when appropriate

---

## `agent/tools.py` — Agent Tool Functions (~10KB)

**Location:** `backend/app/agent/tools.py`

LangChain `@tool`-decorated functions that the agent can call during graph execution. Tools provide structured data lookups that supplement the prompt-built context.

### Available Tools

#### `stock_lookup(symbol: str) -> dict`
Fetches real-time price, indicators, and market structure for a stock symbol. Returns a structured dict that the agent can reference in its response. Calls `stock_service`, `indicators`, and `market_structure`.

#### `get_market_structure(symbol: str) -> dict`
Returns the detailed market structure analysis: trend direction, identified support levels, resistance levels, and 52-week range position. Delegates to `services/market_structure.py`.

#### `detect_trading_setups(symbol: str) -> dict`
Runs setup detection and returns any active patterns (RSI recovery, volume breakout, trend alignment). Delegates to `services/setup_engine.py`.

---

## AI Utility Modules (`backend/app/ai/`)

The `ai/` directory contains shared AI infrastructure modules that are used by multiple systems (the agent, the RAG pipeline, and the analyze endpoint).

> **Note:** These are utility modules, not the active agent. The active agent lives in `agent/`. The `ai/` directory provides safety rails and vector store implementations used by the full system.

| File | Purpose |
|------|---------|
| `scoring.py` | Computes a confidence score (0–100) for AI-generated verdicts based on signal strength and data quality |
| `moderation.py` | Screens incoming user queries for unsafe content, off-topic requests, or attempts to misuse the system |
| `hallucination_check.py` | Post-generation check: verifies that numeric values cited in the response (prices, RSI, etc.) match the data provided in the context block |
| `response_limits.py` | Enforces maximum output length and strips or truncates responses that exceed limits |
| `timeout_guard.py` | Wraps async LLM calls with `asyncio.wait_for(timeout=N)`. Raises a structured error if the LLM does not respond within the timeout window. |
| `document_loader.py` | Parses uploaded PDF and TXT files using LangChain's `PyPDFLoader` and `TextLoader`. Splits into chunks using `RecursiveCharacterTextSplitter`. Uses `structlog` for structured logging. |

---

## RAG Pipeline (Document Intelligence)

The RAG (Retrieval-Augmented Generation) system allows users to upload financial documents (annual reports, research papers, regulatory filings) and semantically query them.

### Upload Flow

```
User uploads PDF/TXT via POST /rag/upload
                │
                ▼
        api/rag.py (route handler)
                │
                ▼
        ai/document_loader.py
        - Detects file type
        - Parses content (PyPDFLoader or TextLoader)
        - Splits into chunks (1000 chars, 200 overlap)
        - Adds metadata (source filename, page number)
                │
                ▼
        Vector Store (ChromaDB or Pinecone)
        - Generates embeddings via the configured embedding model
        - Stores chunk text + embedding + metadata
                │
                ▼
        Returns: { "chunks_indexed": N, "source": "filename.pdf" }
```

### Query Flow

```
User sends GET /rag/query?q=...&score_threshold=1.5
                │
                ▼
        api/rag.py (route handler)
                │
                ▼
        Vector Store .similarity_search_with_score(query, k=5)
        - Embeds the query string
        - Finds the k nearest document chunks by cosine distance
        - Filters by score_threshold
                │
                ▼
        Returns ranked results:
        [
          { "content": "...", "source": "annual_report.pdf", "page": 12, "score": 0.87 },
          ...
        ]
```

### Vector Store Selection

| Condition | Vector Store Used |
|-----------|-----------------|
| `Pinecone_Vector_Database` env var is set | Pinecone cloud vector store (`ai/vector_store_pinecone.py`) |
| No Pinecone key | Local ChromaDB (`ai/vector_store_chroma.py`) |

Both implementations extend the abstract base class in `ai/interfaces/vector_store.py`, ensuring they are interchangeable with no code changes in the route or service layer.

### `ai/interfaces/vector_store.py` — Abstract Base

```python
class AbstractVectorStore(ABC):
    @abstractmethod
    def add_documents(self, documents: List[Document]) -> None: ...

    @abstractmethod
    def similarity_search_with_score(self, query: str, k: int = 5) -> List[Tuple[Document, float]]: ...
```

### ChromaDB Details (`vector_store_chroma.py`)
- Stores embeddings on-disk at `backend/vector_db/`.
- Uses the default embedding model configured via LangChain (typically OpenAI embeddings or a local model).
- The `vector_db/` directory is GITIGNORED — each developer's local vector store is independent.

### Pinecone Details (`vector_store_pinecone.py`)
- Connects to the Pinecone index specified in the `Pinecone_Vector_Database` env var.
- Embeddings are cloud-stored — shared across all instances that use the same Pinecone index.
- Suitable for production deployments where persistent, searchable document storage is needed.

---

## The `POST /api/v1/analyze` Endpoint

The `/api/v1/analyze` endpoint (in `api/analyze.py`) provides a simplified analysis interface separate from the full agent chat. It:
1. Validates the question via `AnalyzeRequest` schema.
2. Applies input moderation (`ai/moderation.py`).
3. Calls the agent pipeline for a structured verdict response.
4. Returns a `FinancialAnalysisResult` with verdict, confidence, technical signals, sentiment signals, and risk assessment.

This is distinct from `/api/v1/agent/chat` — the analyze endpoint always returns a fixed structured format, while the agent chat endpoint supports free-form conversation and rich artifacts.
