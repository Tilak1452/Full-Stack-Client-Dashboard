"""
Price Update Background Job (services/price_update_job.py)

Responsibilities:
- Runs every 5 minutes via APScheduler.
- Fetches current market prices for all held symbols.
- Updates holdings with current_price, current_value, unrealized_pl.
- Uses batch fetching to minimize yfinance API calls.
"""

import logging
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import distinct

from ..core.database import SessionLocal
from ..models.holding import Holding
from .portfolio_service import update_holding_prices

logger = logging.getLogger(__name__)


def update_all_holdings_prices():
    """
    Background job: fetches current prices for all distinct symbols
    across all holdings and updates P&L calculations.

    Called by APScheduler every 5 minutes.
    """
    db: Session = SessionLocal()
    try:
        # Get all distinct symbols that have holdings
        symbols = [
            row[0]
            for row in db.query(distinct(Holding.symbol))
            .filter(Holding.quantity > 0)
            .all()
        ]

        if not symbols:
            logger.debug("No active holdings to update prices for")
            return

        logger.info("Updating prices for %d symbols: %s", len(symbols), symbols)

        # Batch fetch prices using yfinance
        prices = _batch_fetch_prices(symbols)

        if not prices:
            logger.warning("Failed to fetch any prices")
            return

        # Update each holding
        updated_count = 0
        holdings = db.query(Holding).filter(Holding.quantity > 0).all()

        for holding in holdings:
            price = prices.get(holding.symbol)
            if price and price > 0:
                update_holding_prices(db, holding.id, price)
                updated_count += 1

        db.commit()
        logger.info(
            "Price update complete | updated=%d/%d holdings",
            updated_count, len(holdings),
        )

    except Exception as e:
        logger.error("Price update job failed: %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


def _batch_fetch_prices(symbols: list[str]) -> dict[str, float]:
    """
    Fetch current prices for a list of symbols using yfinance.
    Returns a dict of {symbol: price}.
    """
    prices = {}

    try:
        import yfinance as yf

        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.fast_info
                price = getattr(info, "last_price", None)
                if price is None:
                    price = getattr(info, "previous_close", None)
                if price and price > 0:
                    prices[symbol] = float(price)
                    logger.debug("Fetched price | %s = %.2f", symbol, price)
            except Exception as e:
                logger.warning("Failed to fetch price for %s: %s", symbol, e)

    except ImportError:
        logger.error("yfinance not installed — cannot update prices")

    return prices
