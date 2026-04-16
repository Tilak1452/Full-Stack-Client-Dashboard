"""
Portfolio Service (services/portfolio_service.py)

Responsibilities:
- Contains ALL business logic for portfolio operations.
- Routers call this service and stay thin (no logic inside routers).
- Handles: duplicate name detection, holding upsert, transaction recording,
  holdings update on buy/sell, negative quantity guard, and FIFO P&L.

This module is database-aware but NOT FastAPI-aware.
No HTTP concepts (HTTPException, status codes) except when raised for the router.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.portfolio import Portfolio
from ..models.holding import Holding
from ..models.transaction import Transaction, TransactionType

logger = logging.getLogger(__name__)


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_portfolio_or_404(db: Session, portfolio_id: int) -> Portfolio:
    """
    Fetches a Portfolio by ID or raises HTTP 404.
    Centralizes the lookup so every endpoint uses the same error response.
    """
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with id={portfolio_id} not found.",
        )
    return portfolio


# ── Service Functions ─────────────────────────────────────────────────────────

def create_portfolio(db: Session, name: str) -> Portfolio:
    """
    Creates a new Portfolio row in the database.

    Raises:
        HTTPException 409: If a portfolio with the same name already exists.
    """
    existing = db.query(Portfolio).filter(Portfolio.name == name).first()
    if existing:
        logger.warning("Duplicate portfolio name attempted: '%s'", name)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A portfolio named '{name}' already exists.",
        )

    portfolio = Portfolio(name=name)
    db.add(portfolio)
    db.flush()
    logger.info("Portfolio created | id=%s | name='%s'", portfolio.id, portfolio.name)
    return portfolio


def get_all_portfolios(db: Session) -> list[Portfolio]:
    """
    Returns a list of all portfolios.
    """
    portfolios = db.query(Portfolio).all()
    logger.info("Fetched all %d portfolios", len(portfolios))
    return portfolios


def add_holding(
    db: Session, portfolio_id: int, symbol: str, quantity: float, price: float
) -> Portfolio:
    """
    Adds or updates a Holding within a portfolio.

    - If a holding for this symbol already exists → update quantity and recalculate
      weighted average cost.
    - If it does not exist → create a new Holding row.

    Uses the CORRECT weighted average formula:
    new_avg = ((old_qty × old_avg) + (new_qty × new_price)) / (old_qty + new_qty)

    Returns the parent Portfolio (for building the response).
    """
    portfolio = _get_portfolio_or_404(db, portfolio_id)

    existing_holding: Optional[Holding] = (
        db.query(Holding)
        .filter(Holding.portfolio_id == portfolio_id, Holding.symbol == symbol)
        .first()
    )

    if existing_holding:
        # Weighted average cost formula
        total_qty = existing_holding.quantity + quantity
        old_cost_total = existing_holding.quantity * existing_holding.average_price
        new_cost_total = quantity * price
        new_avg = (old_cost_total + new_cost_total) / total_qty

        existing_holding.quantity = total_qty
        existing_holding.average_price = round(new_avg, 4)
        existing_holding.cost_basis = round(total_qty * new_avg, 2)
        logger.info(
            "Holding updated | portfolio=%s | symbol=%s | qty=%s | avg_price=%s",
            portfolio_id, symbol, total_qty, new_avg,
        )
    else:
        new_holding = Holding(
            portfolio_id=portfolio_id,
            symbol=symbol,
            quantity=quantity,
            average_price=price,
            cost_basis=round(quantity * price, 2),
            first_purchase_date=datetime.utcnow(),
        )
        db.add(new_holding)
        db.flush()
        logger.info(
            "Holding created | portfolio=%s | symbol=%s | qty=%s",
            portfolio_id, symbol, quantity,
        )

    return portfolio


def record_transaction(
    db: Session,
    portfolio_id: int,
    symbol: str,
    transaction_type: str,
    quantity: float,
    price: float,
) -> Transaction:
    """
    Records a buy or sell transaction and updates the corresponding holding.

    Buy  → increases holding quantity, recalculates weighted average cost.
    Sell → decreases holding quantity, calculates realized P&L using FIFO.

    Raises:
        HTTPException 422: If a SELL would result in negative quantity (oversell).
    """
    portfolio = _get_portfolio_or_404(db, portfolio_id)

    txn_enum = TransactionType(transaction_type)

    existing_holding: Optional[Holding] = (
        db.query(Holding)
        .filter(Holding.portfolio_id == portfolio_id, Holding.symbol == symbol)
        .first()
    )

    realized_pl = None

    if txn_enum == TransactionType.BUY:
        # BUY → upsert holding with correct weighted average
        if existing_holding:
            total_qty = existing_holding.quantity + quantity
            old_cost_total = existing_holding.quantity * existing_holding.average_price
            new_cost_total = quantity * price
            new_avg = (old_cost_total + new_cost_total) / total_qty

            existing_holding.quantity = total_qty
            existing_holding.average_price = round(new_avg, 4)
            existing_holding.cost_basis = round(total_qty * new_avg, 2)
        else:
            db.add(Holding(
                portfolio_id=portfolio_id,
                symbol=symbol,
                quantity=quantity,
                average_price=price,
                cost_basis=round(quantity * price, 2),
                first_purchase_date=datetime.utcnow(),
            ))

    elif txn_enum == TransactionType.SELL:
        # SELL → validate, calculate FIFO P&L, update holding
        if not existing_holding or existing_holding.quantity < quantity:
            available = existing_holding.quantity if existing_holding else 0
            logger.warning(
                "Oversell attempted | portfolio=%s | symbol=%s | sell=%s | held=%s",
                portfolio_id, symbol, quantity, available,
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot sell {quantity} shares of {symbol}. "
                    f"Only {available} shares available."
                ),
            )

        # ── FIFO Realized P&L Calculation ──────────────────────────────────
        buy_transactions = (
            db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.symbol == symbol,
                Transaction.transaction_type == TransactionType.BUY,
            )
            .order_by(Transaction.timestamp)
            .all()
        )

        qty_remaining = quantity
        realized_pl = 0.0

        for buy_txn in buy_transactions:
            if qty_remaining <= 0:
                break
            qty_from_this_buy = min(qty_remaining, buy_txn.quantity)
            profit = qty_from_this_buy * (price - buy_txn.price)
            realized_pl += profit
            qty_remaining -= qty_from_this_buy

        realized_pl = round(realized_pl, 2)

        # Update holding
        existing_holding.quantity -= quantity
        old_cost_basis = existing_holding.cost_basis or (
            (existing_holding.quantity + quantity) * existing_holding.average_price
        )

        if existing_holding.quantity <= 0:
            # All shares sold — accumulate realized P&L, then delete
            existing_holding.realized_pl = (existing_holding.realized_pl or 0) + realized_pl
            if old_cost_basis and old_cost_basis > 0:
                existing_holding.realized_pl_pct = round(
                    (existing_holding.realized_pl / old_cost_basis) * 100, 2
                )
            db.delete(existing_holding)
        else:
            # Partial sale
            existing_holding.realized_pl = (existing_holding.realized_pl or 0) + realized_pl
            existing_holding.cost_basis = round(
                existing_holding.quantity * existing_holding.average_price, 2
            )

    # Insert the immutable transaction record
    txn = Transaction(
        portfolio_id=portfolio_id,
        symbol=symbol,
        transaction_type=txn_enum,
        quantity=quantity,
        price=price,
        total_amount=round(quantity * price, 2),
        realized_pl=realized_pl,
    )
    db.add(txn)
    db.flush()

    logger.info(
        "Transaction recorded | id=%s | portfolio=%s | type=%s | symbol=%s | qty=%s | price=%s | realized_pl=%s",
        txn.id, portfolio_id, transaction_type, symbol, quantity, price, realized_pl,
    )
    return txn


def update_holding_prices(db: Session, holding_id: int, current_price: float) -> Holding:
    """
    Update current price and recalculate unrealized P&L for a holding.
    Called by the background price update job.
    """
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        return None

    cost_basis = holding.cost_basis or (holding.quantity * holding.average_price)

    holding.current_price = current_price
    holding.current_value = round(holding.quantity * current_price, 2)
    holding.unrealized_pl = round(holding.current_value - cost_basis, 2)
    holding.unrealized_pl_pct = (
        round((holding.unrealized_pl / cost_basis) * 100, 2)
        if cost_basis > 0 else 0.0
    )
    holding.last_price_update = datetime.utcnow()

    logger.debug(
        "Holding price updated | id=%s | symbol=%s | price=%.2f | upl=%.2f",
        holding.id, holding.symbol, current_price, holding.unrealized_pl,
    )
    return holding


def get_portfolio_summary(db: Session, portfolio_id: int) -> dict:
    """
    Aggregates portfolio data for the summary endpoint.

    Returns all holdings with pre-calculated P&L values.
    Frontend just displays — no manual calculations needed.
    """
    portfolio = _get_portfolio_or_404(db, portfolio_id)
    holdings = portfolio.holdings

    total_invested = 0.0
    total_current_value = 0.0
    total_unrealized_pl = 0.0
    total_realized_pl = 0.0
    holdings_data = []

    for h in holdings:
        cost_basis = h.cost_basis or round(h.quantity * h.average_price, 2)
        current_value = h.current_value or 0.0
        unrealized_pl = h.unrealized_pl or 0.0
        unrealized_pl_pct = h.unrealized_pl_pct or 0.0

        total_invested += cost_basis
        total_current_value += current_value if current_value else cost_basis
        total_unrealized_pl += unrealized_pl
        total_realized_pl += h.realized_pl or 0.0

        holdings_data.append({
            "id": h.id,
            "symbol": h.symbol,
            "quantity": h.quantity,
            "average_price": h.average_price,
            "cost_basis": cost_basis,
            "current_price": h.current_price,
            "current_value": current_value if current_value else None,
            "unrealized_pl": unrealized_pl,
            "unrealized_pl_pct": unrealized_pl_pct,
            "realized_pl": h.realized_pl or 0.0,
            "realized_pl_pct": h.realized_pl_pct or 0.0,
            "first_purchase_date": h.first_purchase_date,
            "last_price_update": h.last_price_update,
        })

    total_unrealized_pl_pct = (
        round((total_unrealized_pl / total_invested) * 100, 2)
        if total_invested > 0 else 0.0
    )

    logger.info(
        "Portfolio summary | id=%s | holdings=%d | invested=%.2f | value=%.2f | upl=%.2f",
        portfolio_id, len(holdings), total_invested, total_current_value, total_unrealized_pl,
    )

    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "created_at": portfolio.created_at,
        "total_holdings": len(holdings),
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current_value, 2),
        "total_unrealized_pl": round(total_unrealized_pl, 2),
        "total_unrealized_pl_pct": total_unrealized_pl_pct,
        "total_realized_pl": round(total_realized_pl, 2),
        "market_value": round(total_current_value, 2) if total_current_value > 0 else None,
        "holdings": holdings_data,
    }
