"""COLLECT AGENT — smart accounts-receivable collection.

Scores outstanding invoices on likelihood-to-pay, prioritises the riskiest,
generates a personalised (Claude-authored, or templated) reminder whose tone
escalates with the number of prior reminders, and creates a Razorpay payment
link for one-tap settlement.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from backend.agents.bus import emit
from backend.agents.state import MerchantState
from backend.razorpay_client.client import get_client
from backend.services import debtor_scorer, llm

AGENT = "collect"


def _rupees(paisa: int) -> str:
    return f"₹{paisa / 100:,.0f}"


def _tone_for(reminders: int) -> str:
    if reminders >= 3:
        return "urgent"
    if reminders >= 1:
        return "firm"
    return "friendly"


def _template_reminder(inv: dict, tone: str, link: str) -> str:
    name = inv["customer_name"]
    amount = _rupees(inv["amount"])
    days = inv["days_overdue"]
    if tone == "urgent":
        opener = (
            f"Dear {name}, this is an urgent reminder that invoice {inv['id']} for "
            f"{amount} is now {days} days overdue and requires immediate attention."
        )
    elif tone == "firm":
        opener = (
            f"Hello {name}, we notice invoice {inv['id']} for {amount} is still "
            f"outstanding ({days} days overdue). We'd appreciate prompt settlement."
        )
    else:
        opener = (
            f"Hi {name}, just a gentle reminder that invoice {inv['id']} for {amount} "
            f"is due. Thank you for your continued business with Artisan Coffee Co."
        )
    return f"{opener}\nPay now via this link: {link}"


def build_reminder(inv: dict, link: str) -> tuple[str, str, bool]:
    tone = _tone_for(inv.get("reminders_sent", 0))
    prompt = (
        "You are a polite but effective collections assistant for an Indian business "
        "(Artisan Coffee Co.). Write a short payment reminder (3-4 lines) for:\n"
        f"Customer: {inv['customer_name']}\n"
        f"Amount: {_rupees(inv['amount'])}\n"
        f"Days overdue: {inv['days_overdue']}\n"
        f"Previous reminders sent: {inv.get('reminders_sent', 0)}\n"
        f"Tone: {tone}\n"
        f"End with a line saying exactly: 'Pay now via this link: {link}'\n"
        "Use Indian English conventions. Keep it professional. Return only the message."
    )
    text, used = llm.generate(
        prompt,
        max_tokens=250,
        fallback=lambda: _template_reminder(inv, tone, link),
    )
    return text, tone, used


async def collect_agent_node(state: MerchantState) -> MerchantState:
    emit(state, AGENT, "thinking", "Scoring outstanding invoices by likelihood-to-pay…")
    await asyncio.sleep(0.4)

    invoices = state.get("invoices", [])
    debtor_scorer.score_all(invoices)

    outstanding = [i for i in invoices if i.get("status") in {"overdue", "partially_paid"}]
    outstanding.sort(key=lambda i: i["risk_score"], reverse=True)
    prioritized = outstanding[:10]

    emit(
        state,
        AGENT,
        "result",
        f"Scored {len(outstanding)} overdue invoices. Prioritising the top {len(prioritized)}.",
        {"overdue_count": len(outstanding)},
    )
    await asyncio.sleep(0.3)

    client = get_client()
    actions: list[dict] = []

    for inv in prioritized:
        emit(
            state,
            AGENT,
            "thinking",
            f"Preparing outreach for {inv['customer_name']} "
            f"({_rupees(inv['amount'])}, risk {inv['risk_score']:.2f})…",
        )
        await asyncio.sleep(0.25)

        link = client.create_payment_link(inv)
        inv["payment_link_id"] = link["id"]
        inv["payment_link_url"] = link["short_url"]

        message, tone, used_llm = build_reminder(inv, link["short_url"])
        inv["reminders_sent"] = inv.get("reminders_sent", 0) + 1
        inv["last_reminder_date"] = datetime.now(timezone.utc).isoformat()

        actions.append(
            {
                "invoice_id": inv["id"],
                "customer_name": inv["customer_name"],
                "amount": inv["amount"],
                "tone": tone,
                "message": message,
                "payment_link_url": link["short_url"],
                "risk_score": inv["risk_score"],
                "authored_by": "claude" if used_llm else "template",
            }
        )

        emit(
            state,
            AGENT,
            "action",
            f"Created payment link and {tone} reminder for {inv['customer_name']} "
            f"({_rupees(inv['amount'])}).",
            {"invoice_id": inv["id"], "payment_link_url": link["short_url"]},
        )
        await asyncio.sleep(0.15)

    emit(
        state,
        AGENT,
        "result",
        f"Collections sweep complete — {len(actions)} reminders sent with payment links.",
        {"actions": len(actions)},
    )

    return {"invoices": invoices, "collection_actions": actions}
