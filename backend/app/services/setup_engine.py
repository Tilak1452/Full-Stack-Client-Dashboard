"""
Trading Setup Engine (services/setup_engine.py)

Detects high-probability trading setups from stock data and historical candles.
Three setups are checked in priority order:
  1. RSI Recovery Setup — oversold bounce
  2. Volume Breakout Setup — institutional accumulation
  3. Trend Continuation Setup — healthy uptrend pullback

Called by: backend/app/agent/tools.py → detect_setup()
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Fallback dict returned when no setup is detected
_NO_SETUP = {
    "name": "No Clear Setup",
    "confidence": 0.0,
    "entry": None,
    "stop_loss": None,
    "target_1": None,
    "target_2": None,
    "risk_reward": 0.0,
    "reasoning": "No high-probability setup detected in current conditions.",
}


def detect_trading_setup(stock_data: dict, candles: list) -> dict:
    """
    Analyse stock data + recent candle history to detect a trading setup.

    Args:
        stock_data: Dict from StockService.get_full_stock_data() with keys like
                    current_price, rsi, sma, ema, volume, etc.
        candles:    List of OHLCV dicts from StockService.get_historical_data()
                    Each candle has: open, high, low, close, volume (and optionally date/timestamp)

    Returns:
        Dict with setup details or the "No Clear Setup" fallback.
    """
    try:
        if not candles or len(candles) < 20:
            return {**_NO_SETUP, "reasoning": "Insufficient historical data (need at least 20 candles)."}

        current_price = stock_data.get("current_price") or stock_data.get("price")
        if not current_price:
            return {**_NO_SETUP, "reasoning": "Current price unavailable."}

        current_price = float(current_price)

        # Extract close prices
        closes = [float(c.get("close", 0)) for c in candles if c.get("close")]
        if len(closes) < 20:
            return {**_NO_SETUP, "reasoning": "Not enough close prices for analysis."}

        # Extract volumes
        volumes = [int(c.get("volume", 0)) for c in candles if c.get("volume")]

        # Current indicators from stock_data
        rsi = stock_data.get("rsi")
        sma = stock_data.get("sma") or stock_data.get("sma_20")
        ema = stock_data.get("ema") or stock_data.get("ema_20")

        # ── Setup 1: RSI Recovery Setup ──────────────────────────────────────
        if rsi is not None:
            rsi = float(rsi)
            # Check if RSI was below 40 in the last 5 candles
            # We approximate past RSI by checking if recent closes were in a dip
            recent_lows = [float(c.get("low", 0)) for c in candles[-5:] if c.get("low")]
            lowest_low = min(recent_lows) if recent_lows else current_price

            if rsi > 42 and rsi < 60:
                # Check if the stock was recently in oversold territory
                # Heuristic: if current RSI is 42-60 and recent candles show a bounce from lows
                recent_closes = closes[-5:]
                if len(recent_closes) >= 5:
                    min_recent = min(recent_closes)
                    if current_price > min_recent * 1.02:  # Price has bounced at least 2% from recent low
                        risk = current_price - lowest_low
                        if risk > 0:
                            rr = round((risk * 1.5) / risk, 1) if risk > 0 else 0
                            if rr >= 1.5:
                                target_1 = round(current_price + (risk * 1.5), 2)
                                target_2 = round(current_price + (risk * 2.5), 2)
                                confidence = min(0.85, 0.5 + (60 - rsi) / 100 + 0.1)
                                return {
                                    "name": "RSI Recovery Setup",
                                    "confidence": round(confidence, 2),
                                    "entry": round(current_price, 2),
                                    "stop_loss": round(lowest_low, 2),
                                    "target_1": target_1,
                                    "target_2": target_2,
                                    "risk_reward": round((target_1 - current_price) / risk, 1),
                                    "reasoning": f"RSI at {rsi:.1f} recovering from oversold zone. "
                                                 f"Stop below recent low ₹{lowest_low:.2f}.",
                                }

        # ── Setup 2: Volume Breakout Setup ───────────────────────────────────
        if volumes and len(volumes) >= 20 and sma is not None:
            sma = float(sma)
            avg_volume_20 = sum(volumes[-20:]) / 20
            current_volume = volumes[-1] if volumes else 0

            if current_volume > avg_volume_20 * 1.8 and current_price > sma:
                risk = current_price - sma
                if risk > 0:
                    target_1 = round(current_price + (risk * 1.5), 2)
                    target_2 = round(current_price + (risk * 2.5), 2)
                    vol_ratio = current_volume / avg_volume_20 if avg_volume_20 > 0 else 0
                    confidence = min(0.88, 0.55 + (vol_ratio - 1.8) * 0.1)
                    return {
                        "name": "Volume Breakout Setup",
                        "confidence": round(confidence, 2),
                        "entry": round(current_price, 2),
                        "stop_loss": round(sma, 2),
                        "target_1": target_1,
                        "target_2": target_2,
                        "risk_reward": round((target_1 - current_price) / risk, 1),
                        "reasoning": f"Volume {vol_ratio:.1f}× average with price above SMA20 (₹{sma:.2f}). "
                                     f"Institutional accumulation signal.",
                    }

        # ── Setup 3: Trend Continuation Setup ────────────────────────────────
        if rsi is not None and ema is not None and sma is not None:
            rsi = float(rsi)
            ema = float(ema)
            sma = float(sma)

            ema_gap_pct = ((current_price - ema) / ema) * 100 if ema > 0 else 999

            if 50 <= rsi <= 65 and ema > sma and 0 <= ema_gap_pct <= 3:
                risk = current_price - ema
                if risk > 0:
                    target_1 = round(current_price + (risk * 1.5), 2)
                    target_2 = round(current_price + (risk * 2.5), 2)
                    confidence = min(0.78, 0.50 + (rsi - 50) / 100 + 0.1)
                    return {
                        "name": "Trend Continuation Setup",
                        "confidence": round(confidence, 2),
                        "entry": round(current_price, 2),
                        "stop_loss": round(ema, 2),
                        "target_1": target_1,
                        "target_2": target_2,
                        "risk_reward": round((target_1 - current_price) / risk, 1),
                        "reasoning": f"RSI {rsi:.1f} in healthy trend zone. EMA (₹{ema:.2f}) above "
                                     f"SMA (₹{sma:.2f}), price within {ema_gap_pct:.1f}% of EMA.",
                    }

        # No setup found
        return _NO_SETUP

    except Exception as e:
        logger.error("Setup detection failed | error=%s", str(e), exc_info=True)
        return {**_NO_SETUP, "reasoning": f"Setup detection error: {str(e)}"}
