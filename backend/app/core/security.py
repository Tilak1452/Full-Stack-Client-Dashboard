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

import json
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings

def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodes and verifies a Supabase-issued JWT.
    
    Supports both:
    - Legacy HS256 (using a plain string secret)
    - Modern ES256 / RS256 (using a JSON Web Key - JWK string)
    """
    secret = settings.supabase_jwt_secret
    
    if not secret:
        return None
        
    try:
        # Determine the algorithm and key format based on the secret's content
        if secret.strip().startswith("{"):
            # It's a JWK (JSON Web Key) block for ES256 or RS256
            key = json.loads(secret)
            algorithms = [key.get("alg", "ES256")]
        else:
            # It's a standard Legacy HS256 secret string
            key = secret
            algorithms = ["HS256"]

        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience="authenticated",
        )
    except (JWTError, json.JSONDecodeError) as e:
        print(f"JWT Verification Failed: {e}")
        return None
