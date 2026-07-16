"""Thin Claude wrapper used by every agent.

Design goal: the whole product must run perfectly with zero configuration.
When ANTHROPIC_API_KEY is set we call Claude (Sonnet 5 by default) for natural,
context-aware copy. When it is not set — or a call fails — we fall back to a
deterministic template so the demo never breaks and never blocks on the network.
"""
from __future__ import annotations

import logging
from typing import Callable, Optional

from backend.config import settings

logger = logging.getLogger("kosh.llm")

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not settings.llm_enabled:
        return None
    try:
        import anthropic

        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        return _client
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not initialise Anthropic client (%s); using offline templates.", exc)
        return None


def generate(
    prompt: str,
    *,
    system: Optional[str] = None,
    max_tokens: int = 400,
    fallback: Callable[[], str] | str = "",
) -> tuple[str, bool]:
    """Return (text, used_llm).

    ``fallback`` is used whenever Claude is unavailable or errors. It may be a
    plain string or a zero-arg callable that builds one.
    """
    client = _get_client()
    if client is None:
        return _resolve_fallback(fallback), False

    try:
        resp = client.messages.create(
            model=settings.model,
            max_tokens=max_tokens,
            system=system or "You are Kosh, an AI revenue-operations copilot for Indian merchants.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text").strip()
        return (text or _resolve_fallback(fallback)), bool(text)
    except Exception as exc:  # pragma: no cover - network/credential issues
        logger.warning("Claude call failed (%s); using offline template.", exc)
        return _resolve_fallback(fallback), False


def _resolve_fallback(fallback: Callable[[], str] | str) -> str:
    return fallback() if callable(fallback) else fallback
