"""
Portfolio Router (api/portfolio.py)

Responsibilities:
- Define HTTP endpoints for portfolio operations.
- Validate requests via Pydantic schemas.
- Delegate ALL business logic to portfolio_service.
- Return structured JSON responses.

This router is THIN — no business logic lives here.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..core.dependencies import get_db
from ..schemas.portfolio import (
    CreatePortfolioRequest,
    AddHoldingRequest,
    RecordTransactionRequest,
    SellHoldingRequest,
    PortfolioResponse,
    PortfolioSummaryResponse,
    TransactionResponse,
    SellResponse,
    HoldingSummary,
)
from ..services import portfolio_service
from ..services.mpt_service import optimize_portfolio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/portfolios", tags=["portfolio"])


# ── 1. Create Portfolio ───────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=List[PortfolioResponse],
    status_code=status.HTTP_200_OK,
    summary="Get all portfolios",
)
def get_all_portfolios(db: Session = Depends(get_db)) -> List[PortfolioResponse]:
    """
    Returns a list of all portfolios.
    """
    logger.info("GET /portfolios")
    portfolios = portfolio_service.get_all_portfolios(db=db)
    return [_build_portfolio_response(p) for p in portfolios]


@router.post(
    "/",
    response_model=PortfolioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new portfolio",
)
def create_portfolio(
    payload: CreatePortfolioRequest,
    db: Session = Depends(get_db),
) -> PortfolioResponse:
    """
    Creates a new portfolio with the given name.
    Returns 409 Conflict if the name already exists.
    """
    logger.info("POST /portfolios | name='%s'", payload.name)
    portfolio = portfolio_service.create_portfolio(db=db, name=payload.name)
    return _build_portfolio_response(portfolio)


# ── 2. Add Holding ────────────────────────────────────────────────────────────

@router.post(
    "/{portfolio_id}/holdings",
    response_model=PortfolioResponse,
    status_code=status.HTTP_200_OK,
    summary="Add or update a holding in a portfolio",
)
def add_holding(
    portfolio_id: int,
    payload: AddHoldingRequest,
    db: Session = Depends(get_db),
) -> PortfolioResponse:
    """
    Adds a new holding or updates quantity + weighted average cost if the symbol exists.
    Returns the full updated portfolio summary.
    Returns 404 if the portfolio doesn't exist.
    """
    logger.info(
        "POST /portfolios/%s/holdings | symbol=%s | qty=%s",
        portfolio_id, payload.symbol, payload.quantity,
    )
    portfolio = portfolio_service.add_holding(
        db=db,
        portfolio_id=portfolio_id,
        symbol=payload.symbol,
        quantity=payload.quantity,
        price=payload.price,
    )
    return _build_portfolio_response(portfolio)


# ── 3. Record Transaction ─────────────────────────────────────────────────────

@router.post(
    "/{portfolio_id}/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a buy or sell transaction",
)
def record_transaction(
    portfolio_id: int,
    payload: RecordTransactionRequest,
    db: Session = Depends(get_db),
) -> TransactionResponse:
    """
    Records a buy or sell transaction.
    For BUY: adds to or creates the holding (weighted average cost).
    For SELL: reduces the holding quantity, calculates FIFO realized P&L.
    Returns 404 if the portfolio doesn't exist.
    Returns 422 if overselling.
    """
    logger.info(
        "POST /portfolios/%s/transactions | type=%s | symbol=%s | qty=%s",
        portfolio_id, payload.transaction_type, payload.symbol, payload.quantity,
    )
    txn = portfolio_service.record_transaction(
        db=db,
        portfolio_id=portfolio_id,
        symbol=payload.symbol,
        transaction_type=payload.transaction_type,
        quantity=payload.quantity,
        price=payload.price,
    )
    return TransactionResponse(
        id=txn.id,
        portfolio_id=txn.portfolio_id,
        symbol=txn.symbol,
        transaction_type=txn.transaction_type.value,
        quantity=txn.quantity,
        price=txn.price,
        total_amount=txn.total_amount,
        realized_pl=txn.realized_pl,
        timestamp=txn.timestamp,
    )


# ── 4. Sell Holding (dedicated endpoint) ──────────────────────────────────────

@router.post(
    "/{portfolio_id}/holdings/{symbol}/sell",
    response_model=SellResponse,
    status_code=status.HTTP_200_OK,
    summary="Sell shares of a holding",
)
def sell_holding(
    portfolio_id: int,
    symbol: str,
    payload: SellHoldingRequest,
    db: Session = Depends(get_db),
) -> SellResponse:
    """
    Sells shares from a holding.
    Calculates realized P&L using FIFO method.
    Returns 422 if overselling.
    """
    symbol = symbol.upper().strip()
    logger.info(
        "POST /portfolios/%s/holdings/%s/sell | qty=%s | price=%s",
        portfolio_id, symbol, payload.quantity, payload.price,
    )
    txn = portfolio_service.record_transaction(
        db=db,
        portfolio_id=portfolio_id,
        symbol=symbol,
        transaction_type="sell",
        quantity=payload.quantity,
        price=payload.price,
    )

    # Check remaining quantity
    from ..models.holding import Holding
    remaining_holding = (
        db.query(Holding)
        .filter(Holding.portfolio_id == portfolio_id, Holding.symbol == symbol)
        .first()
    )
    remaining_qty = remaining_holding.quantity if remaining_holding else 0.0

    return SellResponse(
        status="success",
        message=f"Sold {payload.quantity} shares of {symbol}",
        realized_pl=txn.realized_pl or 0.0,
        remaining_quantity=remaining_qty,
    )


# ── Response Builder ──────────────────────────────────────────────────────────

def _build_portfolio_response(portfolio) -> PortfolioResponse:
    """
    Constructs a PortfolioResponse from a Portfolio ORM object.
    Kept here to avoid leaking response-building logic into the service.
    """
    holdings = [
        HoldingSummary(
            id=h.id,
            symbol=h.symbol,
            quantity=h.quantity,
            average_price=h.average_price,
            total_invested=round(h.quantity * h.average_price, 2),
            cost_basis=h.cost_basis,
            current_price=h.current_price,
            current_value=h.current_value,
            unrealized_pl=h.unrealized_pl,
            unrealized_pl_pct=h.unrealized_pl_pct,
            realized_pl=h.realized_pl or 0.0,
            realized_pl_pct=h.realized_pl_pct or 0.0,
            first_purchase_date=h.first_purchase_date,
            last_price_update=h.last_price_update,
        )
        for h in portfolio.holdings
    ]
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        created_at=portfolio.created_at,
        holdings=holdings,
    )


# ── 5. Portfolio Summary ──────────────────────────────────────────────────────

@router.get(
    "/{portfolio_id}/summary",
    response_model=PortfolioSummaryResponse,
    status_code=200,
    summary="Fetch aggregated portfolio summary with P&L",
)
def get_portfolio_summary(
    portfolio_id: int,
    db: Session = Depends(get_db),
) -> PortfolioSummaryResponse:
    """
    Returns an aggregated summary of the portfolio with all pre-calculated P&L.
    Frontend just displays — no manual calculations needed.
    """
    logger.info("GET /portfolios/%s/summary", portfolio_id)
    data = portfolio_service.get_portfolio_summary(db=db, portfolio_id=portfolio_id)
    return PortfolioSummaryResponse(**data)

# ── 6. Optimize Portfolio (MPT) ──────────────────────────────────────────────

@router.get(
    "/{portfolio_id}/optimize",
    status_code=200,
    summary="Optimize portfolio weights using Modern Portfolio Theory",
)
def optimize_user_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
):
    logger.info("GET /portfolios/%s/optimize", portfolio_id)
    portfolio = portfolio_service._get_portfolio_or_404(db, portfolio_id)
    
    symbols = [h.symbol for h in portfolio.holdings if h.quantity > 0]
    if len(symbols) < 2:
        return {"status": "error", "message": "At least 2 active holdings required to optimize."}
        
    return optimize_portfolio(symbols)
