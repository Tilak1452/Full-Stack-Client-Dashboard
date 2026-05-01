"""
Stock Service (services/stock_service.py)

Responsibilities:
- Fetch real-time and historical stock data using yFinance.
- Return clean, structured Python dictionaries (NOT ORM objects, NOT DataFrames).
- Handle missing/invalid symbols and yFinance failures gracefully.
- Retry transient network failures automatically using tenacity.
- Zero LLM logic here — pure data retrieval and normalization.

Retry Strategy:
- Max 3 attempts (1 original + 2 retries).
- Exponential backoff: 2^n seconds between attempts (2s, 4s).
- Only retries on RuntimeError (network/infrastructure failure).
- Does NOT retry ValueError (bad symbol — retrying would fail every time).
- Logs every retry attempt for observability.
"""

import logging
from typing import Optional

import yfinance as yf
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from ..core.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError  # noqa: F401
from ..core.cache import cache

logger = logging.getLogger(__name__)

# ── Shared retry policy ───────────────────────────────────────────────────────
# Reused by both get_current_price and get_historical_data as a decorator.
# Only retries RuntimeError (network failures), NOT ValueError (bad symbol).
_stock_retry = retry(
    retry=retry_if_exception_type(RuntimeError),   # Only retry infra failures
    stop=stop_after_attempt(3),                     # 1 original + 2 retries
    wait=wait_exponential(multiplier=1, min=2, max=8),  # 2s → 4s → 8s
    before_sleep=before_sleep_log(logger, logging.WARNING),  # Log each retry
    reraise=True,  # Re-raise the last exception if all attempts exhausted
)


class StockService:
    """
    Thin wrapper around yFinance for fetching stock market data.

    Resilience layers applied (outermost to innermost):
    1. CircuitBreaker → blocks calls when yFinance is repeatedly unavailable.
    2. Tenacity retry  → retries transient failures with exponential backoff.
    3. ValueError guard → rejects bad symbols before hitting the network.

    Error handling contract:
    - Symbol invalid / no data → raises ValueError.
    - Network failure after all retries → raises RuntimeError.
    - Circuit OPEN (too many failures) → raises CircuitBreakerOpenError.
    - Caller converts these to HTTP 404 / 503 as needed.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 30.0,
    ) -> None:
        # Shared circuit breaker for all yFinance calls from this instance.
        # Tracks consecutive outer-level failures (after retries are exhausted).
        self._cb = CircuitBreaker(
            name="yfinance",
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )
    # ── 1. Current Price ─────────────────────────────────────────────────────

    def get_current_price(self, symbol: str) -> dict:
        """Routes through circuit breaker, then retries on failure."""
        return self._cb.call(self._fetch_current_price, symbol)

    @_stock_retry  # Retries up to 3 times on RuntimeError with exponential backoff
    def _fetch_current_price(self, symbol: str) -> dict:
        """
        Fetches the latest market price for a stock symbol.

        Returns:
            {
                "symbol": "AAPL",
                "price": 175.23,
                "currency": "USD",
                "exchange": "NMS",
                "market_state": "REGULAR",   # REGULAR | PRE | POST | CLOSED
                "previous_close": 174.10,
                "day_high": 176.80,
                "day_low": 174.00,
            }

        Raises:
            ValueError: If symbol is invalid or no data is returned.
            RuntimeError: If yFinance request fails due to a network error.
        """
        symbol = symbol.upper().strip()
        logger.info("Fetching current price | symbol=%s", symbol)

        try:
            ticker = yf.Ticker(symbol)
            
            price: Optional[float] = None
            info = None
            
            try:
                info = ticker.fast_info
                price = getattr(info, "last_price", None)
            except Exception:
                # If fast_info throws any KeyError or HTTPError internally, skip to fallback
                pass

            if price is None or price == 0.0:
                try:
                    full_info = ticker.info
                    price = full_info.get("currentPrice") or full_info.get("regularMarketPrice")
                except Exception:
                    # If full info also throws an exception, price remains None
                    pass

            if not price:
                raise ValueError(
                    f"No price data found for symbol '{symbol}'. "
                    "It may be delisted, misspelled, or not supported by yFinance (e.g., use 'TATAMOTORS.NS' instead of 'TATA MOTORS LTD')."
                )

            result = {
                "symbol": symbol,
                "price": round(float(price), 4),
                "currency": getattr(info, "currency", "N/A") if info else "N/A",
                "exchange": getattr(info, "exchange", "N/A") if info else "N/A",
                "market_state": getattr(info, "market_state", "UNKNOWN") if info else "UNKNOWN",
                "previous_close": round(float(getattr(info, "previous_close", 0) or 0), 4) if info else 0.0,
                "day_high": round(float(getattr(info, "day_high", 0) or 0), 4) if info else 0.0,
                "day_low": round(float(getattr(info, "day_low", 0) or 0), 4) if info else 0.0,
                "market_cap": getattr(info, "market_cap", None) if info else None,
            }
            # Trailing PE is usually only in full .info, not .fast_info
            if not result["market_cap"]:
                try:
                    full_info = ticker.info
                    result["market_cap"] = full_info.get("marketCap")
                    result["pe_ratio"] = full_info.get("trailingPE")
                except Exception:
                    result["pe_ratio"] = None
            else:
                # Fast info doesn't have PE, fetch if needed
                try:
                    result["pe_ratio"] = ticker.info.get("trailingPE")
                except Exception:
                    result["pe_ratio"] = None

            logger.info("Price fetched | symbol=%s | price=%s", symbol, result["price"])
            return result

        except ValueError:
            raise  # Re-raise our own validation errors
        except Exception as exc:
            logger.error("yFinance request failed | symbol=%s | error=%s", symbol, str(exc))
            raise RuntimeError(
                f"Failed to fetch price for '{symbol}' from yFinance: {exc}"
            ) from exc

    # ── 2. Historical OHLC Data ───────────────────────────────────────────────

    def get_historical_data(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
        include_indicators: bool = False,
    ) -> dict:
        """Routes through circuit breaker, then retries on failure."""
        return self._cb.call(self._fetch_historical_data, symbol, period, interval, include_indicators)

    @_stock_retry  # Retries up to 3 times on RuntimeError with exponential backoff
    def _fetch_historical_data(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
        include_indicators: bool = False,
    ) -> dict:
        """
        Fetches historical OHLC (Open, High, Low, Close) + Volume data.

        When include_indicators=True, also computes 8 technical indicators,
        pivot points, and a bullish/bearish summary score.

        Args:
            symbol:   Stock ticker (e.g., "AAPL", "RELIANCE.NS").
            period:   Time range — "1d", "5d", "1mo", "3mo", "6mo", "1y", "5y".
            interval: Candle size — "1m", "5m", "15m", "1h", "1d", "1wk", "1mo".
            include_indicators: If True, enrich candles with all 8 indicators.

        Returns:
            Base dict with OHLCV candles, plus (when indicators=True):
            latest_indicators, pivot_points, summary.

        Raises:
            ValueError: If the symbol has no historical data.
            RuntimeError: If yFinance request fails.
        """
        from .indicators import compute_all_indicators, compute_pivot_points, compute_summary

        symbol = symbol.upper().strip()
        logger.info(
            "Fetching historical data | symbol=%s | period=%s | interval=%s | indicators=%s",
            symbol, period, interval, include_indicators,
        )

        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)

            if df.empty:
                raise ValueError(
                    f"No historical data found for symbol '{symbol}' "
                    f"with period='{period}' and interval='{interval}'."
                )

            currency = "N/A"
            try:
                currency = getattr(ticker.fast_info, "currency", "N/A")
            except Exception:
                pass

            # ── Enriched response (with indicators) ──
            if include_indicators:
                try:
                    enriched_df = compute_all_indicators(df)

                    if enriched_df.empty:
                        raise ValueError("Not enough data after indicator warmup.")

                    # Build candle records with indicator columns
                    records = []
                    for timestamp, row in enriched_df.iterrows():
                        records.append({
                            "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                            "open": round(float(row.get("Open", 0)), 4),
                            "high": round(float(row.get("High", 0)), 4),
                            "low": round(float(row.get("Low", 0)), 4),
                            "close": round(float(row.get("Close", 0)), 4),
                            "volume": int(row.get("Volume", 0)),
                            "rsi": round(float(row.get("RSI_14", 0)), 2),
                            "sma": round(float(row.get("SMA_20", 0)), 2),
                            "ema": round(float(row.get("EMA_20", 0)), 2),
                            "macd": round(float(row.get("MACD_12_26_9", 0)), 2),
                            "macd_signal": round(float(row.get("MACDs_12_26_9", 0)), 2),
                            "macd_hist": round(float(row.get("MACDh_12_26_9", 0)), 2),
                            "bb_upper": round(float(row.get("BBU_20", 0)), 2),
                            "bb_middle": round(float(row.get("BBM_20", 0)), 2),
                            "bb_lower": round(float(row.get("BBL_20", 0)), 2),
                            "stoch_k": round(float(row.get("STOCHk_14_3", 0)), 2),
                            "stoch_d": round(float(row.get("STOCHd_14_3", 0)), 2),
                            "atr": round(float(row.get("ATR_14", 0)), 2),
                            "mfi": round(float(row.get("MFI_14", 0)), 2),
                        })

                    # Extract latest indicator snapshot
                    last_row = enriched_df.iloc[-1]
                    latest_indicators = {
                        "rsi": round(float(last_row.get("RSI_14", 0)), 2),
                        "sma": round(float(last_row.get("SMA_20", 0)), 2),
                        "ema": round(float(last_row.get("EMA_20", 0)), 2),
                        "macd": round(float(last_row.get("MACD_12_26_9", 0)), 2),
                        "macd_signal": round(float(last_row.get("MACDs_12_26_9", 0)), 2),
                        "macd_hist": round(float(last_row.get("MACDh_12_26_9", 0)), 2),
                        "bb_upper": round(float(last_row.get("BBU_20", 0)), 2),
                        "bb_middle": round(float(last_row.get("BBM_20", 0)), 2),
                        "bb_lower": round(float(last_row.get("BBL_20", 0)), 2),
                        "stoch_k": round(float(last_row.get("STOCHk_14_3", 0)), 2),
                        "stoch_d": round(float(last_row.get("STOCHd_14_3", 0)), 2),
                        "atr": round(float(last_row.get("ATR_14", 0)), 2),
                        "mfi": round(float(last_row.get("MFI_14", 0)), 2),
                    }

                    current_price = float(last_row.get("Close", 0))
                    pivot_points = compute_pivot_points(enriched_df)
                    summary = compute_summary(last_row, current_price)

                    result = {
                        "symbol": symbol,
                        "period": period,
                        "interval": interval,
                        "currency": currency,
                        "num_candles": len(records),
                        "candles": records,
                        "latest_indicators": latest_indicators,
                        "pivot_points": pivot_points,
                        "summary": summary,
                    }
                    logger.info(
                        "Enriched history fetched | symbol=%s | candles=%d", symbol, len(records)
                    )
                    return result

                except Exception as ind_exc:
                    logger.warning(
                        "Indicator computation failed, returning raw candles | symbol=%s | error=%s",
                        symbol, str(ind_exc)
                    )
                    # Fall through to raw candle response below

            # ── Basic response (no indicators) ──
            records = []
            for timestamp, row in df.iterrows():
                records.append({
                    "date": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "open": round(float(row.get("Open", 0)), 4),
                    "high": round(float(row.get("High", 0)), 4),
                    "low": round(float(row.get("Low", 0)), 4),
                    "close": round(float(row.get("Close", 0)), 4),
                    "volume": int(row.get("Volume", 0)),
                })

            result = {
                "symbol": symbol,
                "period": period,
                "interval": interval,
                "currency": currency,
                "num_candles": len(records),
                "data": records,
            }
            logger.info(
                "Historical data fetched | symbol=%s | candles=%d", symbol, len(records)
            )
            return result

        except ValueError:
            raise
        except Exception as exc:
            logger.error(
                "yFinance historical request failed | symbol=%s | error=%s", symbol, str(exc)
            )
            raise RuntimeError(
                f"Failed to fetch historical data for '{symbol}': {exc}"
            ) from exc

    # ── 3. Full Stock Data (price + indicators) ───────────────────────────────

    def get_full_stock_data(self, symbol: str) -> dict:
        """
        Combines live price and technical indicators into one structured dict.

        Steps:
        1. Fetch current price via get_current_price() (circuit breaker + retry).
        2. Fetch 3-month daily history via get_historical_data().
        3. Extract close prices and run RSI(14), SMA(20), EMA(20).
        4. Merge into a flat dict ready for StockDataResponse.

        Indicators return None if history is too short to calculate.
        Never raises for missing indicators — only raises for missing price.
        """
        import pandas as pd
        from datetime import datetime, timezone
        from .indicators import calculate_all

        symbol = symbol.upper().strip()
        cache_key = f"stock:{symbol}"
        
        # Check Cache
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info("Stock cache HIT | symbol=%s", symbol)
            # Need to restore timestamp back to datetime since it was JSON serialized to string
            if "timestamp" in cached_data and isinstance(cached_data["timestamp"], str):
                cached_data["timestamp"] = datetime.fromisoformat(cached_data["timestamp"])
            return cached_data

        logger.info("Stock cache MISS | get_full_stock_data | symbol=%s", symbol)

        # Step 1: Live price (raises ValueError / RuntimeError on failure)
        price_data = self.get_current_price(symbol)

        # Step 2: History for indicators (silently skip if unavailable)
        indicators = {"rsi": None, "sma": None, "ema": None}
        volume = None
        try:
            hist = self.get_historical_data(symbol, period="3mo", interval="1d")
            candles = hist.get("data", [])
            if candles:
                closes = pd.Series([c["close"] for c in candles], dtype=float)
                volume = candles[-1].get("volume")  # Most recent volume
                indicators = calculate_all(closes)
        except Exception as exc:
            logger.warning(
                "Indicators skipped | symbol=%s | reason=%s", symbol, str(exc)
            )

        result = {
            "symbol": price_data["symbol"],
            "current_price": price_data["price"],
            "currency": price_data.get("currency", "N/A"),
            "exchange": price_data.get("exchange", "N/A"),
            "market_state": price_data.get("market_state", "UNKNOWN"),
            "previous_close": price_data.get("previous_close"),
            "day_high": price_data.get("day_high"),
            "day_low": price_data.get("day_low"),
            "volume": volume,
            "market_cap": price_data.get("market_cap"),
            "pe_ratio": price_data.get("pe_ratio"),
            "rsi": indicators["rsi"],
            "sma": indicators["sma"],
            "ema": indicators["ema"],
            "timestamp": datetime.now(timezone.utc),
        }

        # Save to cache (TTL: 120 seconds / 2 minutes)
        # Convert datetime to ISO string for JSON serialization
        cache_payload = result.copy()
        cache_payload["timestamp"] = cache_payload["timestamp"].isoformat()
        cache.set(cache_key, cache_payload, ttl_seconds=120)

        return result


    # ── 4. Fundamentals (Phase 2) ──────────────────────────────────────────────

    async def get_fundamentals(self, symbol: str) -> dict:
        """
        Fetches fundamental data for the Fundamental tab.

        Uses asyncio.gather + run_in_executor to parallelize 4 blocking yfinance calls.
        Returns a structured dict with overview, quarterly/annual financials,
        shareholding, and earnings calendar.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        symbol = symbol.upper().strip()
        logger.info("Fetching fundamentals | symbol=%s", symbol)

        ticker = yf.Ticker(symbol)
        loop = asyncio.get_event_loop()

        with ThreadPoolExecutor(max_workers=4) as pool:
            info_future = loop.run_in_executor(pool, lambda: ticker.info)
            qfin_future = loop.run_in_executor(pool, lambda: ticker.quarterly_financials)
            holders_future = loop.run_in_executor(pool, lambda: ticker.major_holders)
            calendar_future = loop.run_in_executor(pool, lambda: ticker.calendar)

            info, qfin, holders, calendar = await asyncio.gather(
                info_future, qfin_future, holders_future, calendar_future,
                return_exceptions=True
            )

        # ── Parse ticker.info ──
        if isinstance(info, Exception) or not isinstance(info, dict):
            info = {}

        overview = {
            "pe_ratio": info.get("trailingPE"),
            "pb_ratio": info.get("priceToBook"),
            "roe": info.get("returnOnEquity"),
            "dividend_yield": info.get("dividendYield"),
            "market_cap": info.get("marketCap"),
            "day_high": info.get("dayHigh"),
            "day_low": info.get("dayLow"),
            "52_week_high": info.get("fiftyTwoWeekHigh"),
            "52_week_low": info.get("fiftyTwoWeekLow"),
            "beta": info.get("beta"),
            "book_value": info.get("bookValue"),
            "earnings_per_share": info.get("trailingEps"),
        }

        # ── Parse quarterly financials ──
        quarterly_financials = []
        if not isinstance(qfin, Exception) and hasattr(qfin, 'columns'):
            try:
                def _sg(df, col, key):
                    try:
                        v = df[col].get(key)
                        return float(v) if v is not None else None
                    except Exception:
                        return None
                for col in qfin.columns:
                    period_label = col.strftime("%b %Y") if hasattr(col, 'strftime') else str(col)
                    quarterly_financials.append({
                        "period": period_label,
                        "total_revenue":   _sg(qfin, col, "Total Revenue"),
                        "net_income":      _sg(qfin, col, "Net Income"),
                        "gross_profit":    _sg(qfin, col, "Gross Profit"),
                        "operating_income": _sg(qfin, col, "Operating Income"),
                        "ebitda":          _sg(qfin, col, "EBITDA"),
                    })
            except Exception as e:
                logger.warning("Failed to parse quarterly financials | %s", e)

        # ── Parse annual financials ──
        annual_financials = []
        try:
            afin = ticker.financials
            if hasattr(afin, 'columns'):
                def _sga(df, col, key):
                    try:
                        v = df[col].get(key)
                        return float(v) if v is not None else None
                    except Exception:
                        return None
                for col in afin.columns:
                    period_label = col.strftime("%Y") if hasattr(col, 'strftime') else str(col)
                    annual_financials.append({
                        "period": period_label,
                        "total_revenue":   _sga(afin, col, "Total Revenue"),
                        "net_income":      _sga(afin, col, "Net Income"),
                        "gross_profit":    _sga(afin, col, "Gross Profit"),
                        "operating_income": _sga(afin, col, "Operating Income"),
                        "ebitda":          _sga(afin, col, "EBITDA"),
                    })
        except Exception as e:
            logger.warning("Failed to parse annual financials | %s", e)

        # ── Parse shareholding ──
        shareholding = {
            "pct_held_by_institutions": None,
            "pct_held_by_insiders": None,
            "float_shares_pct": None,
            "number_of_institutions": None,
        }
        if not isinstance(holders, Exception) and hasattr(holders, 'iloc'):
            try:
                for _, row_data in holders.iterrows():
                    label = str(row_data.iloc[1]).lower() if len(row_data) > 1 else ""
                    val = row_data.iloc[0]
                    if 'institution' in label and 'held' in label:
                        shareholding["pct_held_by_institutions"] = float(val) if val else None
                    elif 'insider' in label and 'held' in label:
                        shareholding["pct_held_by_insiders"] = float(val) if val else None
                    elif 'float' in label:
                        shareholding["float_shares_pct"] = float(val) if val else None
                    elif 'institution' in label and 'count' in label:
                        shareholding["number_of_institutions"] = int(val) if val else None
            except Exception as e:
                logger.warning("Failed to parse holders | %s", e)

        # Also get from info dict as a more reliable fallback
        if shareholding["pct_held_by_institutions"] is None:
            shareholding["pct_held_by_institutions"] = info.get("heldPercentInstitutions")
        if shareholding["pct_held_by_insiders"] is None:
            shareholding["pct_held_by_insiders"] = info.get("heldPercentInsiders")
        shareholding["number_of_institutions"] = shareholding["number_of_institutions"] or info.get("floatShares")

        # ── Parse calendar ──
        cal_data = {
            "next_earnings_date": None,
            "earnings_low": None,
            "earnings_high": None,
            "revenue_low": None,
            "revenue_high": None,
        }
        if not isinstance(calendar, Exception) and calendar is not None:
            try:
                if isinstance(calendar, dict):
                    earnings_dates = calendar.get("Earnings Date", [])
                    if earnings_dates:
                        next_date = earnings_dates[0]
                        cal_data["next_earnings_date"] = next_date.strftime("%Y-%m-%d") if hasattr(next_date, 'strftime') else str(next_date)
                    cal_data["earnings_low"] = calendar.get("Earnings Low")
                    cal_data["earnings_high"] = calendar.get("Earnings High")
                    cal_data["revenue_low"] = calendar.get("Revenue Low")
                    cal_data["revenue_high"] = calendar.get("Revenue High")
            except Exception as e:
                logger.warning("Failed to parse calendar | %s", e)

        # ── Parse dividends / corporate actions ──
        corporate_actions = {"dividends": [], "splits": []}
        try:
            divs = ticker.dividends
            if divs is not None and len(divs) > 0:
                for date_idx, amount in divs.items():
                    corporate_actions["dividends"].append({
                        "date": date_idx.strftime("%Y-%m-%d") if hasattr(date_idx, 'strftime') else str(date_idx),
                        "amount": float(amount) if amount is not None else None,
                    })
                corporate_actions["dividends"] = list(reversed(corporate_actions["dividends"]))
        except Exception as e:
            logger.warning("Failed to parse dividends | %s", e)

        return {
            "symbol": symbol,
            "overview": overview,
            "quarterly_financials": quarterly_financials,
            "annual_financials": annual_financials,
            "shareholding": shareholding,
            "calendar": cal_data,
            "corporate_actions": corporate_actions,
        }


# ── Module-level singleton ────────────────────────────────────────────────────
# A single shared instance for the entire app (circuit breaker state is shared).
# Routers import this: `from app.services.stock_service import stock_service`
stock_service = StockService(failure_threshold=3, recovery_timeout=30.0)


def get_circuit_status() -> dict:
    """Returns circuit breaker status — used by the /health endpoint."""
    return stock_service._cb.status()
