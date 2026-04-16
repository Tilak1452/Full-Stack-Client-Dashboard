from fastapi import APIRouter, HTTPException, Query
from app.services.stock_service import stock_service

router = APIRouter(prefix="/api/v1/stock", tags=["Stock"])

@router.get("/{symbol}")
async def get_stock_full(symbol: str):
    """
    Returns price data + RSI/SMA/EMA indicators.
    Symbol is uppercased automatically.
    """
    symbol = symbol.upper().strip()
    try:
        data = stock_service.get_full_stock_data(symbol)
        return data
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
    symbol = symbol.upper().strip()
    try:
        result = stock_service.get_historical_data(
            symbol, period=period, interval=interval, include_indicators=include_indicators
        )
        # For backward compat: enriched responses already have 'candles' key
        if include_indicators and "candles" in result:
            return result
        # Basic response: rename 'data' to 'candles' for frontend consistency
        return {"symbol": symbol, "period": period, "interval": interval, "candles": result.get("data", [])}
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
    symbol = symbol.upper().strip()
    try:
        data = await stock_service.get_fundamentals(symbol)
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch fundamentals: {str(e)}")
