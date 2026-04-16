"""
Technical Indicators (services/indicators.py)

Pure calculation functions — no API calls, no DB access, no FastAPI.
Input: pandas Series (close prices) or DataFrame (OHLCV). Output: float or dict.

These can be unit-tested with synthetic data without any external dependencies.

Includes:
  - Legacy single-value functions (calculate_rsi, calculate_sma, calculate_ema, calculate_all)
  - Full DataFrame enrichment (compute_all_indicators) for 8 indicators
  - Pivot points (compute_pivot_points) from last completed candle
  - Technical summary (compute_summary) bullish/neutral/bearish scoring
"""

from typing import Union
import pandas as pd
import numpy as np


PriceSeries = Union[pd.Series, list]


def _to_series(prices: PriceSeries) -> pd.Series:
    """Converts list or Series to a clean float Series for calculations."""
    if isinstance(prices, list):
        return pd.Series(prices, dtype=float)
    return prices.astype(float)


# ── Legacy Single-Value Functions (kept for backward compatibility) ────────────

def calculate_rsi(prices: PriceSeries, period: int = 14) -> float:
    """
    Relative Strength Index (RSI) using Wilder's Exponential Smoothing.

    Formula:
        RSI = 100 - (100 / (1 + RS))
        RS  = Average Gain / Average Loss over `period` candles

    Args:
        prices: Close price series (oldest → newest). Minimum length = period + 1.
        period: Lookback window. Standard = 14.

    Returns:
        RSI value in range [0, 100]. Rounded to 2 decimal places.

    Raises:
        ValueError: If not enough data points for the requested period.
    """
    series = _to_series(prices)

    if len(series) < period + 1:
        raise ValueError(
            f"RSI requires at least {period + 1} data points. Got {len(series)}."
        )

    delta = series.diff().dropna()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)

    # Wilder's smoothing (EWM with alpha = 1/period, adjust=False)
    avg_gain = gains.ewm(alpha=1 / period, adjust=False).mean().iloc[-1]
    avg_loss = losses.ewm(alpha=1 / period, adjust=False).mean().iloc[-1]

    if avg_loss == 0:
        return 100.0  # No losses → fully overbought

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return round(float(rsi), 2)


def calculate_sma(prices: PriceSeries, period: int = 20) -> float:
    """
    Simple Moving Average — arithmetic mean of the last `period` prices.

    Args:
        prices: Close price series. Minimum length = period.
        period: Lookback window. Standard = 20.

    Returns:
        Latest SMA value. Rounded to 4 decimal places.

    Raises:
        ValueError: If not enough data points.
    """
    series = _to_series(prices)

    if len(series) < period:
        raise ValueError(
            f"SMA({period}) requires at least {period} data points. Got {len(series)}."
        )

    sma = series.rolling(window=period).mean().iloc[-1]
    return round(float(sma), 4)


def calculate_ema(prices: PriceSeries, period: int = 20) -> float:
    """
    Exponential Moving Average — weights recent prices more heavily.

    Uses pandas EWM with span=period and adjust=False (standard brokers use this).

    Args:
        prices: Close price series. Minimum length = period.
        period: Lookback window. Standard = 20.

    Returns:
        Latest EMA value. Rounded to 4 decimal places.

    Raises:
        ValueError: If not enough data points.
    """
    series = _to_series(prices)

    if len(series) < period:
        raise ValueError(
            f"EMA({period}) requires at least {period} data points. Got {len(series)}."
        )

    ema = series.ewm(span=period, adjust=False).mean().iloc[-1]
    return round(float(ema), 4)


def calculate_all(
    prices: PriceSeries,
    rsi_period: int = 14,
    sma_period: int = 20,
    ema_period: int = 20,
) -> dict:
    """
    Calculates RSI, SMA, and EMA in one call.

    Returns a dict with keys: rsi, sma, ema.
    Returns None for any indicator if there is insufficient data (no exception raised).
    """
    series = _to_series(prices)

    def _safe(fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ValueError:
            return None

    return {
        "rsi": _safe(calculate_rsi, series, rsi_period),
        "sma": _safe(calculate_sma, series, sma_period),
        "ema": _safe(calculate_ema, series, ema_period),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Full DataFrame Enrichment (Phase 1 — 8 indicators)
# ══════════════════════════════════════════════════════════════════════════════

def _rsi_series(close: pd.Series, period: int = 14) -> pd.Series:
    """RSI as a full Series (NaN for warmup rows)."""
    delta = close.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    rsi.iloc[:period] = np.nan  # Mark warmup rows
    return rsi


def _macd_series(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """Returns (macd_line, signal_line, histogram) as Series."""
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    # Mark warmup
    macd_line.iloc[:slow] = np.nan
    signal_line.iloc[:slow + signal] = np.nan
    histogram.iloc[:slow + signal] = np.nan
    return macd_line, signal_line, histogram


def _bollinger_bands(close: pd.Series, period: int = 20, std_dev: float = 2.0):
    """Returns (upper, middle, lower) Bollinger Band Series."""
    middle = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    return upper, middle, lower


def _stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k: int = 14, d: int = 3):
    """Returns (stoch_k, stoch_d) as Series."""
    lowest_low = low.rolling(window=k).min()
    highest_high = high.rolling(window=k).max()
    stoch_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling(window=d).mean()
    return stoch_k, stoch_d


def _atr_series(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Average True Range as a Series."""
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = true_range.ewm(alpha=1 / period, adjust=False).mean()
    atr.iloc[:period] = np.nan
    return atr


def _mfi_series(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series, period: int = 14) -> pd.Series:
    """Money Flow Index as a Series."""
    typical_price = (high + low + close) / 3
    money_flow = typical_price * volume
    delta = typical_price.diff()

    positive_flow = pd.Series(0.0, index=close.index)
    negative_flow = pd.Series(0.0, index=close.index)
    positive_flow[delta > 0] = money_flow[delta > 0]
    negative_flow[delta < 0] = money_flow[delta < 0]

    positive_sum = positive_flow.rolling(window=period).sum()
    negative_sum = negative_flow.rolling(window=period).sum()

    mfi = 100 - (100 / (1 + positive_sum / negative_sum.replace(0, np.nan)))
    mfi.iloc[:period] = np.nan
    return mfi


def compute_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all 8 technical indicators on a DataFrame with OHLCV columns.

    Expected columns: Open, High, Low, Close, Volume
    Appends indicator columns and drops warmup NaN rows.

    Returns a clean DataFrame with no NaN values in indicator columns.
    """
    df = df.copy()
    close = df['Close'].astype(float)
    high = df['High'].astype(float)
    low = df['Low'].astype(float)
    volume = df['Volume'].astype(float)

    # 1. RSI (14)
    df['RSI_14'] = _rsi_series(close, 14)

    # 2. SMA (20)
    df['SMA_20'] = close.rolling(window=20).mean()

    # 3. EMA (20)
    df['EMA_20'] = close.ewm(span=20, adjust=False).mean()

    # 4. MACD (12, 26, 9)
    macd, macd_signal, macd_hist = _macd_series(close, 12, 26, 9)
    df['MACD_12_26_9'] = macd
    df['MACDs_12_26_9'] = macd_signal
    df['MACDh_12_26_9'] = macd_hist

    # 5. Bollinger Bands (20, 2.0)
    bb_upper, bb_middle, bb_lower = _bollinger_bands(close, 20, 2.0)
    df['BBU_20'] = bb_upper
    df['BBM_20'] = bb_middle
    df['BBL_20'] = bb_lower

    # 6. Stochastic (14, 3)
    stoch_k, stoch_d = _stochastic(high, low, close, 14, 3)
    df['STOCHk_14_3'] = stoch_k
    df['STOCHd_14_3'] = stoch_d

    # 7. ATR (14)
    df['ATR_14'] = _atr_series(high, low, close, 14)

    # 8. MFI (14)
    df['MFI_14'] = _mfi_series(high, low, close, volume, 14)

    # Strip warmup NaN rows
    df = df.dropna(subset=[
        'RSI_14', 'SMA_20', 'EMA_20', 'MACD_12_26_9', 'MACDs_12_26_9',
        'MACDh_12_26_9', 'BBU_20', 'STOCHk_14_3', 'ATR_14', 'MFI_14'
    ])

    return df


def compute_pivot_points(df: pd.DataFrame) -> dict:
    """
    Compute classic pivot points from the last completed candle.

    Uses the second-to-last row (last completed candle, not the current in-progress one).
    Returns: pivot, s1, s2, r1, r2
    """
    if len(df) < 2:
        return {"pivot": None, "s1": None, "s2": None, "r1": None, "r2": None}

    last = df.iloc[-2]
    H = float(last['High'])
    L = float(last['Low'])
    C = float(last['Close'])
    pivot = (H + L + C) / 3
    return {
        "pivot": round(pivot, 2),
        "s1": round(2 * pivot - H, 2),
        "s2": round(pivot - (H - L), 2),
        "r1": round(2 * pivot - L, 2),
        "r2": round(pivot + (H - L), 2),
    }


def compute_summary(latest_row: pd.Series, current_price: float) -> dict:
    """
    Compute a technical summary verdict from the latest indicator values.

    Scores each indicator as bullish/neutral/bearish and returns a tally + verdict.
    """
    signals = []

    # RSI
    rsi = latest_row.get('RSI_14')
    if rsi is not None and not np.isnan(rsi):
        signals.append('bullish' if rsi < 40 else 'bearish' if rsi > 60 else 'neutral')

    # Price vs SMA
    sma = latest_row.get('SMA_20')
    if sma is not None and not np.isnan(sma):
        signals.append('bullish' if current_price > sma else 'bearish')

    # Price vs EMA
    ema = latest_row.get('EMA_20')
    if ema is not None and not np.isnan(ema):
        signals.append('bullish' if current_price > ema else 'bearish')

    # MACD histogram direction
    macdh = latest_row.get('MACDh_12_26_9')
    if macdh is not None and not np.isnan(macdh):
        signals.append('bullish' if macdh > 0 else 'bearish')

    # Stochastic
    stochk = latest_row.get('STOCHk_14_3')
    if stochk is not None and not np.isnan(stochk):
        signals.append('bullish' if stochk < 20 else 'bearish' if stochk > 80 else 'neutral')

    # MFI
    mfi = latest_row.get('MFI_14')
    if mfi is not None and not np.isnan(mfi):
        signals.append('bullish' if mfi < 20 else 'bearish' if mfi > 80 else 'neutral')

    # Bollinger Bands
    bbu = latest_row.get('BBU_20')
    bbl = latest_row.get('BBL_20')
    if bbu is not None and bbl is not None and not np.isnan(bbu) and not np.isnan(bbl):
        signals.append('bearish' if current_price > bbu else 'bullish' if current_price < bbl else 'neutral')

    bullish = signals.count('bullish')
    bearish = signals.count('bearish')
    neutral = signals.count('neutral')
    verdict = 'BULLISH' if bullish > bearish else 'BEARISH' if bearish > bullish else 'NEUTRAL'

    return {
        "verdict": verdict,
        "bullish": bullish,
        "bearish": bearish,
        "neutral": neutral,
    }
