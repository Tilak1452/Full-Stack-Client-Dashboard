"""
News Service (services/news_service.py)

Fetches, normalizes, and caches relevant financial news for a given stock symbol.

Features:
- Primary source: yfinance .news property (reliable, works for Indian .NS stocks)
- Fallback source: Yahoo Finance RSS feed
- Normalizes output to schemas.news.NewsArticle
- In-memory cache with TTL to prevent spamming the provider
- Returns empty list instead of crashing if fetch fails
"""

import logging
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any

import yfinance as yf
import feedparser
from pydantic import ValidationError

from ..core.cache import cache
from ..schemas.news import NewsArticle, NewsResponse

logger = logging.getLogger(__name__)


class NewsService:
    """
    Stateful service (holds in-memory cache) for fetching targeted financial news.
    Primary: yfinance .news | Fallback: Yahoo Finance RSS
    """

    def __init__(self, provider_name: str = "YahooFinance"):
        self.provider_name = provider_name

    def _get_cache_key(self, symbol: str) -> str:
        return f"news:{symbol.upper()}"

    # ── API Integration ───────────────────────────────────────────────────────

    def get_news_for_symbol(
        self,
        symbol: str,
        limit: int = 5,
        cache_ttl_minutes: int = 15,
    ) -> NewsResponse:
        """
        Fetches the latest news articles for a stock symbol.
        Checks cache first. On miss, fetches from yfinance (with RSS fallback).
        Never raises exceptions — returns empty list on failure.
        """
        symbol = symbol.upper().strip()
        cache_key = self._get_cache_key(symbol)

        # 1. Check Cache
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info("News cache HIT | symbol=%s", symbol)
            cached_response = NewsResponse(**cached_data)
            return cached_response.model_copy(update={"cached": True})

        # 2. Cache Miss -> Fetch from yfinance
        logger.info("News cache MISS | symbol=%s | fetching from %s", symbol, self.provider_name)
        articles = self._fetch_yfinance_news(symbol, limit)

        # 3. Fallback to RSS if yfinance returned nothing
        if not articles:
            logger.warning("yfinance returned 0 articles for %s, trying RSS fallback", symbol)
            articles = self._fetch_yahoo_rss(symbol, limit)

        # 4. Build Response
        response = NewsResponse(
            symbol=symbol,
            count=len(articles),
            articles=articles,
            cached=False,
            provider=self.provider_name,
        )

        # 5. Cache Result
        cache.set(cache_key, response.model_dump(mode='json'), ttl_seconds=cache_ttl_minutes * 60)
        return response

    def get_news(self, limit: int = 10) -> list[NewsArticle]:
        """
        Fetches general Indian market news using NIFTY 50 index ticker.
        """
        articles = self._fetch_yfinance_news("^NSEI", limit)
        if not articles:
            articles = self._fetch_yahoo_rss("^NSEI", limit)
        return articles

    # ── Provider: yfinance (primary) ──────────────────────────────────────────

    def _fetch_yfinance_news(self, symbol: str, limit: int) -> list[NewsArticle]:
        """
        Uses yfinance Ticker.news to fetch news. Works for Indian stocks (.NS).
        yfinance returns providerPublishTime as a Unix timestamp integer.
        """
        try:
            ticker = yf.Ticker(symbol)
            raw_news = ticker.news or []

            articles = []
            for item in raw_news[:limit]:
                try:
                    publish_ts = item.get("providerPublishTime")
                    if publish_ts:
                        published = datetime.fromtimestamp(publish_ts, tz=timezone.utc).replace(tzinfo=None)
                    else:
                        published = datetime.utcnow()

                    title = item.get("title", "")
                    title_lower = title.lower()

                    positive_words = ['surge', 'gain', 'growth', 'bull', 'high', 'optimism', 'positive',
                                      'breakthrough', 'profit', 'rise', 'jump', 'rally', 'record']
                    negative_words = ['drop', 'fall', 'loss', 'bear', 'low', 'pessimism', 'negative',
                                      'crash', 'down', 'slump', 'decline', 'plunge', 'weak']

                    sentiment = "neutral"
                    if any(word in title_lower for word in positive_words):
                        sentiment = "positive"
                    elif any(word in title_lower for word in negative_words):
                        sentiment = "negative"

                    article = NewsArticle(
                        title=title,
                        source=item.get("publisher", "Yahoo Finance"),
                        published_at=published,
                        url=item.get("link", ""),
                        summary=item.get("summary", title)[:500],
                        sentiment=sentiment,
                    )
                    articles.append(article)
                except (ValidationError, Exception) as e:
                    logger.debug("Skipping invalid yfinance article | symbol=%s | error=%s", symbol, e)
                    continue

            logger.info("yfinance news fetched | symbol=%s | count=%d", symbol, len(articles))
            return articles

        except Exception as exc:
            logger.error("yfinance news fetch failed | symbol=%s | error=%s", symbol, str(exc))
            return []

    # ── Provider: RSS fallback ────────────────────────────────────────────────

    def _fetch_yahoo_rss(self, symbol: str, limit: int) -> list[NewsArticle]:
        """
        Fallback RSS source. Yahoo's old RSS feed is deprecated for most tickers
        but may still work for some indices.
        """
        encoded_symbol = urllib.parse.quote(symbol)
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={encoded_symbol}&region=IN&lang=en-US"

        try:
            feed = feedparser.parse(url)

            if feed.bozo:
                logger.warning("RSS feed parse error | symbol=%s | bozo_exc=%s",
                               symbol, feed.get("bozo_exception", "Unknown"))
                return []

            articles = []
            for entry in feed.entries[:limit]:
                try:
                    published = (datetime(*entry.published_parsed[:6])
                                 if hasattr(entry, 'published_parsed') and entry.published_parsed
                                 else datetime.utcnow())
                except Exception:
                    published = datetime.utcnow()

                title_lower = entry.title.lower()
                positive_words = ['surge', 'gain', 'growth', 'bull', 'high', 'optimism', 'positive',
                                   'breakthrough', 'profit', 'rise']
                negative_words = ['drop', 'fall', 'loss', 'bear', 'low', 'pessimism', 'negative',
                                   'crash', 'down', 'slump']

                sentiment = "neutral"
                if any(word in title_lower for word in positive_words):
                    sentiment = "positive"
                elif any(word in title_lower for word in negative_words):
                    sentiment = "negative"

                try:
                    article = NewsArticle(
                        title=entry.title,
                        source=entry.get("publisher", "Yahoo Finance"),
                        published_at=published,
                        url=entry.link,
                        summary=entry.get("summary", "")[:500],
                        sentiment=sentiment,
                    )
                    articles.append(article)
                except ValidationError as ve:
                    logger.debug("Skipping invalid RSS article | symbol=%s | error=%s", symbol, ve)
                    continue

            return articles

        except Exception as exc:
            logger.error("RSS news fetch failed | symbol=%s | error=%s", symbol, str(exc))
            return []


# ── Module-level singleton ────────────────────────────────────────────────────
news_service = NewsService()
