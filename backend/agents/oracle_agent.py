"""ORACLE AGENT — 7-day cashflow forecasting.

Learns daily inflow patterns from recent settlements, adjusts for receivables
coming due (weighted by payment likelihood), estimates operational outflow, and
raises actionable alerts on projected shortfalls.
"""
from __future__ import annotations

import asyncio
import statistics
from datetime import datetime, timedelta, timezone

from backend.agents.bus import emit
from backend.agents.state import MerchantState
from backend.services import debtor_scorer, llm

AGENT = "oracle"

# Industry-average daily operational spend as a fraction of daily inflow.
_OUTFLOW_RATIO = 0.30


def _rupees(amount: float) -> str:
    return f"₹{amount / 100:,.0f}"


def _history_daily_inflow(settlements: list[dict]) -> tuple[list[dict], float]:
    """Return per-day inflow history (last ~14 days) and the daily average."""
    by_day: dict[str, float] = {}
    for s in settlements:
        day = s["created_at"][:10]
        by_day[day] = by_day.get(day, 0.0) + s["amount"]
    days = sorted(by_day)[-14:]
    history = [{"date": d, "inflow": by_day[d]} for d in days]
    avg = statistics.mean([h["inflow"] for h in history]) if history else 0.0
    return history, avg


def forecast(settlements: list[dict], invoices: list[dict]) -> tuple[list[dict], list[dict]]:
    now = datetime(2026, 7, 16, tzinfo=timezone.utc)
    history, daily_avg = _history_daily_inflow(settlements)

    # Receivables coming due in the next 7 days, weighted by pay-likelihood.
    debtor_scorer.score_all(invoices)
    due_by_day: dict[str, float] = {}
    for inv in invoices:
        if inv.get("status") not in {"overdue", "pending", "partially_paid"}:
            continue
        due = datetime.fromisoformat(inv["due_date"])
        prob = 1.0 - inv.get("risk_score", 0.5)
        # Overdue invoices are assumed to land in the next couple of days if chased.
        offset = 1 if inv["status"] == "overdue" else max(0, (due - now).days)
        if 0 <= offset <= 6:
            key = (now + timedelta(days=offset)).strftime("%Y-%m-%d")
            due_by_day[key] = due_by_day.get(key, 0.0) + inv["amount"] * prob

    days: list[dict] = []
    # Include the last 14 days of history for the chart.
    for h in history:
        outflow = h["inflow"] * _OUTFLOW_RATIO
        days.append(
            {
                "date": h["date"],
                "predicted_inflow": round(h["inflow"], 2),
                "predicted_outflow": round(outflow, 2),
                "net_position": round(h["inflow"] - outflow, 2),
                "confidence": 1.0,
                "is_history": True,
            }
        )

    # Weekday multipliers (Mon-heavy, weekend-light) for a bit of realism.
    weekday_factor = {0: 1.15, 1: 1.1, 2: 1.05, 3: 1.0, 4: 1.1, 5: 0.7, 6: 0.55}

    for offset in range(1, 8):
        d = now + timedelta(days=offset)
        base = daily_avg * weekday_factor.get(d.weekday(), 1.0)
        expected_due = due_by_day.get(d.strftime("%Y-%m-%d"), 0.0)
        inflow = base + expected_due
        outflow = daily_avg * _OUTFLOW_RATIO
        confidence = max(0.5, 1.0 - offset * 0.07)
        days.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "predicted_inflow": round(inflow, 2),
                "predicted_outflow": round(outflow, 2),
                "net_position": round(inflow - outflow, 2),
                "confidence": round(confidence, 2),
                "is_history": False,
            }
        )

    alerts = _build_alerts(days, invoices, daily_avg)
    return days, alerts


def _build_alerts(days: list[dict], invoices: list[dict], daily_avg: float) -> list[dict]:
    future = [d for d in days if not d["is_history"]]
    alerts: list[dict] = []

    for d in future:
        if d["net_position"] < 0:
            alerts.append(
                {
                    "severity": "critical",
                    "message": (
                        f"{_weekday(d['date'])} may run a "
                        f"{_rupees(abs(d['net_position']))} shortfall."
                    ),
                }
            )
        elif d["predicted_inflow"] < daily_avg * 0.7:
            alerts.append(
                {
                    "severity": "warning",
                    "message": (
                        f"{_weekday(d['date'])} inflow "
                        f"({_rupees(d['predicted_inflow'])}) is well below the daily average."
                    ),
                }
            )

    # Large overdue receivable worth chasing this week.
    big_overdue = [
        i for i in invoices
        if i.get("status") == "overdue" and i.get("amount", 0) >= 10_000_000
    ]
    big_overdue.sort(key=lambda i: i["amount"], reverse=True)
    if big_overdue:
        inv = big_overdue[0]
        alerts.append(
            {
                "severity": "warning",
                "message": (
                    f"Chase {inv['id']} ({_rupees(inv['amount'])} from "
                    f"{inv['customer_name']}, {inv['days_overdue']} days overdue) "
                    "to shore up this week's position."
                ),
            }
        )
    return alerts[:4]


def _weekday(date_str: str) -> str:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except ValueError:
        return date_str


async def oracle_agent_node(state: MerchantState) -> MerchantState:
    from backend.services import studio

    if not studio.enabled(AGENT):
        emit(state, AGENT, "result", "Oracle is disabled in Agent Studio — skipping this run.")
        return {}

    emit(state, AGENT, "thinking", "Learning daily inflow patterns from settlement history…")
    await asyncio.sleep(0.5)

    settlements = state.get("settlements", [])
    invoices = state.get("invoices", [])
    days, alerts = forecast(settlements, invoices)

    future = [d for d in days if not d["is_history"]]
    net_7d = sum(d["net_position"] for d in future)
    emit(
        state,
        AGENT,
        "action",
        f"Projected 7-day net position: {_rupees(net_7d)} across {len(future)} days.",
        {"net_7d": net_7d},
    )
    await asyncio.sleep(0.3)

    # Let Claude phrase the headline alert if there is a shortfall.
    if alerts:
        prompt = (
            "You are a financial advisor for a small Indian coffee business. Turn these "
            "raw cashflow signals into 1-2 concise, actionable alerts (max 2 lines each):\n"
            + "\n".join(f"- {a['message']}" for a in alerts)
            + "\nReturn only the alerts, one per line."
        )
        text, used = llm.generate(prompt, max_tokens=200, fallback="")
        if used and text:
            lines = [ln.strip("-• ").strip() for ln in text.splitlines() if ln.strip()]
            if lines:
                alerts = [
                    {"severity": alerts[i]["severity"] if i < len(alerts) else "warning", "message": ln}
                    for i, ln in enumerate(lines[:4])
                ]

    for a in alerts:
        emit(state, AGENT, "result", a["message"], {"severity": a["severity"]})
        await asyncio.sleep(0.1)

    if not alerts:
        emit(state, AGENT, "result", "Cashflow looks healthy across the next 7 days.")

    return {"cashflow_forecast": days, "cashflow_alerts": alerts}
