# backend/app/core/key_manager.py
"""
Round-Robin API Key Manager for FinSight AI.

Handles rotation for:
  - Data providers: Finnhub, FMP, Alpha Vantage, NewsAPI, FRED, Twelve Data
  - NVIDIA NIM LLM provider (single key: NVIDIA_NIM_API_KEY)

Key Format — matches the .env file structure exactly:
  Keys are stored as numbered env vars: PREFIX_1, PREFIX_2, PREFIX_3, ...

  Examples from .env:
    FINNHUB_API_KEY_1=d7p6...      FINNHUB_API_KEY_2=d7p6...
    FMP_API_KEY_1=Xc2x...          FMP_API_KEY_2=kR9b...
    ALPHA_VANTAGE_KEY_1=SHYZ...    ALPHA_VANTAGE_KEY_2=DPLTR...
    NEWS_API_KEY_1=1bcf...         NEWS_API_KEY_2=8be9...
    FRED_API_KEY_1=aa7d...         FRED_API_KEY_2=57cb...
    TWELVE_DATA_API_KEY_1=abc...   TWELVE_DATA_API_KEY_2=xyz...
    NVIDIA_NIM_API_KEY=nvapi-... (single key, not numbered)

Behavior:
  - Rotates keys per request (round-robin) to distribute load evenly
  - Thread-safe via a single lock
  - On 429: caller catches the exception and calls get_*_key() again for next key
  - If a provider has 0 keys: logs a debug warning, returns None — fallbacks activate

Note: Gemini keys (Gemini_API_KEY_1..10) are NOT managed here.
  The existing ProviderPool in graph.py reads them individually from settings fields.
"""

import itertools
import threading
import os
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class KeyManager:
    """
    Thread-safe round-robin API key manager for all providers.
    Import the module-level singleton: `from app.core.key_manager import key_manager`
    """

    def __init__(self):
        # ── Data Provider Keys (numbered format: PREFIX_1, PREFIX_2, ...) ────────
        self._finnhub_keys: List[str] = self._load_numbered_keys("FINNHUB_API_KEY")
        self._fmp_keys: List[str]     = self._load_numbered_keys("FMP_API_KEY")
        self._av_keys: List[str]      = self._load_numbered_keys("ALPHA_VANTAGE_KEY")
        self._newsapi_keys: List[str] = self._load_numbered_keys("NEWS_API_KEY")
        self._fred_keys: List[str]    = self._load_numbered_keys("FRED_API_KEY")
        self._twelve_keys: List[str]  = self._load_numbered_keys("TWELVE_DATA_API_KEY")

        # ── NVIDIA NIM — single key (NVIDIA_NIM_API_KEY), not numbered ────────────
        _nvidia_raw = os.getenv("NVIDIA_NIM_API_KEY", "").strip()
        self._nvidia_keys: List[str] = [_nvidia_raw] if _nvidia_raw else []

        # ── Cycle Iterators (thread-safe via lock) ───────────────────────────────
        self._finnhub_cycle = itertools.cycle(self._finnhub_keys) if self._finnhub_keys else None
        self._fmp_cycle     = itertools.cycle(self._fmp_keys)     if self._fmp_keys     else None
        self._av_cycle      = itertools.cycle(self._av_keys)      if self._av_keys      else None
        self._newsapi_cycle = itertools.cycle(self._newsapi_keys) if self._newsapi_keys else None
        self._fred_cycle    = itertools.cycle(self._fred_keys)    if self._fred_keys    else None
        self._twelve_cycle  = itertools.cycle(self._twelve_keys)  if self._twelve_keys  else None
        self._nvidia_cycle  = itertools.cycle(self._nvidia_keys)  if self._nvidia_keys  else None

        self._lock = threading.Lock()

        logger.info(
            "[KeyManager] Initialized — "
            "Finnhub:%d FMP:%d AlphaVantage:%d NewsAPI:%d FRED:%d TwelveData:%d NVIDIA:%d",
            len(self._finnhub_keys), len(self._fmp_keys), len(self._av_keys),
            len(self._newsapi_keys), len(self._fred_keys),
            len(self._twelve_keys), len(self._nvidia_keys),
        )

    # ── Internal ────────────────────────────────────────────────────────────────

    def _load_numbered_keys(self, prefix: str, max_keys: int = 20) -> List[str]:
        """
        Load API keys stored as numbered env vars: PREFIX_1, PREFIX_2, ... PREFIX_N.

        Scans from _1 up to _max_keys. Skips blank values but continues scanning
        so sparse numbering (e.g. _1, _2, _4) is handled correctly.

        Args:
            prefix:   Env var prefix, e.g. "FINNHUB_API_KEY"
                      → reads FINNHUB_API_KEY_1, FINNHUB_API_KEY_2, ...
            max_keys: Upper bound on how many numbered vars to scan (default 20).

        Returns:
            List of non-empty key strings in ascending order.
        """
        keys: List[str] = []
        for i in range(1, max_keys + 1):
            val = os.getenv(f"{prefix}_{i}", "").strip()
            if val:
                keys.append(val)
        if not keys:
            logger.debug(
                "[KeyManager] No keys found for prefix '%s' (scanned _%d to _%d). "
                "Fallback providers will be used.",
                prefix, 1, max_keys,
            )
        return keys

    def _next(self, cycle, name: str) -> Optional[str]:
        """Thread-safe next() from a cycle iterator. Returns None if no keys."""
        if cycle is None:
            return None
        with self._lock:
            return next(cycle)

    # ── Data Provider Keys ───────────────────────────────────────────────────────

    def get_finnhub_key(self) -> Optional[str]:
        """Returns next Finnhub key in rotation (FINNHUB_API_KEY_1 … N), or None."""
        return self._next(self._finnhub_cycle, "FINNHUB_API_KEY")

    def get_fmp_key(self) -> Optional[str]:
        """Returns next FMP key in rotation (FMP_API_KEY_1 … N), or None."""
        return self._next(self._fmp_cycle, "FMP_API_KEY")

    def get_av_key(self) -> Optional[str]:
        """Returns next Alpha Vantage key in rotation (ALPHA_VANTAGE_KEY_1 … N), or None."""
        return self._next(self._av_cycle, "ALPHA_VANTAGE_KEY")

    def get_newsapi_key(self) -> Optional[str]:
        """Returns next NewsAPI key in rotation (NEWS_API_KEY_1 … N), or None."""
        return self._next(self._newsapi_cycle, "NEWS_API_KEY")

    def get_fred_key(self) -> Optional[str]:
        """Returns next FRED key in rotation (FRED_API_KEY_1 … N), or None."""
        return self._next(self._fred_cycle, "FRED_API_KEY")

    def get_twelve_key(self) -> Optional[str]:
        """Returns next Twelve Data key in rotation (TWELVE_DATA_API_KEY_1 … N), or None."""
        return self._next(self._twelve_cycle, "TWELVE_DATA_API_KEY")

    def get_nvidia_key(self) -> Optional[str]:
        """Returns NVIDIA NIM key (NVIDIA_NIM_API_KEY — single key), or None."""
        return self._next(self._nvidia_cycle, "NVIDIA_NIM_API_KEY")

    # ── Availability Checks ──────────────────────────────────────────────────────

    def has_nvidia(self) -> bool:
        return bool(self._nvidia_keys)

    def has_finnhub(self) -> bool:
        return bool(self._finnhub_keys)

    def has_fmp(self) -> bool:
        return bool(self._fmp_keys)

    def has_av(self) -> bool:
        return bool(self._av_keys)

    def has_newsapi(self) -> bool:
        return bool(self._newsapi_keys)

    def has_fred(self) -> bool:
        return bool(self._fred_keys)

    def has_twelve(self) -> bool:
        return bool(self._twelve_keys)


# Module-level singleton — import this everywhere
key_manager = KeyManager()
