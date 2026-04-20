"""
security.py — Supabase Auth edition

The backend no longer creates or hashes passwords. Its only job is to
VERIFY the JWT that Supabase issues to the frontend after login.

Supabase JWTs are standard HS256 tokens signed with the project's
JWT secret (SUPABASE_JWT_SECRET). The payload includes:
  - sub:           user UUID (string)
  - email:         user's email
  - role:          "authenticated"
  - user_metadata: { name: "..." } (set at sign-up)
  - exp:           expiry timestamp
"""

from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodes and verifies a Supabase-issued JWT.

    Uses the SUPABASE_JWT_SECRET (HS256) and checks that the audience
    claim is 'authenticated', which is what Supabase sets for all
    logged-in user tokens (as opposed to 'anon' for the anon key).

    Returns the payload dict on success, None on any failure.
    """
    if not settings.supabase_jwt_secret:
        # Safety guard: if someone accidentally deploys without the secret,
        # all auth will fail loudly rather than silently accepting any token.
        return None
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        return None
