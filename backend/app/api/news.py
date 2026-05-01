from fastapi import APIRouter, Query
from typing import Optional
from app.services.news_service import news_service

router = APIRouter(prefix="/api/v1", tags=["News"])

@router.get("/news")
def get_news(
    limit: int = Query(default=20, ge=1, le=50),
    symbol: Optional[str] = Query(default=None, description="Stock symbol to fetch news for (e.g. RELIANCE.NS)"),
):
    """
    Returns latest financial news articles from Yahoo Finance RSS.
    When symbol is provided, returns news for that specific stock.
    Each article includes title, source, published_at, url, summary, and sentiment.
    """
    try:
        if symbol:
            response = news_service.get_news_for_symbol(symbol.upper().strip(), limit=limit)
            articles = [a.model_dump(mode='json') for a in response.articles]
        else:
            articles = news_service.get_news(limit=limit)
            articles = [a.model_dump(mode='json') if hasattr(a, 'model_dump') else a for a in articles]
        return {"articles": articles, "count": len(articles)}
    except Exception as e:
        return {"articles": [], "count": 0, "error": str(e)}

