try:
    import pandas_datareader.data as web
except TypeError:
    web = None
import datetime
import yfinance as yf
from typing import Dict, Any, Optional
import pybreaker
import logging

# Circuit breaker: Tripped after 5 failures, resets after 60 seconds
# Track B requirement: Hardcode fallback graceful degradation
macro_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)

@macro_breaker
def fetch_fred_metric(series_id: str, years: int = 1) -> Optional[Dict[str, Any]]:
    """
    Fetch macroeconomic data from the Federal Reserve Economic Data (FRED).
    Common IDs:
    - 'UNRATE': Unemployment Rate
    - 'DGS10': 10-Year Treasury Constant Maturity Rate
    - 'CPIAUCSL': Consumer Price Index for All Urban Consumers
    """
    try:
        end = datetime.datetime.now()
        start = end - datetime.timedelta(days=365 * years)
        if web is None:
            raise Exception("pandas_datareader is not compatible with installed pandas.")
        df = web.DataReader(series_id, 'fred', start, end)
        if df.empty:
            return None
            
        latest_date = df.index[-1]
        latest_value = df.iloc[-1][series_id]
        
        year_ago_value = df.iloc[0][series_id] if len(df) > 1 else latest_value
        change_pct = ((latest_value - year_ago_value) / year_ago_value) * 100 if year_ago_value != 0 else 0
        
        return {
            "series_id": series_id,
            "latest_value": float(latest_value),
            "latest_date": latest_date.strftime('%Y-%m-%d'),
            "year_over_year_change_pct": float(change_pct),
            "trend": "up" if change_pct > 0 else "down",
        }
    except Exception as e:
        logging.error(f"Error fetching FRED metric {series_id}: {e}")
        raise e

@macro_breaker
def fetch_commodity_metric(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch near-real-time commodity data using yfinance.
    Common symbols: 'GC=F' (Gold), 'CL=F' (Crude Oil)
    """
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1y")
        if hist.empty:
            return None
            
        latest_date = hist.index[-1]
        latest_value = hist.iloc[-1]['Close']
        
        year_ago_value = hist.iloc[0]['Close'] if len(hist) > 1 else latest_value
        change_pct = ((latest_value - year_ago_value) / year_ago_value) * 100 if year_ago_value != 0 else 0
        
        return {
            "series_id": symbol,
            "latest_value": float(latest_value),
            "latest_date": latest_date.strftime('%Y-%m-%d'),
            "year_over_year_change_pct": float(change_pct),
            "trend": "up" if change_pct > 0 else "down",
        }
    except Exception as e:
        logging.error(f"Error fetching commodity metric {symbol}: {e}")
        raise e

def get_macro_dashboard() -> Dict[str, Any]:
    """
    Returns a comprehensive snapshot of the macro economy and key commodities.
    Gracefully degrades if the API is broken.
    """
    try:
        return {
            "10y_treasury_yield": fetch_fred_metric('DGS10', years=1),
            "inflation_cpi": fetch_fred_metric('CPIAUCSL', years=1),
            "unemployment_rate": fetch_fred_metric('UNRATE', years=1),
            "gold": fetch_commodity_metric('GC=F'),
            "crude_oil": fetch_commodity_metric('CL=F'),
            "status": "success"
        }
    except pybreaker.CircuitBreakerError:
        return {
            "status": "degraded_circuit_open",
            "message": "Market Data API currently down. Operating on cache/defaults.",
            "10y_treasury_yield": {"latest_value": 4.25, "trend": "down", "cached": True},
            "inflation_cpi": {"latest_value": 311.5, "trend": "up", "cached": True},
            "unemployment_rate": {"latest_value": 3.9, "trend": "up", "cached": True},
            "gold": {"latest_value": 2400.50, "trend": "up", "cached": True},
            "crude_oil": {"latest_value": 81.20, "trend": "down", "cached": True}
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
