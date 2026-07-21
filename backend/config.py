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

        # OpenRouter (OpenAI-compatible gateway) — an alternative to a direct
        # Anthropic key. If set, it takes priority for agent copy generation.
        self.openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
        # Cost-optimal default: Claude 3.5 Haiku is cheap (~$0.80/$4 per 1M) and
        # more than enough for Kosh's short prompts. Override for higher quality.
        self.openrouter_model: str = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")

        self.backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./kosh.db")

        # Public base URL used to build clickable payment links inside emails.
        # For a demo on the same machine, localhost works. When sharing links to
        # another device, set KOSH_PUBLIC_URL to a tunnel/deploy URL (e.g. ngrok).
        self.public_url: str = os.getenv("KOSH_PUBLIC_URL", f"http://localhost:{self.backend_port}").rstrip("/")

        # Optional SMTP config (Gmail etc.) so real email delivery survives
        # restarts. These can also be set at runtime via Settings → Email.
        self.smtp_host: str = os.getenv("KOSH_SMTP_HOST", "")
        self.smtp_port: int = int(os.getenv("KOSH_SMTP_PORT", "587"))
        self.smtp_user: str = os.getenv("KOSH_SMTP_USER", "")
        self.smtp_password: str = os.getenv("KOSH_SMTP_PASSWORD", "")
        self.smtp_from: str = os.getenv("KOSH_SMTP_FROM", "")
        self.smtp_from_name: str = os.getenv("KOSH_SMTP_FROM_NAME", "Artisan Coffee Co. (via Kosh)")
        # Deliver every demo email here regardless of the customer's address.
        self.mail_redirect: str = os.getenv("KOSH_MAIL_REDIRECT", "")

        # Google Apps Script Web App URL for live ledger sync (optional).
        self.sheets_webhook: str = os.getenv("KOSH_SHEETS_WEBHOOK", "")

        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        self.cors_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]

    @property
    def has_razorpay_credentials(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def llm_provider(self) -> str:
        """Which LLM backend to use: 'openrouter' | 'anthropic' | 'none'."""
        if self.openrouter_api_key:
            return "openrouter"
        if self.anthropic_api_key:
            return "anthropic"
        return "none"

    @property
    def llm_enabled(self) -> bool:
        return self.llm_provider != "none"

    @property
    def active_model(self) -> str:
        """The model string actually in use, for display/health."""
        if self.llm_provider == "openrouter":
            return self.openrouter_model
        return self.model

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
