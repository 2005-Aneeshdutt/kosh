"""Dashboard read endpoints."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.agents.store import store
from backend.models.schemas import (
    ARAgingBucket,
    ARAgingResponse,
    DashboardMetrics,
    MetricCard,
    PaymentRow,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _sparkline_from_metrics(metrics: list[dict], key: str) -> list[float]:
    return [round(m.get(key, 0), 2) for m in metrics][-7:]


@router.get("/metrics", response_model=DashboardMetrics)
def metrics() -> DashboardMetrics:
    snap = store.snapshot()
    payments = snap["recent_payments"]
    invoices = snap["invoices"]
    metrics_series = snap["payment_metrics"]
    forecast = snap["cashflow_forecast"]
    health = snap["payment_health"]

    total_revenue = sum(p["amount"] for p in payments if p["status"] == "captured")
    outstanding = sum(
        i["amount"] for i in invoices if i["status"] in {"overdue", "pending", "partially_paid"}
    )
    success_rate = health["success_rate"] * 100
    future = [d for d in forecast if not d.get("is_history")]
    projected = sum(d["net_position"] for d in future)

    revenue_spark = [
        round(m["avg_amount"] * m["total_payments"] / 100, 2) for m in metrics_series
    ][-7:]
    success_spark = [round(m["success_rate"] * 100, 1) for m in metrics_series][-7:]

    cards = [
        MetricCard(
            key="revenue",
            label="Total Revenue (30d)",
            value=total_revenue,
            display=f"₹{total_revenue / 100:,.0f}",
            trend_pct=8.4,
            trend_direction="up",
            sparkline=revenue_spark or [0],
        ),
        MetricCard(
            key="success_rate",
            label="Payment Success Rate",
            value=success_rate,
            display=f"{success_rate:.1f}%",
            trend_pct=-1.2 if success_rate < 94 else 0.6,
            trend_direction="down" if success_rate < 94 else "up",
            sparkline=success_spark or [0],
        ),
        MetricCard(
            key="outstanding",
            label="Outstanding Receivables",
            value=outstanding,
            display=f"₹{outstanding / 100:,.0f}",
            trend_pct=3.1,
            trend_direction="down",
            sparkline=[round(outstanding / 100 * f, 0) for f in (1.1, 1.08, 1.05, 1.03, 1.0)],
        ),
        MetricCard(
            key="forecast",
            label="7-Day Net Forecast",
            value=projected,
            display=f"₹{projected / 100:,.0f}",
            trend_pct=5.0,
            trend_direction="up" if projected >= 0 else "down",
            sparkline=[round(d["net_position"] / 100, 0) for d in future] or [0],
        ),
    ]

    return DashboardMetrics(
        merchant_name=snap["merchant_name"],
        generated_at=datetime.now(timezone.utc).isoformat(),
        cards=cards,
    )


@router.get("/ar-aging", response_model=ARAgingResponse)
def ar_aging() -> ARAgingResponse:
    snap = store.snapshot()
    invoices = [
        i for i in snap["invoices"]
        if i["status"] in {"overdue", "pending", "partially_paid"}
    ]
    buckets = {"0-30": [0, 0], "30-60": [0, 0], "60-90": [0, 0], "90+": [0, 0]}
    for inv in invoices:
        d = inv["days_overdue"]
        if d <= 30:
            key = "0-30"
        elif d <= 60:
            key = "30-60"
        elif d <= 90:
            key = "60-90"
        else:
            key = "90+"
        buckets[key][0] += inv["amount"]
        buckets[key][1] += 1

    result = [
        ARAgingBucket(bucket=k, amount=v[0], count=v[1]) for k, v in buckets.items()
    ]
    return ARAgingResponse(
        buckets=result, total_outstanding=sum(b.amount for b in result)
    )


@router.get("/payments", response_model=list[PaymentRow])
def payments(limit: int = 15) -> list[PaymentRow]:
    snap = store.snapshot()
    rows = snap["recent_payments"][:limit]
    return [PaymentRow(**r) for r in rows]
