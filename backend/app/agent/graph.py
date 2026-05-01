"""
FinSight AI — LangGraph Agent State Machine
Flow: classify intent → route to appropriate branch → gather data via tools → synthesize response
"""

import json
import os
import asyncio
import re
import logging
import concurrent.futures
from app.core.cache import cache as _cache

logger = logging.getLogger(__name__)
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
from app.services.data_provider import data_provider


# ---------------------------------------------------------------------------
# Agent State Definition
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """Complete state passed between all nodes in the graph."""
    query: str
    query_complexity: str         # "simple" | "medium" | "complex" — set by rule classifier
    intent_category: str          # "stock" | "news" | "portfolio" | "general" | "market"
    intent_symbol: Optional[str]  # Primary Ticker symbol if applicable
    intent_symbols: list[str]     # List of all extracted symbols (for comparison)
    intent_confidence: float
    gathered_data: dict           # Accumulated tool results
    final_response: str           # Final human-readable response
    error: Optional[str]          # Error message if something failed
    # ── NEW Phase 4 fields ────────────────────────────────────────────────────
    artifact_type: Optional[str]       # Phase 4: rendered artifact type (price_ticker, full_analysis, etc.)
    artifact_symbol: Optional[str]     # Phase 4: resolved NSE symbol for artifact header
    artifact_data: Optional[dict]      # Phase 4: assembled slot data from all 3 parallel nodes
    technicals_draft: Optional[dict]   # Phase 4: output of phase4_technicals_node
    news_draft: Optional[dict]         # Phase 4: output of phase4_news_node
    fundamentals_draft: Optional[dict] # Phase 4: output of phase4_fundamentals_node
    # ── NEW: Dynamic artifact layout fields (added for artifact system) ───────
    artifact_layout: str            # e.g. "investment_thesis" — set in classify_intent
    artifact_components: list       # e.g. ["VerdictBanner:top","MetricGrid:3col"]
    artifact_emphasis: str          # e.g. "fundamentals_primary"
    artifact_text_length: str       # e.g. "2_sentences" or "null"


# ---------------------------------------------------------------------------
# DIRECT PROVIDER MODEL CONFIGURATION (No OpenRouter)
# Tier 1 — Gemma 4 31B     → Google AI (langchain-google-genai, 7-key rotation)
# Tier 2 — Qwen3.5 397B    → NVIDIA NIM (ChatOpenAI + nvidia_nim_base_url)
# Tier 3 — DeepSeek V4     → DeepSeek API (ChatOpenAI + deepseek_base_url)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Phase 4 — Artifact Type Rules
# Maps query complexity + category → default artifact type
# Fast-classify override: price/news queries always get lightweight artifacts
# ---------------------------------------------------------------------------

VALID_ARTIFACT_TYPES = {
    "price_ticker", "technical_gauge", "news_feed", "info_card",
    "comparison_table", "screener_table", "portfolio_breakdown",
    "full_analysis", "financial_report",
}

ARTIFACT_TYPE_RULES: dict = {
    # category → (simple_artifact, medium_artifact, complex_artifact)
    "stock":     ("price_ticker",      "technical_gauge",     "full_analysis"),
    "news":      ("news_feed",          "news_feed",            "news_feed"),
    "portfolio": ("portfolio_breakdown","portfolio_breakdown",  "portfolio_breakdown"),
    "market":    ("screener_table",     "screener_table",       "screener_table"),
    "general":   ("info_card",          "info_card",            "info_card"),
}


def _determine_artifact_type(category: str, complexity: str) -> str:
    """Returns the appropriate artifact type string for the given intent."""
    rule = ARTIFACT_TYPE_RULES.get(category, ("info_card", "info_card", "info_card"))
    idx = {"simple": 0, "medium": 1, "complex": 2}.get(complexity, 2)
    return rule[idx]

import random
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

# ---------------------------------------------------------------------------
# Per-node config: temperature range + token budget
# ---------------------------------------------------------------------------

_NODE_CONFIG = {
    "classify_intent": {
        "temp_min":  0.05, "temp_max": 0.15,
        "max_tokens": settings.nemotron_classify_max_tokens,   # 200
    },
    "analyze_stock": {
        "temp_min":  0.30, "temp_max": 0.42,
        "max_tokens": settings.nemotron_analyze_max_tokens,    # 2500
    },
    "synthesize_news": {
        "temp_min":  0.35, "temp_max": 0.48,
        "max_tokens": settings.nemotron_news_max_tokens,       # 1200
    },
    "audit_portfolio": {
        "temp_min":  0.28, "temp_max": 0.40,
        "max_tokens": settings.nemotron_portfolio_max_tokens,  # 1800
    },
    "handle_general": {
        "temp_min":  0.38, "temp_max": 0.50,
        "max_tokens": settings.nemotron_general_max_tokens,    # 900
    },
    "handle_market": {
        "temp_min":  0.50, "temp_max": 0.50,
        "max_tokens": settings.nemotron_market_max_tokens,     # 4000
    },
}


# ---------------------------------------------------------------------------
# Phase 1 — Rule-Based Complexity Classifier (Zero API Cost, <1ms)
# ---------------------------------------------------------------------------

SIMPLE_KEYWORDS = [
    "price", "current price", "52 week", "market cap", "what is pe",
    "share price", "ltp", "today price", "high", "low", "open", "close",
]
MEDIUM_KEYWORDS = [
    "rsi", "sma", "ema", "macd", "technical analysis", "support",
    "resistance", "sector", "trend", "best stock", "today in", "news",
    "chart", "indicator", "moving average",
]
COMPLEX_KEYWORDS = [
    "compare", " vs ", "portfolio", "risk", "diversify",
    "invest in", "should i", "best etf", "macro", "next year",
    "strategy", "allocation", "rebalance",
    # ── Fix 2: analytical & financial depth phrases → always route to COMPLEX tier ──
    "long term", "short term", "long-term", "short-term",
    "fundamental", "intrinsic value", "valuation", "dcf",
    "earnings", "quarterly results", "annual report", "q4", "q3", "q2", "q1",
    "should i buy", "should i sell", "good investment", "worth buying",
    "growth potential", "target price", "fair value", "undervalued", "overvalued",
    "technical analysis", "chart pattern", "breakout", "breakdown",
    "debt", "revenue", "profit", "ebitda", "cash flow", "margin",
]

# ── CLASSIFY_INTENT SYSTEM PROMPT (Extended for dynamic artifact layout) ──────
CLASSIFY_INTENT_SYSTEM_PROMPT = """You are the Lead UI/UX Designer and AI router for FinSight AI,
an elite, terminal-themed Indian stock market research dashboard.

Your job: analyze the user query and return a single JSON object. 
You act as a dynamic composition engine. You do NOT use fixed layout templates. 
Instead, you design the UI specifically for the query by selecting from our rich library of atomic UI components.
No prose. No markdown. Only the JSON object.

OUTPUT FORMAT:
{
  "category": "<stock|news|portfolio|market|general>",
  "symbol": "<Primary NSE ticker like TCS.NS, or null>",
  "symbols": ["<TCS.NS>", "<INFY.NS>"],
  "confidence": <float 0.0-1.0>,
  "artifact_type": "<one of the artifact types below>",
  "layout": "dynamic",
  "components": ["<component1>", "<component2>", ...],
  "emphasis": "<one emphasis value>",
  "text_length": "<null|1_sentence|2_sentences|3_sentences>"
}

ARTIFACT TYPES:
- price_ticker: user only wants current price, LTP, or quick price check
- technical_gauge: user asks about RSI, MACD, SMA, EMA, technical indicators
- news_feed: user asks about news, headlines, recent events
- info_card: user asks to explain a concept (PE ratio, RSI, etc.)
- comparison_table: user compares 2 or 3 stocks
- screener_table: top gainers, sector scan
- portfolio_breakdown: portfolio, holdings, P&L
- full_analysis: complete analysis, investment decision, long/short term view
- financial_report: revenue, profit, quarterly results

ATOMIC COMPONENT LIBRARY (Pick 3 to 6 max, ordered top to bottom):
[CORE METRICS]
- "HeroMetric" : Huge price display, day change, Mkt Cap. Best for top of deep dives.
- "MiniPriceCard" : Small compact price card. Best when price is secondary or comparing.
[TECHNICALS]
- "TechnicalGauges" : Visual meters for RSI, MACD, EMA.
- "SupportResistanceBar" : Visual slider showing proximity to support/resistance.
- "SignalRow:expanded" : Bullish/Bearish badges with technical context.
[FUNDAMENTALS]
- "FundamentalGrid" : Compact grid for PE, EPS, ROE, Debt/Eq.
- "RevenueProfitChart" : Bar chart for historical financial performance.
- "ShareholdingProgress" : Visual breakdown of Promoter/FII/DII holding.
[COMPARISON]
- "PeerComparisonTable" : Side-by-side fundamentals. (Use only for 2+ symbols).
- "SegmentStrengthBars" : Normalized progress bars comparing entities.
[CONTEXT]
- "NewsFeed" : List of recent news articles.
- "VerdictCard" : Actionable LLM summary with bullet points. ALWAYS include if asking for advice/analysis.
- "ExpandableRiskPanel" : Hidden deep risk factors (Debt, low ROE).

UI DESIGN RULES:
1. ALWAYS order components logically (e.g. Price -> Data -> Charts -> Verdict).
2. For investment advice: ALWAYS include "VerdictCard" at the end.
3. For comparisons: ALWAYS use "PeerComparisonTable" and "SegmentStrengthBars".
4. For technicals: ALWAYS use "TechnicalGauges".

QUERY → UI DESIGN EXAMPLES:

Query: "TCS ka price kya hai?"
→ {"category":"stock","symbol":"TCS.NS","symbols":["TCS.NS"],"confidence":0.99,"artifact_type":"price_ticker",
   "layout":"dynamic","components":["HeroMetric"],
   "emphasis":"price_only","text_length":"null"}

Query: "RELIANCE ka RSI aur MACD detail mein batao"
→ {"category":"stock","symbol":"RELIANCE.NS","symbols":["RELIANCE.NS"],"confidence":0.95,"artifact_type":"technical_gauge",
   "layout":"dynamic","components":["MiniPriceCard","TechnicalGauges","SupportResistanceBar","SignalRow:expanded"],
   "emphasis":"technicals_primary","text_length":"1_sentence"}

Query: "INFY mein long term invest karna chahiye?"
→ {"category":"stock","symbol":"INFY.NS","symbols":["INFY.NS"],"confidence":0.92,"artifact_type":"full_analysis",
   "layout":"dynamic","components":["HeroMetric","TechnicalGauges","FundamentalGrid","RevenueProfitChart","ShareholdingProgress","ExpandableRiskPanel","VerdictCard"],
   "emphasis":"fundamentals_primary","text_length":"2_sentences"}

Query: "TCS vs Infosys — best IT stock konsa hai?"
→ {"category":"stock","symbol":"TCS.NS","symbols":["TCS.NS","INFY.NS"],"confidence":0.94,"artifact_type":"comparison_table",
   "layout":"dynamic","components":["MiniPriceCard","PeerComparisonTable","SegmentStrengthBars","VerdictCard"],
   "emphasis":"comparison_winner","text_length":"1_sentence"}

Query: "HDFC Bank Q4 results ke baad kya hua market mein?"
→ {"category":"news","symbol":"HDFCBANK.NS","symbols":["HDFCBANK.NS"],"confidence":0.91,"artifact_type":"news_feed",
   "layout":"event_news_focus","components":["HeroMetric","NewsItem:5","SignalRow","VerdictBanner"],
   "emphasis":"news_primary","text_length":"1_sentence"}

Query: "RELIANCE quarterly revenue aur profit dikhao last 2 years"
→ {"category":"stock","symbol":"RELIANCE.NS","confidence":0.93,"artifact_type":"financial_report",
   "layout":"financials_timeline","components":["MetricGrid:2col","BarChart:revenue","BarChart:profit","TimelineRow:8q"],
   "emphasis":"trend_visualization","text_length":"1_sentence"}

Query: "PE ratio kya hota hai?"
→ {"category":"general","symbol":null,"confidence":0.98,"artifact_type":"info_card",
   "layout":"education_explainer","components":["MetricGrid:2col","SignalRow"],
   "emphasis":"education_first","text_length":"3_sentences"}

Now classify this query and return ONLY the JSON object:"""


def classify_query_complexity(query: str) -> str:
    """
    Rule-based complexity classifier — zero API cost, runs in <1ms.
    Complex keywords take priority; returns 'simple', 'medium', or 'complex'.
    """
    q = query.lower()
    for kw in COMPLEX_KEYWORDS:
        if kw in q:
            return "complex"
    for kw in MEDIUM_KEYWORDS:
        if kw in q:
            return "medium"
    return "simple"


# ---------------------------------------------------------------------------
# Health-Aware Routing — Rate Limit Cooldown Registry
# ---------------------------------------------------------------------------

import time as _time

_COOLDOWN_REGISTRY: dict[str, float] = {}   # "provider:key8" → expiry monotonic timestamp
_COOLDOWN_SECONDS  = 60                     # Mark a rate-limited key unavailable for 60s


def _is_rate_limit_error(exc: Exception) -> bool:
    """Returns True for 429 / quota-exhausted / 503-high-demand errors.
    503 UNAVAILABLE ("high demand" / "currently experiencing") is treated as
    overloaded — immediate cooldown, no retry, fall through to next pool.
    Google SDK already retries internally; our retry just doubles the wait.
    """
    msg = str(exc).lower()
    return any(kw in msg for kw in [
        "429", "rate_limit", "rate limit", "quota", "resource_exhausted",
        "too many requests", "resourceexhausted",
        # Google 503 UNAVAILABLE under load — treat as "too busy", not transient
        "high demand", "currently experiencing", "503 unavailable",
        "service_unavailable", "service unavailable",
    ])


def _is_transient_error(exc: Exception) -> bool:
    """Returns True for temporary network / connection errors worth one retry.
    Excludes rate-limit and overloaded errors (those go straight to cooldown).
    """
    if _is_rate_limit_error(exc):          # Already handled — don't also retry
        return False
    msg = str(exc).lower()
    return any(kw in msg for kw in [
        "500", "502", "503", "504", "timeout", "connection", "network",
        "timed out", "remote disconnected", "read timeout",
    ])


# Known canned refusal/safety phrases returned as HTTP 200 by various models.
# These look like successes but carry no real analysis — treat as failures.
_SAFETY_PHRASES = [
    "i encountered an error processing your request",
    "i'm sorry, i can't help with that",
    "i cannot provide financial advice",
    "i'm not able to assist",
    "i cannot assist with",
    "as an ai language model, i cannot",
    "i apologize, but i'm unable to",
    "i don't have the ability to",
    "please try again later",
]

def _is_safety_refusal(content: str) -> bool:
    """
    Returns True if the model returned a canned refusal/error phrase instead of
    a real financial analysis. Gemma 4 in particular returns these under load
    or when the content filter triggers, but the HTTP status is still 200.
    Only flags SHORT responses (< 200 chars) matching known phrases to avoid
    false-positives on long answers that happen to mention these words.
    """
    if not content or len(content) > 200:
        return False
    low = content.lower().strip()
    return any(phrase in low for phrase in _SAFETY_PHRASES)


def _mark_key_cooldown(provider: str, key: str) -> None:
    _COOLDOWN_REGISTRY[f"{provider}:{key[:8]}"] = _time.monotonic() + _COOLDOWN_SECONDS


def _key_on_cooldown(provider: str, key: str) -> bool:
    return _time.monotonic() < _COOLDOWN_REGISTRY.get(f"{provider}:{key[:8]}", 0.0)


def _get_model_timeout(model: str) -> int:
    """
    Per-model timeout in seconds.
    Free/light models get shorter timeouts so the fallback chain activates quickly.
    Paid/heavy models get more time to avoid premature failures.
    """
    _TIMEOUTS: dict[str, int] = {
        # ─ Simple tier ───────────────────────────────────────────────────────
        settings.simple_model:            15,   # Gemini 2.5 Flash-Lite (fast path, classify)
        settings.gemini_flash_lite_model: 20,   # Gemini 2.5 Flash-Lite: lightweight, fast
        settings.gemini_flash_model:      30,   # Gemini 2.5 Flash: full model, fundamentals
        # ─ Pro tier ─────────────────────────────────────────────────────────
        settings.gemini_pro_model:        90,   # Gemini 2.5 Pro: heavy model, needs time
    }
    return _TIMEOUTS.get(model, 45)   # 45s default for unknown models


# ---------------------------------------------------------------------------
# Provider LLM Factory — builds the correct SDK client per provider tag
# ---------------------------------------------------------------------------

def _build_provider_llm(
    provider: str, model: str, api_key: str, cfg: dict, temperature: float,
    streaming: bool = False,
):
    """
    Returns the correct LangChain LLM instance for the given provider.
      google   → ChatGoogleGenerativeAI (direct Google AI — Gemma / Gemini)

    streaming=True  → enables real token streaming for LangGraph stream_mode='messages'
    streaming=False → used for classify_intent (JSON parsing requires complete response)
    Timeout is looked up per-model via _get_model_timeout().
    """
    timeout = _get_model_timeout(model)
    if provider == "google":
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            temperature=temperature,
            max_output_tokens=cfg["max_tokens"],
            streaming=streaming,
            timeout=timeout,
            max_retries=0,
        )
    elif provider == "nvidia":
        return ChatOpenAI(
            model=model,
            base_url=settings.nvidia_nim_base_url,
            api_key=api_key,
            temperature=temperature,
            max_tokens=cfg["max_tokens"],
            streaming=streaming,
            timeout=timeout,
            max_retries=0,
        )
    else:  # deepseek
        return ChatOpenAI(
            model=model,
            base_url=settings.deepseek_base_url,
            api_key=api_key,
            temperature=temperature,
            max_tokens=cfg["max_tokens"],
            streaming=streaming,
            timeout=timeout,
            max_retries=0,
        )


# ---------------------------------------------------------------------------
# ProviderPool — encapsulates one provider+model with its full key pool.
#
# Responsibilities:
#   • Filters blank keys at startup
#   • Skips individual keys that are in cooldown
#   • Retries once on transient errors before trying the next key
#   • Marks rate-limited keys with a 60s cooldown instantly
#   • Raises only after all keys are exhausted
# ---------------------------------------------------------------------------

class ProviderPool:
    """One logical provider in the fallback chain (e.g. 'Gemini 2.5 Flash')."""

    def __init__(self, provider: str, model: str, keys: list[str]):
        self.provider = provider
        self.model    = model
        self.keys     = [k for k in keys if k]   # drop any blank keys

    @property
    def all_on_cooldown(self) -> bool:
        """True when every key in this pool is currently rate-limited."""
        return bool(self.keys) and all(
            _key_on_cooldown(self.provider, k) for k in self.keys
        )

    def invoke(self, messages: list, cfg: dict, temperature: float, streaming: bool = False) -> str:
        """
        Tries each key in the pool in order.
        Per key: one retry on transient errors, immediate skip on rate-limit.
        streaming=True → builds LLM with streaming enabled so LangGraph can
                         intercept individual tokens in stream_mode='messages'.
        Raises RuntimeError only if all keys fail.
        """
        last_err: Exception = RuntimeError(
            f"All keys for {self.provider}/{self.model} failed"
        )

        for key in self.keys:
            if _key_on_cooldown(self.provider, key):
                continue                              # Skip rate-limited key

            llm = _build_provider_llm(
                provider=self.provider,
                model=self.model,
                api_key=key,
                cfg=cfg,
                temperature=temperature,
                streaming=streaming,
            )

            for attempt_num in range(2):              # max 2 tries per key
                try:
                    content = llm.invoke(messages).content

                    # ── Safety-filter guard ────────────────────────────────
                    # Some models (Gemma) return HTTP 200 but fill the content
                    # with a canned refusal / error phrase instead of a real answer.
                    # Detect these and treat as failures so the next pool is tried.
                    if _is_safety_refusal(content):
                        last_err = RuntimeError(
                            f"{self.provider}/{self.model} returned a safety/refusal response"
                        )
                        break                         # Try next key in pool

                    return content                    # ✅ Real answer

                except Exception as exc:
                    last_err = exc

                    if _is_rate_limit_error(exc):
                        _mark_key_cooldown(self.provider, key)
                        break                         # No retry — next key

                    if attempt_num == 0 and _is_transient_error(exc):
                        continue                      # One retry on transient errors

                    break                             # Non-retryable — next key

        raise last_err


# ---------------------------------------------------------------------------
# Pool Instances — one per provider+model combination
# ---------------------------------------------------------------------------

_GEMMA_POOL = ProviderPool(
    provider="google",
    model=settings.gemini_flash_lite_model,    # gemini-2.5-flash-lite (fast path)
    keys=[
        settings.gemini_api_key_1,
        settings.gemini_api_key_2,
        settings.gemini_api_key_3,
        settings.gemini_api_key_4,
        settings.gemini_api_key_5,
        settings.gemini_api_key_6,
        settings.gemini_api_key_7,
        settings.gemini_api_key_8,
        settings.gemini_api_key_9,
        settings.gemini_api_key_10,
    ],
)

_GEMINI_FLASH_POOL = ProviderPool(
    provider="google",
    model=settings.gemini_flash_lite_model,    # gemini-2.5-flash-lite (fast path)
    keys=[
        settings.gemini_api_key_1,
        settings.gemini_api_key_2,
        settings.gemini_api_key_3,
        settings.gemini_api_key_4,
        settings.gemini_api_key_5,
        settings.gemini_api_key_6,
        settings.gemini_api_key_7,
        settings.gemini_api_key_8,
        settings.gemini_api_key_9,
        settings.gemini_api_key_10,
    ],
)

_GEMINI_PRO_POOL = ProviderPool(
    provider="google",
    model=settings.gemini_flash_lite_model,    # gemini-2.5-flash-lite (fallback tier)
    keys=[
        settings.gemini_api_key_1,
        settings.gemini_api_key_2,
        settings.gemini_api_key_3,
        settings.gemini_api_key_4,
        settings.gemini_api_key_5,
        settings.gemini_api_key_6,
        settings.gemini_api_key_7,
        settings.gemini_api_key_8,
        settings.gemini_api_key_9,
        settings.gemini_api_key_10,
    ],
)

# 🧠 FUNDAMENTALS-ONLY pool — full Gemini 2.5 Flash for deeper financial reasoning
_GEMINI_FLASH_FUNDAMENTALS_POOL = ProviderPool(
    provider="google",
    model=settings.gemini_flash_model,         # gemini-2.5-flash (full model, fundamentals only)
    keys=[
        settings.gemini_api_key_1,
        settings.gemini_api_key_2,
        settings.gemini_api_key_3,
        settings.gemini_api_key_4,
        settings.gemini_api_key_5,
        settings.gemini_api_key_6,
        settings.gemini_api_key_7,
        settings.gemini_api_key_8,
        settings.gemini_api_key_9,
        settings.gemini_api_key_10,
    ],
)


# ---------------------------------------------------------------------------
# Provider Chains — ordered list of ProviderPools per complexity tier
#
# All tiers route through Gemini 2.5 Flash-Lite (fast, reliable, 10 keys).
# Fundamentals node uses _GEMINI_FLASH_FUNDAMENTALS_POOL (full Flash model)
# independently — bypasses this chain entirely.
# ---------------------------------------------------------------------------

_PROVIDER_CHAINS: dict[str, list[ProviderPool]] = {
    "simple":  [_GEMMA_POOL, _GEMINI_FLASH_POOL],
    "medium":  [_GEMINI_FLASH_POOL],
    "complex": [_GEMINI_FLASH_POOL],
}


# ---------------------------------------------------------------------------
# _invoke_with_fallback — iterates the pool chain, delegates all retry/
# cooldown logic to each pool's own invoke() method.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# _extract_json — Robust JSON extraction from LLM responses (Gap #6 Fix)
# Handles markdown fences, surrounding prose, and truncated JSON gracefully.
# ---------------------------------------------------------------------------

def _extract_json(raw_text: str, fallback: dict = None) -> dict:
    """
    Robustly extract JSON from LLM response text.
    Tries 4 strategies in order: direct parse → fence strip → first-brace → greedy.
    Returns fallback dict if ALL strategies fail.
    """
    if fallback is None:
        fallback = {}
    if not raw_text or not raw_text.strip():
        return fallback
    # Strategy 1: Direct parse
    try:
        return json.loads(raw_text.strip())
    except json.JSONDecodeError:
        pass
    # Strategy 2: Strip markdown fences
    fence_match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', raw_text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1).strip())
        except json.JSONDecodeError:
            pass
    # Strategy 3: First {...} block
    brace_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass
    # Strategy 4: Greedy {...} block
    greedy_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if greedy_match:
        try:
            return json.loads(greedy_match.group(0))
        except json.JSONDecodeError:
            pass
    logger.warning("[_extract_json] All strategies failed. Snippet: %r", raw_text[:200])
    return fallback


def _invoke_with_fallback(
    node_name: str,
    messages: list,
    complexity: str = "complex",
    use_streaming: bool = False,
) -> str:
    """
    Walks the ProviderPool chain for the given complexity tier.
    Each pool handles its own key rotation, cooldown, and transient retry.
    Skips any pool where ALL keys are currently in rate-limit cooldown.

    use_streaming=True  → pass streaming=True to LLM (Fix 3: real token streaming)
    use_streaming=False → classify_intent keeps this False (JSON must arrive complete)

    Chain order (all tiers — Gemini 2.5 Flash):
      SIMPLE:  Flash-Lite(7 keys) → Flash-Lite fallback pool
      MEDIUM:  Flash-Lite(7 keys)
      COMPLEX: Flash-Lite(7 keys)
    Note: Fundamentals node uses _GEMINI_FLASH_FUNDAMENTALS_POOL directly,
    bypassing this chain.
    """
    cfg         = _NODE_CONFIG.get(node_name, _NODE_CONFIG["handle_general"])
    temperature = round(random.uniform(cfg["temp_min"], cfg["temp_max"]), 3)
    chain       = _PROVIDER_CHAINS.get(complexity, _PROVIDER_CHAINS["complex"])
    last_err: Exception = RuntimeError("All providers in chain failed — no successful response")

    for pool in chain:
        if not pool.keys:                            # Pool has zero valid keys — skip entirely
            continue
        if pool.all_on_cooldown:
            continue                              # Entire pool rate-limited — skip
        try:
            return pool.invoke(messages, cfg, temperature, streaming=use_streaming)
        except Exception as exc:
            last_err = exc                        # Pool exhausted — try next pool

    raise last_err



# ---------------------------------------------------------------------------
# Fix 1 — Regex Fast-Path for Phase 2 (zero API cost, <1ms)
# Handles ~80% of real financial queries without an LLM call.
# Returns None for ambiguous queries → caller falls through to LLM.
# ---------------------------------------------------------------------------

_NSE_TICKER_REGEX = re.compile(
    r'\b(RELIANCE|TCS|INFY|INFOSYS|HDFCBANK|HDFC|HDFCBANK|SBIN|STATEBANK|ICICIBANK|ICICI|'
    r'WIPRO|AXISBANK|AXIS|BAJFINANCE|BAJAJFINSV|BAJAJ|SUNPHARMA|SUN|LT|LARSEN|TATASTEEL|'
    r'TATAMOTORS|TATA|ADANIENT|ADANIPORTS|ADANI|ONGC|COALINDIA|COAL|NTPC|POWERGRID|'
    r'HINDUNILVR|HUL|NESTLEIND|NESTLE|MARUTI|BHARTIARTL|AIRTEL|JSWSTEEL|JSW|INDIGO|'
    r'ASIANPAINT|ASIAN|TECHM|TECH|HCLTECH|HCL|DRREDDY|CIPLA|DIVISLAB|DIVIS|'
    r'KOTAKBANK|KOTAK|LTIM|LTIMINDTREE|TITAN|ULTRACEMCO|ULTRATECH|BAJAJFINSV|'
    r'MAHINDRA|M&M|MMFINANCE|WIPRO|ITC|BPCL|ONGC|VEDL|VEDANTA|GRASIM|'
    r'EICHERMOT|EICHER|APOLLOHOSP|APOLLO|DABUR|MARICO|PIDILITIND|PIDILITE|'
    r'BERGEPAINT|BERGER|TORNTPHARM|TORNT|MUTHOOTFIN|MUTHOOT)\b',
    re.IGNORECASE,
)

_NSE_SYMBOL_MAP: dict[str, str] = {
    # ── Core Blue Chips ──
    "RELIANCE": "RELIANCE.NS",  "TCS": "TCS.NS",       "INFY": "INFY.NS",
    "INFOSYS": "INFY.NS",       "HDFCBANK": "HDFCBANK.NS", "HDFC": "HDFCBANK.NS",
    "SBIN": "SBIN.NS",          "STATEBANK": "SBIN.NS",  "SBI": "SBIN.NS",
    "STATE BANK": "SBIN.NS",    "ICICIBANK": "ICICIBANK.NS", "ICICI": "ICICIBANK.NS",
    "ICICI BANK": "ICICIBANK.NS",
    "WIPRO": "WIPRO.NS",        "AXISBANK": "AXISBANK.NS",  "AXIS": "AXISBANK.NS",
    "AXIS BANK": "AXISBANK.NS",
    "BAJFINANCE": "BAJFINANCE.NS", "BAJAJ FINANCE": "BAJFINANCE.NS",
    "BAJAJFINSV": "BAJAJFINSV.NS", "BAJAJ FINSERV": "BAJAJFINSV.NS",
    "BAJAJ": "BAJFINANCE.NS",
    "SUNPHARMA": "SUNPHARMA.NS", "SUN PHARMA": "SUNPHARMA.NS", "SUN": "SUNPHARMA.NS",
    "LT": "LT.NS",              "LARSEN": "LT.NS",
    "TATASTEEL": "TATASTEEL.NS", "TATA STEEL": "TATASTEEL.NS",
    "TATAMOTORS": "TATAMOTORS.NS", "TATA MOTORS": "TATAMOTORS.NS", "TATA": "TATAMOTORS.NS",
    "ADANIENT": "ADANIENT.NS",  "ADANI ENT": "ADANIENT.NS",  "ADANI": "ADANIENT.NS",
    "ADANIPORTS": "ADANIPORTS.NS",
    "ONGC": "ONGC.NS",
    "COALINDIA": "COALINDIA.NS", "COAL INDIA": "COALINDIA.NS", "COAL": "COALINDIA.NS",
    "NTPC": "NTPC.NS",          "POWERGRID": "POWERGRID.NS",
    "HINDUNILVR": "HINDUNILVR.NS", "HUL": "HINDUNILVR.NS",
    "HINDUSTAN UNILEVER": "HINDUNILVR.NS",
    "NESTLEIND": "NESTLEIND.NS", "NESTLE": "NESTLEIND.NS",
    "MARUTI": "MARUTI.NS",      "MARUTI SUZUKI": "MARUTI.NS",
    "BHARTIARTL": "BHARTIARTL.NS", "AIRTEL": "BHARTIARTL.NS",
    "JSWSTEEL": "JSWSTEEL.NS",  "JSW STEEL": "JSWSTEEL.NS", "JSW": "JSWSTEEL.NS",
    "INDIGO": "INDIGO.NS",
    "ASIANPAINT": "ASIANPAINT.NS", "ASIAN PAINT": "ASIANPAINT.NS", "ASIAN": "ASIANPAINT.NS",
    "TECHM": "TECHM.NS",        "TECH MAHINDRA": "TECHM.NS", "TECH": "TECHM.NS",
    "HCLTECH": "HCLTECH.NS",    "HCL TECH": "HCLTECH.NS",   "HCL": "HCLTECH.NS",
    "DRREDDY": "DRREDDY.NS",    "DR REDDY": "DRREDDY.NS",
    "CIPLA": "CIPLA.NS",        "DIVISLAB": "DIVISLAB.NS",  "DIVIS": "DIVISLAB.NS",
    # ── Newly Added ──
    "KOTAKBANK": "KOTAKBANK.NS", "KOTAK": "KOTAKBANK.NS",   "KOTAK BANK": "KOTAKBANK.NS",
    "LTIM": "LTIM.NS",          "LTI MINDTREE": "LTIM.NS",  "LTIMINDTREE": "LTIM.NS",
    "TITAN": "TITAN.NS",
    "ULTRACEMCO": "ULTRACEMCO.NS", "ULTRATECH": "ULTRACEMCO.NS",
    "M&M": "M&M.NS",            "MAHINDRA": "M&M.NS",
    "ITC": "ITC.NS",            "BPCL": "BPCL.NS",          "VEDL": "VEDL.NS",
    "VEDANTA": "VEDL.NS",       "GRASIM": "GRASIM.NS",
    "EICHERMOT": "EICHERMOT.NS", "EICHER": "EICHERMOT.NS",
    "APOLLOHOSP": "APOLLOHOSP.NS", "APOLLO": "APOLLOHOSP.NS",
    "DABUR": "DABUR.NS",        "MARICO": "MARICO.NS",
    "PIDILITIND": "PIDILITIND.NS", "PIDILITE": "PIDILITIND.NS",
    "BERGEPAINT": "BERGEPAINT.NS", "BERGER": "BERGEPAINT.NS",
    "TORNTPHARM": "TORNTPHARM.NS", "TORNT": "TORNTPHARM.NS",
    "MUTHOOTFIN": "MUTHOOTFIN.NS", "MUTHOOT": "MUTHOOTFIN.NS",
    "NVIDIA": "NVDA",
}

_FAST_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "news":      ["news", "headline", "update", "latest", "happened", "today", "announced",
                  "report", "event", "press release"],
    "portfolio": ["portfolio", "holding", "holdings", "bought", "sold", "position",
                  "my stocks", "invested", "transaction", "balance", "account", "pnl"],
    "market":    ["nifty", "sensex", "market", "index", "top stocks", "best stocks",
                  "gainers", "losers", "screen", "screener", "nifty 50", "nifty bank",
                  "nifty it", "midcap", "smallcap", "largecap", "fii", "dii"],
    "general":   [
        # Educational / conceptual
        "what is", "explain", "how does", "define", "meaning of", "teach me", "what are",
        "difference between", "compare vs", "which is better",
        # Sector questions
        "invest in", "should i invest", "good sector", "best sector", "sector to invest",
        "it sector", "banking sector", "pharma sector", "fmcg sector", "auto sector",
        "which sector", "sector outlook", "market outlook",
        # Comparative / strategy
        "compare", "vs", "versus", "strategy", "allocation", "diversify",
        "rebalance", "momentum", "breakout", "reversal",
        # Fundamental concepts
        "dividend", "yield", "payout", "ipo", "listing", "fpo",
        "valuation", "overvalued", "undervalued", "intrinsic value",
    ],
}


def _fast_classify(query: str) -> dict | None:
    """
    Regex-based fast-path Phase 2 classifier.
    Returns a classification dict if confident, else None (→ LLM fallback).
    Execution time: <1ms. Zero API calls. Covers ~80% of real financial queries.
    """
    q_lower = query.lower()

    # Detect category from keywords first
    detected_category: str | None = None
    for category, keywords in _FAST_CATEGORY_KEYWORDS.items():
        if any(kw in q_lower for kw in keywords):
            detected_category = category
            break

    # Detect NSE tickers (multiple if comparison)
    ticker_matches = list(_NSE_TICKER_REGEX.finditer(query))
    detected_symbols = []
    for match in ticker_matches:
        raw_ticker = match.group().upper()
        sym = _NSE_SYMBOL_MAP.get(raw_ticker)
        if sym and sym not in detected_symbols:
            detected_symbols.append(sym)
    
    detected_symbol = detected_symbols[0] if detected_symbols else None
    
    # Fast path for explicit comparison (e.g. "TCS vs Infosys")
    if len(detected_symbols) >= 2 and any(kw in q_lower for kw in ["vs", "compare"]):
        components = ["MiniPriceCard", "PeerComparisonTable", "SegmentStrengthBars", "VerdictCard"]
        return {"category": "stock", "symbol": detected_symbol, "symbols": detected_symbols[:3], "confidence": 0.94, "artifact_type": "comparison_table", "layout": "dynamic", "components": components, "emphasis": "comparison_winner", "text_length": "1_sentence"}

    # Decision logic (priority order)
    if detected_symbol and not detected_category:
        # Clear ticker, no specific category keyword → stock analysis
        return {"category": "stock", "symbol": detected_symbol, "symbols": detected_symbols, "confidence": 0.88, "artifact_type": None, "layout": "dynamic", "components": ["HeroMetric", "FundamentalGrid", "RevenueProfitChart", "ShareholdingProgress", "VerdictCard"], "emphasis": "fundamentals_primary", "text_length": "2_sentences"}

    if detected_symbol and detected_category == "news":
        # e.g. "TCS latest news" or "Reliance update today"
        return {"category": "news", "symbol": detected_symbol, "symbols": detected_symbols, "confidence": 0.90, "artifact_type": "news_feed", "layout": "dynamic", "components": ["HeroMetric", "NewsFeed", "VerdictCard"], "emphasis": "news_primary", "text_length": "1_sentence"}

    if detected_symbol and detected_category == "general":
        # e.g. "What is Reliance PE" — still a stock query
        return {"category": "stock", "symbol": detected_symbol, "symbols": detected_symbols, "confidence": 0.85, "artifact_type": None, "layout": "dynamic", "components": ["HeroMetric", "FundamentalGrid", "ShareholdingProgress", "VerdictCard"], "emphasis": "fundamentals_primary", "text_length": "2_sentences"}

    if detected_category in ("portfolio", "market", "general") and not detected_symbol:
        # Clear non-stock category with no specific ticker
        FAST_MAP = {
            "portfolio": {"artifact_type": "portfolio_breakdown", "layout": "dynamic", "components": ["FundamentalGrid", "RankedList", "VerdictCard"], "emphasis": "fundamentals_primary", "text_length": "1_sentence"},
            "market": {"artifact_type": "screener_table", "layout": "dynamic", "components": ["RankedList", "FundamentalGrid"], "emphasis": "comparison_winner", "text_length": "null"},
            "general": {"artifact_type": "info_card", "layout": "dynamic", "components": ["FundamentalGrid", "SignalRow:expanded"], "emphasis": "education_first", "text_length": "3_sentences"},
        }
        mapping = FAST_MAP.get(detected_category, {})
        return {"category": detected_category, "symbol": None, "symbols": [], "confidence": 0.87, **mapping}

    # Ambiguous (e.g. "Should I invest in IT sector?") → let LLM handle it
    return None


# ---------------------------------------------------------------------------
# Node: Intent Classification
# ---------------------------------------------------------------------------

def classify_intent(state: AgentState) -> AgentState:
    """
    Phase 1: Rule-based complexity classification (zero API cost, <1ms).
    Phase 2 FAST PATH: regex classifier (<1ms) — handles ~80% of queries with zero API cost.
    Phase 2 SLOW PATH: LLM fallback (Gemma 4 31B) for ambiguous queries regex can't resolve.
    Sets query_complexity, intent_category, intent_symbol, intent_confidence.
    """
    # Phase 1 — keyword complexity classifier (zero API cost, <1ms)
    complexity = classify_query_complexity(state["query"])

    # Phase 2 — FAST PATH: try regex first (<1ms, zero API call)
    fast_result = _fast_classify(state["query"])
    if fast_result:
        logger.info(
            "classify_intent [FAST PATH] query=%r → %s / %s",
            state["query"][:60], fast_result["category"], fast_result["symbol"],
        )
        # Determine artifact_type: use fast_result hint OR derive from complexity
        _cat = fast_result["category"]
        _art = fast_result.get("artifact_type") or _determine_artifact_type(_cat, complexity)
        return {
            **state,
            "query_complexity":  complexity,
            "intent_category":   _cat,
            "intent_symbol":     fast_result["symbol"],
            "intent_symbols":    fast_result.get("symbols", []),
            "intent_confidence": fast_result["confidence"],
            "gathered_data":     {},
            "artifact_type":     _art,
            "artifact_layout":   fast_result.get("layout", "info_card"),
            "artifact_components": fast_result.get("components", []),
            "artifact_emphasis": fast_result.get("emphasis", "education_first"),
            "artifact_text_length": fast_result.get("text_length", "null"),
            "artifact_symbol":   fast_result["symbol"],
            "artifact_data":     None,
            "technicals_draft":  None,
            "news_draft":        None,
            "fundamentals_draft": None,
        }

    # Phase 2 — SLOW PATH: LLM call only for ambiguous queries regex couldn't resolve
    logger.info(
        "classify_intent [LLM PATH] query=%r — regex inconclusive, calling Gemma 4 31B",
        state["query"][:60],
    )
    messages = [
        SystemMessage(content=CLASSIFY_INTENT_SYSTEM_PROMPT),
        HumanMessage(content=f"Query: {state['query']}")
    ]
    try:
        raw = _invoke_with_fallback(
            "classify_intent", messages, complexity="simple",
            use_streaming=False,   # must be False — partial JSON would break json.loads
        )
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        _cat = parsed.get("category", "general")
        _art = parsed.get("artifact_type") or _determine_artifact_type(_cat, complexity)
        sym = parsed.get("symbol")
        syms = parsed.get("symbols", [])
        if sym and not syms:
            syms = [sym]

        return {
            **state,
            "query_complexity":  complexity,
            "intent_category":   _cat,
            "intent_symbol":     sym,
            "intent_symbols":    syms,
            "intent_confidence": parsed.get("confidence", 0.5),
            "gathered_data":     {},
            "artifact_type":     _art,
            "artifact_layout":   parsed.get("layout", "info_card"),
            "artifact_components": parsed.get("components", []),
            "artifact_emphasis": parsed.get("emphasis", "education_first"),
            "artifact_text_length": parsed.get("text_length", "null"),
            "artifact_symbol":   parsed.get("symbol"),
            "artifact_data":     None,
            "technicals_draft":  None,
            "news_draft":        None,
            "fundamentals_draft": None,
        }
    except Exception as e:
        return {
            **state,
            "query_complexity":  complexity,
            "intent_category":   "general",
            "intent_symbol":     None,
            "intent_confidence": 0.0,
            "gathered_data":     {},
            "artifact_type":     "info_card",
            "artifact_layout":   "education_explainer",
            "artifact_components": ["MetricGrid:2col", "SignalRow"],
            "artifact_emphasis": "education_first",
            "artifact_text_length": "3_sentences",
            "artifact_symbol":   None,
            "artifact_data":     None,
            "technicals_draft":  None,
            "news_draft":        None,
            "fundamentals_draft": None,
            "error":             f"Classification failed: {str(e)}"
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
    symbols = state.get("intent_symbols", [])

    # If classified as stock but no symbol extracted, treat as market/general
    if category == "stock" and not symbol and not symbols:
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

# ---------------------------------------------------------------------------
# Gap #4 Fix — Dedicated thread pool for data I/O (isolates from asyncio pool)
# Gap #2 Fix — TTL constants for per-component cache
# ---------------------------------------------------------------------------
_DATA_IO_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=20,
    thread_name_prefix="finsight_data_io",
)
_CACHE_TTL_PRICE     = 30    # seconds — live price (markets refresh every 15s)
_CACHE_TTL_SETUP     = 60    # seconds — RSI/MACD setup (computed from daily candles)
_CACHE_TTL_STRUCTURE = 120   # seconds — support/resistance (slow-moving levels)
_CACHE_TTL_NEWS      = 300   # seconds — RSS feed (doesn't change minute-by-minute)


async def gather_stock_data(state: AgentState) -> AgentState:
    symbols = state.get("intent_symbols", [])
    primary_symbol = state.get("intent_symbol")
    
    if primary_symbol and primary_symbol not in symbols:
        symbols.insert(0, primary_symbol)
        
    if not symbols:
        return {
            **state,
            "error": "No symbol extracted from query. Cannot fetch stock data.",
            "gathered_data": {}
        }

    loop = asyncio.get_event_loop()
    
    async def _fetch_single(sym: str) -> dict:
        key_price     = f"agent:price:{sym}"
        key_setup     = f"agent:setup:{sym}"
        key_structure = f"agent:structure:{sym}"
        key_news      = f"agent:news:{sym}"

        cached_stock     = _cache.get(key_price)
        cached_setup     = _cache.get(key_setup)
        cached_structure = _cache.get(key_structure)
        cached_news      = _cache.get(key_news)

        futures = {}
        if cached_stock     is None: futures["stock"]     = loop.run_in_executor(_DATA_IO_EXECUTOR, lambda: get_stock_data.invoke({"symbol": sym}))
        if cached_setup     is None: futures["setup"]     = loop.run_in_executor(_DATA_IO_EXECUTOR, lambda: detect_setup.invoke({"symbol": sym}))
        if cached_structure is None: futures["structure"] = loop.run_in_executor(_DATA_IO_EXECUTOR, lambda: get_market_structure.invoke({"symbol": sym}))
        if cached_news      is None: futures["news"]      = loop.run_in_executor(_DATA_IO_EXECUTOR, lambda: get_market_news.invoke({"symbol": sym, "limit": 5}))

        # NEW: Fetch financials and shareholding directly via data_provider
        futures["financials"] = data_provider._fetch_financials(sym)
        futures["shareholding"] = data_provider._fetch_shareholding(sym)

        fetched = {}
        if futures:
            fetch_keys = list(futures.keys())
            results    = await asyncio.gather(*futures.values(), return_exceptions=True)
            fetched    = dict(zip(fetch_keys, results))

            def _store(component_key, cache_key, ttl, fallback):
                val = fetched.get(component_key)
                if val is None or isinstance(val, Exception):
                    return fallback
                if cache_key: _cache.set(cache_key, val, ttl_seconds=ttl)
                return val

            cached_stock     = cached_stock or _store("stock",     key_price,     _CACHE_TTL_PRICE,     {})
            cached_setup     = cached_setup or _store("setup",     key_setup,     _CACHE_TTL_SETUP,     {})
            cached_structure = cached_structure or _store("structure", key_structure, _CACHE_TTL_STRUCTURE, {})
            cached_news      = cached_news or _store("news",      key_news,      _CACHE_TTL_NEWS,      [])
            
        financials_r = fetched.get("financials", {})
        shareholding_r = fetched.get("shareholding", {})

        def _safe(r, key, default):
            return r.get(key, default) if isinstance(r, dict) else default

        stock_r     = cached_stock     or {}
        setup_r     = cached_setup     or {}
        structure_r = cached_structure or {}
        news_r      = cached_news      or {}

        # Add shareholding to fundamentals
        fundamentals = {**_safe(stock_r, "stock_data", {}), "shareholding_pattern": shareholding_r}

        return {
            "symbol": sym,
            "stock_data":       _safe(stock_r,     "stock_data",       {}),
            "technicals":       _safe(stock_r,     "technicals",       {}),
            "fundamentals":     fundamentals,
            "financials":       financials_r,
            "trading_setup":    _safe(setup_r,     "setup",            None),
            "market_structure": _safe(structure_r, "market_structure", {}),
            "news_headlines":   _safe(news_r,      "articles",         []) if isinstance(news_r, dict) else [],
        }

    # Fetch all symbols concurrently
    all_results = await asyncio.gather(*[_fetch_single(sym) for sym in symbols], return_exceptions=True)
    
    valid_results = [r for r in all_results if not isinstance(r, Exception)]
    if not valid_results:
        return {**state, "error": f"Failed to fetch data for {symbols}", "gathered_data": {}}

    primary_data = valid_results[0]
    gathered = {
        "stock_data":       primary_data["stock_data"],
        "technicals":       primary_data["technicals"],
        "fundamentals":     primary_data["fundamentals"],
        "financials":       primary_data["financials"],
        "trading_setup":    primary_data["trading_setup"],
        "market_structure": primary_data["market_structure"],
        "news_headlines":   primary_data["news_headlines"],
        "compare":          valid_results if len(valid_results) > 1 else [],
    }
    
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
    Uses dynamic prompt builder and 3-attempt fallback via _invoke_with_fallback().
    """
    symbol = state.get("intent_symbol", "UNKNOWN")
    data = state.get("gathered_data", {})
    complexity = state.get("query_complexity", "complex")

    stock_data   = data.get("stock_data", {})
    technicals   = data.get("technicals", {})
    news         = data.get("news_headlines", [])
    setup        = data.get("trading_setup") or {}
    structure    = data.get("market_structure") or {}
    compare_data = data.get("compare", [])

    dynamic_user_prompt = build_analyst_prompt(
        symbol=symbol,
        stock_data=stock_data,
        technicals=technicals,
        news=news,
        setup=setup,
        structure=structure,
        original_query=state.get("query", ""),
        compare_data=compare_data,
    )

    messages = [
        SystemMessage(content=ANALYST_SYSTEM_PROMPT.format(symbol=symbol)),
        HumanMessage(content=ANALYST_USER_TEMPLATE.format(dynamic_prompt=dynamic_user_prompt)),
    ]

    try:
        content = _invoke_with_fallback("analyze_stock", messages, complexity, use_streaming=True)
        return {**state, "final_response": content}
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "rate_limit" in err_str.lower():
            fallback = (
                f"**⚠️ AI Analysis Temporarily Unavailable**\n\n"
                f"All models are rate-limited. Here is the raw data for **{symbol}**:\n\n"
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
    Uses 3-attempt fallback via _invoke_with_fallback().
    """
    data = state.get("gathered_data", {})
    articles = data.get("articles", [])
    original_query = state.get("query", "")
    complexity = state.get("query_complexity", "medium")

    news_user_prompt = build_news_prompt(
        articles=articles,
        original_query=original_query,
        query_mode="narrative",
    )

    messages = [
        SystemMessage(content=NEWS_SYNTHESIS_SYSTEM_PROMPT),
        HumanMessage(content=NEWS_SYNTHESIS_USER_TEMPLATE.format(news_prompt=news_user_prompt))
    ]

    try:
        content = _invoke_with_fallback("synthesize_news", messages, complexity, use_streaming=True)
        return {**state, "final_response": content}
    except Exception as e:
        return {**state, "final_response": f"News synthesis failed: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Node: Audit Portfolio
# ---------------------------------------------------------------------------

def audit_portfolio(state: AgentState) -> AgentState:
    """
    Calls the Portfolio Auditor prompt with gathered portfolio data.
    Uses 3-attempt fallback via _invoke_with_fallback().
    """
    data = state.get("gathered_data", {})
    complexity = state.get("query_complexity", "complex")

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
        content = _invoke_with_fallback("audit_portfolio", messages, complexity, use_streaming=True)
        return {**state, "final_response": content}
    except Exception as e:
        return {**state, "final_response": f"Portfolio audit failed: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Node: Handle General Query
# ---------------------------------------------------------------------------

def handle_general(state: AgentState) -> AgentState:
    """
    Calls the General Educator prompt.
    Uses 3-attempt fallback via _invoke_with_fallback().
    """
    query = state["query"]
    complexity = state.get("query_complexity", "complex")

    general_user_prompt = build_general_prompt(
        question=query,
        portfolio_context="None provided",
    )

    messages = [
        SystemMessage(content=GENERAL_EDUCATOR_SYSTEM_PROMPT),
        HumanMessage(content=GENERAL_EDUCATOR_USER_TEMPLATE.format(general_prompt=general_user_prompt))
    ]

    # General questions don't need DeepSeek V4 (COMPLEX). Qwen3.5 (MEDIUM) is
    # faster and fully capable for sector opinions and financial education.
    # Cap at "medium" — only fall to "simple" if that was the Phase 1 verdict.
    effective_complexity = "simple" if complexity == "simple" else "medium"

    try:
        content = _invoke_with_fallback("handle_general", messages, effective_complexity, use_streaming=True)
        return {**state, "final_response": content.strip()}
    except Exception as e:
        return {**state, "final_response": "I encountered an error processing your request. Please try again.", "error": str(e)}


# ---------------------------------------------------------------------------
# Node: Handle Market Screening (no specific symbol)
# ---------------------------------------------------------------------------

async def handle_market(state: AgentState) -> AgentState:
    """
    Handles screening/discovery queries where no specific stock is named.
    Market Screener node. Scans a universe of NSE stocks for trading setups.
    Returns the top setups directly (terminal node, no Phase 4).
    """
    import asyncio
    from langchain_core.messages import SystemMessage, HumanMessage
    from datetime import datetime

    fetch_time = datetime.now().isoformat()
    SCREEN_UNIVERSE = [
        "RELIANCE.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS", "TCS.NS",
        "ITC.NS", "LT.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS", "TATAMOTORS.NS"
    ]
    
    screened = []
    fetch_errors = []

    async def _fetch_one(sym: str):
        try:
            loop = asyncio.get_event_loop()
            stock_r, setup_r = await asyncio.gather(
                loop.run_in_executor(None, lambda: get_stock_data.invoke({"symbol": sym})),
                loop.run_in_executor(None, lambda: detect_setup.invoke({"symbol": sym})),
                return_exceptions=True
            )
            if isinstance(stock_r, Exception) or (isinstance(stock_r, dict) and stock_r.get("error")):
                return {"error": True, "symbol": sym}
            setup = setup_r.get("setup", {}) if isinstance(setup_r, dict) and not setup_r.get("error") else {}
            sd   = stock_r.get("stock_data", {})
            tech = stock_r.get("technicals", {})
            return {
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
            }
        except Exception as e:
            return {"error": True, "symbol": sym, "reason": str(e)}

    try:
        results = await asyncio.gather(*[_fetch_one(sym) for sym in SCREEN_UNIVERSE])
    except Exception as e:
        logger.error(f"[handle_market] Parallel fetch failed, falling back to sequential: {e}", exc_info=True)
        results = []
        for sym in SCREEN_UNIVERSE:
            try:
                r = get_stock_data.invoke({"symbol": sym})
                sd, tech = r.get("stock_data", {}), r.get("technicals", {})
                s = detect_setup.invoke({"symbol": sym}).get("setup", {})
                results.append({"symbol": sym, "price": sd.get("current_price"),
                                 "rsi": tech.get("rsi"), "setup_name": s.get("name", "")})
            except Exception as ex:
                results.append({"error": True, "symbol": sym, "reason": str(ex)})

    for r in results:
        if r.get("error"):
            fetch_errors.append(r.get("symbol", "unknown"))
        else:
            screened.append(r)

    # Build the data payload for the LLM
    screened_data_str = json.dumps({
        "fetch_timestamp": fetch_time,
        "stocks_screened": len(screened),
        "fetch_errors": fetch_errors,
        "data": screened,
    }, indent=2)

    llm_complexity = state.get("query_complexity", "complex")
    messages = [
        SystemMessage(content=MARKET_SCREENER_SYSTEM_PROMPT),
        HumanMessage(content=MARKET_SCREENER_USER_TEMPLATE.format(
            query=state["query"],
            screened_data=screened_data_str,
        ))
    ]

    try:
        content = _invoke_with_fallback("handle_market", messages, llm_complexity, use_streaming=True)
        return {**state, "final_response": content, "gathered_data": {"screened_stocks": screened}}
    except Exception as e:
        return {**state, "final_response": f"Could not answer: {str(e)}", "error": str(e)}


# ---------------------------------------------------------------------------
# Phase 4 — Parallel Specialist LLM Nodes
# Three nodes run concurrently via asyncio.gather, then a Sequencer assembles
# the final artifact_data dict. Uses existing _invoke_with_fallback (no Groq).
# ---------------------------------------------------------------------------


async def phase4_technicals_node(state: AgentState) -> AgentState:
    """
    Phase 4 specialist: Technical Analysis.
    EXPLICIT MODEL: Gemini 2.5 Flash (fast + cheap, no Qwen quota used here).
    Fallback: Flash pool (keys 1,2,3,6,7).
    """
    data = state.get("gathered_data", {})
    symbol = state.get("intent_symbol", "UNKNOWN")
    technicals = data.get("technicals", {}) or data.get("technical_indicators", {})
    stock_data = data.get("stock_data", {}) or data.get("live_price", {})
    setup = data.get("trading_setup") or data.get("setup") or {}
    structure = data.get("market_structure") or {}

    prompt = f"""You are a technical analysis expert. Analyze the following data for {symbol} and return ONLY a JSON object.

Data:
Price: {stock_data}
Technicals: {technicals}
Setup: {setup}
Structure: {structure}

Return EXACTLY this JSON (no markdown, no explanation):
{{"trend": "BULLISH|BEARISH|NEUTRAL", "rsi_value": <float>, "rsi_signal": "OVERBOUGHT|OVERSOLD|NEUTRAL",
  "key_support": <float_or_null>, "key_resistance": <float_or_null>,
  "setup_name": "<string>", "setup_confidence": <0-100_or_null>,
  "macd_trend": "BULLISH|BEARISH|NEUTRAL", "brief_text": "<1 sentence>",
  "entry": <float_or_null>, "stop_loss": <float_or_null>, "target_1": <float_or_null>}}"""

    messages = [SystemMessage(content="You are a quantitative technical analyst. Return pure JSON only."),
                HumanMessage(content=prompt)]
    cfg = _NODE_CONFIG["analyze_stock"]
    temperature = round(random.uniform(0.20, 0.35), 3)
    try:
        # ── EXPLICIT: Always use Gemini Flash for technical analysis ──
        raw = await asyncio.get_event_loop().run_in_executor(
            _DATA_IO_EXECUTOR,
            lambda: _GEMINI_FLASH_POOL.invoke(messages, cfg, temperature, streaming=False)
        )
        _tech_fallback = {"trend": "NEUTRAL", "rsi_value": None, "rsi_signal": "NEUTRAL",
                          "key_support": None, "key_resistance": None, "setup_name": "No Setup",
                          "setup_confidence": None, "macd_trend": "NEUTRAL",
                          "brief_text": "Technical analysis complete.", "entry": None,
                          "stop_loss": None, "target_1": None}
        draft = _extract_json(raw, fallback=_tech_fallback)
        logger.info("[Phase4-Technicals/GeminiFlash] OK for %s", symbol)
        return {**state, "technicals_draft": draft}
    except Exception as e:
        logger.warning("[Phase4-Technicals] Flash failed, trying Gemma pool: %s", e)
        try:
            raw = await asyncio.get_event_loop().run_in_executor(
                _DATA_IO_EXECUTOR,
                lambda: _GEMMA_POOL.invoke(messages, cfg, temperature, streaming=False)
            )
            return {**state, "technicals_draft": _extract_json(raw, fallback={
                "trend": "NEUTRAL", "rsi_value": None, "rsi_signal": "NEUTRAL",
                "key_support": None, "key_resistance": None, "setup_name": "No Setup",
                "setup_confidence": None, "macd_trend": "NEUTRAL",
                "brief_text": "Analysis unavailable due to rate limits.",
                "entry": None, "stop_loss": None, "target_1": None
            })}
        except Exception as e2:
            logger.warning("[Phase4-Technicals] All flash pools failed: %s", e2)
            return {**state, "technicals_draft": {
                "trend": "NEUTRAL",
                "rsi_value": None,
                "rsi_signal": "NEUTRAL",
                "key_support": None,
                "key_resistance": None,
                "setup_name": "No Setup",
                "setup_confidence": None,
                "macd_trend": "NEUTRAL",
                "brief_text": "Analysis unavailable due to rate limits.",
                "entry": None,
                "stop_loss": None,
                "target_1": None
            }}


async def phase4_news_node(state: AgentState) -> AgentState:
    """
    Phase 4 specialist: News Sentiment.
    EXPLICIT MODEL: Gemini 2.5 Flash (fast + cheap, no Qwen quota used here).
    Fallback: Gemma pool.
    """
    data = state.get("gathered_data", {})
    symbol = state.get("intent_symbol", "UNKNOWN")
    articles = (data.get("news_headlines") or {}).get("articles", []) or data.get("news_headlines", [])
    if isinstance(articles, dict):
        articles = articles.get("articles", [])

    headlines_text = "\n".join(
        f"- {a.get('title', '')} [{a.get('source', '')}]" for a in articles[:8]
    ) if articles else "No recent news available."

    prompt = f"""Analyze news sentiment for {symbol}. Return ONLY JSON.

Headlines:
{headlines_text}

Return EXACTLY:
{{"overall_sentiment": "POSITIVE|NEGATIVE|NEUTRAL|MIXED",
  "sentiment_score": <-1.0_to_1.0>,
  "key_theme": "<main topic>",
  "bullish_headline": "<most positive title or null>",
  "bearish_headline": "<most negative title or null>",
  "headline_count": {len(articles)},
  "brief_text": "<1 sentence summary>"}}"""

    messages = [SystemMessage(content="You are a financial news analyst. Return pure JSON only."),
                HumanMessage(content=prompt)]
    cfg = _NODE_CONFIG["synthesize_news"]
    temperature = round(random.uniform(0.20, 0.35), 3)
    try:
        # ── EXPLICIT: Always use Gemini Flash for news sentiment ──
        raw = await asyncio.get_event_loop().run_in_executor(
            _DATA_IO_EXECUTOR,
            lambda: _GEMINI_FLASH_POOL.invoke(messages, cfg, temperature, streaming=False)
        )
        _news_fallback = {"overall_sentiment": "NEUTRAL", "sentiment_score": 0.0,
                          "key_theme": "No data", "bullish_headline": None,
                          "bearish_headline": None, "headline_count": len(articles),
                          "brief_text": "News sentiment complete."}
        draft = _extract_json(raw, fallback=_news_fallback)
        logger.info("[Phase4-News/GeminiFlash] OK for %s", symbol)
        return {**state, "news_draft": draft}
    except Exception as e:
        logger.warning("[Phase4-News] Flash failed, trying Gemma pool: %s", e)
        try:
            raw = await asyncio.get_event_loop().run_in_executor(
                _DATA_IO_EXECUTOR,
                lambda: _GEMMA_POOL.invoke(messages, cfg, temperature, streaming=False)
            )
            return {**state, "news_draft": _extract_json(raw, fallback={
                "overall_sentiment": "NEUTRAL", "sentiment_score": 0.0,
                "key_theme": "No data", "bullish_headline": None,
                "bearish_headline": None, "headline_count": 0,
                "brief_text": "News analysis unavailable due to rate limits."
            })}
        except Exception as e2:
            logger.warning("[Phase4-News] All flash pools failed: %s", e2)
            return {**state, "news_draft": {
                "overall_sentiment": "NEUTRAL",
                "sentiment_score": 0.0,
                "key_theme": "No data",
                "bullish_headline": None,
                "bearish_headline": None,
                "headline_count": 0,
                "brief_text": "News analysis unavailable due to rate limits."
            }}


async def phase4_fundamentals_node(state: AgentState) -> AgentState:
    """
    Phase 4 specialist: Fundamental Analysis.
    Gap #1 Fix: Bypasses the hanging Qwen/NVIDIA pool entirely.
    PRIMARY:  Gemini Flash pool (all 7 keys, fast + reliable)
    FALLBACK: Gemma pool (second pool of Flash keys)
    FUTURE:   DeepSeek V3 stub — uncomment when API key is provided.
    """
    data = state.get("gathered_data", {})
    symbol = state.get("intent_symbol", "UNKNOWN")
    fundamentals = data.get("fundamentals") or data.get("stock_data", {})
    revenue = data.get("revenue_pnl_quarterly") or {}
    shareholding = data.get("shareholding_pattern") or {}

    prompt = f"""You are a fundamental analyst for Indian equity markets. Return ONLY JSON.

Symbol: {symbol}
Fundamentals: {json.dumps(fundamentals, default=str)[:800]}
Revenue/PnL (quarterly): {json.dumps(revenue, default=str)[:500]}
Shareholding: {json.dumps(shareholding, default=str)[:300]}

Return EXACTLY:
{{"valuation": "UNDERVALUED|FAIRLY_VALUED|OVERVALUED",
  "pe_ratio": <float_or_null>,
  "revenue_trend": "GROWING|STABLE|DECLINING",
  "profit_trend": "GROWING|STABLE|DECLINING",
  "debt_health": "HEALTHY|MODERATE|HIGH_DEBT",
  "promoter_holding_note": "<string or null>",
  "market_cap_category": "LARGE_CAP|MID_CAP|SMALL_CAP",
  "shareholding_health": "STRONG|MODERATE|WEAK",
  "pe_vs_sector": "CHEAP|FAIR|EXPENSIVE",
  "brief_text": "<1-2 sentence fundamental summary>"}}"""

    messages = [SystemMessage(content="You are an Indian equity fundamental analyst. Return pure JSON only."),
                HumanMessage(content=prompt)]
    cfg = _NODE_CONFIG["analyze_stock"]
    temperature = round(random.uniform(0.28, 0.40), 3)

    _fund_fallback = {
        "valuation": "FAIRLY_VALUED", "pe_ratio": None,
        "revenue_trend": "STABLE", "profit_trend": "STABLE",
        "debt_health": "MODERATE", "promoter_holding_note": None,
        "market_cap_category": "MID_CAP", "shareholding_health": "MODERATE",
        "pe_vs_sector": "FAIR",
        "brief_text": "Fundamental analysis unavailable due to rate limits."
    }

    # ── PRIMARY: Gemini 2.5 Flash FULL (deeper reasoning for financial fundamentals) ──
    try:
        raw = await asyncio.get_event_loop().run_in_executor(
            _DATA_IO_EXECUTOR,
            lambda: _GEMINI_FLASH_FUNDAMENTALS_POOL.invoke(messages, cfg, temperature, streaming=False)
        )
        draft = _extract_json(raw, fallback=_fund_fallback)
        logger.info("[Phase4-Fundamentals/GeminiFlash-FULL] OK for %s", symbol)
        return {**state, "fundamentals_draft": draft}
    except Exception as e:
        logger.warning("[Phase4-Fundamentals] Flash-Full failed, trying Flash-Lite fallback: %s", e)

    # ── FALLBACK: Flash-Lite pool (fast, still capable) ───────────────────────────
    try:
        raw = await asyncio.get_event_loop().run_in_executor(
            _DATA_IO_EXECUTOR,
            lambda: _GEMINI_FLASH_POOL.invoke(messages, cfg, temperature, streaming=False)
        )
        draft = _extract_json(raw, fallback=_fund_fallback)
        logger.info("[Phase4-Fundamentals/FlashLite-fallback] OK for %s", symbol)
        return {**state, "fundamentals_draft": draft}
    except Exception as e2:
        logger.warning("[Phase4-Fundamentals] All pools failed: %s", e2)

    # ── FUTURE STUB: DeepSeek V3 (uncomment when settings.deepseek_api_key is set) ──
    # try:
    #     from langchain_openai import ChatOpenAI as _DSChat
    #     _ds = _DSChat(model="deepseek-chat",
    #                   openai_api_base="https://api.deepseek.com/v1",
    #                   openai_api_key=settings.deepseek_api_key,
    #                   max_tokens=1024, timeout=20, max_retries=0)
    #     resp = await asyncio.get_event_loop().run_in_executor(
    #         _DATA_IO_EXECUTOR, lambda: _ds.invoke(messages))
    #     return {**state, "fundamentals_draft": _extract_json(resp.content, fallback=_fund_fallback)}
    # except Exception as e3:
    #     logger.warning("[Phase4-Fundamentals] DeepSeek also failed: %s", e3)

    return {**state, "fundamentals_draft": _fund_fallback}


async def phase4_sequencer_node(state: AgentState) -> AgentState:
    """
    Phase 4 sequencer: Assembles verdict from 3 parallel drafts.
    Runs AFTER all 3 specialist nodes complete.
    Emits: artifact_data (fully assembled), verdict slot.
    """
    symbol = state.get("intent_symbol", "UNKNOWN")
    technicals = state.get("technicals_draft") or {}
    news = state.get("news_draft") or {}
    fundamentals = state.get("fundamentals_draft") or {}

    # Compute combined verdict
    t_trend = technicals.get("trend", "NEUTRAL")
    n_sent  = news.get("overall_sentiment", "NEUTRAL")
    f_val   = fundamentals.get("valuation", "FAIRLY_VALUED")

    # Score: +1 = bullish/positive/undervalued, -1 = bearish/negative/overvalued
    score = 0
    if t_trend == "BULLISH":    score += 1
    elif t_trend == "BEARISH":  score -= 1
    if n_sent in ("POSITIVE",): score += 1
    elif n_sent in ("NEGATIVE",): score -= 1
    if f_val == "UNDERVALUED":  score += 1
    elif f_val == "OVERVALUED": score -= 1

    overall = "STRONG_BUY" if score >= 2 else "BUY" if score == 1 else "SELL" if score <= -2 else "REDUCE" if score == -1 else "HOLD"

    verdict = {
        "technical": t_trend,
        "news": "BUY" if n_sent in ("POSITIVE",) else "SELL" if n_sent in ("NEGATIVE",) else "NEUTRAL",
        "fundamental": f_val,
        "overall": overall,
        "score": score,
    }

    gathered_data = state.get("gathered_data", {})
    financials = gathered_data.get("financials", {})
    compare = gathered_data.get("compare", [])

    artifact_data = {
        "type": state.get("artifact_type", "full_analysis"),
        "symbol": symbol,
        "technicals": technicals,
        "news": news,
        "fundamentals": fundamentals,
        "financials": financials,
        "compare": compare,
        "verdict": verdict,
    }
    logger.info("[Phase4-Sequencer] Verdict=%s for %s (score=%d)", overall, symbol, score)
    return {**state, "artifact_data": artifact_data}


async def run_phase4_parallel(state: AgentState) -> AgentState:
    """
    Runs phase4_technicals_node, phase4_news_node, and phase4_fundamentals_node
    concurrently via asyncio.gather, then calls the sequencer.

    Called from agent.py AFTER gather_stock_data and analyze_stock complete,
    so the gathered_data dict is fully populated.
    Does NOT modify final_response — purely additive.
    """
    from app.core.config import settings as _settings
    if not _settings.enable_parallel_phase4:
        logger.info("[Phase4] Disabled via enable_parallel_phase4=False")
        return state

    try:
        t_state, n_state, f_state = await asyncio.gather(
            phase4_technicals_node(state),
            phase4_news_node(state),
            phase4_fundamentals_node(state),
            return_exceptions=False,
        )
        # Merge the three partial states into one
        merged = {
            **state,
            "technicals_draft":  t_state.get("technicals_draft"),
            "news_draft":        n_state.get("news_draft"),
            "fundamentals_draft": f_state.get("fundamentals_draft"),
        }
        return await phase4_sequencer_node(merged)
    except Exception as e:
        logger.error("[Phase4] Parallel run failed: %s", e)
        # Silently return original state — final_response is still valid
        return state


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
