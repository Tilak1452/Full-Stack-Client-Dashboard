"""
Agent API Router (api/agent.py)

Exposes the FinSight LangGraph agent via:
  - POST /api/v1/agent/stream  → SSE streaming (real-time token-by-token)
  - POST /api/v1/agent/        → Non-streaming (returns complete JSON)

Protected files NOT touched: analyze.py, analyst.py — those remain as legacy paths.
"""

import json
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent", tags=["Agent"])


# ── Request Schema ────────────────────────────────────────────────────────────

class AgentRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000, description="User's financial question")
    portfolio_id: Optional[int] = Field(None, description="Portfolio ID for portfolio audit queries")
    symbol: Optional[str] = Field(None, description="Override symbol detection")


# ── Lazy import to avoid circular imports and startup crashes ─────────────────

def _get_agent_graph():
    """Lazy-import the compiled graph to avoid crashing main.py if LangGraph has issues."""
    try:
        from app.agent.graph import agent_graph
        return agent_graph
    except Exception as e:
        logger.error("Failed to import agent graph: %s", e)
        return None


# ── SSE Streaming Endpoint ────────────────────────────────────────────────────

async def _agent_stream_generator(request: AgentRequest):
    """
    Async generator that runs the agent graph and yields SSE events.

    Event types:
      - status:     Progress messages ("Agent initialising...")
      - classified: Intent classification result
      - chunk:      LLM token text fragment
      - model:      Which model tier is responding
      - done:       Stream complete
      - error:      Something failed
    """
    from app.agent.graph import AgentState

    # 1. Emit initial status
    yield _sse_event("status", {"message": "Agent initialising...", "step": 1})

    graph = _get_agent_graph()
    if graph is None:
        yield _sse_event("error", {"message": "Agent graph failed to initialise. Check server logs."})
        return

    # 2. Build initial state
    initial_state: AgentState = {
        "query": request.query,
        "intent_category": "",
        "intent_symbol": request.symbol,
        "intent_confidence": 0.0,
        "gathered_data": {},
        "final_response": "",
        "error": None,
    }

    try:
        # 3. Run graph with streaming updates
        # LangGraph's astream yields state updates after each node completes
        emitted_classification = False
        emitted_model = False

        async for event in graph.astream(initial_state, stream_mode="updates"):
            # event is a dict: {node_name: state_update_dict}
            for node_name, update in event.items():
                # After classification node
                if node_name == "classify_intent" and not emitted_classification:
                    category = update.get("intent_category", "general")
                    symbol = update.get("intent_symbol")
                    confidence = update.get("intent_confidence", 0.0)

                    yield _sse_event("classified", {
                        "category": category,
                        "symbol": symbol,
                        "confidence": confidence,
                    })
                    emitted_classification = True

                    # Emit a status update describing the next step
                    step_msgs = {
                        "stock": f"Gathering stock data for {symbol}...",
                        "news": "Fetching market news...",
                        "portfolio": "Analysing portfolio holdings...",
                        "market": "Screening NSE stocks...",
                        "general": "Preparing response...",
                    }
                    yield _sse_event("status", {
                        "message": step_msgs.get(category, "Processing..."),
                        "step": 2,
                    })

                # After data gathering nodes — emit another status
                if node_name in ("gather_stock_data", "gather_news_data", "gather_portfolio_data"):
                    yield _sse_event("status", {"message": "Running AI analysis...", "step": 3})

                # After analysis/synthesis nodes — these contain the final response
                if node_name in ("analyze_stock", "synthesize_news", "audit_portfolio",
                                "handle_general", "handle_market"):
                    final_text = update.get("final_response", "")

                    if not emitted_model:
                        # Determine which model tier was used
                        from app.agent.graph import _NODE_CONFIG
                        model_tier = _NODE_CONFIG.get(node_name, {}).get("model", "nano")
                        yield _sse_event("model", {"model": model_tier, "node": node_name})
                        emitted_model = True

                    # Emit the full response as chunks (split by sentences for visual streaming effect)
                    if final_text:
                        chunks = _split_into_chunks(final_text)
                        for chunk in chunks:
                            yield _sse_event("chunk", {"text": chunk})
                            await asyncio.sleep(0.02)  # Small delay for visual streaming effect

        yield _sse_event("done", {"message": "Analysis complete."})

    except Exception as e:
        logger.error("Agent stream error: %s", str(e), exc_info=True)
        yield _sse_event("error", {"message": f"Analysis failed: {str(e)}", "partial_response": ""})


def _split_into_chunks(text: str, chunk_size: int = 8) -> list:
    """
    Split text into small word-based chunks for a streaming visual effect.
    LangGraph's astream with 'updates' mode gives us the full response at once,
    so we simulate token-by-token streaming by splitting into word groups.
    """
    words = text.split(' ')
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk_words = words[i:i + chunk_size]
        chunk = ' '.join(chunk_words)
        # Add trailing space unless it's the last chunk
        if i + chunk_size < len(words):
            chunk += ' '
        chunks.append(chunk)
    return chunks


def _sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event string."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


@router.post("/stream")
async def stream_agent(request: AgentRequest):
    """SSE streaming endpoint — tokens arrive in real-time."""
    return StreamingResponse(
        _agent_stream_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ── Non-Streaming Endpoint (for testing / Swagger) ───────────────────────────

@router.post("/")
async def invoke_agent(request: AgentRequest):
    """Non-streaming endpoint — returns the complete response as JSON."""
    from app.agent.graph import AgentState

    graph = _get_agent_graph()
    if graph is None:
        raise HTTPException(status_code=503, detail="Agent graph failed to initialise")

    initial_state: AgentState = {
        "query": request.query,
        "intent_category": "",
        "intent_symbol": request.symbol,
        "intent_confidence": 0.0,
        "gathered_data": {},
        "final_response": "",
        "error": None,
    }

    try:
        result = await graph.ainvoke(initial_state)
        return {
            "response": result.get("final_response", ""),
            "category": result.get("intent_category", ""),
            "symbol": result.get("intent_symbol"),
            "confidence": result.get("intent_confidence", 0.0),
            "error": result.get("error"),
        }
    except Exception as e:
        logger.error("Agent invoke error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(e)}")
