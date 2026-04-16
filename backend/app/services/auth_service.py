"""
Authentication business logic.
Handles user creation, credential verification, and token issuance.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserPublic
from app.core.security import hash_password, verify_password, create_access_token


def register_user(db: Session, payload: RegisterRequest) -> AuthResponse:
    """
    Creates a new user account.
    Raises 409 if email is already registered.
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # Create the user row
    new_user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Issue JWT
    token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})

    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(new_user),
    )


def login_user(db: Session, payload: LoginRequest) -> AuthResponse:
    """
    Authenticates an existing user.
    Raises 401 on bad credentials (intentionally vague for security).
    """
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    # Use constant-time comparison to prevent timing attacks
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated."
        )

    # Update last login timestamp
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id, User.is_active == True).first()
