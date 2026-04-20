"""
FastAPI Dependency Injection Layer (dependencies.py)

Responsibilities:
1. Provide get_db() — a generator dependency that yields a SQLAlchemy session.
2. Commit the session transaction when the route completes successfully.
3. Rollback the session transaction if any exception occurs mid-request.
4. Guarantee the session is always closed after the request lifecycle ends.
5. Keep all transaction management here — route handlers stay business-logic-only.

Usage in a route:
    from fastapi import Depends
    from sqlalchemy.orm import Session
    from .dependencies import get_db

    @router.post("/portfolios")
    def create_portfolio(db: Session = Depends(get_db)):
        # db is already open
        # If this function returns normally → get_db() commits
        # If this function raises an exception → get_db() rolls back
        ...

Design decisions:
- `try / except / finally` pattern is the industry standard for safe DB sessions.
- Commit happens INSIDE the dependency (not the route) so every route
  automatically gets atomic transaction behavior without writing boilerplate.
- Rollback is triggered by ANY exception — including HTTP exceptions raised by
  FastAPI (e.g., HTTPException 404) and SQLAlchemy integrity errors.
- Session closes in `finally` → zero connection leaks, even on crashes.
- No business logic here — this file only manages lifecycle.
"""

import logging
from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import SessionLocal
from .security import decode_access_token

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides a SQLAlchemy session with full transaction management.

    Transaction lifecycle:
    1. Open  → SessionLocal() creates a new session bound to the engine.
    2. Yield → The session is given to the route handler for use.
    3. Commit → If the route returns normally, all pending changes are committed.
    4. Rollback → If ANY exception is raised (HTTP or DB), all changes are undone.
    5. Close  → The session is always closed to release the DB connection.

    Example behaviour:
        Route inserts 3 rows → route raises HTTPException(404)
        → get_db() catches exception → rollback() → 0 rows inserted
        → DB remains consistent.
    """
    db: Session = SessionLocal()
    logger.debug("DB session opened")
    try:
        yield db
        db.commit()
        logger.debug("DB session committed")
    except Exception as exc:
        db.rollback()
        logger.warning("DB session rolled back | reason: %s", str(exc))
        raise
    finally:
        db.close()
        logger.debug("DB session closed")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency that extracts and validates a Supabase JWT from the
    Authorization: Bearer <token> header.

    Returns a plain dict with user info extracted from the token payload.
    No database query required — Supabase embeds all necessary info in the JWT.

    Usage in any route:
        @router.get("/protected")
        def protected_route(current_user: dict = Depends(get_current_user)):
            user_id = current_user["id"]   # UUID string
            email   = current_user["email"]
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id": payload.get("sub"),                                    # UUID string
        "email": payload.get("email", ""),
        "name": payload.get("user_metadata", {}).get("name", ""),
        "is_active": True,
    }
