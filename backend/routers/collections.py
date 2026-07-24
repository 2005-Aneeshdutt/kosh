"""Collections endpoints: debtor list + single-invoice reminder."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.agents.collect_agent import build_reminder, checkout_link, send_reminder_email
from backend.agents.store import store
from backend.models.schemas import DebtorRow, SendReminderRequest, SendReminderResponse
from backend.services import audit, debtor_scorer

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("/debtors", response_model=list[DebtorRow])
def debtors() -> list[DebtorRow]:
    snap = store.snapshot()
    invoices = [
        i for i in snap["invoices"]
        if i["status"] in {"overdue", "pending", "partially_paid"}
    ]
    debtor_scorer.score_all(invoices)
    invoices.sort(key=lambda i: i["risk_score"], reverse=True)

    return [
        DebtorRow(
            id=i["id"],
            customer_name=i["customer_name"],
            customer_email=i["customer_email"],
            customer_phone=i["customer_phone"],
            amount=i["amount"],
            due_date=i["due_date"],
            days_overdue=i["days_overdue"],
            status=i["status"],
            risk_score=i["risk_score"],
            risk_band=debtor_scorer.risk_band(i["risk_score"]),
            reminders_sent=i.get("reminders_sent", 0),
            last_reminder_date=i.get("last_reminder_date"),
            payment_link_url=i.get("payment_link_url"),
        )
        for i in invoices
    ]


@router.get("/explain/{invoice_id}")
def explain(invoice_id: str) -> dict:
    """The reasoning trace behind an invoice's risk score & recommended action."""
    snap = store.snapshot()
    invoice = next((i for i in snap["invoices"] if i["id"] == invoice_id), None)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    debtor_scorer.score_all([invoice])
    score = invoice["risk_score"]
    band = debtor_scorer.risk_band(score)
    factors = debtor_scorer.score_factors(invoice)

    tone = {"critical": "firm", "high": "assertive", "medium": "friendly", "low": "gentle"}[band]
    recommendation = (
        f"Send a {tone} reminder with a one-click payment link. "
        f"{'Escalate to a call if unpaid in 48h.' if band in {'critical', 'high'} else 'Auto-follow-up in 3 days.'}"
    )
    return {
        "invoice_id": invoice_id,
        "customer_name": invoice["customer_name"],
        "amount": invoice["amount"],
        "days_overdue": invoice.get("days_overdue", 0),
        "risk_score": score,
        "risk_band": band,
        "factors": factors,
        "recommended_tone": tone,
        "recommendation": recommendation,
    }


@router.post("/send-reminder", response_model=SendReminderResponse)
def send_reminder(req: SendReminderRequest) -> SendReminderResponse:
    snap = store.snapshot()
    invoice = next((i for i in snap["invoices"] if i["id"] == req.invoice_id), None)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pay_url = checkout_link(invoice)
    invoice["payment_link_url"] = pay_url

    message, tone, _ = build_reminder(invoice, pay_url)
    invoice["reminders_sent"] = invoice.get("reminders_sent", 0) + 1
    invoice["last_reminder_date"] = datetime.now(timezone.utc).isoformat()

    email = send_reminder_email(invoice, message, pay_url)
    audit.human(
        "You", "reminder.sent",
        target=invoice["id"], amount=invoice["amount"],
        detail=f"{tone.capitalize()} reminder to {invoice['customer_name']}"
        f"{' · delivered' if email['delivered'] else ''}",
    )

    return SendReminderResponse(
        invoice_id=invoice["id"],
        message=message,
        payment_link_url=pay_url,
        reminders_sent=invoice["reminders_sent"],
        tone=tone,
        email_id=email["id"],
        email_delivered=email["delivered"],
    )
