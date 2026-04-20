"""
Auth router — Supabase Auth edition.

Login and Registration are now handled entirely on the frontend
by the Supabase JS client. The backend only needs to provide:

  GET /api/v1/auth/me  — validate the Supabase JWT and return user info

This endpoint is used by the frontend to verify the session is still
valid after a page reload, without calling Supabase directly.
"""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.schemas.auth import UserPublic

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Get currently authenticated user",
)
def me(current_user: dict = Depends(get_current_user)):
    """
    Returns the profile of the currently authenticated user.
    Requires: Authorization: Bearer <supabase_access_token> header.
    The token is verified against the SUPABASE_JWT_SECRET.
    """
    return UserPublic(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        is_active=current_user["is_active"],
    )
