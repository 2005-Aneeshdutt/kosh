"""Environment-backed configuration for the Kosh backend."""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

# Load the repo-root .env (one level up from backend/) plus any local .env.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    """Centralised, read-once settings object."""

    def __init__(self) -> None:
        self.razorpay_key_id: str = os.getenv("RAZORPAY_KEY_ID", "")
        self.razorpay_key_secret: str = os.getenv("RAZORPAY_KEY_SECRET", "")
        self.demo_mode: bool = _as_bool(os.getenv("DEMO_MODE"), default=True)

        self.anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
        self.model: str = os.getenv("KOSH_MODEL", "claude-sonnet-5")

        self.backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./kosh.db")

        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        self.cors_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]

    @property
    def has_razorpay_credentials(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def sqlite_path(self) -> str:
        """Resolve the DATABASE_URL to a filesystem path for sqlite3."""
        url = self.database_url
        if url.startswith("sqlite:///"):
            return url.replace("sqlite:///", "", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
