"""In-process pub/sub for real-time streaming to the browser.

Two channels share one bus:

* **agent events** — the AI crew's thinking/action/result log (the activity feed).
* **live events**  — business events the whole UI reacts to in real time:
  new payments, invoices paid, emails sent, metric ticks, agent status.

Agents call :func:`emit`; the payment/mail/simulator layers call
:func:`publish_live`. FastAPI SSE endpoints subscribe to either channel.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

from backend.agents.state import AgentEvent, MerchantState
from backend.models import database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventBus:
    def __init__(self) -> None:
        # Agent activity channel.
        self._subscribers: set[asyncio.Queue] = set()
        self._recent: list[AgentEvent] = []
        # Live business-event channel.
        self._live_subscribers: set[asyncio.Queue] = set()
        self._recent_live: list[dict[str, Any]] = []

    # ── Agent activity channel ──────────────────────────────
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def recent(self, limit: int = 50) -> list[AgentEvent]:
        return self._recent[-limit:]

    def publish(self, event: AgentEvent) -> None:
        self._recent.append(event)
        if len(self._recent) > 200:
            self._recent = self._recent[-200:]
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover
                pass

    # ── Live business-event channel ─────────────────────────
    def subscribe_live(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._live_subscribers.add(q)
        return q

    def unsubscribe_live(self, q: asyncio.Queue) -> None:
        self._live_subscribers.discard(q)

    def recent_live(self, limit: int = 30) -> list[dict[str, Any]]:
        return self._recent_live[-limit:]

    def publish_live(self, kind: str, payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """Broadcast a typed live event, e.g. kind='payment' | 'invoice_paid' |
        'email' | 'metrics' | 'agent_status'. Returns the envelope."""
        event = {"kind": kind, "ts": _now(), "data": payload or {}}
        self._recent_live.append(event)
        if len(self._recent_live) > 200:
            self._recent_live = self._recent_live[-200:]
        for q in list(self._live_subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover
                pass
        return event


bus = EventBus()


def make_event(
    agent_name: str,
    event_type: str,
    message: str,
    metadata: Optional[dict[str, Any]] = None,
) -> AgentEvent:
    return {
        "agent_name": agent_name,
        "event_type": event_type,
        "message": message,
        "timestamp": _now(),
        "metadata": metadata,
    }


def emit(
    state: MerchantState,
    agent_name: str,
    event_type: str,
    message: str,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Record an agent event to shared state, the live bus, and the DB log."""
    event = make_event(agent_name, event_type, message, metadata)
    state.setdefault("agent_events", []).append(event)
    bus.publish(event)
    try:
        database.record_event(
            agent_name, event_type, message, metadata, run_id=state.get("run_id")
        )
    except Exception:  # pragma: no cover - logging must never break a run
        pass
