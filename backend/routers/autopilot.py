"""Autopilot endpoints: scheduler control, proposals, approvals, policy."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import autopilot as ap

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
    return ap.scan()


@router.get("/proposals")
def proposals(status: str | None = None) -> dict:
    return {"proposals": ap.list_proposals(status)}


@router.post("/proposals/{proposal_id}/approve")
def approve(proposal_id: str) -> dict:
    p = ap.approve(proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found or already handled")
    return p


@router.post("/proposals/{proposal_id}/reject")
def reject(proposal_id: str) -> dict:
    p = ap.reject(proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found or already handled")
    return p


class PolicyUpdate(BaseModel):
    auto_max_amount: int | None = None
    auto_max_risk: float | None = None


@router.post("/policy")
def policy(update: PolicyUpdate) -> dict:
    return ap.set_policy(update.auto_max_amount, update.auto_max_risk)
