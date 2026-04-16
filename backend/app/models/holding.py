"""
Holding Model (holding.py)

Responsibilities:
1. Represents a single stock position inside a portfolio.
2. Stores the stock symbol, number of shares, and average buy price.
3. Tracks current market data (price, value, unrealized P&L).
4. Tracks realized P&L from completed sales.
5. Linked to a parent Portfolio via a foreign key.

Relationships:
- Many Holdings → One Portfolio (many-to-one).
- Cascade: If a Portfolio is deleted, all its Holdings are deleted automatically.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..core.database import Base

# TYPE_CHECKING guard prevents circular imports at runtime.
# The import is only resolved by mypy / IDEs for type hints.
if TYPE_CHECKING:
    from .portfolio import Portfolio


class Holding(Base):
    """
    SQLAlchemy model for the 'holdings' table.

    A Holding represents how many shares of a single stock symbol
    a portfolio currently owns, and at what average cost.

    Fields:
    - id: Primary key (Integer, auto-incremented).
    - portfolio_id: Foreign key referencing portfolios.id.
    - symbol: Stock ticker (e.g., 'AAPL'), indexed for fast lookups.
    - quantity: Number of shares held (supports fractional shares).
    - average_price: The weighted average cost per share across all buy transactions.
    - cost_basis: Total invested amount (quantity × average_price).
    - current_price: Last fetched market price (updated by background job).
    - current_value: quantity × current_price.
    - unrealized_pl: current_value - cost_basis.
    - unrealized_pl_pct: (unrealized_pl / cost_basis) × 100.
    - realized_pl: Cumulative P&L from completed sales (FIFO).
    - realized_pl_pct: realized_pl as percentage of original cost_basis.
    - first_purchase_date: When the position was first opened.
    - last_price_update: When current_price was last refreshed.
    """
    __tablename__ = "holdings"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # ── Foreign Key ────────────────────────────────────────────────────────
    portfolio_id: Mapped[int] = mapped_column(
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    symbol: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    average_price: Mapped[float] = mapped_column(Float, nullable=False)

    # ── New: Cost Basis (denormalized for performance) ─────────────────────
    cost_basis: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── New: Current Market Data (updated by background job) ───────────────
    current_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unrealized_pl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unrealized_pl_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── New: Realized P&L (from completed sales) ──────────────────────────
    realized_pl: Mapped[Optional[float]] = mapped_column(Float, default=0.0, server_default="0")
    realized_pl_pct: Mapped[Optional[float]] = mapped_column(Float, default=0.0, server_default="0")

    # ── New: Metadata ─────────────────────────────────────────────────────
    first_purchase_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
    )
    last_price_update: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ── ORM Relationship ───────────────────────────────────────────────────
    portfolio: Mapped["Portfolio"] = relationship(
        "Portfolio",
        back_populates="holdings",
    )

    def __repr__(self) -> str:
        return (
            f"<Holding(id={self.id}, symbol='{self.symbol}', "
            f"qty={self.quantity}, avg_price={self.average_price})>"
        )
