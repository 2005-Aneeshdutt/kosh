"""Autopilot endpoints: scheduler control, proposals, approvals, policy."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import audit, autopilot as ap

router = APIRouter(prefix="/api/autopilot", tags=["autopilot"])


@router.get("/status")
def status() -> dict:
    return ap.autopilot.status()


@router.post("/start")
async def start() -> dict:
    ap.autopilot.start()
    return ap.autopilot.status()


@router.post("/stop")
async def stop() -> dict:
    ap.autopilot.stop()
    return ap.autopilot.status()


@router.post("/scan")
def scan() -> dict:
    result = ap.scan()
    if result.get("auto_executed"):
        audit.agent(
            "Autopilot", "proposal.auto_executed",
            detail=f"{result['auto_executed']} reminders sent within policy · {result.get('pending', 0)} queued for approval",
        )
    return result


@router.get("/proposals")
def proposals(status: str | None = None) -> dict:
    return {"proposals": ap.list_proposals(status)}


@router.post("/proposals/{proposal_id}/approve")
def approve(proposal_id: str) -> dict:
    p = ap.approve(proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found or already handled")
    audit.human(
        "You", "proposal.approved",
        target=p.get("invoice_id"), amount=p.get("amount"),
        detail=f"Approved reminder to {p.get('customer_name')} ({p.get('risk_band')} risk)",
    )
    return p


@router.post("/proposals/{proposal_id}/reject")
def reject(proposal_id: str) -> dict:
    p = ap.reject(proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found or already handled")
    audit.human(
        "You", "proposal.rejected",
        target=p.get("invoice_id"), amount=p.get("amount"),
        detail=f"Rejected reminder to {p.get('customer_name')}",
    )
    return p


class PolicyUpdate(BaseModel):
    auto_max_amount: int | None = None
    auto_max_risk: float | None = None


@router.post("/policy")
def policy(update: PolicyUpdate) -> dict:
    return ap.set_policy(update.auto_max_amount, update.auto_max_risk)
