"""
FinSight AI Agent Tools
All @tool functions available to the LangGraph agent.
Each tool wraps existing services and returns structured dicts.
"""

import json
from datetime import datetime, timedelta
from typing import Optional
from langchain_core.tools import tool

# Import existing services — these already exist in the project
from app.services.stock_service import StockService
from app.services.news_service import NewsService
from app.services.setup_engine import detect_trading_setup
from app.services.market_structure import analyze_market_structure

# Instantiate services once (they are stateless)
_stock_service = StockService()
_news_service = NewsService()

# ─── Yahoo Finance .NS suffix helper ──────────────────────────────────────────
# Indian NSE stocks require '.NS' suffix for yfinance to return data.
_EXCHANGE_SUFFIXES = ('.NS', '.BO', '.L', '.AX', '.TO', '.HK', '.SS', '.SZ')
_KNOWN_US_TICKERS = {'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'NVDA',
                     'META', 'NFLX', 'AMD', 'INTC', 'PYPL', 'DIS', 'BA',
                     'JPM', 'V', 'MA', 'WMT', 'PG', 'UNH', 'JNJ', 'HD'}

def _ensure_ns_suffix(symbol: str) -> str:
    """Append .NS to bare Indian tickers for Yahoo Finance compatibility.
    US tickers and already-suffixed symbols pass through unchanged."""
    symbol = symbol.strip().upper()
    # Already has exchange suffix → pass through
    if any(symbol.endswith(s) for s in _EXCHANGE_SUFFIXES):
        return symbol
    # Known US ticker → pass through
    if symbol in _KNOWN_US_TICKERS:
        return symbol
    # Default: assume NSE Indian stock
    return f"{symbol}.NS"


@tool
def get_stock_data(symbol: str) -> dict:
    """
    Fetch full stock data for a given symbol including current price,
    previous close, market cap, P/E ratio, RSI, SMA, EMA, day high/low,
    MACD, Bollinger Bands, volume ratio, ATR, and exchange.

    Args:
        symbol: Stock ticker symbol (e.g. 'RELIANCE.NS', 'TCS.NS', 'AAPL')

    Returns:
        Dict with stock_data and technicals sub-keys, or error dict.
    """
    try:
        symbol = _ensure_ns_suffix(symbol)
        data = _stock_service.get_full_stock_data(symbol)
        if data is None:
            return {
                "error": True,
                "symbol": symbol,
                "message": f"No data found for symbol {symbol}. It may be delisted or the ticker is incorrect."
            }
        return {
            "error": False,
            "symbol": symbol,
            "stock_data": {
                "symbol": symbol,
                "current_price": data.get("current_price"),
                "previous_close": data.get("previous_close"),
                "market_cap": data.get("market_cap"),
                "pe_ratio": data.get("pe_ratio"),
                "day_high": data.get("day_high"),
                "day_low": data.get("day_low"),
                "exchange": data.get("exchange"),
            },
            "technicals": {
                "rsi": data.get("rsi"),
                "sma_20": data.get("sma_20"),
                "ema_20": data.get("ema_20"),
                "macd": data.get("macd"),
                "macd_signal": data.get("macd_signal"),
                "bollinger_upper": data.get("bollinger_upper"),
                "bollinger_lower": data.get("bollinger_lower"),
                "volume_ratio": data.get("volume_ratio"),
                "atr": data.get("atr"),
            }
        }
    except Exception as e:
        return {
            "error": True,
            "symbol": symbol,
            "message": f"Failed to fetch stock data: {str(e)}"
        }


@tool
def get_stock_history(symbol: str, period: str = "3mo") -> dict:
    """
    Fetch historical OHLCV (Open, High, Low, Close, Volume) candle data
    for charting and market structure analysis.

    Args:
        symbol: Stock ticker symbol (e.g. 'RELIANCE.NS')
        period: Time period — one of: '1mo', '3mo', '6mo', '1y', '5y'

    Returns:
        Dict with candles list or error dict.
    """
    valid_periods = ["1mo", "3mo", "6mo", "1y", "5y"]
    if period not in valid_periods:
        period = "3mo"
    try:
        symbol = _ensure_ns_suffix(symbol)
        candles = _stock_service.get_historical_data(symbol, period=period, interval="1d")
        if not candles:
            return {
                "error": True,
                "symbol": symbol,
                "message": f"No historical data found for {symbol} over period {period}."
            }
        return {
            "error": False,
            "symbol": symbol,
            "period": period,
            "candle_count": len(candles),
            "candles": candles
        }
    except Exception as e:
        return {
            "error": True,
            "symbol": symbol,
            "message": f"Failed to fetch historical data: {str(e)}"
        }


@tool
def get_market_news(symbol: Optional[str] = None, limit: int = 10) -> dict:
    """
    Fetch recent financial news articles. If a symbol is provided,
    fetches symbol-specific news. Otherwise fetches general market news.

    Args:
        symbol: Optional stock ticker. If None, fetches general market news.
        limit: Number of articles to return (1-20).

    Returns:
        Dict with articles list and count.
    """
    limit = max(1, min(20, limit))
    try:
        if symbol:
            symbol = symbol.strip().upper()
            # Strip exchange suffix for cleaner news results (RELIANCE.NS -> RELIANCE)
            clean_symbol = symbol.split('.')[0] if '.' in symbol else symbol
            result = _news_service.get_news_for_symbol(clean_symbol, limit=limit)
            # get_news_for_symbol returns a NewsResponse object, extract .articles list
            articles_raw = result.articles if hasattr(result, 'articles') else result
        else:
            articles_raw = _news_service.get_news(limit=limit)

        serializable = []
        for a in articles_raw:
            sent = a.sentiment if hasattr(a, "sentiment") else a.get("sentiment", "neutral")
            sent_str = str(sent).upper() if sent else "NEUTRAL"
            # Map sentiment to spec labels: POSITIVE / NEGATIVE / NEUTRAL
            if sent_str in ("POSITIVE", "POS") or (isinstance(sent, (int, float)) and sent > 0.05):
                sentiment_label = "POSITIVE"
            elif sent_str in ("NEGATIVE", "NEG") or (isinstance(sent, (int, float)) and sent < -0.05):
                sentiment_label = "NEGATIVE"
            else:
                sentiment_label = "NEUTRAL"
            serializable.append({
                "title": a.title if hasattr(a, "title") else a.get("title", ""),
                "source": a.source if hasattr(a, "source") else a.get("source", ""),
                "sentiment": sent,
                "sentiment_label": sentiment_label,
                "published_at": str(a.published_at if hasattr(a, "published_at") else a.get("published_at", "")),
                "summary": a.summary if hasattr(a, "summary") else a.get("summary", ""),
            })

        return {
            "error": False,
            "symbol": symbol,
            "count": len(serializable),
            "articles": serializable
        }
    except Exception as e:
        return {
            "error": True,
            "symbol": symbol,
            "message": f"Failed to fetch news: {str(e)}"
        }


@tool
def detect_setup(symbol: str) -> dict:
    """
    Detect a trading setup for the given stock using pure Python logic.
    Checks for: RSI Recovery Setup, Volume Breakout Setup, Trend Continuation Setup.
    Returns entry price, stop loss, target prices, and risk/reward ratio.

    Args:
        symbol: Stock ticker symbol (e.g. 'RELIANCE.NS')

    Returns:
        Dict with detected setup details or a 'No Clear Setup' result.
    """
    try:
        symbol = _ensure_ns_suffix(symbol)
        stock_data = _stock_service.get_full_stock_data(symbol)
        hist = _stock_service.get_historical_data(symbol, period="3mo", interval="1d")

        # get_historical_data returns a dict with 'data' key containing the candle list
        candles = hist.get("data", []) if isinstance(hist, dict) else hist

        if not stock_data or not candles:
            return {
                "error": True,
                "symbol": symbol,
                "message": f"Insufficient data to detect setup for {symbol}."
            }

        result = detect_trading_setup(stock_data=stock_data, candles=candles)
        return {
            "error": False,
            "symbol": symbol,
            "setup": result
        }
    except Exception as e:
        return {
            "error": True,
            "symbol": symbol,
            "message": f"Setup detection failed: {str(e)}"
        }


@tool
def get_market_structure(symbol: str) -> dict:
    """
    Analyze the market structure of a stock using the last 50 candles.
    Returns trend direction, key support/resistance levels, and trader bias.

    Args:
        symbol: Stock ticker symbol (e.g. 'RELIANCE.NS')

    Returns:
        Dict with trend, key_resistance, key_support, distances, and trader_bias.
    """
    try:
        symbol = _ensure_ns_suffix(symbol)
        hist = _stock_service.get_historical_data(symbol, period="6mo", interval="1d")
        # get_historical_data returns a dict with 'data' key containing the candle list
        candles = hist.get("data", []) if isinstance(hist, dict) else hist

        if not candles or len(candles) < 20:
            return {
                "error": True,
                "symbol": symbol,
                "message": f"Need at least 20 candles for market structure analysis. Only {len(candles) if candles else 0} found."
            }

        result = analyze_market_structure(candles=candles[-50:])
        return {
            "error": False,
            "symbol": symbol,
            "market_structure": result
        }
    except Exception as e:
        return {
            "error": True,
            "symbol": symbol,
            "message": f"Market structure analysis failed: {str(e)}"
        }


# List of all tools available to the agent graph
ALL_TOOLS = [
    get_stock_data,
    get_stock_history,
    get_market_news,
    detect_setup,
    get_market_structure,
]
