"""In-process pub/sub so the SSE endpoint can stream live agent events.

A single EventBus fans out AgentEvent dicts to any number of subscribers
(each an asyncio.Queue). Agents call ``emit`` inside their nodes; the FastAPI
SSE endpoint subscribes and forwards to the browser.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

from backend.agents.state import AgentEvent, MerchantState
from backend.models import database


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        # Ring buffer of recent events so a late-connecting client can catch up.
        self._recent: list[AgentEvent] = []

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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
    }


def emit(
    state: MerchantState,
    agent_name: str,
    event_type: str,
    message: str,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Record an event to the shared state, the live bus, and the DB log."""
    event = make_event(agent_name, event_type, message, metadata)
    state.setdefault("agent_events", []).append(event)
    bus.publish(event)
    try:
        database.record_event(
            agent_name, event_type, message, metadata, run_id=state.get("run_id")
        )
    except Exception:  # pragma: no cover - logging must never break a run
        pass
