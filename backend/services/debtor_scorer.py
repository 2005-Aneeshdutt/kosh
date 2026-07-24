"""Payment-likelihood (risk) scoring for outstanding invoices."""
from __future__ import annotations

from typing import Any

# Amount that we treat as the top of the "large invoice" scale (paisa).
_MAX_AMOUNT = 2_500_000_00 // 100  # ₹2,50,000 in paisa == 25000000


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_invoice(invoice: dict[str, Any]) -> float:
    """Return a 0.0-1.0 risk score (1.0 = most likely to NOT pay).

    Weighted blend of:
      * days overdue        (0.40)
      * customer history    (0.30) — proxied by reminders already sent
      * invoice amount      (0.15)
      * reminder fatigue    (0.15)
    """
    days_overdue = invoice.get("days_overdue", 0)
    reminders = invoice.get("reminders_sent", 0)
    amount = invoice.get("amount", 0)

    # Normalise each signal into 0..1.
    days_norm = _clamp(days_overdue / 90.0)
    history_score = _clamp(reminders / 3.0)          # chronic-late-payer proxy
    amount_norm = _clamp(amount / 25_000_000)         # ₹2,50,000 == 1.0
    reminder_fatigue = _clamp(reminders / 4.0)

    score = (
        days_norm * 0.40
        + history_score * 0.30
        + amount_norm * 0.15
        + reminder_fatigue * 0.15
    )
    return round(_clamp(score), 3)


def score_factors(invoice: dict[str, Any]) -> list[dict[str, Any]]:
    """Explain a risk score: the weighted signals that produced it.

    Returns one row per factor with its raw value, normalised 0..1 signal, the
    weight applied, and its points contribution — the data behind the
    'explain this decision' trace.
    """
    days_overdue = invoice.get("days_overdue", 0)
    reminders = invoice.get("reminders_sent", 0)
    amount = invoice.get("amount", 0)

    signals = [
        ("Days overdue", f"{days_overdue} days", _clamp(days_overdue / 90.0), 0.40),
        ("Customer history", f"{reminders} prior reminders", _clamp(reminders / 3.0), 0.30),
        ("Invoice size", f"₹{amount / 100:,.0f}", _clamp(amount / 25_000_000), 0.15),
        ("Reminder fatigue", f"{reminders} sent", _clamp(reminders / 4.0), 0.15),
    ]
    return [
        {
            "label": label,
            "value": value,
            "signal": round(signal, 3),
            "weight": weight,
            "contribution": round(signal * weight, 3),
        }
        for label, value, signal, weight in signals
    ]


def risk_band(score: float) -> str:
    if score >= 0.66:
        return "critical"
    if score >= 0.45:
        return "high"
    if score >= 0.25:
        return "medium"
    return "low"


def score_all(invoices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach a risk_score to every outstanding invoice (in place)."""
    for inv in invoices:
        if inv.get("status") in {"overdue", "pending", "partially_paid"}:
            inv["risk_score"] = score_invoice(inv)
        else:
            inv["risk_score"] = 0.0
    return invoices
