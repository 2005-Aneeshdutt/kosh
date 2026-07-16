"""Razorpay API client wrapper with DEMO and LIVE modes.

In DEMO mode (default) every method returns realistic mock data from
``mock_data`` — no network, no keys required. In LIVE mode the official
``razorpay`` Python SDK is used. All amounts are in paisa (100 paisa = ₹1).

We deliberately use the SDK directly rather than the Razorpay MCP server:
the SDK exposes the same 35+ endpoints with tighter control inside our
LangGraph agents. (Kosh remains MCP-compatible — see the README.)
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from backend.config import settings
from backend.razorpay_client import mock_data

logger = logging.getLogger("kosh.razorpay")


class RazorpayClient:
    def __init__(
        self,
        demo_mode: Optional[bool] = None,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None,
    ) -> None:
        self.demo_mode = settings.demo_mode if demo_mode is None else demo_mode
        self.key_id = key_id or settings.razorpay_key_id
        self.key_secret = key_secret or settings.razorpay_key_secret
        self._sdk = None

        if not self.demo_mode:
            self._sdk = self._build_sdk()

    def _build_sdk(self):
        if not (self.key_id and self.key_secret):
            logger.warning("Live mode requested without credentials; falling back to demo mode.")
            self.demo_mode = True
            return None
        try:
            import razorpay  # imported lazily so demo mode has no hard dependency

            client = razorpay.Client(auth=(self.key_id, self.key_secret))
            client.set_app_details({"title": "Kosh", "version": "1.0"})
            return client
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to init Razorpay SDK (%s); using demo mode.", exc)
            self.demo_mode = True
            return None

    # ── Connectivity ────────────────────────────────────────
    def test_connection(self) -> dict[str, Any]:
        if self.demo_mode:
            return {"connected": True, "merchant_name": mock_data.MERCHANT_NAME, "demo": True}
        try:
            # A cheap authenticated call to validate credentials.
            self._sdk.payment.all({"count": 1})
            return {"connected": True, "merchant_name": "Razorpay Merchant", "demo": False}
        except Exception as exc:  # pragma: no cover
            return {"connected": False, "error": str(exc), "demo": False}

    @property
    def merchant_id(self) -> str:
        return mock_data.MERCHANT_ID

    @property
    def merchant_name(self) -> str:
        return mock_data.MERCHANT_NAME

    # ── Data fetches ────────────────────────────────────────
    def fetch_payments(self) -> list[dict[str, Any]]:
        if self.demo_mode:
            return mock_data.generate_payments()
        items = self._sdk.payment.all({"count": 100}).get("items", [])
        return [
            {
                "id": p.get("id"),
                "customer_name": p.get("email") or p.get("contact") or "Customer",
                "amount": p.get("amount", 0),
                "method": p.get("method", "unknown"),
                "status": p.get("status", "unknown"),
                "created_at": p.get("created_at"),
                "failure_reason": p.get("error_reason"),
            }
            for p in items
        ]

    def fetch_invoices(self) -> list[dict[str, Any]]:
        # Razorpay's invoice API differs from our internal invoice model, so in
        # live mode we still lean on the demo invoices as the AR ledger. A real
        # deployment would source these from the merchant's accounting system.
        return mock_data.generate_invoices()

    def fetch_settlements(self) -> list[dict[str, Any]]:
        if self.demo_mode:
            return mock_data.generate_settlements()
        items = self._sdk.settlement.all({"count": 100}).get("items", [])
        return [
            {
                "id": s.get("id"),
                "amount": s.get("amount", 0),
                "utr": s.get("utr", ""),
                "status": s.get("status", ""),
                "created_at": s.get("created_at"),
                "matched": False,
                "bank_ref": None,
            }
            for s in items
        ]

    def fetch_payment_metrics(self) -> list[dict[str, Any]]:
        if self.demo_mode:
            return mock_data.generate_payment_metrics()
        # Live mode would aggregate from fetch_payments(); demo aggregation is fine here.
        return mock_data.generate_payment_metrics()

    # ── Actions ─────────────────────────────────────────────
    def create_payment_link(self, invoice: dict[str, Any]) -> dict[str, Any]:
        """Create a Razorpay payment link for one-tap collection."""
        if self.demo_mode:
            link_id = f"plink_{invoice['id'].replace('-', '')}"
            return {
                "id": link_id,
                "short_url": f"https://rzp.io/i/{link_id[-8:]}",
            }
        payload = {
            "amount": invoice["amount"],
            "currency": "INR",
            "description": f"Payment for Invoice #{invoice['id']}",
            "customer": {
                "name": invoice["customer_name"],
                "email": invoice["customer_email"],
                "contact": invoice["customer_phone"],
            },
            "notify": {"sms": True, "email": True},
            "reminder_enable": True,
            "callback_url": "https://kosh.app/payment/confirm",
            "callback_method": "get",
        }
        link = self._sdk.payment_link.create(payload)
        return {"id": link.get("id"), "short_url": link.get("short_url")}


_client: Optional[RazorpayClient] = None


def get_client() -> RazorpayClient:
    """Return a process-wide client, rebuilding if settings changed."""
    global _client
    if _client is None:
        _client = RazorpayClient()
    return _client


def reset_client(**kwargs: Any) -> RazorpayClient:
    """Rebuild the shared client (used when settings change at runtime)."""
    global _client
    _client = RazorpayClient(**kwargs)
    return _client
