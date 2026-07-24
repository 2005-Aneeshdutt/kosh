"""Audit trail + live anomaly detection endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from backend.services import anomaly_detector, audit
from backend.services.live_data import live

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/audit")
def audit_log(limit: int = 100, actor_type: str | None = None, action_prefix: str | None = None) -> dict:
    """Immutable activity trail — every agent, human and system action."""
    return {
        "entries": audit.recent(limit=limit, actor_type=actor_type, action_prefix=action_prefix),
        "summary": audit.summary(),
    }


@router.get("/anomalies")
def anomalies() -> dict:
    """Z-score anomalies over recent payment metrics + per-method health."""
    metrics = live.get_metrics()
    found = anomaly_detector.detect(metrics)
    payments = live.get_payments()[:200]
    breakdown = anomaly_detector.method_failure_breakdown(payments)
    return {
        "anomalies": found,
        "method_health": breakdown,
        "checked_at": metrics[-1]["timestamp"] if metrics else None,
    }
