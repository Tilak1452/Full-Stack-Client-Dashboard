"""
Application configuration — loaded from .env via python-dotenv.
Extend this as the project grows (DB URL, LLM keys, etc.)
"""

import os
from pydantic_settings import BaseSettings

# Calculate the root path (financial_ai/) assuming config.py is inside backend/app/core/
current_file_dir = os.path.dirname(os.path.abspath(__file__))
# current_file_dir is backend/app/core. Go up 3 levels to reach financial_ai/
root_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", ".."))

env_path = os.path.join(root_dir, ".env")

class Settings(BaseSettings):
    app_name: str = "Financial Research AI"
    debug: bool = False
    log_level: str = "INFO"

    # Database — read from DATABASE_URL in .env (required, no default)
    database_url: str

    # LLM
    openai_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""

    # External APIs
    news_api_key: str = ""

    # Caching
    redis_url: str = "redis://localhost:6379/0"

    # JWT Authentication
    jwt_secret: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # ─── NVIDIA Nemotron via OpenRouter (Agent Pipeline) ──────────────────────
    nvidia_nemotron_3_super_api_key: str = ""
    nvidia_nemotron_3_nano_api_key: str = ""          # Falls back to super key if blank
    nvidia_base_url: str = "https://openrouter.ai/api/v1"
    nemotron_super_model: str = "nvidia/llama-3.1-nemotron-70b-instruct"
    nemotron_nano_model: str = "meta-llama/llama-3.1-8b-instruct"

    # ─── Per-node token budgets ───────────────────────────────────────────────
    nemotron_classify_max_tokens: int = 200
    nemotron_analyze_max_tokens: int = 2500
    nemotron_news_max_tokens: int = 1200
    nemotron_portfolio_max_tokens: int = 1800
    nemotron_general_max_tokens: int = 900
    nemotron_market_max_tokens: int = 4000

    # ─── GNews API key ────────────────────────────────────────────────────────
    gnews_api_key: str = ""

    class Config:
        env_file = env_path
        extra = "ignore"

settings = Settings()



# ### ✅ What Was Added

# ```python
# from pydantic_settings import BaseSettings

# class Settings(BaseSettings):
#     app_name: str = "Financial Research AI"
#     log_level: str = "INFO"
#     openai_api_key: str

#     class Config:
#         env_file = ".env"

# settings = Settings()
# ```

# ---

# ### 🎯 Purpose of This Implementation

# * Introduced a **structured configuration management system** using `BaseSettings`.
# * Enabled **type-safe and validated environment variable handling**.
# * Implemented **fail-fast behavior at application startup** if required variables (e.g., API keys) are missing.
# * Ensured sensitive data (like API keys) is managed securely through environment variables instead of hardcoding.

# ---

# ### 🧠 Problems It Solves

# * Eliminates hardcoded secrets from the codebase.
# * Detects missing or misconfigured environment variables during startup.
# * Centralizes configuration management for better maintainability and scalability.
