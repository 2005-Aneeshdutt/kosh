"""Payment processing — the live transaction core.

Handles a customer paying an invoice through the Razorpay-style checkout:
validates the instrument, decides success/decline (with predictable test
cards), records the payment on the live dataset, marks the invoice paid, emails
a receipt, and syncs the ledger row to Google Sheets.
"""
from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from backend.services import mailer, sheets
from backend.services.live_data import live

# Predictable test instruments (mirrors how Razorpay test cards behave).
DECLINE_CARDS = {"4000000000000002"}
LOWFUNDS_CARDS = {"4000000000009995"}


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def luhn_ok(card: str) -> bool:
    card = _digits(card)
    if len(card) < 12:
        return False
    total, alt = 0, False
    for ch in reversed(card):
        d = int(ch)
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def card_brand(card: str) -> str:
    card = _digits(card)
    if card.startswith("4"):
        return "Visa"
    if re.match(r"5[1-5]", card) or re.match(r"2[2-7]", card):
        return "Mastercard"
    if re.match(r"3[47]", card):
        return "Amex"
    if card.startswith("6"):
        return "RuPay"
    return "Card"


def create_order(invoice_id: str) -> dict[str, Any]:
    inv = live.get_invoice(invoice_id)
    if not inv:
        raise ValueError("Invoice not found")
    return {
        "order_id": f"order_{uuid.uuid4().hex[:14]}",
        "amount": inv["amount"],
        "currency": "INR",
        "invoice_id": invoice_id,
        "merchant": live.merchant_name,
        "customer_name": inv["customer_name"],
        "customer_email": inv["customer_email"],
        "description": f"Payment for Invoice #{invoice_id}",
    }


def _decide(method: str, details: dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Return (success, failure_reason)."""
    if method == "card":
        card = _digits(details.get("card_number", ""))
        if card in DECLINE_CARDS:
            return False, "card_declined_by_bank"
        if card in LOWFUNDS_CARDS:
            return False, "insufficient_funds"
        if not luhn_ok(card):
            return False, "invalid_card_number"
        return True, None
    if method == "upi":
        vpa = (details.get("vpa") or "").lower()
        if "fail" in vpa:
            return False, "upi_collect_declined"
        if "@" not in vpa:
            return False, "invalid_vpa"
        return True, None
    if method == "netbanking":
        return True, None
    return False, "unsupported_method"


def process_invoice_payment(
    invoice_id: str, method: str, details: dict[str, Any]
) -> dict[str, Any]:
    inv = live.get_invoice(invoice_id)
    if not inv:
        raise ValueError("Invoice not found")
    if inv["status"] == "paid":
        raise ValueError("Invoice already paid")

    success, reason = _decide(method, details)
    status = "captured" if success else "failed"

    payment = live.add_payment(
        customer_name=inv["customer_name"],
        amount=inv["amount"],
        method=method,
        status=status,
        failure_reason=reason,
        source="checkout",
        invoice_id=invoice_id,
    )

    receipt: Optional[dict[str, Any]] = None
    if success:
        live.mark_invoice_paid(invoice_id, payment["id"])
        receipt = _send_receipt(inv, payment, method, details)
        sheets.push_row(
            {
                "type": "Payment",
                "reference": payment["id"],
                "party": inv["customer_name"],
                "detail": method.upper(),
                "amount": inv["amount"],
                "status": "captured",
            }
        )

    return {
        "success": success,
        "status": status,
        "failure_reason": reason,
        "payment_id": payment["id"],
        "amount": inv["amount"],
        "method": method,
        "invoice_id": invoice_id,
        "brand": card_brand(details.get("card_number", "")) if method == "card" else None,
        "receipt_email_id": receipt["id"] if receipt else None,
    }


def _send_receipt(inv: dict, payment: dict, method: str, details: dict) -> dict[str, Any]:
    amount = f"₹{inv['amount'] / 100:,.0f}"
    instrument = {
        "card": f"{card_brand(details.get('card_number',''))} •••• "
                f"{_digits(details.get('card_number',''))[-4:]}",
        "upi": details.get("vpa", "UPI"),
        "netbanking": details.get("bank", "Netbanking"),
    }.get(method, method)
    html = mailer.render_email(
        kind="receipt",
        to_name=inv["customer_name"],
        to_email=inv["customer_email"],
        subject=f"Payment received — {amount} · Invoice {inv['id']}",
        body_lines=[
            f"We've received your payment of <b>{amount}</b> for invoice "
            f"<b>{inv['id']}</b>. Thank you!",
            f"Payment ID: {payment['id']}",
            f"Paid via: {instrument}",
        ],
        accent="#10B981",
    )
    return mailer.send(
        kind="receipt",
        to_name=inv["customer_name"],
        to_email=inv["customer_email"],
        subject=f"Payment received — {amount} · Invoice {inv['id']}",
        html=html,
        meta={"invoice_id": inv["id"], "payment_id": payment["id"]},
    )
