"""Autopilot — autonomous collections with a human-in-the-loop approval queue.

Instead of firing actions blindly, the agents *propose* them. A policy engine
decides which proposals are safe to auto-execute (low value, low risk) and which
must be **approved by a human** (large amounts, discounts, direct collection).
A background scheduler periodically scans for new proposals.

This is the production pattern for agentic AI: autonomy where it's safe,
guardrails where it matters, and a human in control of the rest.
"""
from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from backend.agents.bus import bus
from backend.services import debtor_scorer, llm
from backend.services.live_data import live

_lock = threading.RLock()
_PROPOSALS: list[dict[str, Any]] = []  # newest first

# Policy thresholds (tunable at runtime).
POLICY: dict[str, Any] = {
    # Reminders at/below this amount AND at/below this risk auto-execute.
    "auto_max_amount": 5_000_000,   # ₹50,000 in paisa
    "auto_max_risk": 0.45,
    # These action types ALWAYS need human approval.
    "always_approve": ["discount_offer", "collect"],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rupees(paisa: int) -> str:
    return f"₹{paisa / 100:,.0f}"


# ── Proposal generation ─────────────────────────────────────
def _recommend(inv: dict[str, Any]) -> tuple[str, str, float]:
    """Return (action_type, tone, confidence) for an open invoice."""
    days = inv.get("days_overdue", 0)
    risk = inv.get("risk_score", 0.0)
    if days >= 40 or risk >= 0.6:
        return "discount_offer", "urgent", round(min(0.95, 0.6 + risk / 3), 2)
    if days >= 20:
        return "escalate", "firm", round(0.7 + (1 - risk) * 0.2, 2)
    return "reminder", "friendly", round(0.75 + (1 - risk) * 0.2, 2)


def _rationale(inv: dict, action: str, tone: str) -> str:
    prompt = (
        "In one concise sentence, justify this collections action for an Indian "
        f"merchant. Invoice {inv['id']} · {inv['customer_name']} · "
        f"{_rupees(inv['amount'])} · {inv['days_overdue']} days overdue · risk "
        f"{inv.get('risk_score',0):.2f}. Recommended action: {action} ({tone}). "
        "Return only the sentence."
    )

    def _fallback() -> str:
        base = {
            "reminder": f"{inv['customer_name']} is {inv['days_overdue']}d overdue on "
                        f"{_rupees(inv['amount'])}; a {tone} nudge should land the payment.",
            "escalate": f"{inv['customer_name']} is {inv['days_overdue']}d overdue "
                        f"({_rupees(inv['amount'])}); escalate the tone before it ages further.",
            "discount_offer": f"High-risk account {inv['customer_name']} is "
                              f"{inv['days_overdue']}d overdue on {_rupees(inv['amount'])}; a "
                              f"small early-payment discount likely beats writing it off.",
        }
        return base.get(action, base["reminder"])

    text, _ = llm.generate(prompt, max_tokens=90, fallback=_fallback)
    return text


def _requires_approval(action: str, inv: dict) -> bool:
    if action in POLICY["always_approve"]:
        return True
    if inv["amount"] > POLICY["auto_max_amount"]:
        return True
    if inv.get("risk_score", 0.0) > POLICY["auto_max_risk"]:
        return True
    return False


def _has_active_proposal(invoice_id: str) -> bool:
    return any(p["invoice_id"] == invoice_id for p in _PROPOSALS)


def generate_proposals() -> list[dict[str, Any]]:
    """Scan open invoices and create proposals for those without one yet."""
    invoices = live.get_invoices()
    debtor_scorer.score_all(invoices)
    opens = [i for i in invoices if i["status"] in {"overdue", "partially_paid"}]
    opens.sort(key=lambda i: i.get("risk_score", 0), reverse=True)

    created: list[dict[str, Any]] = []
    with _lock:
        for inv in opens:
            if _has_active_proposal(inv["id"]):
                continue
            action, tone, confidence = _recommend(inv)
            proposal = {
                "id": f"prop_{uuid.uuid4().hex[:10]}",
                "type": action,
                "tone": tone,
                "invoice_id": inv["id"],
                "customer_name": inv["customer_name"],
                "customer_email": inv["customer_email"],
                "amount": inv["amount"],
                "days_overdue": inv["days_overdue"],
                "risk_score": inv.get("risk_score", 0.0),
                "risk_band": debtor_scorer.risk_band(inv.get("risk_score", 0.0)),
                "confidence": confidence,
                "rationale": _rationale(inv, action, tone),
                "requires_approval": _requires_approval(action, inv),
                "status": "pending",
                "created_at": _now(),
                "executed_at": None,
                "result": None,
            }
            _PROPOSALS.insert(0, proposal)
            created.append(proposal)

    for p in created:
        bus.publish_live("proposal", {k: v for k, v in p.items()})
    return created


# ── Execution ───────────────────────────────────────────────
def _execute(proposal: dict[str, Any], auto: bool) -> dict[str, Any]:
    from backend.agents.collect_agent import build_reminder, checkout_link, send_reminder_email

    inv = live.get_invoice(proposal["invoice_id"])
    if not inv:
        proposal["status"] = "failed"
        proposal["result"] = "Invoice no longer exists"
        return proposal

    ptype = proposal["type"]
    try:
        if ptype in {"reminder", "escalate", "discount_offer"}:
            pay_url = checkout_link(inv)
            message, tone, _ = build_reminder(inv, pay_url)
            if ptype == "discount_offer":
                message = (f"Special offer for {inv['customer_name']}: settle invoice "
                           f"{inv['id']} within 48 hours and get 2% off. "
                           f"Pay now: {pay_url}")
            email = send_reminder_email(
                inv, message, pay_url,
                actor="Autopilot" if auto else "You (via Autopilot)",
                actor_type="agent" if auto else "human",
            )
            proposal["result"] = (
                f"{'Discount offer' if ptype == 'discount_offer' else 'Reminder'} "
                f"{'emailed' if email['delivered'] else 'queued'} to {inv['customer_name']}"
            )
        elif ptype == "collect":
            from backend.services import payments

            res = payments.process_invoice_payment(inv["id"], "upi", {"vpa": "customer@okhdfc"})
            proposal["result"] = (
                f"Collected {_rupees(inv['amount'])}" if res["success"]
                else f"Collection failed: {res['failure_reason']}"
            )
    except Exception as exc:  # pragma: no cover - defensive
        proposal["status"] = "failed"
        proposal["result"] = str(exc)
        bus.publish_live("proposal_update", {"id": proposal["id"], "status": "failed"})
        return proposal

    proposal["status"] = "auto_executed" if auto else "approved"
    proposal["executed_at"] = _now()
    bus.publish_live("proposal_update", {"id": proposal["id"], "status": proposal["status"], "result": proposal["result"]})
    return proposal


def scan() -> dict[str, Any]:
    """Create new proposals and auto-execute the ones within policy."""
    created = generate_proposals()
    auto_done = 0
    for p in created:
        if not p["requires_approval"]:
            _execute(p, auto=True)
            auto_done += 1
    return {"created": len(created), "auto_executed": auto_done, "pending": len(list_proposals("pending"))}


def approve(proposal_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        p = next((x for x in _PROPOSALS if x["id"] == proposal_id), None)
        if not p or p["status"] != "pending":
            return None
    return _execute(p, auto=False)


def reject(proposal_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        p = next((x for x in _PROPOSALS if x["id"] == proposal_id), None)
        if not p or p["status"] != "pending":
            return None
        p["status"] = "rejected"
        p["executed_at"] = _now()
    bus.publish_live("proposal_update", {"id": proposal_id, "status": "rejected"})
    return p


def list_proposals(status: Optional[str] = None, limit: int = 100) -> list[dict[str, Any]]:
    with _lock:
        items = list(_PROPOSALS)
    if status:
        items = [p for p in items if p["status"] == status]
    return items[:limit]


def set_policy(auto_max_amount: Optional[int] = None, auto_max_risk: Optional[float] = None) -> dict:
    if auto_max_amount is not None:
        POLICY["auto_max_amount"] = int(auto_max_amount)
    if auto_max_risk is not None:
        POLICY["auto_max_risk"] = float(auto_max_risk)
    return dict(POLICY)


# ── Scheduler ───────────────────────────────────────────────
class Autopilot:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self.running = False
        self.interval = 20.0

    async def _loop(self) -> None:
        while self.running:
            try:
                scan()
            except Exception:  # pragma: no cover
                pass
            await asyncio.sleep(self.interval)

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self.running = False
        if self._task:
            self._task.cancel()
            self._task = None

    def status(self) -> dict[str, Any]:
        proposals = list_proposals()
        pending = [p for p in proposals if p["status"] == "pending"]
        executed = [p for p in proposals if p["status"] in {"auto_executed", "approved"}]
        return {
            "running": self.running,
            "pending": len(pending),
            "auto_executed": len([p for p in proposals if p["status"] == "auto_executed"]),
            "approved": len([p for p in proposals if p["status"] == "approved"]),
            "rejected": len([p for p in proposals if p["status"] == "rejected"]),
            "pending_value": sum(p["amount"] for p in pending),
            "managed_value": sum(p["amount"] for p in proposals),
            "policy": dict(POLICY),
        }


autopilot = Autopilot()
