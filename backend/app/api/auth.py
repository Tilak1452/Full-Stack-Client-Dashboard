"""
Auth router — handles /auth/register, /auth/login, /auth/me, /auth/logout.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserPublic
from app.services.auth_service import register_user, login_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=201,
    summary="Register a new user account",
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Creates a new user account with hashed password.
    Returns a JWT access token on success.
    - **name**: Full name (2–100 characters)
    - **email**: Must be a valid email, unique across all accounts
    - **password**: Minimum 8 characters
    """
    return register_user(db, payload)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Login with email and password",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns a JWT access token.
    Token is valid for 7 days by default.
    """
    return login_user(db, payload)


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Get currently authenticated user",
)
def me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile of the currently authenticated user.
    Requires: Authorization: Bearer <token> header.
    """
    return current_user


@router.post(
    "/logout",
    summary="Logout (client-side token removal)",
)
def logout():
    """
    Stateless logout — instructs the frontend to clear the token.
    Since JWTs are stateless, actual invalidation happens on the client.
    For server-side token revocation, a token blocklist (Redis) can be added later.
    """
    return {"message": "Logged out successfully. Please clear your local token."}
