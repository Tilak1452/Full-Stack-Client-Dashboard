"""
Request and response shapes for all /auth/* endpoints.
"""

from pydantic import BaseModel, EmailStr, Field


# ── Requests ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["Rahul Sharma"])
    email: EmailStr = Field(..., examples=["rahul@example.com"])
    password: str = Field(..., min_length=8, max_length=128, examples=["SecurePass123"])


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., examples=["rahul@example.com"])
    password: str = Field(..., min_length=1, examples=["SecurePass123"])


# ── Responses ─────────────────────────────────────────────────────────────────

class UserPublic(BaseModel):
    """Safe user representation — never includes hashed_password."""
    id: int
    name: str
    email: str
    is_active: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Returned after successful register or login."""
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
