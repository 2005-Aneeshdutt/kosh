"""Strategist — an AI advisor that turns the merchant's live state into
prioritised, actionable decisions (chase this, offer that, hold cash here).

Deterministic analysis builds the candidate moves from real data; an optional
LLM writes the executive narrative. Each recommendation carries an action the
UI can execute, so strategy connects straight to doing.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.agents.oracle_agent import forecast as compute_forecast
from backend.services import debtor_scorer, llm
from backend.services.live_data import live


def _rupees(paisa: int) -> str:
    return f"₹{paisa / 100:,.0f}"


def _recommendations() -> list[dict[str, Any]]:
    invoices = live.get_invoices()
    debtor_scorer.score_all(invoices)
    opens = [i for i in invoices if i["status"] in {"overdue", "partially_paid"}]
    opens.sort(key=lambda i: i.get("risk_score", 0) * i["amount"], reverse=True)
    settlements = live.get_settlements()

    recs: list[dict[str, Any]] = []

    # 1. Biggest risk-weighted receivable → chase now.
    if opens:
        top = opens[0]
        recs.append({
            "priority": "high",
            "title": f"Chase {top['customer_name']} — {_rupees(top['amount'])}",
            "rationale": f"{top['id']} is {top['days_overdue']}d overdue with the highest "
                         f"risk-weighted exposure ({top.get('risk_score',0):.2f}). Recovering it "
                         f"materially de-risks this week's cash.",
            "action": {"type": "open_checkout", "url": f"/pay/{top['id']}", "label": f"Pay link · {top['id']}"},
        })

    # 2. Chronic / high-risk account → offer an early-payment discount.
    high = [i for i in opens if i.get("risk_score", 0) >= 0.5]
    if high:
        h = high[0]
        recs.append({
            "priority": "medium",
            "title": f"Offer 2% early-settlement to {h['customer_name']}",
            "rationale": f"{h['id']} is high-risk ({h.get('risk_score',0):.2f}); a small discount "
                         f"now likely beats a write-off later. Needs your approval in Autopilot.",
            "action": {"type": "navigate", "to": "/autopilot", "label": "Review in Autopilot"},
        })

    # 3. Cashflow position → hold or deploy.
    days, alerts = compute_forecast(settlements, invoices)
    future = [d for d in days if not d.get("is_history")]
    net_7d = sum(d["net_position"] for d in future)
    if any(d["net_position"] < 0 for d in future):
        recs.append({
            "priority": "high",
            "title": "Protect this week's cash position",
            "rationale": "Oracle projects a shortfall day in the next 7. Prioritise the two "
                         "largest overdue collections before committing to discretionary spend.",
            "action": {"type": "navigate", "to": "/forecast", "label": "See forecast"},
        })
    else:
        recs.append({
            "priority": "low",
            "title": f"Cash is healthy — 7-day net {_rupees(int(net_7d))}",
            "rationale": "No projected shortfall. A good week to clear the highest-risk "
                         "receivables while liquidity is comfortable.",
            "action": {"type": "navigate", "to": "/collections", "label": "Open Collections"},
        })

    # 4. Always: put collections on autopilot.
    recs.append({
        "priority": "medium",
        "title": "Engage Autopilot for routine chasing",
        "rationale": "Let the agents auto-send low-risk reminders within policy and route only "
                     "discounts and direct collections to you. Frees ~4 hrs/month.",
        "action": {"type": "navigate", "to": "/autopilot", "label": "Engage Autopilot"},
    })
    return recs


def brief() -> dict[str, Any]:
    recs = _recommendations()
    invoices = live.get_invoices()
    opens = [i for i in invoices if i["status"] in {"overdue", "pending", "partially_paid"}]
    outstanding = sum(i["amount"] for i in opens)
    overdue = len([i for i in opens if i["status"] == "overdue"])

    prompt = (
        "You are the chief strategy advisor for an Indian D2C merchant on Razorpay. In 2 crisp "
        "sentences, give the CEO a strategic read of this week and the single most important move.\n"
        f"Outstanding receivables: {_rupees(outstanding)} across {len(opens)} invoices "
        f"({overdue} overdue).\n"
        "Top recommendations:\n" + "\n".join(f"- {r['title']}" for r in recs[:3]) +
        "\nReturn only the 2 sentences."
    )

    def _fallback() -> str:
        return (
            f"You have {_rupees(outstanding)} outstanding across {len(opens)} invoices, with "
            f"{overdue} overdue and concentrated risk in a few large accounts. The highest-leverage "
            f"move this week is to chase the top risk-weighted receivable now and put routine "
            f"reminders on Autopilot."
        )

    headline, used_llm = llm.generate(prompt, max_tokens=180, fallback=_fallback)
    return {
        "headline": headline,
        "recommendations": recs,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "llm_authored": used_llm,
    }
