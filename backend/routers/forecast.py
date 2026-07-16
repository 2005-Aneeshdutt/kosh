"""Cashflow forecast endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from backend.agents.store import store
from backend.models.schemas import ForecastAlert, ForecastDay, ForecastResponse

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/cashflow", response_model=ForecastResponse)
def cashflow() -> ForecastResponse:
    snap = store.snapshot()
    days = [ForecastDay(**d) for d in snap.get("cashflow_forecast", [])]
    alerts = [ForecastAlert(**a) for a in snap.get("cashflow_alerts", [])]
    return ForecastResponse(days=days, alerts=alerts)
