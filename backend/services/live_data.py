"""Live, mutable merchant dataset — the single source of truth in demo mode.

Unlike the stateless mock generator, this holds ONE dataset in memory that is
seeded once and then mutated over the app's lifetime: payments stream in, the
simulator appends transactions, and customer checkouts flip invoices to paid.
Every mutation broadcasts a live event so the whole UI updates in real time.
"""
from __future__ import annotations

import random
import threading
from datetime import datetime, timezone
from typing import Any, Optional

from backend.agents.bus import bus
from backend.razorpay_client import mock_data
from backend.services import debtor_scorer


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


class LiveData:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._rng = random.Random()
        self.seed()

    # ── Seeding ─────────────────────────────────────────────
    def seed(self) -> None:
        with self._lock:
            self.merchant_id = mock_data.MERCHANT_ID
            self.merchant_name = mock_data.MERCHANT_NAME
            self.payments: list[dict[str, Any]] = mock_data.generate_payments()
            self.invoices: list[dict[str, Any]] = mock_data.generate_invoices()
            self.settlements: list[dict[str, Any]] = mock_data.generate_settlements()
            debtor_scorer.score_all(self.invoices)
            self._counter = 900000
            # Invoices currently being paid (guards against double-capture).
            self._claims: set[str] = set()

    # ── Atomic invoice claim (concurrency-safe payment) ─────
    def claim_invoice(self, invoice_id: str) -> bool:
        """Atomically reserve an invoice for payment. Returns False if it's
        already paid or another request is mid-payment for it."""
        with self._lock:
            inv = next((i for i in self.invoices if i["id"] == invoice_id), None)
            if inv is None or inv["status"] == "paid" or invoice_id in self._claims:
                return False
            self._claims.add(invoice_id)
            return True

    def release_invoice(self, invoice_id: str) -> None:
        with self._lock:
            self._claims.discard(invoice_id)

    # ── Reads (return copies so callers can't mutate internals) ──
    def get_payments(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(p) for p in self.payments]

    def get_invoices(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(i) for i in self.invoices]

    def get_settlements(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(s) for s in self.settlements]

    def get_invoice(self, invoice_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            inv = next((i for i in self.invoices if i["id"] == invoice_id), None)
            return dict(inv) if inv else None

    def get_metrics(self) -> list[dict[str, Any]]:
        """Recompute daily metrics from the live payments list."""
        from datetime import timedelta

        with self._lock:
            payments = list(self.payments)
        now = _now()
        metrics: list[dict[str, Any]] = []
        for days_ago in range(6, -1, -1):
            day = (now - timedelta(days=days_ago)).date()
            day_payments = [
                p for p in payments
                if datetime.fromisoformat(p["created_at"]).date() == day
            ]
            if not day_payments:
                continue
            successful = sum(1 for p in day_payments if p["status"] == "captured")
            failed = sum(1 for p in day_payments if p["status"] == "failed")
            total = len(day_payments)
            method_breakdown: dict[str, int] = {}
            for p in day_payments:
                method_breakdown[p["method"]] = method_breakdown.get(p["method"], 0) + 1
            avg_amount = sum(p["amount"] for p in day_payments) / total if total else 0
            metrics.append(
                {
                    "timestamp": _iso(datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)),
                    "total_payments": total,
                    "successful": successful,
                    "failed": failed,
                    "success_rate": round(successful / total, 4) if total else 0.0,
                    "avg_amount": round(avg_amount, 2),
                    "method_breakdown": method_breakdown,
                }
            )
        return metrics

    def _next_id(self, prefix: str) -> str:
        with self._lock:
            self._counter += 1
            counter = self._counter
        return f"{prefix}_{counter:08d}"

    # ── Mutations ───────────────────────────────────────────
    def add_payment(
        self,
        *,
        customer_name: str,
        amount: int,
        method: str,
        status: str = "captured",
        failure_reason: Optional[str] = None,
        source: str = "live",
        invoice_id: Optional[str] = None,
    ) -> dict[str, Any]:
        payment = {
            "id": self._next_id("pay"),
            "customer_name": customer_name,
            "amount": amount,
            "method": method,
            "status": status,
            "created_at": _iso(_now()),
            "failure_reason": failure_reason,
            "source": source,
            "invoice_id": invoice_id,
        }
        with self._lock:
            self.payments.insert(0, payment)
            if len(self.payments) > 600:
                self.payments = self.payments[:600]
        bus.publish_live("payment", payment)
        self._broadcast_metrics()
        return payment

    def mark_invoice_paid(self, invoice_id: str, payment_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            inv = next((i for i in self.invoices if i["id"] == invoice_id), None)
            if inv is None or inv["status"] == "paid":
                return None
            inv["status"] = "paid"
            inv["days_overdue"] = 0
            inv["risk_score"] = 0.0
            inv["paid_at"] = _iso(_now())
            inv["paid_by_payment"] = payment_id
            snapshot = dict(inv)
        bus.publish_live("invoice_paid", snapshot)
        return snapshot

    def random_live_payment(self) -> dict[str, Any]:
        """Generate one realistic live payment (used by the simulator)."""
        rng = self._rng
        name = f"{rng.choice(mock_data._FIRST_NAMES)} {rng.choice(mock_data._LAST_NAMES)}"
        method = rng.choice(mock_data._METHODS)
        amount = rng.choice([29900, 49900, 79900, 99900, 149900, 249900, 349900])
        roll = rng.random()
        status, reason = "captured", None
        if roll > 0.93:
            status, reason = "failed", rng.choice(mock_data._FAILURE_REASONS)
        elif roll > 0.90:
            status = "refunded"
        return self.add_payment(
            customer_name=name, amount=amount, method=method,
            status=status, failure_reason=reason, source="simulator",
        )

    def _broadcast_metrics(self) -> None:
        with self._lock:
            payments = list(self.payments)
        recent = payments[:200]
        captured = sum(1 for p in recent if p["status"] == "captured")
        total = len(recent)
        today_revenue = sum(p["amount"] for p in payments if p["status"] == "captured")
        bus.publish_live(
            "metrics",
            {
                "success_rate": round(captured / total, 4) if total else 0.0,
                "total_revenue": today_revenue,
                "payment_count": len([p for p in payments if p["status"] == "captured"]),
            },
        )


live = LiveData()
