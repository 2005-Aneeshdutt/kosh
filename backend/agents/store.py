"""Process-wide store for the latest agent run + uploaded bank statement.

Read endpoints always reflect the LIVE dataset (so streaming payments and
customer checkouts show up instantly), with the most recent agent run's
*outputs* (collection actions, anomalies, reconciliation, alerts) overlaid on
top when available.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Optional

from backend.agents.oracle_agent import forecast as compute_forecast
from backend.agents.pulse_agent import compute_health
from backend.razorpay_client.client import get_client
from backend.services import debtor_scorer

# Short-lived cache so bursts of dashboard reads reuse one computation. The
# window is small enough that live payments still feel instant (SSE drives the
# UI), but it removes redundant CPU work under concurrent load.
_SNAPSHOT_TTL = 0.3


class Store:
    def __init__(self) -> None:
        self.latest: Optional[dict[str, Any]] = None
        self.bank_entries: list[dict[str, Any]] = []
        self.last_recon: Optional[dict[str, Any]] = None
        self.status: dict[str, str] = {
            "collect": "idle",
            "recon": "idle",
            "oracle": "idle",
            "pulse": "idle",
        }
        self._cache: Optional[dict[str, Any]] = None
        self._cache_ts = 0.0
        self._cache_version = -1
        self._cache_lock = threading.Lock()

    def _invalidate(self) -> None:
        self._cache = None

    def set_run(self, final_state: dict[str, Any]) -> None:
        self.latest = final_state
        if final_state.get("reconciliation_result", {}).get("ran"):
            self.last_recon = final_state["reconciliation_result"]
        self._invalidate()

    def set_bank_entries(self, entries: list[dict[str, Any]]) -> None:
        self.bank_entries = entries

    def snapshot(self) -> dict[str, Any]:
        """Coherent view for read endpoints: always-live data + agent outputs.

        Cached for a fraction of a second to absorb bursts of concurrent reads.
        """
        from backend.services.live_data import live

        version = live.version
        now = time.time()
        if (self._cache is not None and self._cache_version == version
                and now - self._cache_ts < _SNAPSHOT_TTL):
            return self._cache
        with self._cache_lock:
            version = live.version
            now = time.time()
            if (self._cache is not None and self._cache_version == version
                    and now - self._cache_ts < _SNAPSHOT_TTL):
                return self._cache
            snap = self._compute_snapshot()
            self._cache = snap
            self._cache_ts = time.time()
            self._cache_version = version
            return snap

    def _compute_snapshot(self) -> dict[str, Any]:
        client = get_client()
        invoices = client.fetch_invoices()
        debtor_scorer.score_all(invoices)
        settlements = client.fetch_settlements()
        payments = client.fetch_payments()
        metrics = client.fetch_payment_metrics()
        forecast_days, alerts = compute_forecast(settlements, invoices)
        health = compute_health(payments, metrics)

        latest = self.latest or {}
        return {
            "merchant_id": client.merchant_id,
            "merchant_name": client.merchant_name,
            "razorpay_connected": True,
            # Always-live fields.
            "invoices": invoices,
            "settlements": settlements,
            "recent_payments": payments,
            "payment_metrics": metrics,
            "cashflow_forecast": forecast_days,
            "cashflow_alerts": alerts,
            "payment_health": health,
            # Overlaid agent outputs (from the last run, if any).
            "anomalies": latest.get("anomalies", []),
            "collection_actions": latest.get("collection_actions", []),
            "payment_insights": latest.get("payment_insights", []),
            "reconciliation_result": self.last_recon or {"ran": False},
            "last_run": latest.get("last_run"),
        }


store = Store()
