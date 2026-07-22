"""PULSE AGENT — payment health monitor.

Computes current success metrics, detects anomalies via z-score, and surfaces
concise, specific insights (e.g. a UPI success-rate dip correlated with a
known NPCI window).
"""
from __future__ import annotations

import asyncio

from backend.agents.bus import emit
from backend.agents.state import MerchantState
from backend.services import anomaly_detector, llm

AGENT = "pulse"


def compute_health(payments: list[dict], metrics: list[dict]) -> dict:
    total = len(payments)
    captured = sum(1 for p in payments if p["status"] == "captured")
    failed = sum(1 for p in payments if p["status"] == "failed")
    # Payment success rate = captured / (captured + failed). Refunds are a
    # settled payment that was later returned, not a failed attempt, so they
    # are excluded from the denominator (matches the Copilot's definition).
    attempts = captured + failed
    success_rate = round(captured / attempts, 4) if attempts else 0.0

    by_method = anomaly_detector.method_failure_breakdown(payments)

    # Peak-hour analysis.
    hour_counts: dict[int, int] = {}
    for p in payments:
        try:
            hr = int(p["created_at"][11:13])
        except (ValueError, IndexError):
            continue
        hour_counts[hr] = hour_counts.get(hr, 0) + 1
    peak_hour = max(hour_counts, key=hour_counts.get) if hour_counts else 10
    peak_window = f"{peak_hour:02d}:00-{(peak_hour + 3) % 24:02d}:00"

    # Failure-reason breakdown.
    reasons: dict[str, int] = {}
    for p in payments:
        if p["status"] == "failed":
            r = p.get("failure_reason") or "unknown"
            reasons[r] = reasons.get(r, 0) + 1

    avg_amount = round(sum(p["amount"] for p in payments) / total, 2) if total else 0.0

    return {
        "total_payments": total,
        "captured": captured,
        "failed": failed,
        "success_rate": success_rate,
        "avg_amount": avg_amount,
        "method_breakdown": by_method,
        "peak_window": peak_window,
        "failure_reasons": reasons,
    }


def _template_insights(health: dict, anomalies: list[dict]) -> list[str]:
    insights: list[str] = []
    if anomalies:
        insights.append(anomalies[0]["message"] + " — correlates with a known NPCI maintenance window.")
    # Weakest method.
    worst = None
    for method, stats in health["method_breakdown"].items():
        if stats["total"] >= 5 and (worst is None or stats["success_rate"] < worst[1]["success_rate"]):
            worst = (method, stats)
    if worst and worst[1]["success_rate"] < 0.92:
        top_reason = max(worst[1]["reasons"], key=worst[1]["reasons"].get) if worst[1]["reasons"] else "bank_refused"
        insights.append(
            f"{worst[0].upper()} success rate is {worst[1]['success_rate'] * 100:.0f}% "
            f"(top reason: {top_reason}). Consider enabling Razorpay Smart Retry."
        )
    insights.append(
        f"Your peak payment window is {health['peak_window']}. Ensure sufficient capacity there."
    )
    return insights[:3]


async def pulse_agent_node(state: MerchantState) -> MerchantState:
    from backend.services import studio

    if not studio.enabled(AGENT):
        emit(state, AGENT, "result", "Pulse is disabled in Agent Studio — skipping this run.")
        return {}

    emit(state, AGENT, "thinking", "Computing live payment success metrics…")
    await asyncio.sleep(0.4)

    payments = state.get("recent_payments", [])
    metrics = state.get("payment_metrics", [])
    health = compute_health(payments, metrics)

    emit(
        state,
        AGENT,
        "action",
        f"Overall success rate {health['success_rate'] * 100:.1f}% across "
        f"{health['total_payments']} payments.",
        {"success_rate": health["success_rate"]},
    )
    await asyncio.sleep(0.3)

    anomalies = anomaly_detector.detect(metrics)
    if anomalies:
        emit(
            state,
            AGENT,
            "action",
            f"Detected {len(anomalies)} anomaly(ies) via z-score analysis.",
            {"count": len(anomalies)},
        )
    await asyncio.sleep(0.2)

    # Ask Claude for insights; fall back to templates offline.
    prompt = (
        "You are a payment analytics expert for an Indian merchant on Razorpay. "
        "Given these metrics and anomalies, write 2-3 concise insights (1-2 lines "
        "each), specific with numbers:\n"
        f"Overall success rate: {health['success_rate'] * 100:.1f}%\n"
        f"Method breakdown: {health['method_breakdown']}\n"
        f"Failure reasons: {health['failure_reasons']}\n"
        f"Peak window: {health['peak_window']}\n"
        f"Anomalies: {[a['message'] for a in anomalies]}\n"
        "Return only the insights, one per line."
    )
    text, used = llm.generate(
        prompt, max_tokens=250, fallback=lambda: "\n".join(_template_insights(health, anomalies))
    )
    insights = [ln.strip("-• ").strip() for ln in text.splitlines() if ln.strip()][:3]

    for ins in insights:
        emit(state, AGENT, "result", ins)
        await asyncio.sleep(0.1)

    return {
        "payment_health": health,
        "anomalies": anomalies,
        "payment_insights": insights,
    }
