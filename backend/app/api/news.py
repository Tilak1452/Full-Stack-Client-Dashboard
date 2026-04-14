from fastapi import APIRouter, Query
from app.services.news_service import news_service

router = APIRouter(prefix="/api/v1", tags=["News"])

@router.get("/news")
def get_news(limit: int = Query(default=20, ge=1, le=50)):
    """
    Returns latest financial news articles from Yahoo Finance RSS.
    Each article includes title, source, published_at, url, summary, and sentiment.
    """
    try:
        articles = news_service.get_news(limit=limit)
        return {"articles": articles, "count": len(articles)}
    except Exception as e:
        return {"articles": [], "count": 0, "error": str(e)}
