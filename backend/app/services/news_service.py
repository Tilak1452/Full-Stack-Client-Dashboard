"""
News Service (services/news_service.py)

Fetches, normalizes, and caches relevant financial news for a given stock symbol.

Sources (in priority order):
1. yfinance Ticker.news  — fast, works for most tickers including .NS
2. yfinance Search API   — broader search results, good fallback
3. Yahoo Finance RSS     — legacy fallback

Handles both old yfinance news format (flat keys) and new format (nested content).
"""

import logging
import urllib.parse
from datetime import datetime, timezone

import yfinance as yf
import feedparser
from pydantic import ValidationError

from ..core.cache import cache
from ..schemas.news import NewsArticle, NewsResponse

logger = logging.getLogger(__name__)


def _parse_sentiment(title: str) -> str:
    title_lower = title.lower()
    positive = ['surge', 'gain', 'growth', 'bull', 'optimism', 'positive',
                 'breakthrough', 'profit', 'rise', 'jump', 'rally', 'record',
                 'soar', 'strong', 'beat', 'upgrade', 'buy']
    negative = ['drop', 'fall', 'loss', 'bear', 'pessimism', 'negative',
                 'crash', 'down', 'slump', 'decline', 'plunge', 'weak',
                 'miss', 'downgrade', 'sell', 'risk', 'concern', 'warning']
    if any(w in title_lower for w in positive):
        return "positive"
    if any(w in title_lower for w in negative):
        return "negative"
    return "neutral"


def _parse_yf_news_item(item: dict) -> dict | None:
    """
    Parse a single yfinance news item. Handles both formats:
    - Old (pre-1.0): flat keys {title, publisher, link, providerPublishTime, ...}
    - New (1.x): nested {content: {title, summary, pubDate, provider, canonicalUrl, ...}}
    Returns a normalized dict or None if parsing fails.
    """
    try:
        # ── New yfinance 1.x format ──
        content = item.get("content", {})
        if content and isinstance(content, dict):
            title = content.get("title", "")
            summary = content.get("summary", title)
            url = ""
            canonical = content.get("canonicalUrl", {})
            if isinstance(canonical, dict):
                url = canonical.get("url", "")
            elif isinstance(canonical, str):
                url = canonical

            pub_date = content.get("pubDate", "")
            try:
                published = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).replace(tzinfo=None) if pub_date else datetime.utcnow()
            except Exception:
                published = datetime.utcnow()

            provider = content.get("provider", {})
            source = provider.get("displayName", "Yahoo Finance") if isinstance(provider, dict) else str(provider)

            return dict(title=title, source=source, published_at=published, url=url, summary=summary[:500])

        # ── Old yfinance format (flat keys) ──
        title = item.get("title", "")
        if not title:
            return None

        pub_ts = item.get("providerPublishTime")
        if pub_ts:
            published = datetime.fromtimestamp(pub_ts, tz=timezone.utc).replace(tzinfo=None)
        else:
            published = datetime.utcnow()

        return dict(
            title=title,
            source=item.get("publisher", "Yahoo Finance"),
            published_at=published,
            url=item.get("link", ""),
            summary=item.get("summary", title)[:500],
        )
    except Exception as e:
        logger.debug("Failed to parse news item: %s | error: %s", item, e)
        return None


class NewsService:
    """
    Fetches and caches financial news.
    Priority: yfinance Ticker.news → yfinance Search API → Yahoo RSS
    """

    def __init__(self, provider_name: str = "YahooFinance"):
        self.provider_name = provider_name

    def _get_cache_key(self, symbol: str) -> str:
        return f"news:{symbol.upper()}"

    def get_news_for_symbol(
        self,
        symbol: str,
        limit: int = 5,
        cache_ttl_minutes: int = 15,
    ) -> NewsResponse:
        symbol = symbol.upper().strip()
        cache_key = self._get_cache_key(symbol)

        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info("News cache HIT | symbol=%s", symbol)
            return NewsResponse(**cached_data).model_copy(update={"cached": True})

        logger.info("News cache MISS | symbol=%s", symbol)
        articles = self._fetch_ticker_news(symbol, limit)

        if not articles:
            logger.warning("Ticker.news returned 0 for %s — trying Search API", symbol)
            articles = self._fetch_search_news(symbol, limit)

        if not articles:
            logger.warning("Search API returned 0 for %s — trying RSS fallback", symbol)
            articles = self._fetch_yahoo_rss(symbol, limit)

        response = NewsResponse(
            symbol=symbol,
            count=len(articles),
            articles=articles,
            cached=False,
            provider=self.provider_name,
        )
        cache.set(cache_key, response.model_dump(mode='json'), ttl_seconds=cache_ttl_minutes * 60)
        return response

    def get_news(self, limit: int = 10) -> list[NewsArticle]:
        """General Indian market news."""
        articles = self._fetch_ticker_news("^NSEI", limit)
        if not articles:
            articles = self._fetch_search_news("NIFTY 50 India", limit)
        if not articles:
            articles = self._fetch_yahoo_rss("^NSEI", limit)
        return articles

    # ── Source 1: yfinance Ticker.news ───────────────────────────────────────

    def _fetch_ticker_news(self, symbol: str, limit: int) -> list[NewsArticle]:
        try:
            ticker = yf.Ticker(symbol)
            raw_news = ticker.news or []
            logger.info("yfinance Ticker.news raw count | symbol=%s | count=%d", symbol, len(raw_news))

            articles = []
            for item in raw_news[:limit]:
                parsed = _parse_yf_news_item(item)
                if not parsed or not parsed.get("title"):
                    continue
                try:
                    sentiment = _parse_sentiment(parsed["title"])
                    articles.append(NewsArticle(sentiment=sentiment, **parsed))
                except ValidationError as e:
                    logger.debug("Validation error for news item: %s", e)

            logger.info("Ticker.news parsed | symbol=%s | count=%d", symbol, len(articles))
            return articles
        except Exception as exc:
            logger.error("Ticker.news failed | symbol=%s | error=%s", symbol, exc)
            return []

    # ── Source 2: yfinance Search API ────────────────────────────────────────

    def _fetch_search_news(self, query: str, limit: int) -> list[NewsArticle]:
        try:
            search = yf.Search(query, news_count=limit)
            raw_news = search.news or []
            logger.info("yfinance Search.news raw count | query=%s | count=%d", query, len(raw_news))

            articles = []
            for item in raw_news[:limit]:
                parsed = _parse_yf_news_item(item)
                if not parsed or not parsed.get("title"):
                    continue
                try:
                    sentiment = _parse_sentiment(parsed["title"])
                    articles.append(NewsArticle(sentiment=sentiment, **parsed))
                except ValidationError as e:
                    logger.debug("Validation error for search news item: %s", e)

            logger.info("Search.news parsed | query=%s | count=%d", query, len(articles))
            return articles
        except Exception as exc:
            logger.error("Search.news failed | query=%s | error=%s", query, exc)
            return []

    # ── Source 3: RSS fallback ────────────────────────────────────────────────

    def _fetch_yahoo_rss(self, symbol: str, limit: int) -> list[NewsArticle]:
        encoded_symbol = urllib.parse.quote(symbol)
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={encoded_symbol}&region=IN&lang=en-US"
        try:
            feed = feedparser.parse(url)
            if feed.bozo:
                return []

            articles = []
            for entry in feed.entries[:limit]:
                try:
                    published = (datetime(*entry.published_parsed[:6])
                                 if hasattr(entry, 'published_parsed') and entry.published_parsed
                                 else datetime.utcnow())
                except Exception:
                    published = datetime.utcnow()

                try:
                    articles.append(NewsArticle(
                        title=entry.title,
                        source=entry.get("publisher", "Yahoo Finance"),
                        published_at=published,
                        url=entry.link,
                        summary=entry.get("summary", "")[:500],
                        sentiment=_parse_sentiment(entry.title),
                    ))
                except ValidationError:
                    continue
            return articles
        except Exception as exc:
            logger.error("RSS fallback failed | symbol=%s | error=%s", symbol, exc)
            return []


# ── Module-level singleton ────────────────────────────────────────────────────
news_service = NewsService()
