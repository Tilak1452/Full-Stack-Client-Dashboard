from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import math
from app.services.stock_service import stock_service

router = APIRouter(prefix="/api/v1/stock", tags=["Stock"])

# Known US tickers that should NOT get .NS appended
_KNOWN_US = {'AAPL','MSFT','GOOGL','GOOG','AMZN','TSLA','NVDA','META','NFLX','AMD',
             'INTC','PYPL','DIS','BA','JPM','V','MA','WMT','PG','UNH','JNJ','HD'}
_SUFFIXES = ('.NS','.BO','.L','.AX','.TO','.HK','.SS','.SZ')

def _auto_suffix(symbol: str) -> str:
    """Append .NS to bare Indian tickers for Yahoo Finance compatibility."""
    s = symbol.upper().strip()
    if any(s.endswith(x) for x in _SUFFIXES):
        return s
    if s.startswith('^'):       # index symbols like ^NSEI
        return s
    if s in _KNOWN_US:
        return s
    return f"{s}.NS"


def _sanitize(obj):
    """Replace NaN/Inf floats and non-serializable types with JSON-safe values."""
    import datetime as _dt
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, (_dt.datetime, _dt.date)):
        return obj.isoformat()
    # Handle numpy types that sneak through from pandas
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            return None if math.isnan(v) or math.isinf(v) else v
        if isinstance(obj, np.ndarray):
            return _sanitize(obj.tolist())
    except ImportError:
        pass
    return obj


@router.get("/{symbol}")
async def get_stock_full(symbol: str):
    """
    Returns price data + RSI/SMA/EMA indicators.
    Symbol is uppercased and .NS suffix auto-appended for Indian stocks.
    """
    symbol = _auto_suffix(symbol)
    try:
        data = stock_service.get_full_stock_data(symbol)
        return JSONResponse(content=_sanitize(data))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock data: {str(e)}")


@router.get("/{symbol}/history")
async def get_stock_history(
    symbol: str,
    period: str = Query(default="6mo", description="yfinance period: 5d, 15d, 60d, 6mo, 2y"),
    interval: str = Query(default="1d", description="yfinance interval: 5m, 15m, 60m, 1d"),
    include_indicators: bool = Query(default=False, description="Include all 8 technical indicators per candle"),
):
    """
    Returns OHLCV historical candle data.
    When include_indicators=True, also returns enriched candles with RSI, MACD, Bollinger, etc.
    """
    symbol = _auto_suffix(symbol)
    try:
        result = stock_service.get_historical_data(
            symbol, period=period, interval=interval, include_indicators=include_indicators
        )
        # For backward compat: enriched responses already have 'candles' key
        if include_indicators and "candles" in result:
            return JSONResponse(content=_sanitize(result))
        # Basic response: rename 'data' to 'candles' for frontend consistency
        return JSONResponse(content=_sanitize({"symbol": symbol, "period": period, "interval": interval, "candles": result.get("data", [])}))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/{symbol}/fundamentals")
async def get_stock_fundamentals(symbol: str):
    """
    Returns fundamental data: PE, PB, ROE, quarterly financials,
    shareholding pattern, and earnings calendar.

    Fetches 4 yfinance data sources in parallel using asyncio.gather.
    Expected latency: ~2.0–3.5s.
    """
    symbol = _auto_suffix(symbol)
    try:
        data = await stock_service.get_fundamentals(symbol)
        return JSONResponse(content=_sanitize(data))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch fundamentals: {str(e)}")
