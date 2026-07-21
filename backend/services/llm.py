"""Thin LLM wrapper used by every agent.

Design goal: the whole product runs perfectly with zero configuration. When an
LLM is configured we call it for natural, context-aware copy; otherwise (or if a
call fails) we fall back to a deterministic template so the demo never breaks and
never blocks on the network.

Two providers are supported, auto-selected in ``config.py``:
  * **openrouter** — an OpenAI-compatible gateway (`OPENROUTER_API_KEY`),
    routed to a Claude model. Takes priority when set.
  * **anthropic**  — a direct Anthropic key (`ANTHROPIC_API_KEY`).
"""
from __future__ import annotations

import json
import logging
import urllib.request
from typing import Callable, Optional

from backend.config import settings

logger = logging.getLogger("kosh.llm")

_client = None
_DEFAULT_SYSTEM = "You are Kosh, an AI revenue-operations copilot for Indian merchants."


def _get_anthropic_client():
    global _client
    if _client is not None:
        return _client
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

    ``fallback`` is used whenever the LLM is unavailable or errors. It may be a
    plain string or a zero-arg callable that builds one.
    """
    provider = settings.llm_provider
    system = system or _DEFAULT_SYSTEM

    if provider == "openrouter":
        text = _openrouter(prompt, system, max_tokens)
        if text:
            return text, True
        return _resolve_fallback(fallback), False

    if provider == "anthropic":
        client = _get_anthropic_client()
        if client is None:
            return _resolve_fallback(fallback), False
        try:
            resp = client.messages.create(
                model=settings.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            return (text or _resolve_fallback(fallback)), bool(text)
        except Exception as exc:  # pragma: no cover - network/credential issues
            logger.warning("Claude call failed (%s); using offline template.", exc)
            return _resolve_fallback(fallback), False

    # provider == "none"
    return _resolve_fallback(fallback), False


def _openrouter(prompt: str, system: str, max_tokens: int) -> Optional[str]:
    """Call OpenRouter's OpenAI-compatible chat completions endpoint."""
    body = json.dumps(
        {
            "model": settings.openrouter_model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
    ).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.public_url,
            "X-Title": "Kosh",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return (data["choices"][0]["message"]["content"] or "").strip() or None
    except Exception as exc:  # pragma: no cover - network/credential issues
        logger.warning("OpenRouter call failed (%s); using offline template.", exc)
        return None


def _resolve_fallback(fallback: Callable[[], str] | str) -> str:
    return fallback() if callable(fallback) else fallback
