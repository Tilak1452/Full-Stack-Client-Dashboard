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
from langchain_core.messages import AIMessageChunk

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.core.config import settings

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

    Fix 3: uses dual stream_mode=["messages","updates"]:
      - "messages" mode → yields real LLM token chunks as they are generated (<1s latency)
      - "updates" mode  → yields full state updates per node (for classification badges)

    Event types emitted:
      status     → progress messages (step 1/2/3/4)
      complexity → which model tier + badge
      classified → intent category, symbol, confidence
      chunk      → real LLM token text
      done       → stream complete
      error      → something failed
    """
    from app.agent.graph import AgentState

    yield _sse_event("status", {"message": "Agent initialising...", "step": 1})

    graph = _get_agent_graph()
    if graph is None:
        yield _sse_event("error", {"message": "Agent graph failed to initialise. Check server logs."})
        return

    initial_state: AgentState = {
        "query":             request.query,
        "query_complexity":  "",
        "intent_category":   "",
        "intent_symbol":     request.symbol,
        "intent_confidence": 0.0,
        "gathered_data":     {},
        "final_response":    "",
        "error":             None,
        # Phase 4 fields — safe defaults
        "artifact_type":     None,
        "artifact_symbol":   request.symbol,
        "artifact_data":     None,
        "technicals_draft":  None,
        "news_draft":        None,
        "fundamentals_draft": None,
    }

    try:
        emitted_classification  = False
        emitted_response_start  = False
        p4_task = None

        # Dual stream mode: "messages" for real tokens, "updates" for state snapshots
        async for stream_event in graph.astream(
            initial_state,
            stream_mode=["messages", "updates"],
        ):
            # LangGraph dual-mode yields (mode_string, event_payload) tuples
            mode, event = stream_event

            # ── State UPDATE events — classification badge + status progress ──────
            if mode == "updates":
                for node_name, update in event.items():
                    if node_name.startswith("__"):
                        continue

                    # Classification node completed → emit model badge + routing info
                    if node_name == "classify_intent" and not emitted_classification:
                        category   = update.get("intent_category", "general")
                        symbol     = update.get("intent_symbol")
                        confidence = update.get("intent_confidence", 0.0)
                        complexity = update.get("query_complexity", "complex")

                        _MODEL_BADGE = {
                            "simple":  "⚡ Gemini 2.5 Flash",
                            "medium":  "⚡ Qwen3.5 397B A17B",
                            "complex": "🚀 Qwen3.5 397B A17B",
                        }
                        yield _sse_event("complexity", {
                            "complexity": complexity,
                            "model": _MODEL_BADGE.get(complexity, "🚀 Qwen3.5 397B A17B"),
                        })
                        yield _sse_event("classified", {
                            "category":   category,
                            "symbol":     symbol,
                            "confidence": confidence,
                        })
                        emitted_classification = True

                        # Emit artifact_type event right after classification
                        if settings.enable_artifact_system:
                            art_type = update.get("artifact_type")
                            if art_type:
                                yield _sse_event("artifact_type", {
                                    "type": art_type,
                                    "layout": update.get("artifact_layout", "info_card"),
                                    "components": update.get("artifact_components", []),
                                    "emphasis": update.get("artifact_emphasis", "education_first"),
                                    "text_length": update.get("artifact_text_length", "null")
                                })
                                yield _sse_event("artifact_text", {
                                    "text": f"Preparing {art_type.replace('_', ' ')} for {symbol or 'market data'}..."
                                })

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

                    # Data-gathering nodes complete → update status bar
                    # For stock queries: run Phase 4 parallel nodes
                    if node_name in ("gather_stock_data", "gather_news_data", "gather_portfolio_data"):
                        yield _sse_event("status", {"message": "Running AI analysis...", "step": 3})

                        # Phase 4: fire parallel analysis for stock queries
                        if node_name == "gather_stock_data" and settings.enable_parallel_phase4:
                            from app.agent.graph import run_phase4_parallel
                            # Build a working state for Phase 4 using current update data
                            phase4_state = {
                                **initial_state,
                                **update,
                                "gathered_data": update.get("gathered_data", {}),
                                "intent_symbol": update.get("intent_symbol") or request.symbol,
                                "artifact_type": update.get("artifact_type"),
                                "query_complexity": update.get("query_complexity", "complex"),
                            }
                            # Launch Phase 4 in the background so it doesn't block the main analysis stream
                            p4_task = asyncio.create_task(run_phase4_parallel(phase4_state))

                    # Simulated streaming fallback: if the final response arrives in an update
                    if "final_response" in update and update["final_response"]:
                        if not emitted_response_start:
                            emitted_response_start = True
                            yield _sse_event("status", {"message": "Streaming response...", "step": 4})
                        
                        chunks = _split_into_chunks(update["final_response"], chunk_size=6)
                        for chunk in chunks:
                            yield _sse_event("chunk", {"text": chunk})
                            await asyncio.sleep(0.05)

            # ── MESSAGE events — real LLM token chunks ────────────────────────────
            elif mode == "messages":
                message_chunk, metadata = event
                node_name = metadata.get("langgraph_node", "")

                # Guard 1: skip the final AIMessage — LangGraph emits BOTH the
                # streaming AIMessageChunk objects AND one final AIMessage at the end.
                # Without this guard the complete response appears twice in the UI.
                if not isinstance(message_chunk, AIMessageChunk):
                    continue

                # Only stream tokens from synthesis nodes — skip classifier tokens
                is_synthesis_node = node_name in (
                    "analyze_stock", "synthesize_news", "audit_portfolio",
                    "handle_general", "handle_market",
                )

                if not is_synthesis_node:
                    continue

                # Guard 2: extract text safely.
                # Gemma thinking tokens arrive as list content blocks, e.g.
                # [{"type": "thinking", ...}, {"type": "text", "text": "..."}]
                # Naively sending that list as chunk.text → [object Object] in the UI.
                raw = message_chunk.content
                if isinstance(raw, str):
                    text = raw
                elif isinstance(raw, list):
                    text = "".join(
                        block.get("text", "")
                        for block in raw
                        if isinstance(block, dict) and block.get("type") == "text"
                    )
                else:
                    text = ""

                if not text:
                    continue

                # First real text token → emit step-4 status once
                if not emitted_response_start:
                    emitted_response_start = True
                    yield _sse_event("status", {"message": "Streaming response...", "step": 4})

                yield _sse_event("chunk", {"text": text})

        # Process Phase 4 background task results if launched
        if p4_task:
            try:
                p4_result = await p4_task
                artifact = p4_result.get("artifact_data") or {}

                if artifact and settings.enable_artifact_system:
                    if artifact.get("technicals"):
                        yield _sse_event("slot_technicals", artifact["technicals"])
                    if artifact.get("news"):
                        yield _sse_event("slot_news", artifact["news"])
                    if artifact.get("fundamentals"):
                        yield _sse_event("slot_fundamentals", artifact["fundamentals"])
                    if artifact.get("financials"):
                        yield _sse_event("slot_financials", artifact["financials"])
                    if artifact.get("compare"):
                        yield _sse_event("slot_compare", artifact["compare"])
                    if artifact.get("verdict"):
                        yield _sse_event("slot_verdict", artifact["verdict"])
            except Exception as _p4_err:
                logger.warning("Phase 4 background task failed: %s", _p4_err)

        # Emit final result event (for new frontend artifact panel text field)
        if settings.enable_artifact_system:
            yield _sse_event("result", {"content": ""})
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


from fastapi import Query

@router.get("/stream")
async def stream_agent(q: str = Query(..., description="User's financial question")):
    """SSE streaming endpoint — tokens arrive in real-time."""
    request = AgentRequest(query=q)
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
        "query_complexity": "",
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
