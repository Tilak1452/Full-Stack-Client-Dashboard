"""
FinSight AI — LangGraph Agent State Machine
Flow: classify intent → route to appropriate branch → gather data via tools → synthesize response
"""

import json
import os
from typing import TypedDict, Annotated, List, Any, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.agent.prompts import (
    CLASSIFIER_SYSTEM_PROMPT,
    CLASSIFIER_USER_TEMPLATE,
    ANALYST_SYSTEM_PROMPT,
    ANALYST_USER_TEMPLATE,
    NEWS_SYNTHESIS_SYSTEM_PROMPT,
    NEWS_SYNTHESIS_USER_TEMPLATE,
    PORTFOLIO_AUDITOR_SYSTEM_PROMPT,
    PORTFOLIO_AUDITOR_USER_TEMPLATE,
    GENERAL_EDUCATOR_SYSTEM_PROMPT,
    GENERAL_EDUCATOR_USER_TEMPLATE,
    MARKET_SCREENER_SYSTEM_PROMPT,
    MARKET_SCREENER_USER_TEMPLATE,
)
from app.agent.tools import ALL_TOOLS, get_stock_data, get_stock_history, get_market_news, detect_setup, get_market_structure
from app.agent.prompt_builder import build_analyst_prompt, build_news_prompt, build_general_prompt


# ---------------------------------------------------------------------------
# Agent State Definition
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """Complete state passed between all nodes in the graph."""
    query: str
    intent_category: str          # "stock" | "news" | "portfolio" | "general"
    intent_symbol: Optional[str]  # Ticker symbol if applicable
    intent_confidence: float
    gathered_data: dict           # Accumulated tool results
    final_response: str           # Final human-readable response
    error: Optional[str]          # Error message if something failed


# ---------------------------------------------------------------------------
# MODEL CONFIGURATION & OPENROUTER
# ---------------------------------------------------------------------------

import random
from langchain_openai import ChatOpenAI

# Map each graph node to its model tier and temperature range
_NODE_CONFIG = {
    "classify_intent": {
        "model":     "nano",
        "temp_min":  0.05,
        "temp_max":  0.15,
        "max_tokens": settings.nemotron_classify_max_tokens,
    },
    "analyze_stock": {
        "model":     "super",
        "temp_min":  0.30,
        "temp_max":  0.42,
        "max_tokens": settings.nemotron_analyze_max_tokens,
    },
    "synthesize_news": {
        "model":     "nano",
        "temp_min":  0.35,
        "temp_max":  0.48,
        "max_tokens": settings.nemotron_news_max_tokens,
    },
    "audit_portfolio": {
        "model":     "super",
        "temp_min":  0.28,
        "temp_max":  0.40,
        "max_tokens": settings.nemotron_portfolio_max_tokens,
    },
    "handle_general": {
        "model":     "nano",
        "temp_min":  0.38,
        "temp_max":  0.50,
        "max_tokens": settings.nemotron_general_max_tokens,
    },
    "handle_market": {
        "model":     "super",
        "temp_min":  0.50,
        "temp_max":  0.50,
        "max_tokens": settings.nemotron_market_max_tokens,  # 4000 — dedicated budget for screener
    }
}


def _get_llm(node_name: str) -> ChatOpenAI:
    """
    Returns a ChatOpenAI instance configured for OpenRouter.

    - node_name selects the model tier (Super or Nano) and token budget.
    - Temperature is randomized within a safe range per node type on every call.
    """
    cfg = _NODE_CONFIG.get(node_name, _NODE_CONFIG["handle_general"])

    # Pull the correct model slug
    model_slug = settings.nemotron_super_model if cfg["model"] == "super" else settings.nemotron_nano_model
    
    # Pull the correct API Key. If nano isn't set, fallback to super key.
    api_key = settings.nvidia_nemotron_3_nano_api_key if cfg["model"] == "nano" and settings.nvidia_nemotron_3_nano_api_key else settings.nvidia_nemotron_3_super_api_key

    temperature = round(random.uniform(cfg["temp_min"], cfg["temp_max"]), 3)

    return ChatOpenAI(
        model=model_slug,
        base_url=settings.nvidia_base_url,
        api_key=api_key,
        temperature=temperature,
        max_tokens=cfg["max_tokens"],
        streaming=True,            # enables token-by-token streaming via LangChain callbacks
        timeout=60,
    )



# ---------------------------------------------------------------------------
# Node: Intent Classification
# ---------------------------------------------------------------------------

def classify_intent(state: AgentState) -> AgentState:
    """
    Classifies the user query into one of: stock, news, portfolio, general.
    Sets intent_category, intent_symbol, intent_confidence in state.
    """
    llm = _get_llm("classify_intent")
    messages = [
        SystemMessage(content=CLASSIFIER_SYSTEM_PROMPT),
        HumanMessage(content=CLASSIFIER_USER_TEMPLATE.format(query=state["query"]))
    ]
    try:
        response = llm.invoke(messages)
        raw = response.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        return {
            **state,
            "intent_category": parsed.get("category", "general"),
            "intent_symbol": parsed.get("symbol"),
            "intent_confidence": parsed.get("confidence", 0.5),
            "gathered_data": {},
        }
    except Exception as e:
        return {
            **state,
            "intent_category": "general",
            "intent_symbol": None,
            "intent_confidence": 0.0,
            "gathered_data": {},
            "error": f"Classification failed: {str(e)}"
        }


# ---------------------------------------------------------------------------
# Node: Route Decision
# ---------------------------------------------------------------------------

def route_intent(state: AgentState) -> str:
    """
    Decides which branch to execute based on intent_category.
    Returns the name of the next node.
    """
    category = state.get("intent_category", "general")
    symbol = state.get("intent_symbol")

    # If classified as stock but no symbol extracted, treat as market/general
    if category == "stock" and not symbol:
        return "handle_market"

    if category == "stock":
        return "gather_stock_data"
    elif category == "news":
        return "gather_news_data"
    elif category == "portfolio":
        return "gather_portfolio_data"
    elif category == "market":
        return "handle_market"
    else:
        return "handle_general"


# ---------------------------------------------------------------------------
# Node: Gather Stock Data
# ---------------------------------------------------------------------------

def gather_stock_data(state: AgentState) -> AgentState:
    """
    Calls stock data, setup detection, and market structure tools in sequence.
    All results are stored in state['gathered_data'].
    """
    symbol = state.get("intent_symbol")
    if not symbol:
        return {
            **state,
            "error": "No symbol extracted from query. Cannot fetch stock data.",
            "gathered_data": {}
        }

    gathered = {}

    # Fetch core stock data and technicals
    stock_result = get_stock_data.invoke({"symbol": symbol})
    gathered["stock_data"] = stock_result.get("stock_data", {})
    gathered["technicals"] = stock_result.get("technicals", {})

    # Fetch setup detection
    setup_result = detect_setup.invoke({"symbol": symbol})
    gathered["trading_setup"] = setup_result.get("setup", None)

    # Fetch market structure
    structure_result = get_market_structure.invoke({"symbol": symbol})
    gathered["market_structure"] = structure_result.get("market_structure", {})

    # Fetch recent news for this symbol (last 5 articles)
    news_result = get_market_news.invoke({"symbol": symbol, "limit": 5})
    gathered["news_headlines"] = news_result.get("articles", [])

    return {**state, "gathered_data": gathered}


# ---------------------------------------------------------------------------
# Node: Gather News Data
# ---------------------------------------------------------------------------

def gather_news_data(state: AgentState) -> AgentState:
    """
    Fetches general market news for synthesis.
    """
    symbol = state.get("intent_symbol")
    news_result = get_market_news.invoke({"symbol": symbol, "limit": 15})
    return {
        **state,
        "gathered_data": {
            "articles": news_result.get("articles", [])
        }
    }


# ---------------------------------------------------------------------------
# Node: Gather Portfolio Data
# ---------------------------------------------------------------------------

def gather_portfolio_data(state: AgentState) -> AgentState:
    """
    Placeholder for portfolio data gathering.
    Returns empty portfolio structure — portfolio data is injected
    from the frontend request payload in the API layer.
    """
    return {
        **state,
        "gathered_data": {
            "holdings": [],
            "total_invested": 0,
            "total_value": 0,
            "overall_pnl_pct": 0.0
        }
    }


# ---------------------------------------------------------------------------
# Node: Analyze Stock (Trading Coach)
# ---------------------------------------------------------------------------

def analyze_stock(state: AgentState) -> AgentState:
    """
    Calls the Trading Coach prompt with all gathered stock data.
    Uses dynamic prompt builder — every section is conditional on real data.
    """
    symbol = state.get("intent_symbol", "UNKNOWN")
    data = state.get("gathered_data", {})
    llm = _get_llm("analyze_stock")

    # Extract structured data from gathered_data
    stock_data   = data.get("stock_data", {})
    technicals   = data.get("technicals", {})
    news         = data.get("news_headlines", [])
    setup        = data.get("trading_setup") or {}
    structure    = data.get("market_structure") or {}

    # Build the dynamic, query-intent-aware prompt (output_mode auto-detected inside)
    dynamic_user_prompt = build_analyst_prompt(
        symbol=symbol,
        stock_data=stock_data,
        technicals=technicals,
        news=news,
        setup=setup,
        structure=structure,
        original_query=state.get("query", ""),
    )

    messages = [
        SystemMessage(content=ANALYST_SYSTEM_PROMPT.format(symbol=symbol)),
        HumanMessage(content=ANALYST_USER_TEMPLATE.format(dynamic_prompt=dynamic_user_prompt)),
    ]

    try:
        response = llm.invoke(messages)
        return {**state, "final_response": response.content}
    except Exception as e:
        err_str = str(e)
        # Graceful rate-limit fallback — return the pre-built data as the response
        if "429" in err_str or "rate_limit" in err_str.lower():
            fallback = (
                f"**⚠️ AI Analysis Temporarily Unavailable**\n\n"
                f"The AI inference service is rate-limited right now. "
                f"Here is the raw data gathered for **{symbol}**:\n\n"
                f"{dynamic_user_prompt}\n\n"
                f"_Please retry in a few minutes for the full AI-generated commentary._"
            )
            return {**state, "final_response": fallback, "error": "rate_limited"}
        return {**state, "final_response": f"Analysis failed: {err_str}", "error": err_str}


# ---------------------------------------------------------------------------
# Node: Synthesize News
# ---------------------------------------------------------------------------

def synthesize_news(state: AgentState) -> AgentState:
    """
    Calls the News Synthesis prompt with gathered articles.
    Automatically detects query_mode: narrative (for chat) or dashboard (for widgets).
    """
    data = state.get("gathered_data", {})
    articles = data.get("articles", [])
    original_query = state.get("query", "")
    llm = _get_llm("synthesize_news")

    # Build a query-aware news prompt (narrative mode for chat, dashboard mode for widget)
    news_user_prompt = build_news_prompt(
        articles=articles,
        original_query=original_query,
        query_mode="narrative",   # chat always gets prose; dashboard widget can pass "dashboard"
    )

    messages = [
        SystemMessage(content=NEWS_SYNTHESIS_SYSTEM_PROMPT),
        HumanMessage(content=NEWS_SYNTHESIS_USER_TEMPLATE.format(news_prompt=news_user_prompt))
    ]

    try:
        response = llm.invoke(messages)
        return {**state, "final_response": response.content}
    except Exception as e:
        return {**state, "final_response": f"News synthesis failed: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Node: Audit Portfolio
# ---------------------------------------------------------------------------

def audit_portfolio(state: AgentState) -> AgentState:
    """
    Calls the Portfolio Auditor prompt with gathered portfolio data.
    """
    data = state.get("gathered_data", {})
    llm = _get_llm("audit_portfolio")

    messages = [
        SystemMessage(content=PORTFOLIO_AUDITOR_SYSTEM_PROMPT),
        HumanMessage(content=PORTFOLIO_AUDITOR_USER_TEMPLATE.format(
            total_invested=data.get("total_invested", 0),
            total_value=data.get("total_value", 0),
            overall_pnl_pct=data.get("overall_pnl_pct", 0.0),
            holdings=json.dumps(data.get("holdings", []), indent=2)
        ))
    ]

    try:
        response = llm.invoke(messages)
        return {**state, "final_response": response.content}
    except Exception as e:
        return {**state, "final_response": f"Portfolio audit failed: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Node: Handle General Query
# ---------------------------------------------------------------------------

def handle_general(state: AgentState) -> AgentState:
    """
    Calls the General Educator prompt.
    Auto-detects response_mode (educational/advisory/macro) and complexity level.
    Returns clean markdown — no JSON parsing needed.
    """
    llm = _get_llm("handle_general")
    query = state["query"]

    # Build the fully adaptive general prompt
    general_user_prompt = build_general_prompt(
        question=query,
        portfolio_context="None provided",
    )

    messages = [
        SystemMessage(content=GENERAL_EDUCATOR_SYSTEM_PROMPT),
        HumanMessage(content=GENERAL_EDUCATOR_USER_TEMPLATE.format(general_prompt=general_user_prompt))
    ]

    try:
        response = llm.invoke(messages)
        return {**state, "final_response": response.content.strip()}
    except Exception as e:
        return {**state, "final_response": f"Could not answer: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Node: Handle Market Screening (no specific symbol)
# ---------------------------------------------------------------------------

def handle_market(state: AgentState) -> AgentState:
    """
    Handles screening/discovery queries where no specific stock is named.
    Fetches REAL-TIME data for a liquid NSE watchlist, then passes it to the LLM.
    Examples: "Find oversold stocks", "Best IT stocks to buy", "Stocks near 52-week low"
    """
    from datetime import datetime, timezone

    # Liquid NSE watchlist — covers major sectors
    SCREEN_UNIVERSE = [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "SBIN.NS",
        "TATASTEEL.NS", "ICICIBANK.NS", "WIPRO.NS", "AXISBANK.NS",
        "BAJFINANCE.NS", "SUNPHARMA.NS", "LT.NS",
    ]

    screened = []
    fetch_errors = []
    fetch_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    for sym in SCREEN_UNIVERSE:
        try:
            stock_result = get_stock_data.invoke({"symbol": sym})
            if stock_result.get("error"):
                fetch_errors.append(sym)
                continue

            setup_result = detect_setup.invoke({"symbol": sym})
            setup = setup_result.get("setup", {}) if not setup_result.get("error") else {}

            sd = stock_result.get("stock_data", {})
            tech = stock_result.get("technicals", {})

            screened.append({
                "symbol": sym,
                "price": sd.get("current_price"),
                "prev_close": sd.get("previous_close"),
                "rsi": tech.get("rsi"),
                "macd": tech.get("macd"),
                "macd_signal": tech.get("macd_signal"),
                "sma_20": tech.get("sma_20"),
                "volume_ratio": tech.get("volume_ratio"),
                "atr": tech.get("atr"),
                "setup_name": setup.get("name", "No Clear Setup"),
                "setup_confidence": setup.get("confidence"),
                "entry": setup.get("entry"),
                "stop_loss": setup.get("stop_loss"),
                "target_1": setup.get("target_1"),
                "target_2": setup.get("target_2"),
                "risk_reward": setup.get("risk_reward"),
                "setup_reasoning": setup.get("reasoning", ""),
            })
        except Exception as e:
            fetch_errors.append(f"{sym}: {str(e)}")
            continue

    # Build the data payload for the LLM
    screened_data_str = json.dumps({
        "fetch_timestamp": fetch_time,
        "stocks_screened": len(screened),
        "fetch_errors": fetch_errors,
        "data": screened,
    }, indent=2)

    llm = _get_llm("handle_market")
    messages = [
        SystemMessage(content=MARKET_SCREENER_SYSTEM_PROMPT),
        HumanMessage(content=MARKET_SCREENER_USER_TEMPLATE.format(
            query=state["query"],
            screened_data=screened_data_str,
        ))
    ]

    try:
        response = llm.invoke(messages)
        return {**state, "final_response": response.content, "gathered_data": {"screened_stocks": screened}}
    except Exception as e:
        return {**state, "final_response": f"Could not answer: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Build the LangGraph
# ---------------------------------------------------------------------------

def build_agent_graph() -> StateGraph:
    """
    Assembles the full LangGraph state machine and returns a compiled graph.
    """
    workflow = StateGraph(AgentState)

    # Register all nodes
    workflow.add_node("classify_intent", classify_intent)
    workflow.add_node("gather_stock_data", gather_stock_data)
    workflow.add_node("gather_news_data", gather_news_data)
    workflow.add_node("gather_portfolio_data", gather_portfolio_data)
    workflow.add_node("analyze_stock", analyze_stock)
    workflow.add_node("synthesize_news", synthesize_news)
    workflow.add_node("audit_portfolio", audit_portfolio)
    workflow.add_node("handle_general", handle_general)
    workflow.add_node("handle_market", handle_market)

    # Entry point
    workflow.set_entry_point("classify_intent")

    # Routing from classifier
    workflow.add_conditional_edges(
        "classify_intent",
        route_intent,
        {
            "gather_stock_data": "gather_stock_data",
            "gather_news_data": "gather_news_data",
            "gather_portfolio_data": "gather_portfolio_data",
            "handle_general": "handle_general",
            "handle_market": "handle_market",
        }
    )

    # Data gathering → Analysis
    workflow.add_edge("gather_stock_data", "analyze_stock")
    workflow.add_edge("gather_news_data", "synthesize_news")
    workflow.add_edge("gather_portfolio_data", "audit_portfolio")

    # All analysis nodes → END
    workflow.add_edge("analyze_stock", END)
    workflow.add_edge("synthesize_news", END)
    workflow.add_edge("audit_portfolio", END)
    workflow.add_edge("handle_general", END)
    workflow.add_edge("handle_market", END)

    return workflow.compile()


# Singleton compiled graph — import this in the API router
agent_graph = build_agent_graph()
