"""Immutable activity trail.

A thin, exception-safe wrapper over the SQLite audit_log table. Every agent
action, human decision, and material system event should flow through
:func:`record` so the Audit page can present one trustworthy timeline.
Recording must never break the operation it is describing.
"""
from __future__ import annotations

from typing import Any, Optional

from backend.models import database


def record(
    actor_type: str,
    actor: str,
    action: str,
    *,
    target: Optional[str] = None,
    detail: Optional[str] = None,
    amount: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    try:
        database.record_audit(
            actor_type, actor, action,
            target=target, detail=detail, amount=amount, metadata=metadata,
        )
    except Exception:  # pragma: no cover - audit must never break a request
        pass


def agent(actor: str, action: str, **kw: Any) -> None:
    record("agent", actor, action, **kw)


def human(actor: str, action: str, **kw: Any) -> None:
    record("human", actor, action, **kw)


def system(action: str, **kw: Any) -> None:
    record("system", "system", action, **kw)


def recent(limit: int = 100, actor_type: Optional[str] = None,
           action_prefix: Optional[str] = None) -> list[dict[str, Any]]:
    try:
        return database.query_audit(limit, actor_type, action_prefix)
    except Exception:  # pragma: no cover
        return []


def summary() -> dict[str, int]:
    try:
        return database.audit_summary()
    except Exception:  # pragma: no cover
        return {"total": 0, "agent": 0, "human": 0, "system": 0}
