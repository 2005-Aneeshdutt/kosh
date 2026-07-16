"""LangGraph orchestrator wiring the four Kosh agents over shared state.

Graph shape:

        START
          │
       fetch_data          ← pulls latest data from Razorpay (or mock)
          │
    ┌─────┼─────┐          ← parallel fan-out
  pulse  oracle collect
    └─────┼─────┘
        recon              ← fan-in; internally no-ops without a bank statement
          │
       summary             ← Claude-authored run summary
          │
         END
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from langgraph.graph import END, START, StateGraph

from backend.agents.bus import emit
from backend.agents.collect_agent import collect_agent_node
from backend.agents.oracle_agent import oracle_agent_node
from backend.agents.pulse_agent import pulse_agent_node
from backend.agents.recon_agent import recon_agent_node
from backend.agents.state import MerchantState
from backend.models import database
from backend.razorpay_client.client import get_client
from backend.services import llm

ORCH = "orchestrator"


async def fetch_data(state: MerchantState) -> MerchantState:
    emit(state, ORCH, "action", "Connecting to Razorpay and pulling latest merchant data…")
    client = get_client()
    conn = client.test_connection()
    update: MerchantState = {
        "merchant_id": client.merchant_id,
        "merchant_name": client.merchant_name,
        "razorpay_connected": conn.get("connected", False),
        "invoices": client.fetch_invoices(),
        "settlements": client.fetch_settlements(),
        "recent_payments": client.fetch_payments(),
        "payment_metrics": client.fetch_payment_metrics(),
    }
    emit(
        state,
        ORCH,
        "result",
        f"Loaded {len(update['recent_payments'])} payments, "
        f"{len(update['settlements'])} settlements, {len(update['invoices'])} invoices.",
    )
    return update


async def generate_summary(state: MerchantState) -> MerchantState:
    actions = len(state.get("collection_actions", []))
    anomalies = len(state.get("anomalies", []))
    recon = state.get("reconciliation_result") or {}
    forecast = state.get("cashflow_forecast", [])
    future = [d for d in forecast if not d.get("is_history")]
    net_7d = sum(d["net_position"] for d in future)

    prompt = (
        "Write a single upbeat sentence summarising this Kosh agent run for a merchant "
        "dashboard toast. Be specific:\n"
        f"- Collect: {actions} reminders + payment links sent\n"
        f"- Pulse: {anomalies} payment anomalies flagged\n"
        f"- Recon: {'ran' if recon.get('ran') else 'skipped (no statement)'}\n"
        f"- Oracle: 7-day net position ₹{net_7d / 100:,.0f}\n"
        "Return only the sentence."
    )
    summary, _ = llm.generate(
        prompt,
        max_tokens=120,
        fallback=lambda: (
            f"All agents completed — {actions} collections actions taken, "
            f"{anomalies} anomalies flagged, 7-day net position ₹{net_7d / 100:,.0f}."
        ),
    )
    emit(state, ORCH, "result", summary, {"final": True})
    return {"summary": summary, "last_run": datetime.now(timezone.utc).isoformat()}


def build_graph():
    graph = StateGraph(MerchantState)
    graph.add_node("fetch_data", fetch_data)
    graph.add_node("pulse", pulse_agent_node)
    graph.add_node("oracle", oracle_agent_node)
    graph.add_node("collect", collect_agent_node)
    graph.add_node("recon", recon_agent_node)
    graph.add_node("summarize", generate_summary)

    graph.add_edge(START, "fetch_data")
    # Parallel fan-out.
    graph.add_edge("fetch_data", "pulse")
    graph.add_edge("fetch_data", "oracle")
    graph.add_edge("fetch_data", "collect")
    # Fan-in to recon (waits for all three).
    graph.add_edge("pulse", "recon")
    graph.add_edge("oracle", "recon")
    graph.add_edge("collect", "recon")
    graph.add_edge("recon", "summarize")
    graph.add_edge("summarize", END)

    return graph.compile()


_compiled = None


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
    return _compiled


async def run_pipeline(bank_entries: list | None = None) -> MerchantState:
    """Execute the full agent crew once and return the final state."""
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    database.create_run(run_id)

    initial: MerchantState = {
        "run_id": run_id,
        "agent_events": [],
        "bank_entries": bank_entries or [],
        "errors": [],
    }
    emit(initial, ORCH, "action", "🚀 Kosh crew activated — 4 agents starting.", {"run_id": run_id})

    try:
        final = await get_graph().ainvoke(initial)
        database.finish_run(run_id, "completed", final.get("summary", ""))
        return final
    except Exception as exc:  # pragma: no cover - defensive
        emit(initial, ORCH, "error", f"Run failed: {exc}")
        database.finish_run(run_id, "error", str(exc))
        raise
