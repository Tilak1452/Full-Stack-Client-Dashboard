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
    period: str = Query(default="1mo", description="yfinance period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 5y"),
    interval: str = Query(default="1d", description="yfinance interval: 1m, 5m, 1h, 1d, 1wk")
):
    """
    Returns OHLCV historical candle data only, for charting.
    """
    symbol = symbol.upper().strip()
    try:
        # stock_service.get_historical_data is synchronous according to the actual implementation.
        candles = stock_service.get_historical_data(symbol, period=period, interval=interval)
        return {"symbol": symbol, "period": period, "interval": interval, "candles": candles.get("data", [])}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")
