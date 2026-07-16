"""Agent orchestration endpoints: trigger runs and stream live events (SSE)."""
from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from backend.agents import orchestrator
from backend.agents.bus import bus
from backend.agents.store import store
from backend.models.schemas import AgentStatus, RunAgentsResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])

_AGENT_LABELS = {
    "collect": "Collect",
    "recon": "Recon",
    "oracle": "Oracle",
    "pulse": "Pulse",
}

_running = False


async def _execute_run() -> None:
    global _running
    _running = True
    for k in store.status:
        store.status[k] = "active"
    try:
        final = await orchestrator.run_pipeline(bank_entries=store.bank_entries)
        store.set_run(final)
        for k in store.status:
            store.status[k] = "done"
    except Exception:  # pragma: no cover
        for k in store.status:
            store.status[k] = "error"
    finally:
        _running = False


@router.post("/run", response_model=RunAgentsResponse)
async def run_all() -> RunAgentsResponse:
    """Kick off the full crew in the background; events stream over /events."""
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    asyncio.create_task(_execute_run())
    return RunAgentsResponse(started=True, run_id=run_id)


@router.get("/status", response_model=list[AgentStatus])
def status() -> list[AgentStatus]:
    snap = store.latest
    result: list[AgentStatus] = []
    for name, label in _AGENT_LABELS.items():
        summary = None
        actions = 0
        if snap:
            if name == "collect":
                actions = len(snap.get("collection_actions", []))
                summary = f"{actions} reminders sent"
            elif name == "pulse":
                actions = len(snap.get("anomalies", []))
                summary = f"{actions} anomalies flagged"
            elif name == "oracle":
                summary = "7-day forecast ready"
            elif name == "recon":
                recon = snap.get("reconciliation_result") or {}
                summary = "Reconciled" if recon.get("ran") else "Awaiting statement"
        result.append(
            AgentStatus(
                name=name,
                label=label,
                status=store.status.get(name, "idle"),
                last_run=snap.get("last_run") if snap else None,
                summary=summary,
                actions_taken=actions,
            )
        )
    return result


@router.get("/events")
async def events():
    """Server-Sent Events stream of live agent activity."""

    async def event_generator():
        queue = bus.subscribe()
        try:
            # Replay a little recent history so late subscribers see context.
            for ev in bus.recent(20):
                yield {"event": "agent_event", "data": _json(ev)}
            while True:
                ev = await queue.get()
                yield {"event": "agent_event", "data": _json(ev)}
        finally:
            bus.unsubscribe(queue)

    return EventSourceResponse(event_generator())


def _json(ev: dict) -> str:
    import json

    return json.dumps(ev)
