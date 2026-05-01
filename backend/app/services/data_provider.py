"""
DataProvider Interface (services/data_provider.py)

Defines the abstract contract that all stock data sources must fulfil.
Business logic (StockService, indicators, portfolio summary) depends on
DataProvider, NOT on yFinance directly — so swapping YFinanceProvider for
AlphaVantageProvider requires zero changes to any other module.

Pattern: Strategy / Pluggable Provider
"""

from abc import ABC, abstractmethod


# ── Abstract Interface ────────────────────────────────────────────────────────

class DataProvider(ABC):
    """
    Abstract base class defining the minimum contract for any stock data source.

    Every concrete provider (yFinance, AlphaVantage, mock) MUST implement
    all methods below. Callers program to this interface, not to the implementation.
    """

    @abstractmethod
    def get_stock_data(self, symbol: str) -> dict:
        """
        Fetch the latest price and metadata for a stock symbol.

        Args:
            symbol: Stock ticker (e.g., "AAPL", "RELIANCE.NS").

        Returns:
            dict with at minimum:
            {
                "symbol": str,
                "price": float,
                "currency": str,
                "exchange": str,
            }

        Raises:
            ValueError:     Symbol not found or no data available.
            RuntimeError:   Network or provider-level failure.
        """
        ...

    @abstractmethod
    def get_historical_data(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> dict:
        """
        Fetch historical OHLC + volume data.

        Args:
            symbol:   Stock ticker.
            period:   Time range string (e.g., "1mo", "3mo", "1y").
            interval: Candle size (e.g., "1d", "1h").

        Returns:
            dict with at minimum:
            {
                "symbol": str,
                "period": str,
                "interval": str,
                "num_candles": int,
                "data": list[dict],  # each dict: date, open, high, low, close, volume
            }

        Raises:
            ValueError:   No data found.
            RuntimeError: Provider failure.
        """
        ...


# ── YFinance Provider ─────────────────────────────────────────────────────────

class YFinanceProvider(DataProvider):
    """
    Concrete DataProvider backed by yFinance (via StockService).

    Delegates to the existing StockService singleton which already has:
    - Tenacity retry (3 attempts, exponential backoff)
    - Circuit breaker (CLOSED / OPEN / HALF_OPEN)
    - Clean dict output (no pandas types leaked)
    """

    def __init__(self) -> None:
        # Import here (not at module top) to avoid circular import issues
        # if data_provider.py is imported before stock_service.py is ready.
        from app.services.stock_service import stock_service
        self._service = stock_service

    def get_stock_data(self, symbol: str) -> dict:
        return self._service.get_current_price(symbol)

    def get_historical_data(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
    ) -> dict:
        return self._service.get_historical_data(symbol, period=period, interval=interval)


# ── Module-level default provider ─────────────────────────────────────────────
# Routers and services import this singleton.
# To switch to AlphaVantage:
#   1. Create AlphaVantageProvider(DataProvider)
#   2. Change: default_provider = AlphaVantageProvider()
#   — No other file needs to change.
default_provider: DataProvider = YFinanceProvider()


# =============================================================================
# ── Phase 3: ParallelDataProvider ────────────────────────────────────────────
# =============================================================================
# This is a SEPARATE class from DataProvider(ABC) above.
# It provides parallel async fetching with waterfall fallbacks for the agent.
# Imported by graph.py's gather_stock_data node.
# =============================================================================

import asyncio
import aiohttp
import logging as _logging
from datetime import datetime, timedelta
from typing import Optional as _Opt

import yfinance as yf

from app.core.key_manager import key_manager
from app.core.config import settings

_dp_logger = _logging.getLogger(__name__)


# ── Required Data Map ──────────────────────────────────────────────────────────
# Controls which data types are fetched per artifact_type (only fetch what's needed)

REQUIRED_DATA_MAP: dict = {
    "price_ticker":        ["live_price"],
    "technical_gauge":     ["live_price", "ohlcv_history", "technical_indicators"],
    "news_feed":           ["news_headlines"],
    "info_card":           [],
    "comparison_table":    ["live_price", "technical_indicators", "fundamentals", "revenue_pnl_quarterly"],
    "screener_table":      ["live_price"],
    "portfolio_breakdown": ["live_price"],
    "full_analysis": [
        "live_price", "ohlcv_history", "technical_indicators",
        "fundamentals", "sector_context", "news_headlines",
        "shareholding_pattern", "revenue_pnl_quarterly", "corporate_actions",
    ],
    "financial_report": [
        "fundamentals", "revenue_pnl_quarterly", "revenue_pnl_annual",
        "shareholding_pattern", "corporate_actions",
    ],
}


class ParallelDataProvider:
    """
    Phase 3 async parallel data fetcher for FinSight AI agent.

    Uses asyncio.gather(return_exceptions=True) so one failed source
    never blocks others. Each data type has a waterfall fallback chain.
    Never raises — always returns a structured dict (with error:True if needed).
    """

    # ── Master Entry Point ─────────────────────────────────────────────────────

    async def fetch_all_parallel(
        self,
        symbol: str,
        query: str,
        artifact_type: str,
        comparison_symbols: _Opt[list] = None,
    ) -> dict:
        required = REQUIRED_DATA_MAP.get(artifact_type, ["live_price", "technical_indicators"])
        _dp_logger.info("[Phase3] Fetching %d types for %s | artifact: %s", len(required), symbol, artifact_type)

        task_map = {
            "live_price":            lambda: self._fetch_live_price(symbol),
            "ohlcv_history":         lambda: self._fetch_ohlcv_history(symbol),
            "technical_indicators":  lambda: self._fetch_technical_indicators(symbol),
            "fundamentals":          lambda: self._fetch_fundamentals(symbol),
            "sector_context":        lambda: self._fetch_sector_context(symbol),
            "news_headlines":        lambda: self._fetch_news(query, symbol),
            "macro_context":         lambda: self._fetch_macro(),
            "shareholding_pattern":  lambda: self._fetch_shareholding(symbol),
            "revenue_pnl_quarterly": lambda: self._fetch_financials(symbol, "quarter"),
            "revenue_pnl_annual":    lambda: self._fetch_financials(symbol, "annual"),
            "corporate_actions":     lambda: self._fetch_corporate_actions(symbol),
        }

        active_tasks = {k: task_map[k]() for k in required if k in task_map}
        results = await asyncio.gather(*active_tasks.values(), return_exceptions=True)

        gathered = {}
        for key, result in zip(active_tasks.keys(), results):
            if isinstance(result, Exception):
                _dp_logger.warning("[Phase3] %s raised: %s", key, result)
                gathered[key] = self._fallback(key)
            else:
                gathered[key] = result

        _dp_logger.info("[Phase3] Done. Keys: %s", list(gathered.keys()))
        return gathered

    # ── Live Price ──────────────────────────────────────────────────────────────

    async def _fetch_live_price(self, symbol: str) -> dict:
        """
        Priority order:
          1. Twelve Data  — PRIMARY   (6 keys, 4,800 credits/day, official NSE/BSE feed)
          2. Alpha Vantage — SECONDARY (5 keys, reliable but slower)
          3. Yahoo Finance  — LAST RESORT (unofficial scraper, breaks randomly)
        """
        # ── 1. Twelve Data (PRIMARY) ─────────────────────────────────────────
        td_key = key_manager.get_twelve_key()
        if td_key:
            try:
                td_sym = symbol.replace(".NS", ":NSE").replace(".BO", ":BSE")
                url = f"https://api.twelvedata.com/quote?symbol={td_sym}&apikey={td_key}"
                async with asyncio.timeout(settings.timeout_twelve_data):
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            if data.get("status") != "error" and data.get("close"):
                                return {
                                    "current_price":  float(data.get("close", 0)),
                                    "previous_close": float(data.get("previous_close", 0)),
                                    "day_high":  float(data.get("high", 0)),
                                    "day_low":   float(data.get("low", 0)),
                                    "volume":    int(data.get("volume", 0)),
                                    "symbol": symbol, "source": "twelve_data", "currency": "INR",
                                }
            except Exception as e:
                _dp_logger.warning("[live_price] TwelveData failed: %s", e)

        # ── 2. Alpha Vantage (SECONDARY) ────────────────────────────────────
        av_key = key_manager.get_av_key()
        if av_key:
            try:
                av_sym = symbol.replace(".NS", ".BSE").replace(".BO", ".BSE")
                url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={av_sym}&apikey={av_key}"
                async with asyncio.timeout(settings.timeout_alpha_vantage):
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            gq = data.get("Global Quote", {})
                            if gq and gq.get("05. price"):
                                return {
                                    "current_price":  float(gq.get("05. price", 0)),
                                    "previous_close": float(gq.get("08. previous close", 0)),
                                    "volume":  int(gq.get("06. volume", 0)),
                                    "symbol": symbol, "source": "alpha_vantage", "currency": "INR",
                                }
            except Exception as e:
                _dp_logger.warning("[live_price] AlphaVantage failed: %s", e)

        # ── 3. Yahoo Finance (LAST RESORT — unofficial scraper) ─────────────────
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    t = yf.Ticker(symbol)
                    info = t.fast_info
                    return {
                        "current_price":  info.last_price,
                        "previous_close": info.previous_close,
                        "day_high":  info.day_high,
                        "day_low":   info.day_low,
                        "volume":    info.three_month_average_volume,
                        "market_cap": getattr(info, "market_cap", None),
                        "symbol": symbol, "source": "yahoo_finance", "currency": "INR",
                    }
                return await loop.run_in_executor(None, _sync)
        except Exception as e:
            _dp_logger.warning("[live_price] Yahoo (last resort) also failed: %s", e)

        return self._fallback("live_price")

    # ── OHLCV History ──────────────────────────────────────────────────────────

    async def _fetch_ohlcv_history(self, symbol: str, period: str = "6mo") -> dict:
        """
        Priority order:
          1. Twelve Data  — PRIMARY   (official NSE/BSE exchange data, daily candles)
          2. Yahoo Finance  — LAST RESORT (unofficial scraper, inconsistent for Indian stocks)
        """
        # ── 1. Twelve Data (PRIMARY) ─────────────────────────────────────────
        td_key = key_manager.get_twelve_key()
        if td_key:
            try:
                td_sym = symbol.replace(".NS", ":NSE").replace(".BO", ":BSE")
                _period_to_candles = {
                    "1mo": 30, "3mo": 90, "6mo": 130, "1y": 252, "2y": 504, "5y": 1260,
                }
                outputsize = _period_to_candles.get(period, 90)
                url = (f"https://api.twelvedata.com/time_series"
                       f"?symbol={td_sym}&interval=1day&outputsize={outputsize}&apikey={td_key}")
                async with asyncio.timeout(settings.timeout_twelve_data):
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            values = data.get("values", [])
                            if values:
                                values = list(reversed(values))  # newest-first → chronological
                                return {
                                    "dates":  [v["datetime"] for v in values],
                                    "open":   [float(v["open"]) for v in values],
                                    "high":   [float(v["high"]) for v in values],
                                    "low":    [float(v["low"]) for v in values],
                                    "close":  [float(v["close"]) for v in values],
                                    "volume": [int(v.get("volume", 0)) for v in values],
                                    "symbol": symbol, "source": "twelve_data",
                                }
            except Exception as e:
                _dp_logger.warning("[ohlcv] TwelveData failed: %s", e)

        # ── 2. Yahoo Finance (LAST RESORT — unofficial scraper) ─────────────────
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    hist = yf.Ticker(symbol).history(period=period)
                    if hist.empty:
                        return None
                    return {
                        "dates":  hist.index.strftime("%Y-%m-%d").tolist(),
                        "open":   hist["Open"].round(2).tolist(),
                        "high":   hist["High"].round(2).tolist(),
                        "low":    hist["Low"].round(2).tolist(),
                        "close":  hist["Close"].round(2).tolist(),
                        "volume": hist["Volume"].tolist(),
                        "symbol": symbol, "source": "yahoo_finance",
                    }
                r = await loop.run_in_executor(None, _sync)
                if r:
                    return r
        except Exception as e:
            _dp_logger.warning("[ohlcv] Yahoo (last resort) also failed: %s", e)

        return self._fallback("ohlcv_history")

    # ── Technical Indicators ───────────────────────────────────────────────────

    async def _fetch_technical_indicators(self, symbol: str) -> dict:
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    hist = yf.Ticker(symbol).history(period="3mo")
                    if hist.empty or len(hist) < 20:
                        return None
                    closes = hist["Close"]
                    delta = closes.diff()
                    gain = delta.clip(lower=0).rolling(14).mean()
                    loss = (-delta.clip(upper=0)).rolling(14).mean()
                    rs = gain / loss
                    rsi = float(round(100 - (100 / (1 + rs.iloc[-1])), 2))
                    sma_20 = float(round(closes.rolling(20).mean().iloc[-1], 2))
                    sma_50 = float(round(closes.rolling(50).mean().iloc[-1], 2)) if len(closes) >= 50 else None
                    ema_12 = float(round(closes.ewm(span=12).mean().iloc[-1], 2))
                    ema_26 = float(round(closes.ewm(span=26).mean().iloc[-1], 2))
                    macd_line = ema_12 - ema_26
                    signal_line = float(round(closes.ewm(span=9).mean().iloc[-1], 2))
                    macd_hist = macd_line - signal_line
                    price = float(closes.iloc[-1])
                    return {
                        "rsi_14": rsi,
                        "rsi_signal": "OVERBOUGHT" if rsi > 70 else "OVERSOLD" if rsi < 30 else "NEUTRAL",
                        "sma_20": sma_20, "sma_50": sma_50,
                        "ema_12": ema_12, "ema_26": ema_26,
                        "macd_line": round(macd_line, 4),
                        "macd_signal": signal_line,
                        "macd_histogram": round(macd_hist, 4),
                        "macd_trend": "BULLISH" if macd_hist > 0 else "BEARISH",
                        "price_vs_sma20_pct": round(((price - sma_20) / sma_20) * 100, 2),
                        "symbol": symbol, "source": "yahoo_local_calc",
                    }
                r = await loop.run_in_executor(None, _sync)
                if r:
                    return r
        except Exception as e:
            _dp_logger.warning("[technicals] Yahoo calc failed: %s", e)
        return self._fallback("technical_indicators")

    # ── Fundamentals ───────────────────────────────────────────────────────────

    async def _fetch_fundamentals(self, symbol: str) -> dict:
        """FMP → Finnhub → Yahoo Finance"""
        fmp_key = key_manager.get_fmp_key()
        if fmp_key:
            try:
                async with asyncio.timeout(settings.timeout_fmp):
                    url = f"https://financialmodelingprep.com/stable/profile?symbol={symbol}&apikey={fmp_key}"
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            if data and isinstance(data, list) and data[0]:
                                d = data[0]
                                return {
                                    "pe_ratio": d.get("pe"), "market_cap": d.get("mktCap"),
                                    "eps": d.get("eps"), "beta": d.get("beta"),
                                    "52w_high": d.get("yearHigh"), "52w_low": d.get("yearLow"),
                                    "dividend_yield": d.get("lastDiv"),
                                    "sector": d.get("sector"), "industry": d.get("industry"),
                                    "description": d.get("description", "")[:300],
                                    "symbol": symbol, "source": "fmp",
                                }
            except Exception as e:
                _dp_logger.warning("[fundamentals] FMP failed: %s", e)

        fh_key = key_manager.get_finnhub_key()
        if fh_key:
            try:
                async with asyncio.timeout(settings.timeout_finnhub):
                    loop = asyncio.get_event_loop()
                    def _sync():
                        import finnhub
                        client = finnhub.Client(api_key=fh_key)
                        fh_sym = symbol.replace(".NS", "").replace(".BO", "")
                        m = client.company_basic_financials(fh_sym, "all").get("metric", {})
                        p = client.company_profile2(symbol=fh_sym)
                        return {
                            "pe_ratio": m.get("peTTM"), "market_cap": m.get("marketCapitalization"),
                            "eps": m.get("epsTTM"), "beta": m.get("beta"),
                            "52w_high": m.get("52WeekHigh"), "52w_low": m.get("52WeekLow"),
                            "dividend_yield": m.get("dividendYieldIndicatedAnnual"),
                            "sector": p.get("finnhubIndustry"),
                            "symbol": symbol, "source": "finnhub",
                        }
                    return await loop.run_in_executor(None, _sync)
            except Exception as e:
                _dp_logger.warning("[fundamentals] Finnhub failed: %s", e)

        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    info = yf.Ticker(symbol).info
                    return {
                        "pe_ratio": info.get("trailingPE"), "market_cap": info.get("marketCap"),
                        "eps": info.get("trailingEps"), "beta": info.get("beta"),
                        "52w_high": info.get("fiftyTwoWeekHigh"), "52w_low": info.get("fiftyTwoWeekLow"),
                        "dividend_yield": info.get("dividendYield"),
                        "sector": info.get("sector"), "industry": info.get("industry"),
                        "symbol": symbol, "source": "yahoo_finance",
                    }
                return await loop.run_in_executor(None, _sync)
        except Exception as e:
            _dp_logger.warning("[fundamentals] Yahoo failed: %s", e)
        return self._fallback("fundamentals")

    # ── News Headlines ─────────────────────────────────────────────────────────

    async def _fetch_news(self, query: str, symbol: str) -> dict:
        """NewsAPI → Yahoo Finance RSS → Finnhub news"""
        news_key = key_manager.get_newsapi_key()
        if news_key:
            try:
                company = symbol.replace(".NS", "").replace(".BO", "")
                url = (f"https://newsapi.org/v2/everything?q={company}+stock+India"
                       f"&language=en&sortBy=publishedAt&pageSize=8&apiKey={news_key}")
                async with asyncio.timeout(settings.timeout_newsapi):
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            articles = data.get("articles", [])
                            if articles:
                                return {
                                    "articles": [{"title": a.get("title"), "source": a.get("source", {}).get("name"),
                                                  "published_at": a.get("publishedAt"), "url": a.get("url")}
                                                 for a in articles[:8]],
                                    "symbol": symbol, "source": "newsapi",
                                }
            except Exception as e:
                _dp_logger.warning("[news] NewsAPI failed: %s", e)

        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    news = yf.Ticker(symbol).news
                    if not news:
                        return None
                    return {
                        "articles": [{"title": n.get("title"), "source": n.get("publisher"),
                                      "published_at": str(n.get("providerPublishTime")), "url": n.get("link")}
                                     for n in news[:8]],
                        "symbol": symbol, "source": "yahoo_finance",
                    }
                r = await loop.run_in_executor(None, _sync)
                if r:
                    return r
        except Exception as e:
            _dp_logger.warning("[news] Yahoo RSS failed: %s", e)

        fh_key = key_manager.get_finnhub_key()
        if fh_key:
            try:
                async with asyncio.timeout(settings.timeout_finnhub):
                    loop = asyncio.get_event_loop()
                    def _sync():
                        import finnhub
                        client = finnhub.Client(api_key=fh_key)
                        fh_sym = symbol.replace(".NS", "").replace(".BO", "")
                        today = datetime.now().strftime("%Y-%m-%d")
                        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
                        news = client.company_news(fh_sym, _from=week_ago, to=today)
                        if not news:
                            return None
                        return {
                            "articles": [{"title": n.get("headline"), "source": n.get("source"),
                                          "published_at": str(n.get("datetime")), "url": n.get("url")}
                                         for n in news[:8]],
                            "symbol": symbol, "source": "finnhub",
                        }
                    r = await loop.run_in_executor(None, _sync)
                    if r:
                        return r
            except Exception as e:
                _dp_logger.warning("[news] Finnhub failed: %s", e)

        return self._fallback("news_headlines")

    # ── Financials (Revenue + P&L) ─────────────────────────────────────────────

    async def _fetch_financials(self, symbol: str, period: str = "quarter") -> dict:
        """FMP → Finnhub → Twelve Data"""
        fmp_key = key_manager.get_fmp_key()
        if fmp_key:
            try:
                async with asyncio.timeout(settings.timeout_fmp):
                    url = (f"https://financialmodelingprep.com/stable/income-statement?symbol={symbol}"
                           f"&period={period}&limit=8&apikey={fmp_key}")
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            if data and isinstance(data, list) and len(data) > 0:
                                return {
                                    "period": period,
                                    "statements": [{"date": s2.get("date"), "revenue": s2.get("revenue"),
                                                    "gross_profit": s2.get("grossProfit"),
                                                    "operating_income": s2.get("operatingIncome"),
                                                    "net_income": s2.get("netIncome"),
                                                    "eps": s2.get("eps"), "ebitda": s2.get("ebitda")}
                                                   for s2 in data[:8]],
                                    "symbol": symbol, "source": "fmp",
                                }
            except Exception as e:
                _dp_logger.warning("[financials/%s] FMP failed: %s", period, e)

        td_key = key_manager.get_twelve_key()
        if td_key:
            try:
                td_sym = symbol.replace(".NS", ":NSE").replace(".BO", ":BSE")
                url = (f"https://api.twelvedata.com/income_statement"
                       f"?symbol={td_sym}&period={period}&apikey={td_key}")
                async with asyncio.timeout(settings.timeout_twelve_data):
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            if data.get("status") == "ok" and data.get("income_statement"):
                                return {"period": period, "statements": data["income_statement"][:8],
                                        "symbol": symbol, "source": "twelve_data"}
            except Exception as e:
                _dp_logger.warning("[financials/%s] TwelveData failed: %s", period, e)

        return self._fallback("revenue_pnl_quarterly")

    # ── Shareholding Pattern ───────────────────────────────────────────────────

    async def _fetch_shareholding(self, symbol: str) -> dict:
        """Finnhub ownership → NSE scrape"""
        fh_key = key_manager.get_finnhub_key()
        if fh_key:
            try:
                async with asyncio.timeout(settings.timeout_finnhub):
                    loop = asyncio.get_event_loop()
                    def _sync():
                        import finnhub
                        client = finnhub.Client(api_key=fh_key)
                        fh_sym = symbol.replace(".NS", "").replace(".BO", "")
                        data = client.ownership(fh_sym, limit=5)
                        if data and data.get("ownership"):
                            return {
                                "top_institutional_holders": [
                                    {"name": o.get("name"), "pct": o.get("share")}
                                    for o in data["ownership"][:5]
                                ],
                                "symbol": symbol, "source": "finnhub",
                            }
                        return None
                    r = await loop.run_in_executor(None, _sync)
                    if r:
                        return r
            except Exception as e:
                _dp_logger.warning("[shareholding] Finnhub failed: %s", e)

        try:
            async with asyncio.timeout(settings.timeout_nse_scrape):
                nse_sym = symbol.replace(".NS", "").replace(".BO", "")
                headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com", "Accept": "application/json"}
                async with aiohttp.ClientSession() as s:
                    await s.get("https://www.nseindia.com", headers=headers)
                    url = f"https://www.nseindia.com/api/shareholding-patterns?symbol={nse_sym}"
                    async with s.get(url, headers=headers) as r:
                        if r.status == 200:
                            data = await r.json()
                            categories = data.get("data", [{}])[0].get("shareHoldingList", [])
                            if categories:
                                return {
                                    "quarters": [{"category": c.get("category"), "percentage": c.get("percentage")}
                                                 for c in categories],
                                    "symbol": symbol, "source": "nse_official",
                                }
        except Exception as e:
            _dp_logger.warning("[shareholding] NSE scrape failed: %s", e)

        return self._fallback("shareholding_pattern")

    # ── Corporate Actions ──────────────────────────────────────────────────────

    async def _fetch_corporate_actions(self, symbol: str) -> dict:
        try:
            async with asyncio.timeout(settings.timeout_yahoo):
                loop = asyncio.get_event_loop()
                def _sync():
                    ticker = yf.Ticker(symbol)
                    divs = ticker.dividends
                    div_list = []
                    if not divs.empty:
                        div_list = [{"date": str(d), "amount": round(float(v), 4)}
                                    for d, v in divs.tail(8).items()]
                    return {"dividend_history": div_list, "symbol": symbol, "source": "yahoo_finance"}
                return await loop.run_in_executor(None, _sync)
        except Exception as e:
            _dp_logger.warning("[corporate_actions] Yahoo failed: %s", e)
        return self._fallback("corporate_actions")

    # ── Macro Context ──────────────────────────────────────────────────────────

    async def _fetch_macro(self) -> dict:
        fred_key = key_manager.get_fred_key()
        if fred_key:
            try:
                series = {"yield_curve": "T10Y2Y", "cpi": "CPIAUCSL", "unemployment": "UNRATE"}
                results = {}
                async with asyncio.timeout(settings.timeout_fred):
                    async with aiohttp.ClientSession() as s:
                        for name, sid in series.items():
                            url = (f"https://api.stlouisfed.org/fred/series/observations"
                                   f"?series_id={sid}&api_key={fred_key}&file_type=json&limit=1&sort_order=desc")
                            async with s.get(url) as r:
                                data = await r.json()
                                obs = data.get("observations", [{}])
                                results[name] = obs[-1].get("value") if obs else "N/A"
                return {**results, "source": "fred"}
            except Exception as e:
                _dp_logger.warning("[macro] FRED failed: %s", e)
        return {"yield_curve": "0.25", "cpi": "312.0", "unemployment": "4.1",
                "source": "hardcoded_fallback", "note": "Live macro unavailable"}

    # ── Sector Context ─────────────────────────────────────────────────────────

    async def _fetch_sector_context(self, symbol: str) -> dict:
        fmp_key = key_manager.get_fmp_key()
        if fmp_key:
            try:
                async with asyncio.timeout(settings.timeout_fmp):
                    url = f"https://financialmodelingprep.com/stable/stock-peers?symbol={symbol}&apikey={fmp_key}"
                    async with aiohttp.ClientSession() as s:
                        async with s.get(url) as r:
                            data = await r.json()
                            if data and isinstance(data, list):
                                return {"peers": data[0].get("peersList", [])[:5],
                                        "symbol": symbol, "source": "fmp"}
            except Exception as e:
                _dp_logger.warning("[sector] FMP peers failed: %s", e)
        return self._fallback("sector_context")

    # ── Fallback Structures ────────────────────────────────────────────────────

    def _fallback(self, data_type: str) -> dict:
        fb = {
            "live_price":            {"current_price": None, "source": "unavailable", "error": True},
            "ohlcv_history":         {"dates": [], "close": [], "source": "unavailable", "error": True},
            "technical_indicators":  {"rsi_14": None, "macd_trend": "UNKNOWN", "source": "unavailable", "error": True},
            "fundamentals":          {"pe_ratio": None, "market_cap": None, "source": "unavailable", "error": True},
            "sector_context":        {"peers": [], "source": "unavailable", "error": True},
            "news_headlines":        {"articles": [], "source": "unavailable", "error": True},
            "macro_context":         {"yield_curve": "N/A", "source": "unavailable", "error": True},
            "shareholding_pattern":  {"promoter": "N/A", "fii": "N/A", "dii": "N/A", "source": "unavailable", "error": True},
            "revenue_pnl_quarterly": {"statements": [], "period": "quarter", "source": "unavailable", "error": True},
            "revenue_pnl_annual":    {"statements": [], "period": "annual", "source": "unavailable", "error": True},
            "corporate_actions":     {"dividend_history": [], "source": "unavailable", "error": True},
        }
        return fb.get(data_type, {"source": "unavailable", "error": True})


# Module-level singleton for the agent
data_provider = ParallelDataProvider()
