"""
Request and response shapes for auth endpoints.

After migrating to Supabase Auth, the user id is a UUID string
(managed by Supabase) instead of an integer primary key.
"""

from pydantic import BaseModel


# ── Response ──────────────────────────────────────────────────────────────────

class UserPublic(BaseModel):
    """Safe user representation returned from /auth/me."""
    id: str        # UUID string from Supabase Auth
    name: str
    email: str
    is_active: bool

    model_config = {"from_attributes": True}
