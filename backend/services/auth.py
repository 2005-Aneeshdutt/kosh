"""Lightweight token-based auth for the merchant dashboard.

Not a full IdP — a pragmatic, real session layer: hashed credentials, opaque
bearer tokens, in-memory sessions. Good enough to make the product feel like
something you actually sign into, without dragging in heavy dependencies.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Optional

# Seeded demo merchant. Password: "razorpay"
_SALT = "kosh-demo-salt"


def _hash(password: str) -> str:
    return hashlib.sha256((_SALT + password).encode()).hexdigest()


_USERS: dict[str, dict] = {
    "demo@artisancoffee.in": {
        "name": "Aarav Mehta",
        "role": "Founder & CEO",
        "merchant": "Artisan Coffee Co.",
        "password_hash": _hash("razorpay"),
        "avatar": "AM",
    }
}

# token -> {email, name, role, merchant, created}
_SESSIONS: dict[str, dict] = {}

DEMO_EMAIL = "demo@artisancoffee.in"
DEMO_PASSWORD = "razorpay"


def authenticate(email: str, password: str) -> Optional[dict]:
    user = _USERS.get(email.strip().lower())
    if not user:
        return None
    if not hmac.compare_digest(user["password_hash"], _hash(password)):
        return None
    return user


def create_session(email: str) -> str:
    user = _USERS[email.strip().lower()]
    token = secrets.token_urlsafe(24)
    _SESSIONS[token] = {
        "email": email.strip().lower(),
        "name": user["name"],
        "role": user["role"],
        "merchant": user["merchant"],
        "avatar": user["avatar"],
        "created": time.time(),
    }
    return token


def get_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    return _SESSIONS.get(token)


def destroy_session(token: Optional[str]) -> None:
    if token:
        _SESSIONS.pop(token, None)


def token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()
