"""Impact analytics and the Strategist advisor."""
from __future__ import annotations

from fastapi import APIRouter

from backend.services import impact, strategist

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/impact")
def impact_metrics() -> dict:
    return impact.compute()


@router.get("/strategist/brief")
def strategist_brief() -> dict:
    return strategist.brief()
