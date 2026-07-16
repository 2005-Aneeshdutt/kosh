"""Kosh Copilot — a conversational ops assistant that can also take action.

The copilot answers questions about the merchant's revenue operations AND
performs real actions through chat: create payment links, send reminder emails,
collect a payment, or launch the agent crew. It uses Claude tool-calling when an
API key is configured, and falls back to a capable rule-based intent router so
it works fully offline.

Every action mutates the live dataset, so the dashboard reflects it instantly.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional

from backend.config import settings
from backend.services import mailer
from backend.services.live_data import live


def _rupees(paisa: int) -> str:
    return f"₹{paisa / 100:,.0f}"


# ── Data helpers ────────────────────────────────────────────
def _open_invoices() -> list[dict[str, Any]]:
    return [i for i in live.get_invoices() if i["status"] in {"overdue", "pending", "partially_paid"}]


def resolve_invoice(text: str) -> Optional[dict[str, Any]]:
    """Find an invoice by id (INV-1234) or by customer-name substring."""
    m = re.search(r"inv[-\s]?(\d{3,5})", text, re.I)
    invoices = live.get_invoices()
    if m:
        num = m.group(1)
        return next((i for i in invoices if i["id"].replace("-", "").endswith(num)), None)
    low = text.lower()
    candidates = [i for i in _open_invoices() if i["customer_name"].lower() in low
                  or any(w in low for w in i["customer_name"].lower().split())]
    candidates.sort(key=lambda i: i.get("risk_score", 0), reverse=True)
    return candidates[0] if candidates else None


# ── Tools (each returns (reply_text, actions)) ──────────────
def tool_overview() -> tuple[str, list]:
    payments = live.get_payments()
    captured = [p for p in payments if p["status"] == "captured"]
    revenue = sum(p["amount"] for p in captured)
    total = len([p for p in payments if p["status"] in {"captured", "failed"}])
    sr = round(len(captured) / total * 100, 1) if total else 0
    opens = _open_invoices()
    outstanding = sum(i["amount"] for i in opens)
    overdue = [i for i in opens if i["status"] == "overdue"]
    top = max(overdue, key=lambda i: i["amount"], default=None)
    lines = [
        f"Here's where Artisan Coffee Co. stands right now:",
        f"• Revenue (captured): {_rupees(revenue)} across {len(captured)} payments",
        f"• Payment success rate: {sr}%",
        f"• Outstanding receivables: {_rupees(outstanding)} across {len(opens)} invoices",
        f"• Overdue: {len(overdue)} invoices",
    ]
    if top:
        lines.append(f"• Biggest overdue: {top['id']} — {_rupees(top['amount'])} from "
                     f"{top['customer_name']} ({top['days_overdue']}d late)")
    return "\n".join(lines), []


def tool_top_debtors(n: int = 5) -> tuple[str, list]:
    opens = sorted(_open_invoices(), key=lambda i: i.get("risk_score", 0), reverse=True)[:n]
    if not opens:
        return "No outstanding invoices — you're all caught up! 🎉", []
    lines = ["Top accounts to chase (by risk):"]
    for i in opens:
        lines.append(f"• {i['id']} · {i['customer_name']} · {_rupees(i['amount'])} · "
                     f"{i['days_overdue']}d late · risk {i.get('risk_score', 0):.2f}")
    return "\n".join(lines), [{"type": "navigate", "to": "/collections", "label": "Open Collections"}]


def tool_pay_link(invoice_id: str) -> tuple[str, list]:
    inv = live.get_invoice(invoice_id)
    if not inv:
        return f"I couldn't find invoice {invoice_id}.", []
    url = f"/pay/{inv['id']}"
    reply = (f"Here's a secure payment link for {inv['id']} — {_rupees(inv['amount'])} from "
             f"{inv['customer_name']}. Open it to pay by card, UPI, or netbanking:")
    return reply, [{"type": "open_checkout", "url": url, "invoice_id": inv["id"],
                    "label": f"Pay {_rupees(inv['amount'])} · {inv['id']}"}]


def tool_send_reminder(invoice_id: str) -> tuple[str, list]:
    from backend.agents.collect_agent import build_reminder, send_reminder_email
    from backend.razorpay_client.client import get_client

    inv = live.get_invoice(invoice_id)
    if not inv:
        return f"I couldn't find invoice {invoice_id}.", []
    link = get_client().create_payment_link(inv)
    message, tone, _ = build_reminder(inv, link["short_url"])
    email = send_reminder_email(inv, message, link["short_url"])
    dest = "delivered" if email["delivered"] else "queued in the Outbox"
    reply = (f"Done — I sent a {tone} payment reminder to {inv['customer_name']} for "
             f"{_rupees(inv['amount'])} ({inv['id']}). The email is {dest}.")
    return reply, [{"type": "navigate", "to": "/mail", "label": "View Outbox"},
                   {"type": "open_checkout", "url": f"/pay/{inv['id']}", "invoice_id": inv["id"],
                    "label": f"Pay link · {inv['id']}"}]


def tool_collect_payment(invoice_id: str) -> tuple[str, list]:
    """Actually capture a payment for the invoice (simulated UPI capture)."""
    from backend.services import payments

    inv = live.get_invoice(invoice_id)
    if not inv:
        return f"I couldn't find invoice {invoice_id}.", []
    if inv["status"] == "paid":
        return f"{inv['id']} is already paid. ✅", []
    result = payments.process_invoice_payment(invoice_id, "upi", {"vpa": "customer@okhdfc"})
    if result["success"]:
        reply = (f"✅ Payment collected! {_rupees(result['amount'])} captured for {inv['id']} "
                 f"({inv['customer_name']}). A receipt was emailed and your dashboard just "
                 f"updated live.")
        return reply, [{"type": "navigate", "to": "/ledger", "label": "See it in the Ledger"}]
    return f"The payment for {inv['id']} didn't go through ({result['failure_reason']}).", []


def tool_run_agents() -> tuple[str, list]:
    import asyncio
    from backend.agents import orchestrator
    from backend.agents.store import store

    async def _bg():
        for k in store.status:
            store.status[k] = "active"
        final = await orchestrator.run_pipeline(bank_entries=store.bank_entries)
        store.set_run(final)
        for k in store.status:
            store.status[k] = "done"

    try:
        asyncio.get_running_loop().create_task(_bg())
    except RuntimeError:
        pass
    return ("On it — I've launched all four agents. Watch them work in the Activity feed; "
            "they'll score debtors, reconcile, forecast, and monitor payments."), \
           [{"type": "navigate", "to": "/", "label": "Open Dashboard"}]


def tool_test_email(to_email: str = "aneeshdutt67@gmail.com") -> tuple[str, list]:
    rec = mailer.send_test(to_email)
    if rec["delivered"]:
        return f"📧 Test email delivered to {rec['delivered_to']}. Check the inbox!", []
    return (f"I queued a test email to {to_email} in the Outbox. To actually deliver it, add "
            f"SMTP credentials under Settings → Email."), \
           [{"type": "navigate", "to": "/settings", "label": "Configure email"}]


# ── Offline intent router ───────────────────────────────────
def offline_route(text: str) -> tuple[str, list]:
    t = text.lower().strip()

    if any(w in t for w in ["hello", "hi ", "hey", "help", "what can you"]):
        return (
            "Hi! I'm the Kosh Copilot. I can:\n"
            "• Give you a live business overview\n"
            "• Show who owes you money (\"who's overdue?\")\n"
            "• Send a payment reminder (\"remind Bangalore Brew House\")\n"
            "• Create a pay link or collect a payment (\"pay INV-1020\")\n"
            "• Run the agent crew (\"run the agents\")\n"
            "• Send a test email (\"email a test to aneeshdutt67@gmail.com\")\n"
            "What would you like to do?"
        ), []

    if "test email" in t or "email a test" in t or ("email" in t and "test" in t):
        m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
        return tool_test_email(m.group(0) if m else "aneeshdutt67@gmail.com")

    if "run" in t and "agent" in t:
        return tool_run_agents()

    if any(w in t for w in ["overview", "summary", "how are we", "how's business", "revenue", "outstanding", "dashboard"]):
        return tool_overview()

    if any(w in t for w in ["who owes", "overdue", "debtor", "top account", "who should", "chase list"]):
        return tool_top_debtors()

    inv = resolve_invoice(text)

    if any(w in t for w in ["remind", "reminder", "chase", "nudge", "follow up", "follow-up"]):
        if inv:
            return tool_send_reminder(inv["id"])
        return "Which customer or invoice should I send a reminder for?", []

    if ("pay link" in t or "payment link" in t or "send link" in t or "link for" in t):
        if inv:
            return tool_pay_link(inv["id"])
        return "Which invoice do you want a payment link for? (e.g. INV-1020)", []

    if any(w in t for w in ["pay ", "collect", "settle", "charge", "mark paid", "receive payment"]):
        if inv:
            return tool_collect_payment(inv["id"])
        return "Which invoice should I collect? Try \"pay INV-1020\" or a customer name.", []

    if inv:  # mentioned an invoice but no clear verb
        return tool_pay_link(inv["id"])

    return (
        "I can help with collections, payments, reminders, and reporting. Try:\n"
        "• \"How are we doing?\"  • \"Who's overdue?\"\n"
        "• \"Remind Bangalore Brew House\"  • \"Pay INV-1020\""
    ), []


# ── Claude tool-calling path ────────────────────────────────
_TOOLS = [
    {"name": "get_overview", "description": "Get a live business overview: revenue, success rate, outstanding, overdue.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "list_top_debtors", "description": "List the top outstanding invoices to chase, by risk.", "input_schema": {"type": "object", "properties": {"n": {"type": "integer"}}}},
    {"name": "create_pay_link", "description": "Create a payment link for an invoice so the customer can pay.", "input_schema": {"type": "object", "properties": {"invoice_id": {"type": "string"}}, "required": ["invoice_id"]}},
    {"name": "send_reminder", "description": "Send a payment reminder email for an invoice.", "input_schema": {"type": "object", "properties": {"invoice_id": {"type": "string"}}, "required": ["invoice_id"]}},
    {"name": "collect_payment", "description": "Collect/capture the payment for an invoice now.", "input_schema": {"type": "object", "properties": {"invoice_id": {"type": "string"}}, "required": ["invoice_id"]}},
    {"name": "run_agents", "description": "Launch the four-agent crew to work collections/recon/forecast/health.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "send_test_email", "description": "Send a test email to verify email delivery.", "input_schema": {"type": "object", "properties": {"to_email": {"type": "string"}}}},
]

_DISPATCH = {
    "get_overview": lambda a: tool_overview(),
    "list_top_debtors": lambda a: tool_top_debtors(a.get("n", 5)),
    "create_pay_link": lambda a: tool_pay_link(a["invoice_id"]),
    "send_reminder": lambda a: tool_send_reminder(a["invoice_id"]),
    "collect_payment": lambda a: tool_collect_payment(a["invoice_id"]),
    "run_agents": lambda a: tool_run_agents(),
    "send_test_email": lambda a: tool_test_email(a.get("to_email", "aneeshdutt67@gmail.com")),
}

_SYSTEM = (
    "You are Kosh Copilot, an AI revenue-operations assistant for an Indian Razorpay "
    "merchant (Artisan Coffee Co.). Be concise, warm, and action-oriented. Use the tools "
    "to fetch data or take actions rather than guessing. When the user asks to pay, remind, "
    "or collect, resolve the invoice id (format INV-1020) — you may call get_overview or "
    "list_top_debtors first to find it. Amounts are in INR."
)


def chat(messages: list[dict[str, str]]) -> dict[str, Any]:
    """messages: [{role, content}]. Returns {reply, actions}."""
    if not settings.llm_enabled:
        last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        reply, actions = offline_route(last)
        return {"reply": reply, "actions": actions, "engine": "offline"}

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        convo = [{"role": m["role"], "content": m["content"]} for m in messages]
        actions: list = []

        for _ in range(4):  # bounded tool loop
            resp = client.messages.create(
                model=settings.model, max_tokens=700, system=_SYSTEM,
                tools=_TOOLS, messages=convo,
            )
            if resp.stop_reason == "tool_use":
                convo.append({"role": "assistant", "content": resp.content})
                results = []
                for block in resp.content:
                    if block.type == "tool_use":
                        text, acts = _DISPATCH[block.name](block.input or {})
                        actions.extend(acts)
                        results.append({"type": "tool_result", "tool_use_id": block.id, "content": text})
                convo.append({"role": "user", "content": results})
                continue
            reply = "".join(b.text for b in resp.content if b.type == "text").strip()
            return {"reply": reply, "actions": actions, "engine": "claude"}
        return {"reply": "Let me know if you'd like anything else.", "actions": actions, "engine": "claude"}
    except Exception:
        last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        reply, actions = offline_route(last)
        return {"reply": reply, "actions": actions, "engine": "offline"}
