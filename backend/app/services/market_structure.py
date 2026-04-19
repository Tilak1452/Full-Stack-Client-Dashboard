"""
Market Structure Analyser (services/market_structure.py)

Identifies the overall trend direction, key support/resistance levels,
and trader bias for any stock based on its recent candle history.

Called by: backend/app/agent/tools.py → get_market_structure()
"""

import logging
import math
from typing import List

logger = logging.getLogger(__name__)

# Fallback dict returned on error or insufficient data
_FALLBACK = {
    "trend": "Unknown",
    "key_resistance": None,
    "key_support": None,
    "distance_to_resistance": None,
    "distance_to_support": None,
    "trader_bias": "Unable to determine — insufficient data",
}


def analyze_market_structure(candles: list) -> dict:
    """
    Analyses the market structure using OHLCV candle data.

    Args:
        candles: List of OHLCV dicts (use last 50 candles). Each has:
                 open, high, low, close, volume (and optionally date/timestamp)
                 Minimum required: 20 candles.

    Returns:
        Dict with: trend, key_resistance, key_support,
                   distance_to_resistance, distance_to_support, trader_bias
    """
    try:
        if not candles or len(candles) < 20:
            count = len(candles) if candles else 0
            return {**_FALLBACK, "trader_bias": f"Need at least 20 candles, only {count} provided."}

        # Extract closing prices
        closes = []
        for c in candles:
            close_val = c.get("close")
            if close_val is not None:
                closes.append(float(close_val))

        if len(closes) < 20:
            return {**_FALLBACK, "trader_bias": "Not enough valid close prices."}

        current_close = closes[-1]

        # ── Step 1: Determine trend direction using 20-period SMA ────────────
        sma_20_values = closes[-20:]
        sma_20 = sum(sma_20_values) / len(sma_20_values)

        gap_pct = ((current_close - sma_20) / sma_20) * 100 if sma_20 > 0 else 0

        if gap_pct > 1.5:
            trend = "Uptrend"
        elif gap_pct < -1.5:
            trend = "Downtrend"
        else:
            trend = "Sideways"

        # ── Step 2: Identify key resistance (top 5% of closes) ───────────────
        sorted_closes = sorted(closes)
        n = len(sorted_closes)
        top_count = max(1, math.ceil(n * 0.05))
        bottom_count = max(1, math.ceil(n * 0.05))

        top_closes = sorted_closes[-top_count:]
        bottom_closes = sorted_closes[:bottom_count]

        key_resistance = round(sum(top_closes) / len(top_closes), 2)
        key_support = round(sum(bottom_closes) / len(bottom_closes), 2)

        # Distance from current price as percentage
        dist_to_resistance = round(((key_resistance - current_close) / current_close) * 100, 2) if current_close > 0 else None
        dist_to_support = round(((key_support - current_close) / current_close) * 100, 2) if current_close > 0 else None

        # ── Step 3: Determine trader bias ────────────────────────────────────
        if trend == "Uptrend" and current_close > sma_20:
            abs_dist_res = abs(dist_to_resistance) if dist_to_resistance else 0
            abs_dist_sup = abs(dist_to_support) if dist_to_support else 0
            if abs_dist_res > abs_dist_sup:
                trader_bias = "Bullish — holding above SMA, room to resistance"
            else:
                trader_bias = "Bullish but extended — near resistance zone"
        elif trend == "Downtrend":
            trader_bias = "Bearish — trading below SMA, next level is support"
        else:
            trader_bias = "Neutral — no clear directional bias"

        return {
            "trend": trend,
            "key_resistance": key_resistance,
            "key_support": key_support,
            "distance_to_resistance": dist_to_resistance,
            "distance_to_support": dist_to_support,
            "trader_bias": trader_bias,
        }

    except Exception as e:
        logger.error("Market structure analysis failed | error=%s", str(e), exc_info=True)
        return {**_FALLBACK, "trader_bias": f"Analysis error: {str(e)}"}
