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

    # JWT Authentication (legacy custom JWT — kept for reference)
    jwt_secret: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # Supabase Auth — JWT secret used to verify tokens issued by Supabase GoTrue
    supabase_jwt_secret: str = ""

    # ─── Direct Provider APIs (No OpenRouter) ───────────────────────────────
    # Tier 1 — Simple: Google Gemma 4 31B (direct via langchain-google-genai)
    # Multiple keys for rotation when one hits quota limits
    
    gemini_api_key_1: str = ""     # Gemini_API_KEY_1
    gemini_api_key_2: str = ""     # Gemini_API_KEY_2
    gemini_api_key_3: str = ""     # Gemini_API_KEY_3
    gemini_api_key_4: str = ""     # Gemini_API_KEY_4
    gemini_api_key_5: str = ""     # Gemini_API_KEY_5
    gemini_api_key_6: str = ""     # Gemini_API_KEY_6
    gemini_api_key_7: str = ""     # Gemini_API_KEY_7
    gemini_api_key_8: str = ""     # Gemini_API_KEY_8
    gemini_api_key_9: str = ""     # Gemini_API_KEY_9
    gemini_api_key_10: str = ""    # Gemini_API_KEY_10

    # ─── Direct Provider APIs (Gemini only — NVIDIA NIM removed) ─────────────────
    # All LLM tiers now use Google Gemini keys (Flash-Lite for classify/simple,
    # Flash for medium/complex/fundamentals). 7 keys in round-robin rotation.

    # ─── Model slugs (direct provider format) ────────────────────────────────
    simple_model: str = "gemma-4-31b-it"           # Google AI Studio slug
    medium_model: str = "gemini-2.5-flash"          # Gemini 2.5 Flash (replaced Qwen/NIM)
    complex_model: str = "gemini-2.5-flash"         # Gemini 2.5 Flash (replaced Qwen/NIM)

    # Gemini model tiers (direct Google AI)
    gemini_flash_model: str = "gemini-2.5-flash"              # Full Flash — medium/complex/fundamentals
    gemini_flash_lite_model: str = "gemini-2.5-flash-lite"    # Lite Flash — simple/classify (fast + cheap)
    gemini_pro_model: str = "gemini-2.5-pro"                  # Pro — fallback for heavy queries

    # ─── Per-node token budgets ───────────────────────────────────────────────
    nemotron_classify_max_tokens: int = 200
    nemotron_analyze_max_tokens: int = 2500
    nemotron_news_max_tokens: int = 1200
    nemotron_portfolio_max_tokens: int = 1800
    nemotron_general_max_tokens: int = 900
    nemotron_market_max_tokens: int = 4000

    # ─── GNews API key ────────────────────────────────────────────────────────
    gnews_api_key: str = ""

    # ── NEW: Phase 3 — Data Provider Key Lists (comma-separated) ─────────────
    # These are loaded by KeyManager for multi-key round-robin rotation.
    # KeyManager reads from env vars directly; these settings are for reference.
    google_api_keys: str = ""           # Maps to GOOGLE_API_KEYS (comma-sep)
    nvidia_api_keys: str = ""           # Maps to NVIDIA_API_KEYS (comma-sep)
    finnhub_api_keys: str = ""          # Maps to FINNHUB_API_KEYS (comma-sep)
    twelve_data_api_keys: str = ""      # Maps to TWELVE_DATA_API_KEYS (comma-sep)
    fmp_api_keys: str = ""              # Maps to FMP_API_KEYS (comma-sep)
    alpha_vantage_keys: str = ""        # Maps to ALPHA_VANTAGE_KEYS (comma-sep)
    news_api_keys: str = ""             # Maps to NEWS_API_KEYS (comma-sep)
    fred_api_keys: str = ""             # Maps to FRED_API_KEYS (comma-sep)

    # ── Phase 3 — Data Fetch Timeouts (seconds) ─────────────────────────────
    timeout_yahoo: int = 5
    timeout_fmp: int = 4
    timeout_finnhub: int = 4
    timeout_alpha_vantage: int = 6
    timeout_newsapi: int = 3
    timeout_twelve_data: int = 5         # Twelve Data API (NSE/BSE Indian stocks)
    timeout_fred: int = 8
    timeout_nse_scrape: int = 6
    timeout_bse_scrape: int = 6

    # ── NEW: Phase 3/4 — LLM Provider Config ─────────────────────────────────
    llm_provider_timeout: int = 35      # Per-LLM-call timeout for Phase 4 nodes

    # ── NEW: Phase 4 — Feature Flags ──────────────────────────────────────────
    enable_parallel_phase4: bool = True  # Controls whether Phase 4 runs parallel nodes
    enable_artifact_system: bool = True  # Controls whether artifact_type is emitted via SSE

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
