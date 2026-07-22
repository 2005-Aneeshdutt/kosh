"""Agent Studio — inspect and configure the Kosh agent crew.

Holds the crew's configuration (model, tools, system prompt per agent), the
LangGraph topology for the diagram, and runtime enable flags the orchestrator
respects. Disabling an agent makes its node no-op on the next run; the run still
completes, so nothing can break mid-demo.
"""
from __future__ import annotations

from typing import Any

from backend.config import settings

# Runtime enable flags (reset on restart).
_ENABLED: dict[str, bool] = {"pulse": True, "oracle": True, "collect": True, "recon": True}

# Static per-agent definitions (what each agent is and does).
_AGENTS = [
    {
        "key": "collect", "name": "Collect", "node": "collect", "color": "#3395FF",
        "description": "Smart accounts-receivable collection.",
        "tools": ["score_debtor", "create_payment_link", "draft_reminder", "send_email"],
        "system": "You are a polite but effective collections assistant for an Indian "
                  "business. Score each overdue invoice on likelihood-to-pay, prioritise the "
                  "riskiest, and write a short reminder whose tone escalates with prior nudges.",
    },
    {
        "key": "recon", "name": "Recon", "node": "recon", "color": "#10B981",
        "description": "Settlement reconciliation.",
        "tools": ["parse_statement", "extract_utr", "match_settlements", "summarize_recon"],
        "system": "You reconcile a merchant's bank statement against Razorpay settlements by "
                  "UTR (exact then fuzzy) within an amount tolerance, and explain the gaps in "
                  "plain English.",
    },
    {
        "key": "oracle", "name": "Oracle", "node": "oracle", "color": "#8B5CF6",
        "description": "Cashflow forecasting.",
        "tools": ["aggregate_history", "weight_receivables", "forecast_cashflow", "raise_alert"],
        "system": "You forecast 7-day cashflow from settlement history and due receivables "
                  "weighted by pay-likelihood, and raise early-warning alerts on shortfalls.",
    },
    {
        "key": "pulse", "name": "Pulse", "node": "pulse", "color": "#F59E0B",
        "description": "Payment health monitoring.",
        "tools": ["compute_metrics", "detect_anomaly_zscore", "breakdown_failures", "generate_insights"],
        "system": "You monitor live payment success rates, detect anomalies via z-score, and "
                  "surface specific, actionable insights with likely causes.",
    },
]

# LangGraph topology (for the diagram).
_GRAPH = {
    "nodes": [
        {"id": "fetch_data", "label": "Fetch data", "kind": "system"},
        {"id": "pulse", "label": "Pulse", "kind": "agent"},
        {"id": "oracle", "label": "Oracle", "kind": "agent"},
        {"id": "collect", "label": "Collect", "kind": "agent"},
        {"id": "recon", "label": "Recon", "kind": "agent"},
        {"id": "summarize", "label": "Summary", "kind": "system"},
    ],
    "edges": [
        ["fetch_data", "pulse"], ["fetch_data", "oracle"], ["fetch_data", "collect"],
        ["pulse", "recon"], ["oracle", "recon"], ["collect", "recon"],
        ["recon", "summarize"],
    ],
}


def enabled(key: str) -> bool:
    return _ENABLED.get(key, True)


def set_enabled(key: str, value: bool) -> None:
    if key in _ENABLED:
        _ENABLED[key] = bool(value)


def config() -> dict[str, Any]:
    agents = [{**a, "enabled": _ENABLED.get(a["key"], True)} for a in _AGENTS]
    return {
        "provider": settings.llm_provider,
        "model": settings.active_model,
        "orchestrator": "LangGraph StateGraph over a shared MerchantState",
        "agents": agents,
        "graph": _GRAPH,
    }
