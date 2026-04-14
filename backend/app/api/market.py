from fastapi import APIRouter
from app.services.stock_service import stock_service
import asyncio

router = APIRouter(prefix="/api/v1", tags=["Market"])

# yFinance ticker symbols for Indian market indices
INDICES_MAP = [
    {"name": "NIFTY 50",   "ticker": "^NSEI"},
    {"name": "SENSEX",     "ticker": "^BSESN"},
    {"name": "NIFTY BANK", "ticker": "^NSEBANK"},
    {"name": "NIFTY IT",   "ticker": "NIFTY_IT.NS"},
]

@router.get("/indices")
async def get_market_indices():
    """
    Returns current price and daily change for the 4 Indian market indices.
    Uses the existing stock_service which already handles circuit breaker and retry.
    Returns partial results if some indices fail — never returns an error for the whole endpoint.
    """
    results = []
    for index in INDICES_MAP:
        try:
            # stock_service is synchronous in the actual codebase.
            data = stock_service.get_current_price(index["ticker"])
            results.append({
                "name": index["name"],
                "ticker": index["ticker"],
                "price": data.get("price"),
                "change_pct": data.get("change_pct", 0),
                "up": data.get("change_pct", 0) >= 0,
                "day_high": data.get("day_high"),
                "day_low": data.get("day_low"),
                "market_state": data.get("market_state", "CLOSED"),
            })
        except Exception:
            results.append({
                "name": index["name"],
                "ticker": index["ticker"],
                "price": None,
                "change_pct": None,
                "up": None,
                "error": True,
            })
    return {"indices": results}

MOVERS_BASKET = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", 
    "ICICIBANK.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS",
    "LARSEN.NS", "BAJFINANCE.NS"
]

@router.get("/movers")
async def get_top_movers():
    """
    Returns top 2 gainers and top 2 losers from a predefined basket of large cap Indian stocks.
    """
    results = []
    # Fetch current price for all in basket sequentially (can be slow, but fast_info is typically <100ms each)
    for ticker in MOVERS_BASKET:
        try:
            data = stock_service.get_current_price(ticker)
            price = data.get("price")
            chg_pct = data.get("change_pct")
            
            # Since fast_info doesn't easily expose 'change_pct', we must dynamically compute it using previous_close
            prev_close = data.get("previous_close")
            if price and prev_close and prev_close > 0:
                chg_pct = ((price - prev_close) / prev_close) * 100
            elif chg_pct is None:
                chg_pct = 0
                
            results.append({
                "sym": ticker.split(".")[0],
                "vol": f"{data.get('volume', 0) / 1e6:.1f}M",  # Formatting for UI, though volume isn't returned by fast_info natively
                "chg": f"{'+' if chg_pct >= 0 else ''}{chg_pct:.2f}%",
                "up": chg_pct >= 0,
                "chg_pct": chg_pct  # For sorting
            })
        except Exception:
            continue
            
    # Sort by percentage change
    results.sort(key=lambda x: x["chg_pct"], reverse=True)
    
    # Take top 2 and bottom 2
    top_gainers = results[:2]
    top_losers = results[-2:] if len(results) >= 4 else results[2:]
    
    movers = top_gainers + top_losers
    
    # Strip out the sorting key
    for m in movers:
        del m["chg_pct"]
        if m["vol"] == "0.0M":
            m["vol"] = "N/A" # fallback if volume is missing
            
    return {"movers": movers}
